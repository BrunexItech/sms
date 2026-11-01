"""Import of scanned paper records: upload, suggest (optional reader), officer check, then a normal registration.

Nothing in the holding table is a registration. Importing goes through the same rules as a web registration
(duplicate IDs, valid places, club officials) and the person's record then follows normal verification.
"""
import difflib
import re
from datetime import date, datetime
from types import SimpleNamespace
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import ocr_client
from . import refdata as R
from .api import MEDIA_DIR, In, PlaceIn, RegisterIn, err, hist, log, need_user, new_app, now, place_or_422, sniff
from .db import get_db
from .models import Application, LegacyImport, Setting, User
from .rbac import STAFF_ROLES, can

router = APIRouter(prefix="/api/imports")

MAX_SCAN = 12 * 1024 * 1024
DOC_TYPES = ("player", "club")
LEVEL_DEFAULT = "Amateur"
# fields a record must have, read with enough confidence, before it is registered without an officer's check
REQUIRED = {"player": ["name", "id_no", "dob", "gender", "sport", "county", "sub_county", "ward"],
            "club": ["club_name", "name", "id_no", "phone", "sport", "county", "sub_county", "ward", "chair_name", "secretary_name", "treasurer_name"]}


def auto_rule(db: Session) -> dict:
    row = db.get(Setting, "import_rule")
    return {"auto": False, "minConfidence": 0.85, **(row.value if row else {})}


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


def norm_kra(s: str) -> str:
    v = re.sub(r"[\s-]", "", (s or "").upper())
    return v if re.fullmatch(r"[AP]\d{9}[A-Z]", v) else ""


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
    cid = _best(county, [(c["id"], c["n"]) for c in counties])
    c = next((x for x in counties if x["id"] == cid), None)
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
    if f.get("id_no"):
        out["id_no"] = norm_id(f["id_no"]) or f["id_no"]
        if not norm_id(f["id_no"]):
            warn.append("The ID or passport number does not look right (6 to 10 letters or digits).")
    for k in ("dob", "issue_date", "expiry_date"):
        if f.get(k):
            out[k] = norm_date(f[k]) or f[k]
            if not norm_date(f[k]):
                warn.append(f"Enter {k.replace('_', ' ')} as a date, for example 15/04/1990.")
    if f.get("sport"):
        sid = sport_id(f["sport"])
        out["sport"] = sid or f["sport"]
        if not sid:
            warn.append("The sport was not recognised. Choose it from the list.")
    place = match_place(f.get("county", ""), f.get("sub_county", ""), f.get("ward", ""))
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


def out(r: LegacyImport) -> dict:
    fields, warnings, place = clean(r.doc_type, r.fields or {})
    return {"id": r.id, "docType": r.doc_type, "status": r.status, "fileName": r.file_name, "mime": r.mime, "size": r.size,
            "fields": r.fields or {}, "cleaned": fields, "warnings": warnings, "place": place,
            "suggestions": (r.ocr or {}).get("fields", {}), "reader": (r.ocr or {}).get("message", ""), "readerOn": bool((r.ocr or {}).get("available")),
            "applicationId": r.application_id, "note": r.note, "createdAt": r.created_at, "updatedAt": r.updated_at}


# ───────────── routes ─────────────
@router.get("/reader/status")
def reader_status(u: User = Depends(staff_user)):
    return ocr_client.status()


@router.get("")
def list_imports(status: str = "", db: Session = Depends(get_db), u: User = Depends(staff_user)):
    rows = db.scalars(select(LegacyImport).order_by(LegacyImport.created_at.desc()).limit(300)).all()
    return {"imports": [out(r) for r in rows if mine(r, u) and (not status or r.status == status)]}


@router.post("", status_code=201)
async def upload(doc_type: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db), u: User = Depends(staff_user)):
    if doc_type not in DOC_TYPES:
        err(422, "Choose the type of paper form: player or club.")
    data = await file.read(MAX_SCAN + 1)
    if len(data) > MAX_SCAN:
        err(413, "That scan is larger than 12 MB.")
    found = sniff(data[:16])
    if not found or found[0] not in ("photo", "document"):
        err(422, "Upload a JPG, PNG, WebP or PDF scan.")
    iid = uuid4().hex
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    path = MEDIA_DIR / f"import-{iid}"
    path.write_bytes(data)
    sug = ocr_client.prefill(doc_type, data, (file.filename or "scan")[:120], found[1])
    t = now()
    r = LegacyImport(id=iid, doc_type=doc_type, file_name=(file.filename or "scan")[:120], mime=found[1], size=len(data), path=str(path),
                     fields={k: v["value"] for k, v in sug["fields"].items()}, ocr=sug, created_by=u.id, created_at=t, updated_at=t)
    db.add(r)
    log(db, u, "Uploaded a paper record", iid)
    db.flush()
    a = try_auto(db, u, r)
    db.commit()
    return {"import": out(r), "autoImported": bool(a), "applicationId": a.id if a else None}


class RuleIn(In):
    auto: bool
    min_confidence: float = 0.85


@router.put("/rule")
def set_rule(d: RuleIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not (can(u, "roles.manage") or can(u, "settings.manage")):
        err(403, "Only an administrator can change how paper records are imported.")
    if not 0.5 <= d.min_confidence <= 0.99:
        err(422, "Confidence must be between 50% and 99%.")
    row = db.get(Setting, "import_rule") or Setting(key="import_rule", value={})
    row.value = {"auto": d.auto, "minConfidence": d.min_confidence}
    db.merge(row)
    log(db, u, f"Automatic paper import {'on' if d.auto else 'off'} (min {round(d.min_confidence * 100)}%)", "settings")
    db.commit()
    return auto_rule(db)


@router.get("/rule")
def get_rule(db: Session = Depends(get_db), u: User = Depends(staff_user)):
    return auto_rule(db)


@router.get("/{iid}")
def one(iid: str, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    return {"import": out(get_import(db, u, iid))}


@router.get("/{iid}/image")
def image(iid: str, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    return FileResponse(r.path, media_type=r.mime, headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


class FieldsIn(In):
    fields: dict[str, str]


@router.put("/{iid}")
def save(iid: str, d: FieldsIn, db: Session = Depends(get_db), u: User = Depends(staff_user)):
    r = get_import(db, u, iid)
    if r.status != "Pending":
        err(409, "This paper record is already closed.")
    r.fields = {k[:40]: v[:300] for k, v in d.fields.items()}
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
