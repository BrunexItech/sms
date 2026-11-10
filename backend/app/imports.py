"""Import of scanned paper records: upload, suggest (optional reader), officer check, then a normal registration.

Nothing in the holding table is a registration. Importing goes through the same rules as a web registration
(duplicate IDs, valid places, club officials) and the person's record then follows normal verification.
"""
import difflib
import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import ocr_client, ocr_stats, scan_quality
from . import refdata as R
from . import settings as C
from .api import MEDIA_DIR, In, PlaceIn, RegisterIn, app_out, err, hist, log, need_user, new_app, now, place_or_422, sniff
from .db import get_db
from .models import Application, LegacyImport, Setting, User
from .rbac import STAFF_ROLES, can

router = APIRouter(prefix="/api/imports")

EMAIL_RE = re.compile(r"^\S+@\S+\.\S+$")
MAX_SCAN = 12 * 1024 * 1024
DOC_TYPES = ("player", "club")
LEVEL_DEFAULT = "Amateur"
# fields a record must have, read with enough confidence, before it is registered without an officer's check
REQUIRED = {"player": ["name", "id_no", "dob", "gender", "sport", "county", "sub_county", "ward"],
            "club": ["club_name", "name", "id_no", "phone", "sport", "county", "sub_county", "ward", "chair_name", "secretary_name", "treasurer_name"]}


def auto_rule(db: Session) -> dict:
    row = db.get(Setting, "import_rule")
    # retentionDays: scans of imported or set-aside records are deleted this many days later (0 keeps them)
    return {"auto": False, "minConfidence": 0.85, "retentionDays": 30, **(row.value if row else {}), "testDelete": C.ALLOW_IMPORT_TEST_DELETE}


def erase_files(r: LegacyImport) -> None:
    """Remove every image file of a paper record (the first page and any further pages)."""
    for path in [r.path, *((r.ocr or {}).get("pages") or [])]:
        if path:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
    r.path = ""


def purge_scans(db: Session) -> int:
    """Daily clean-up: finished (imported or set-aside) paper records older than the retention period disappear completely,
    scan and record. The registration they created stays; the audit log keeps the history. Pending records are never touched."""
    days = int(auto_rule(db)["retentionDays"])
    if days <= 0:
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    rows = db.scalars(select(LegacyImport).where(LegacyImport.status != "Pending", LegacyImport.updated_at < cutoff)).all()
    for r in rows:
        erase_files(r)
        db.delete(r)
    db.commit()
    return len(rows)


def try_auto(db: Session, u: User, r: LegacyImport) -> Application | None:
    """Register the record straight away when every required field was read with high confidence and is valid.
    Anything doubtful, a duplicate or a record outside the officer's county stays Pending for a person to check."""
    rule = auto_rule(db)
    sug = (r.ocr or {}).get("fields", {})
    if not rule["auto"] or not sug:
        return None
    need = REQUIRED[r.doc_type]
    fields, warnings, ids = clean(r.doc_type, r.fields or {})
    if any(not r.fields.get(k) or float(sug.get(k, {}).get("confidence", 0)) < float(rule["minConfidence"]) for k in need):
        return None
    if warnings or not ids["wardId"] or any(sug.get(k, {}).get("script") == "handwritten" for k in need):
        return None
    try:
        with db.begin_nested():
            return do_import(db, u, r, "automatically")
    except HTTPException as e:
        r.note = f"Needs a check: {e.detail}"
        return None


# ───────────── cleaning (our side, whatever the reader returned) ─────────────
def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def norm_phone(s: str) -> str:
    d = _digits(s)
    if d.startswith("254") and len(d) == 12:
        d = d[3:]
    elif d.startswith("0") and len(d) == 10:
        d = d[1:]
    return f"+254{d}" if len(d) == 9 and d[0] in "17" else ""


