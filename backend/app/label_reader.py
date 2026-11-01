"""Turns the text lines a reader found on a printed form into field values, using the printed labels.

Works for any layout that prints a label next to its value ("ID No: 12345678", or the label with the value
to its right or just below). Values are only suggestions; an officer checks every one.
"""
import re

# field -> label patterns (matched at the start of a line, case-insensitive)
LABELS: dict[str, list[str]] = {
    "name": [r"full\s*names?", r"names?\s*of\s*(the\s*)?(player|athlete|applicant)", r"contact\s*person(\s*name)?", r"names?(?!\s*of\b)", r"jina"],
    "id_no": [r"(national\s*)?id\s*(no\.?|number)", r"id\s*/\s*passport(\s*(no\.?|number))?", r"passport\s*(no\.?|number)", r"national\s*id"],
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
    "chair_name": [r"chair(person|man)?(\s*name)?"],
    "chair_phone": [r"chair(person|man)?\s*(phone|tel|contact)"],
    "secretary_name": [r"(general\s*)?secretary(\s*name)?"],
    "secretary_phone": [r"secretary\s*(phone|tel|contact)"],
    "treasurer_name": [r"treasurer(\s*name)?"],
    "treasurer_phone": [r"treasurer\s*(phone|tel|contact)"],
}
FIELDS = {
    "player": ["name", "id_no", "dob", "gender", "kra", "phone", "email", "sport", "level", "county", "sub_county", "ward",
               "guardian_phone", "guardian_name", "certificate_number"],
    "club": ["club_name", "org_reg_no", "name", "id_no", "phone", "email", "sport", "county", "sub_county", "ward",
             "chair_phone", "chair_name", "secretary_phone", "secretary_name", "treasurer_phone", "treasurer_name", "certificate_number"],
}
SEP = r"\s*[:\-–—.]*\s*"
_COMPILED = {k: [re.compile(rf"^\s*(?:{p}){SEP}(?P<v>.*)$", re.I) for p in v] for k, v in LABELS.items()}


def _is_label(text: str) -> bool:
    return any(rx.match(text) for rxs in _COMPILED.values() for rx in rxs)


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
            value, conf, box = m.group("v").strip(), float(ln.get("confidence") or 0), ln.get("bbox")
            if not value:  # label on its own: the value is to its right or just below
                nxt = _right_of(ln, lines) or _below(ln, lines)
                if nxt and not _is_label(str(nxt.get("text", "")).strip()):
                    value, conf, box = str(nxt["text"]).strip(), float(nxt.get("confidence") or 0), nxt.get("bbox")
            if value:
                out[key] = {"value": value, "confidence": round(conf, 3), "script": "printed", "bbox": box}
            break
    return out
