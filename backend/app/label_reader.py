"""Turns the text lines a reader found on a printed form into field values, using the printed labels.

Works for any layout that prints a label next to its value ("ID No: 12345678", or the label with the value
to its right or just below). Values are only suggestions; an officer checks every one.
"""
import difflib
import re
from functools import lru_cache

from . import refdata as R

# field -> label patterns (matched at the start of a line, case-insensitive)
LABELS: dict[str, list[str]] = {
    "name": [r"full\s*names?", r"names?\s*of\s*(the\s*)?(player|athlete|applicant)", r"contact\s*person(\s*name)?", r"names?(?!\s*of\b)", r"jina"],
    "id_no": [r"contact\s*id(\s*(no\.?|number))?", r"(national\s*)?id\s*(no\.?|number)", r"id\s*/\s*passport(\s*(no\.?|number))?", r"passport\s*(no\.?|number)", r"national\s*id"],
    "dob": [r"date\s*of\s*birth", r"d\.?\s*o\.?\s*b\.?", r"born"],
    "gender": [r"gender", r"sex"],
    "kra": [r"kra(\s*pin)?(\s*(no\.?|number))?", r"pin\s*(no\.?|number)"],
    "phone": [r"(mobile|cell|tel(ephone)?|phone)(\s*(no\.?|number))?", r"contact\s*(no\.?|number)"],
    "email": [r"e-?\s*mail(\s*address)?"],
    "sport": [r"sport(s)?(\s*discipline)?", r"discipline", r"game"],
    "level": [r"(competition\s*)?level", r"category"],
    "club_name": [r"(name\s*of\s*)?(club|team|organi[sz]ation)(\s*name)?"],
    "county": [r"county"],
    "sub_county": [r"sub-?\s*county", r"constituency"],
    "ward": [r"ward"],
    "org_reg_no": [r"registration\s*(no\.?|number)", r"reg\.?\s*(no\.?|number)"],
    "certificate_number": [r"certificate\s*(no\.?|number)", r"cert\.?\s*no\.?"],
    "guardian_name": [r"(parent|guardian)(\s*/\s*(parent|guardian))?(\s*name)?"],
    "guardian_phone": [r"(parent|guardian)\s*(phone|tel|contact)"],
    "guardian_relationship": [r"(parent\s*/\s*)?guardian\s*relationship", r"relationship(\s*to\s*(the\s*)?player)?"],
    "chair_name": [r"chair(person|man)?(\s*name)?"],
    "chair_phone": [r"chair(person|man)?\s*(phone|tel|contact)"],
    "secretary_name": [r"(general\s*)?secretary(\s*name)?"],
    "secretary_phone": [r"secretary\s*(phone|tel|contact)"],
    "treasurer_name": [r"treasurer(\s*name)?"],
    "treasurer_phone": [r"treasurer\s*(phone|tel|contact)"],
}
FIELDS = {
    "player": ["name", "id_no", "dob", "gender", "kra", "phone", "email", "sport", "level", "county", "sub_county", "ward",
               "guardian_phone", "guardian_relationship", "guardian_name", "certificate_number"],
    "club": ["club_name", "org_reg_no", "name", "id_no", "phone", "email", "sport", "county", "sub_county", "ward",
             "chair_phone", "chair_name", "secretary_phone", "secretary_name", "treasurer_phone", "treasurer_name", "certificate_number"],
}
SEP = r"\s*[:\-–—.]*\s*"
# word-bounded: the label "Sport" must not match the start of "Sports" or "Sportsman"
# a value on the same line needs a colon or dash after the label; otherwise the line must be the bare label
_COMPILED = {k: [re.compile(rf"^\s*(?:{p})(?![A-Za-z0-9])\s*(?:[:\-–—]+\s*(?P<v>.*))?$", re.I) for p in v] for k, v in LABELS.items()}


_ANY_LABEL = re.compile(r"^\s*[A-Za-z][A-Za-z .'/&()-]{0,40}:\s*(\S.*)?$")
_BLANK = re.compile(r"^[\s_.\-–—]*$")


# Plain label words per field, for matching labels that OCR garbled ("Diseiplie", "E-mait", "Coustitueney").
CANON: dict[str, list[str]] = {
    "name": ["name", "names", "fullname", "fullnames", "nameofplayer", "contactperson"],
    "id_no": ["idno", "idnumber", "nationalid", "passportno", "passportnumber", "contactidnumber", "idpassport"],
    "dob": ["dob", "dateofbirth", "born"], "gender": ["gender", "sex"], "kra": ["kra", "krapin", "pinno", "pinnumber"],
    "phone": ["phone", "mobile", "telephone", "tel", "cell", "phoneno", "phonenumber"], "email": ["email", "emailaddress"],
    "sport": ["sport", "sports", "discipline", "game"], "level": ["level", "competitionlevel", "category"],
    "club_name": ["club", "clubname", "team", "nameofclub", "organisation", "organisationname"],
    "county": ["county"], "sub_county": ["subcounty", "constituency"], "ward": ["ward"],
    "org_reg_no": ["registrationnumber", "registrationno", "regno"], "certificate_number": ["certificatenumber", "certificateno", "certno"],
    "guardian_name": ["guardianname", "parentname", "parentguardian"], "guardian_phone": ["guardianphone", "parentphone"],
    "guardian_relationship": ["guardianrelationship", "relationship"],
    "chair_name": ["chairperson", "chairpersonname", "chairman"], "chair_phone": ["chairpersonphone", "chairmanphone"],
    "secretary_name": ["secretary", "secretaryname", "generalsecretary"], "secretary_phone": ["secretaryphone"],
    "treasurer_name": ["treasurer", "treasurername"], "treasurer_phone": ["treasurerphone"],
}