# Characters that OCR confuses: in a number read the letter for the digit, in a code's letter part read the digit for the letter.
_TO_DIGIT = str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1", "|": "1", "S": "5", "B": "8", "Z": "2"})
_TO_LETTER = str.maketrans({"0": "O", "1": "I", "5": "S", "8": "B"})


def norm_kra(s: str) -> str:
    v = re.sub(r"[\s-]", "", (s or "").upper())
    if len(v) == 11 and v[0] in "AP0" and v[-1].isalpha() or (len(v) == 11 and v[0] in "AP" and v[-1] in "0158"):
        # A123456789Z: letter, nine digits, letter. Repair look-alikes in the digit part and the two letters.
        mid = v[1:10].translate(_TO_DIGIT)
        first = ("A" if v[0] == "0" else v[0])
        last = v[-1].translate(_TO_LETTER)
        v = first + mid + last
    return v if re.fullmatch(r"[AP]\d{9}[A-Z]", v) else ""


def fix_digits(s: str) -> str:
    """A national ID is digits only; repair a letter OCR mistook for a digit when the value is clearly a number."""
    v = re.sub(r"[\s-]", "", s or "")
    digits = sum(c.isdigit() for c in v)
    # the first character is left alone: a passport number may legitimately start with a letter (A1234567, B1234567)
    return v[0] + v[1:].translate(_TO_DIGIT) if v and 6 <= len(v) <= 10 and digits >= len(v) * 0.7 and any(c in "OoIl|SBZ" for c in v[1:]) else s


def fix_reg_no(s: str) -> str:
    """Registration numbers look like SOC/2019/04512: letters, then numbers. Repair a zero read inside the letters."""
    v = (s or "").strip()
    parts = v.split("/")
    if len(parts) < 2:
        return v
    head = parts[0]
    if len(head) >= 2 and sum(c.isalpha() for c in head) >= len(head) / 2:
        parts[0] = head.translate(_TO_LETTER)
    return "/".join([parts[0]] + [p.translate(_TO_DIGIT) if p and sum(c.isdigit() for c in p) >= len(p) * 0.6 else p for p in parts[1:]])


def norm_id(s: str) -> str:
    v = re.sub(r"[^A-Za-z0-9]", "", re.sub(r"(?i)^\s*(id|passport)\s*(no\.?|number)?\s*[:.-]?", "", s or ""))
    return v.upper() if 6 <= len(v) <= 10 else ""


