"""How accurate is the reader in real use? Counted when an officer imports a record: was each suggested value kept, corrected,
or did the officer have to add a field the reader missed? Totals live in one settings row so deleting scans never loses them."""
from sqlalchemy.orm import Session

from .models import Setting

KEY = "ocr_stats"


def outcomes(suggested: dict, final: dict) -> dict[str, str]:
    """field -> kept | corrected | added, comparing the reader's tidied suggestion with what the officer approved."""
    out = {}
    for k, v in final.items():
        if not str(v or "").strip():
            continue
        sug = str(suggested.get(k, "") or "").strip()
        if not sug:
            out[k] = "added"
        else:
            out[k] = "kept" if sug.casefold() == str(v).strip().casefold() else "corrected"
    for k, v in suggested.items():  # the reader gave a value that the officer removed
        if str(v or "").strip() and not str(final.get(k, "") or "").strip():
            out[k] = "corrected"
    return out


def record(db: Session, doc_type: str, result: dict[str, str]) -> None:
    row = db.get(Setting, KEY) or Setting(key=KEY, value={})
    v = dict(row.value or {})
    v["records"] = int(v.get("records", 0)) + 1
    fields = dict(v.get("fields", {}))
    for k, o in result.items():
        f = dict(fields.get(k, {"kept": 0, "corrected": 0, "added": 0}))
        f[o] = int(f.get(o, 0)) + 1
        fields[k] = f
    v["fields"] = fields
    row.value = v
    db.merge(row)


def report(db: Session) -> dict:
    v = (db.get(Setting, KEY).value if db.get(Setting, KEY) else {}) or {}
    rows, kept, total = [], 0, 0
    for k, f in (v.get("fields") or {}).items():
        n = f["kept"] + f["corrected"] + f["added"]
        kept, total = kept + f["kept"], total + n
        rows.append({"field": k, "kept": f["kept"], "corrected": f["corrected"], "missed": f["added"], "total": n, "accuracy": round(f["kept"] / n, 3) if n else None})
    rows.sort(key=lambda r: (r["accuracy"] is None, r["accuracy"]))
    return {"records": int(v.get("records", 0)), "overall": round(kept / total, 3) if total else None, "fields": rows}