@lru_cache
def _vocab() -> dict[str, list[str]]:
    counties = R.admin()["counties"]
    return {"county": [c["n"].casefold() for c in counties], "sub_county": sorted({s["n"].casefold() for c in counties for s in c["s"]}),
            "ward": sorted({w["n"].casefold() for c in counties for s in c["s"] for w in s["w"]}),
            "sport": [n.casefold() for _, n, _ in R.SPORTS], "gender": ["female", "male"], "level": [l.casefold() for l in R.LEVELS]}


def _plausible(key: str, value: str) -> bool:
    """Without a colon we only accept a value we can check: a known place, sport, gender or level, or a number-shaped value."""
    v = value.strip().casefold()
    if key in ("county", "sub_county", "ward", "sport", "gender", "level"):
        return bool(difflib.get_close_matches(v, _vocab()[key], n=1, cutoff=0.6 if key in ("gender", "level") else 0.7))
    digits = sum(c.isdigit() for c in v)
    if key in ("phone", "guardian_phone", "chair_phone", "secretary_phone", "treasurer_phone"):
        return digits >= 9
    if key == "id_no":
        return digits >= 6 and digits >= len(v.replace(" ", "")) * 0.7
    if key == "email":
        return "@" in v and "." in v and " " not in v
    return False


def _fuzzy(text: str, wanted: list[str], done: set[str], need_colon: bool) -> tuple[str, str] | None:
    """(field, value) for a line whose label is a near-miss of a known label. Never used for a label already found."""
    if need_colon:
        head, sep, tail = text.partition(":")
        if not sep or not tail.strip() or len(head) > 40:
            return None
    else:  # the OCR dropped the colon: only a short, mixed-case line whose first word is a label ("County Nairobi")
        if text.upper() == text or len(text) > 48 or " " not in text.strip():
            return None
        head, _, tail = text.strip().partition(" ")
        if len(tail.strip()) < 2:
            return None
    h = re.sub(r"[^a-z]", "", head.lower())
    if not 3 <= len(h) <= 24:
        return None
    best = None
    for key in wanted:
        if key in done:
            continue
        for word in CANON.get(key, []):
            r = difflib.SequenceMatcher(None, h, word).ratio()
            if r >= (0.78 if need_colon else 0.8) and (best is None or r > best[0]):
                best = (r, key)
    if best and not need_colon and not _plausible(best[1], tail):
        return None
    return (best[1], tail.strip()) if best else None


def _is_label(text: str) -> bool:
    """A line that is itself a form label: "Signature: ____", "Sport: Athletics", or a bare "Phone". Never a value."""
    t = text.strip()
    if not t:
        return False
    if _ANY_LABEL.match(t):
        return True
    for rxs in _COMPILED.values():
        for rx in rxs:
            m = rx.match(t)
            if m and not (m.group("v") or "").strip():
                return True
    return False


def _x(b):
    return b[0]


def _right_of(line, others):
    """Closest line on the same row to the right of `line`."""
    x, y, w, h = line["bbox"]
    best = None
    for o in others:
        if o is line:
            continue
        ox, oy, ow, oh = o["bbox"]
        if ox >= x + w * 0.6 and abs((oy + oh / 2) - (y + h / 2)) < max(h, oh) * 0.7:
            if best is None or ox < best["bbox"][0]:
                best = o
    return best


def _below(line, others):
    x, y, w, h = line["bbox"]
    best = None
    for o in others:
        ox, oy, ow, oh = o["bbox"]
        if oy > y + h * 0.6 and oy < y + h * 3.2 and abs(ox - x) < max(w, 120):
            if best is None or oy < best["bbox"][1]:
                best = o
    return best


def read(doc_type: str, lines: list[dict]) -> dict[str, dict]:
    """lines: [{text, confidence, bbox:[x,y,w,h]}] -> {field: {value, confidence, script, bbox}}."""
    out: dict[str, dict] = {}
    wanted = FIELDS.get(doc_type, [])
    for ln in lines:
        text = str(ln.get("text", "")).strip()
        if not text:
            continue
        for key in wanted:  # more specific labels are listed first for each pair (phone before name)
            if key in out:
                continue
            m = next((rx.match(text) for rx in _COMPILED[key] if rx.match(text)), None)
            if not m:
                continue
            value, conf, box = (m.group("v") or "").strip(), float(ln.get("confidence") or 0), ln.get("bbox")
            if value and (_is_label(value) or _BLANK.match(value)):  # "Guardian Relationship:" matched "Guardian"; "Date: ____" is empty
                value = ""
            if not value:  # label on its own: the value is to its right or just below
                nxt = _right_of(ln, lines) or _below(ln, lines)
                nt = str(nxt.get("text", "")).strip() if nxt else ""
                if nxt and nt and not _is_label(nt) and not _BLANK.match(nt):
                    value, conf, box = nt, float(nxt.get("confidence") or 0), nxt.get("bbox")
            if value:
                out[key] = {"value": value, "confidence": round(conf, 3), "script": "printed", "bbox": box}
            break
        else:
            # no exact label: try a near-miss label, then a label whose colon the OCR lost
            hit = _fuzzy(text, wanted, set(out), True) or _fuzzy(text, wanted, set(out), False)
            if hit and not _is_label(hit[1]) and not _BLANK.match(hit[1]):
                out[hit[0]] = {"value": hit[1], "confidence": round(float(ln.get("confidence") or 0), 3), "script": "printed", "bbox": ln.get("bbox")}
    return out