def norm_date(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d/%m/%y", "%d-%m-%y", "%B %d, %Y", "%d %B %Y", "%d %b %Y", "%b %d, %Y"):
        try:
            d = datetime.strptime(s, fmt).date()
        except ValueError:
            continue
        if d.year > date.today().year:  # two-digit years: 90 means 1990, not 2090
            d = d.replace(year=d.year - 100)
        return d.isoformat()
    return ""


def _clean_name(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).title() if (s or "").isupper() else re.sub(r"\s+", " ", (s or "").strip())


def _best(name: str, options: list[tuple[str, str]], cutoff: float = 0.78) -> str | None:
    """id of the option whose name is closest to `name` (case, 'County' suffix and typos tolerated)."""
    key = re.sub(r"(?i)\s*(county|constituency|sub-?county|ward)\s*$", "", (name or "").strip()).casefold()
    if not key:
        return None
    names = {re.sub(r"(?i)\s*(county|constituency|sub-?county|ward)\s*$", "", n).casefold(): i for i, n in options}
    if key in names:
        return names[key]
    hit = difflib.get_close_matches(key, list(names), n=1, cutoff=cutoff)
    return names[hit[0]] if hit else None


def match_place(county: str, sub: str, ward: str) -> dict:
    out = {"countyId": "", "subId": "", "wardId": ""}
    counties = R.admin()["counties"]
    cid = _best(county, [(c["id"], c["n"]) for c in counties], cutoff=0.7)
    c = next((x for x in counties if x["id"] == cid), None)
    if not c and sub:
        # the county was unreadable but the sub-county names it ("Embakasi East" can only be in Nairobi)
        owner = {s["id"]: x for x in counties for s in x["s"]}
        sid = _best(sub, [(s["id"], s["n"]) for x in counties for s in x["s"]], cutoff=0.8)
        c = owner.get(sid)
    if not c:
        return out
    out["countyId"] = c["id"]
    sid = _best(sub, [(s["id"], s["n"]) for s in c["s"]])
    s = next((x for x in c["s"] if x["id"] == sid), None)
    if not s:
        return out
    out["subId"] = s["id"]
    wid = _best(ward, [(w["id"], w["n"]) for w in s["w"]])
    out["wardId"] = wid or ""
    return out


def sport_id(s: str) -> str:
    v = (s or "").strip().casefold()
    if not v:
        return ""
    for sid, name, _fed in R.SPORTS:
        if v in (sid.casefold(), name.casefold()):
            return sid
    names = {name.casefold(): sid for sid, name, _ in R.SPORTS}
    hit = difflib.get_close_matches(v, list(names), n=1, cutoff=0.8)
    return names[hit[0]] if hit else ""


def clean(doc_type: str, raw: dict) -> tuple[dict, list[str], dict]:
    """Normalised fields, warnings for the officer, and the matched place ids."""
    f = {k: str(v or "").strip() for k, v in (raw or {}).items()}
    warn: list[str] = []
    out = dict(f)
    for k in ("name", "club_name", "guardian_name", "chair_name", "secretary_name", "treasurer_name"):
        if k in out:
            out[k] = _clean_name(out[k])
    for k in ("phone", "guardian_phone", "chair_phone", "secretary_phone", "treasurer_phone"):
        if f.get(k):
            out[k] = norm_phone(f[k]) or f[k]
            if not norm_phone(f[k]):
                warn.append(f"Check the phone number in “{k.replace('_', ' ')}”.")
    if f.get("kra"):
        out["kra"] = norm_kra(f["kra"]) or f["kra"]
        if not norm_kra(f["kra"]):
            warn.append("The KRA PIN does not look right (A123456789Z).")
    if f.get("org_reg_no"):
        out["org_reg_no"] = fix_reg_no(f["org_reg_no"])
    if f.get("id_no"):
        out["id_no"] = norm_id(fix_digits(f["id_no"])) or f["id_no"]
        if not norm_id(f["id_no"]):
            warn.append("The ID or passport number does not look right (6 to 10 letters or digits).")
    for k in ("dob", "issue_date", "expiry_date"):
        if f.get(k):
            out[k] = norm_date(f[k]) or f[k]
            if not norm_date(f[k]):
                warn.append(f"Enter {k.replace('_', ' ')} as a date, for example 15/04/1990.")
    if f.get("name") and " " not in f["name"].strip():
        warn.append("The name is one word. The reader may have lost the spaces between the names: check it against the scan.")
    if f.get("level"):
        # "Sem-Profesuonal" is nearest to "Semi-Professional"; anything far from every level is left for the officer
        near = difflib.get_close_matches(f["level"].strip().casefold(), [l.casefold() for l in R.LEVELS], n=1, cutoff=0.6)
        out["level"] = next((l for l in R.LEVELS if near and l.casefold() == near[0]), f["level"])
        if not near:
            warn.append("Choose the competition level from the list.")
    if f.get("email") and not EMAIL_RE.match(f["email"]):
        warn.append("The email address does not look right (check the @).")
    if f.get("sport"):
        sid = sport_id(f["sport"])
        out["sport"] = sid or f["sport"]
        if not sid:
            warn.append("The sport was not recognised. Choose it from the list.")
    place = match_place(f.get("county", ""), f.get("sub_county", ""), f.get("ward", ""))
    # show the official spelling once a place is matched ("KayoleNorth" becomes "Kayole North"), so the dropdowns pick it up
    c = next((x for x in R.admin()["counties"] if x["id"] == place["countyId"]), None)
    if c:
        out["county"] = c["n"]
        s = next((x for x in c["s"] if x["id"] == place["subId"]), None)
        if s:
            out["sub_county"] = s["n"]
            w = next((x for x in s["w"] if x["id"] == place["wardId"]), None)
            if w:
                out["ward"] = w["n"]
    if f.get("county") and not place["countyId"]:
        warn.append("The county was not recognised. Choose it from the list.")
    elif place["countyId"] and f.get("sub_county") and not place["subId"]:
        warn.append("The sub-county was not recognised. Choose it from the list.")
    elif place["subId"] and f.get("ward") and not place["wardId"]:
        warn.append("The ward was not recognised. Choose it from the list.")
    return out, warn, place


# ───────────── access ─────────────
def staff_user(u: User = Depends(need_user)) -> User:
    if u.role not in STAFF_ROLES or not can(u, "applications.review"):
        err(403, "Importing paper records is for officers who review applications.")
    return u


def mine(r: LegacyImport, u: User) -> bool:
    # county officers work on their own uploads; the Registrar's office sees every batch
    return u.role != "county_officer" or r.created_by == u.id


def get_import(db: Session, u: User, iid: str) -> LegacyImport:
    r = db.get(LegacyImport, iid)
    if not r or not mine(r, u):
        err(404, "Paper record not found.")
    return r


def suspects(doc_type: str, raw: dict, suggestions: dict, warnings: list[str]) -> dict[str, str]:
    """Fields an officer should look at first. The reader gives every field the same confidence, so we judge the values themselves."""
    out: dict[str, str] = {}
    f, _w, place = clean(doc_type, raw)
    for k, v in f.items():
        if not v:
            continue
        sug = suggestions.get(k) or {}
        if sug.get("confidence") is not None and 0 < float(sug["confidence"]) < 0.7:
            out[k] = "The reader was unsure about this one."
    name = f.get("name", "")
    if name and (any(c.isdigit() for c in name) or " " not in name or len(name) < 4):
        out["name"] = "Check the spelling and the spaces between the names."
    if f.get("id_no") and not norm_id(f["id_no"]):
        out["id_no"] = "This does not look like an ID or passport number."
    for k in ("phone", "guardian_phone", "chair_phone", "secretary_phone", "treasurer_phone"):
        if f.get(k) and not norm_phone(f[k]):
            out[k] = "This does not look like a Kenyan phone number."
    if f.get("dob"):
        d = norm_date(f["dob"])
        if not d or not (1925 <= int(d[:4]) <= date.today().year - 3):
            out["dob"] = "Check the date of birth."
    if f.get("kra") and not norm_kra(f["kra"]):
        out["kra"] = "A KRA PIN looks like A123456789Z."
    if f.get("email") and not EMAIL_RE.match(f["email"]):
        out["email"] = "Check the @ in the email address."
    if f.get("sport") and not sport_id(f["sport"]):
        out["sport"] = "The sport was not recognised."
    if f.get("county") and not place["countyId"]:
        out["county"] = "The county was not recognised."
    if place["countyId"] and f.get("sub_county") and not place["subId"]:
        out["sub_county"] = "The sub-county was not recognised."
    if place["subId"] and f.get("ward") and not place["wardId"]:
        out["ward"] = "The ward was not recognised."
    return out


def out(r: LegacyImport) -> dict:
    fields, warnings, place = clean(r.doc_type, r.fields or {})
    o = r.ocr or {}
    return {"id": r.id, "docType": r.doc_type, "status": r.status, "fileName": r.file_name, "mime": r.mime, "size": r.size,
            "fields": r.fields or {}, "cleaned": fields, "warnings": warnings, "place": place,
            "flags": suspects(r.doc_type, r.fields or {}, o.get("fields", {}), warnings) if r.status == "Pending" else {},
            "suggestions": o.get("fields", {}), "reader": o.get("message", ""), "readerOn": bool(o.get("available")),
            "quality": o.get("quality"), "duplicateOf": o.get("duplicate"), "pageCount": 1 + len(o.get("pages") or []),
            "applicationId": r.application_id, "note": r.note, "createdAt": r.created_at, "updatedAt": r.updated_at}


MAX_PDF_PAGES = 20


def pdf_pages(data: bytes) -> list[bytes]:
    """Each page of a PDF as a PNG (about 150 dpi), so a PDF is read page by page like any scan. Empty if it cannot be opened."""
    try:
        import io

        import pypdfium2 as pdfium
        pdf = pdfium.PdfDocument(data)
        out = []
        for i in range(min(len(pdf), MAX_PDF_PAGES)):
            buf = io.BytesIO()
            pdf[i].render(scale=1.8).to_pil().convert("RGB").save(buf, "PNG")
            out.append(buf.getvalue())
        return out
    except Exception:  # a damaged or protected PDF is stored as it is and keyed by hand
        return []


# ───────────── a person claims their paper record ─────────────
class ClaimIn(In):
    id_no: str
    dob: str = ""
    phone: str = ""


claim_router = APIRouter(prefix="/api")


@claim_router.post("/claim-record")
def claim_record(d: ClaimIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    """A signed-in applicant links a record that staff imported from paper to their own account.
    The ID number and the phone number on the paper record must both match, and a player's date of birth too."""
    from . import security as S
    if u.role != "member":
        err(403, "Staff accounts cannot claim records.")
    if S.too_many_attempts(f"claim:{u.id}", limit=6, window=3600):
        err(429, "Too many attempts. Try again in an hour, or ask your county sports office.")
    idn, phone, dob = norm_id(fix_digits(d.id_no)), norm_phone(d.phone), norm_date(d.dob)
    nothing = "We could not match those details to a paper record. Check them, or ask your county sports office."
    if not idn or not phone:
        err(422, "Enter your ID number and the phone number given on the paper form.")
    rows = db.scalars(select(Application).where(Application.legacy.is_(True), Application.owner_id.is_(None), Application.id_no == idn)).all()
    hit = next((a for a in rows if norm_phone(a.phone) == phone and (a.type != "Player / Sportsperson" or (dob and a.dob == dob))), None)
    if not hit:
        err(404, nothing)
    hit.owner_id = u.id
    hit.history = [*hit.history, hist(u, "Record claimed by its owner", f"Linked to the account {u.email}")]
    log(db, u, "Claimed a paper record", hit.id)
    db.commit()
    return {"application": app_out(hit, u, owner_view=True)}


# ───────────── routes ─────────────
class EmbedIn(In):
    doc_type: str = "player"


@router.post("/reader/embed")
def reader_embed(d: EmbedIn, u: User = Depends(staff_user)):
    """Address of the reader's own scanner (camera, preview, fields) to show inside our page."""
    if d.doc_type not in DOC_TYPES:
        err(422, "Choose player or club.")
    token = ocr_client.embed_token()
    if not token:
        err(503, "The reader's scanner is not available. Upload a scan or take a photo instead.")
    from urllib.parse import quote
    type_id = C.OCR_TYPE_PLAYER if d.doc_type == "player" else C.OCR_TYPE_CLUB
    url = f"{C.OCR_URL}/embed/scan?token={quote(token)}&kind=document&parentOrigin={quote(C.PUBLIC_URL)}"
    if type_id:
        url += f"&type_id={quote(type_id)}"
    return {"url": url, "origin": C.OCR_URL}


@router.get("/reader/status")
def reader_status(u: User = Depends(staff_user)):
    return ocr_client.status()


@router.get("")
def list_imports(status: str = "", db: Session = Depends(get_db), u: User = Depends(staff_user)):
    rows = db.scalars(select(LegacyImport).order_by(LegacyImport.created_at.desc()).limit(300)).all()
    return {"imports": [out(r) for r in rows if mine(r, u) and (not status or r.status == status)]}


def _merge(first: dict, more: dict) -> dict:
    """Fields read from a later page fill the gaps left by earlier pages; a value already read is never replaced."""
    out = {k: dict(v) for k, v in first.items()}
    for k, v in more.items():
        if k not in out or not str(out[k].get("value", "")).strip():
            out[k] = v
    return out


@router.post("", status_code=201)
async def upload(doc_type: str = Form(...), file: UploadFile = File(...), scanned: str = Form(""), one_form: str = Form(""),
                 db: Session = Depends(get_db), u: User = Depends(staff_user)):
    if doc_type not in DOC_TYPES:
        err(422, "Choose the type of paper form: player or club.")
    data = await file.read(MAX_SCAN + 1)
    if len(data) > MAX_SCAN:
        err(413, "That scan is larger than 12 MB.")
    found = sniff(data[:16])
    if not found or found[0] not in ("photo", "document"):
        err(422, "Upload a JPG, PNG, WebP or PDF scan.")
    pages = [(data, found[1], (file.filename or "scan")[:120])]
    if found[1] == "application/pdf" and not scanned:
        imgs = pdf_pages(data)
        if imgs:
            base = (file.filename or "scan").rsplit(".", 1)[0][:100]
            pages = [(img, "image/png", f"{base} (page {n}).png" if len(imgs) > 1 else f"{base}.png") for n, img in enumerate(imgs, 1)]
    made, auto = [], None
    if one_form and len(pages) > 1:  # one form that runs over several pages: a single record, fields merged across the pages
        first, *rest = pages
        rec, a = _make_record(db, u, doc_type, *first, scanned, extra=rest)
        made, auto = [rec], a
    else:  # every page, or every file, is its own form
        for pdata, pmime, pname in pages:
            rec, a = _make_record(db, u, doc_type, pdata, pmime, pname, scanned)
            made.append(rec)
            auto = auto or a
    db.commit()
    return {"import": out(made[0]), "imports": [out(r) for r in made], "autoImported": bool(auto), "applicationId": auto.id if auto else None,
            "autoCount": sum(1 for r in made if r.status == "Imported")}


def _store(data: bytes) -> str:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    path = MEDIA_DIR / f"import-{uuid4().hex}"
    path.write_bytes(data)
    return str(path)


def _make_record(db: Session, u: User, doc_type: str, data: bytes, mime: str, name: str, scanned: str, extra: list | None = None):
    iid = uuid4().hex
    path = _store(data)
    if scanned:  # the reader's own scanner already read the page: use its fields
        try:
            fields = ocr_client.map_scanner_fields(json.loads(scanned))
        except ValueError:
            fields = {}
        sug = {"available": bool(fields), "fields": fields, "message": "" if fields else "The scanner found no fields on this page. Enter them by hand."}
    else:
        sug = ocr_client.prefill(doc_type, data, name, mime)
    pages = [_store(pdata) for pdata, _, _ in (extra or [])]
    if extra:  # the other pages are read at the same time, then merged in page order
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(4, len(extra))) as ex:
            reads = list(ex.map(lambda x: ocr_client.prefill(doc_type, x[0], x[2], x[1]), extra))
        for more in reads:
            if more["available"]:
                sug = {"available": True, "fields": _merge(sug["fields"], more["fields"]), "message": ""}
    if pages:
        sug["pages"] = pages
    sug["quality"] = scan_quality.assess(data) if mime.startswith("image/") else None
    sha = hashlib.sha256(data).hexdigest()
    twin = db.scalars(select(LegacyImport).where(LegacyImport.sha256 == sha).order_by(LegacyImport.created_at)).first()
    if twin:
        sug["duplicate"] = {"id": twin.id, "status": twin.status, "createdAt": twin.created_at, "fileName": twin.file_name}
    t = now()
    r = LegacyImport(id=iid, doc_type=doc_type, file_name=name, mime=mime, size=len(data), path=path, sha256=sha,
                     fields=clean(doc_type, {k: v["value"] for k, v in sug["fields"].items()})[0], ocr=sug, created_by=u.id, created_at=t, updated_at=t)
    db.add(r)
    log(db, u, "Uploaded a paper record", iid)
    db.flush()
    return r, try_auto(db, u, r)


class RuleIn(In):
    auto: bool
    min_confidence: float = 0.85
    retention_days: int = 30


@router.put("/rule")
def set_rule(d: RuleIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not (can(u, "roles.manage") or can(u, "settings.manage")):
        err(403, "Only an administrator can change how paper records are imported.")
    if not 0.5 <= d.min_confidence <= 0.99:
        err(422, "Confidence must be between 50% and 99%.")
    row = db.get(Setting, "import_rule") or Setting(key="import_rule", value={})
    if not 0 <= d.retention_days <= 365:
        err(422, "Keep scans for 0 (forever) to 365 days.")
    row.value = {"auto": d.auto, "minConfidence": d.min_confidence, "retentionDays": d.retention_days}  # testDelete comes from the server settings only
    db.merge(row)
    log(db, u, f"Paper import: automatic {'on' if d.auto else 'off'}, min {round(d.min_confidence * 100)}%, scans kept {d.retention_days} days", "settings")
    db.commit()
    return auto_rule(db)


@router.get("/rule")
def get_rule(db: Session = Depends(get_db), u: User = Depends(staff_user)):
    return auto_rule(db)


@router.get("/accuracy")
def accuracy(db: Session = Depends(get_db), u: User = Depends(staff_user)):
    return ocr_stats.report(db)


@router.get("/{iid}")
def one(iid: str, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    return {"import": out(get_import(db, u, iid))}


@router.delete("/{iid}")
def delete_record(iid: str, registration: bool = False, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    """Delete a paper record completely: the scan and the record both disappear, nothing is left in the list.
    A registration already made from it stays (it is real registry data) unless an administrator, on a server where
    ALLOW_IMPORT_TEST_DELETE=1 is switched on for testing, asks for it to go too."""
    r = get_import(db, u, iid)
    if r.application_id:
        a = db.get(Application, r.application_id)
        if a:
            if registration:
                if not C.ALLOW_IMPORT_TEST_DELETE:
                    err(403, "Deleting the registration too is switched off on this server.")
                if not can(u, "settings.manage"):
                    err(403, "Only an administrator can delete the registration as well.")
                if not a.legacy or a.status == "Approved":
                    err(409, "The registration made from this record is already verified, so it cannot be deleted here.")
                db.delete(a)
            else:
                a.history = [*a.history, hist(u, "Scan of the paper record deleted")]
    erase_files(r)
    log(db, u, "Deleted a paper record" + (" and its registration (testing)" if registration else ""), iid)
    db.delete(r)
    db.commit()
    return {"deleted": iid}


@router.get("/{iid}/image")
def image(iid: str, page: int = 1, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    paths = [r.path, *((r.ocr or {}).get("pages") or [])]
    path = paths[page - 1] if 1 <= page <= len(paths) else ""
    if not path or not Path(path).exists():
        err(410, "The scan is no longer on the server.")
    return FileResponse(path, media_type=r.mime, headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


class FieldsIn(In):
    fields: dict[str, str]


@router.put("/{iid}")
def save(iid: str, d: FieldsIn, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    if r.status != "Pending":
        err(409, "This paper record is already closed.")
    r.fields = clean(r.doc_type, {k[:40]: v[:300] for k, v in d.fields.items()})[0]
    r.updated_at = now()
    db.commit()
    return {"import": out(r)}


class NoteIn(In):
    note: str = ""


@router.post("/{iid}/reject")
def reject(iid: str, d: NoteIn, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    if r.status != "Pending":
        err(409, "This paper record is already closed.")
    r.status, r.note, r.updated_at = "Rejected", d.note.strip()[:300], now()
    log(db, u, "Rejected a paper record", iid)
    db.commit()
    return {"import": out(r)}


OFFICIAL_ROLES = [("chair", "chairperson-president"), ("secretary", "secretary-general-secretary"), ("treasurer", "treasurer-finance-officer")]


def do_import(db: Session, u: User, r: LegacyImport, how: str = "") -> Application:
    """Create the registration from a paper record. Raises the same errors as a web registration would."""
    f, _warnings, ids = clean(r.doc_type, r.fields or {})
    place = place_or_422(PlaceIn(county_id=ids["countyId"], sub_id=ids["subId"], ward_id=ids["wardId"]))
    if u.role == "county_officer" and place["county_id"] != u.county_id:
        err(403, "This record is in another county. Ask that county's office or the Registrar to import it.")
    paper = "Imported from a paper record"
    if r.doc_type == "player":
        guardian = None
        if f.get("guardian_name") or f.get("guardian_phone"):
            guardian = {"name": f.get("guardian_name", ""), "phone": f.get("guardian_phone", ""),
                        "relationship": f.get("guardian_relationship", "Parent / guardian"), "consent": True}
        d = RegisterIn(type="Player / Sportsperson", name=f.get("name", ""), id_no=f.get("id_no", ""), kra=f.get("kra", ""),
                       phone=f.get("phone", ""), email=f.get("email", ""), place=PlaceIn(county_id=place["county_id"], sub_id=place["sub_id"], ward_id=place["ward_id"]),
                       sport=f.get("sport", ""), level=f.get("level", "") or LEVEL_DEFAULT, club_name="", has_contract="No",
                       dob=f.get("dob"), gender=f.get("gender"), guardian=guardian, notes=paper)
    else:
        officials = [{"role": role, "name": f.get(f"{p}_name", ""), "phone": f.get(f"{p}_phone", ""), "email": ""} for p, role in OFFICIAL_ROLES]
        d = RegisterIn(type="Club", name=f.get("name", ""), id_no=f.get("id_no", ""), kra=f.get("kra", ""), phone=f.get("phone", ""), email=f.get("email", ""),
                       place=PlaceIn(county_id=place["county_id"], sub_id=place["sub_id"], ward_id=place["ward_id"]), sport=f.get("sport", ""),
                       level=f.get("level", "") or LEVEL_DEFAULT, club_name=f.get("club_name", ""), org_reg_no=f.get("org_reg_no", ""),
                       club_officials=officials, notes=paper)
    # no account is created: a legacy person can claim the record later with their own email
    a = new_app(db, d, SimpleNamespace(id=None), place, f"Paper record, entered by {u.name}")
    a.legacy, a.legacy_cert_no = True, f.get("certificate_number", "")[:60]
    a.pay_status, a.pay_amount, a.pay_method, a.pay_at, a.receipt = "Paid", 0, "Legacy record (fee waived)", now(), "LEGACY"
    a.history = [*a.history, hist(u, "Imported from a paper record" + (f" ({how})" if how else ""),
                                  f"Scan {r.file_name}" + (f", old certificate {a.legacy_cert_no}" if a.legacy_cert_no else ""))]
    r.status, r.application_id, r.updated_at = "Imported", a.id, now()
    r.note = how
    sugg = {k: v.get("value", "") for k, v in ((r.ocr or {}).get("fields") or {}).items()}
    if sugg:  # measure the reader: which values did the officer keep, correct or have to add?
        ocr_stats.record(db, r.doc_type, ocr_stats.outcomes(clean(r.doc_type, sugg)[0], f))
    log(db, u, "Imported a paper record" + (f" ({how})" if how else ""), a.id)
    return a


@router.post("/{iid}/import")
def import_record(iid: str, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    if r.status != "Pending":
        err(409, "This paper record is already closed.")
    a = do_import(db, u, r)
    db.commit()
    return {"import": out(r), "applicationId": a.id}
