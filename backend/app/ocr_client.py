"""Optional reader for scanned paper records (ocr.oqtekal.com, self-hosted and free).

It only ever *suggests* values. Every field is checked by an officer before anything becomes a registration,
and any failure here simply means the officer types the form in by hand.
"""
import json
from pathlib import Path

import requests

from . import label_reader
from . import settings as C

TEMPLATES = Path(__file__).resolve().parent.parent / "data" / "import_templates.json"


def zones_for(doc_type: str) -> list[dict]:
    try:
        return json.loads(TEMPLATES.read_text()).get(doc_type, {}).get("zones", [])
    except (OSError, ValueError):
        return []


def status() -> dict:
    """Is the reader reachable with our key? Never reveals the key."""
    if not C.OCR_API_KEY:
        return {"configured": False, "ok": False, "message": "No reader key is set on the server. Forms are keyed by hand."}
    try:
        r = requests.get(f"{C.OCR_URL}/api/documents/zones-health", headers={"X-API-Key": C.OCR_API_KEY}, timeout=8)
    except requests.RequestException:
        return {"configured": True, "ok": False, "message": "The reader could not be reached. Forms can still be keyed by hand."}
    if r.status_code in (401, 403):
        return {"configured": True, "ok": False, "message": "The reader rejected the key. Ask for a new one."}
    ok = r.status_code == 200
    return {"configured": True, "ok": ok, "message": "Reader connected." if ok else f"The reader answered with an error ({r.status_code})."}


def read_by_labels(doc_type: str, image: bytes, file_name: str, mime: str) -> dict:
    """No template for this layout: read all the text, then take each value from its printed label."""
    try:
        r = requests.post(f"{C.OCR_URL}/api/documents/ocr-text", headers={"X-API-Key": C.OCR_API_KEY},
                          files={"file": (file_name, image, mime)}, timeout=90)
        if r.status_code in (404, 405, 501):
            return {"available": False, "fields": {}, "message": "The reader cannot read whole pages yet. Enter the fields by hand."}
        r.raise_for_status()
        lines = r.json().get("lines", [])
    except (requests.RequestException, ValueError) as e:
        return {"available": False, "fields": {}, "message": f"The reader could not be reached ({type(e).__name__}). Enter the fields by hand."}
    fields = label_reader.read(doc_type, lines)
    msg = "" if fields else "The reader found no labelled fields on this scan. Enter them by hand."
    return {"available": bool(fields), "fields": fields, "message": msg}


def prefill(doc_type: str, image: bytes, file_name: str, mime: str) -> dict:
    """Suggestions per field: {"available": bool, "fields": {key: {value, confidence, script, bbox}}, "message": str}."""
    zones = zones_for(doc_type)
    if not C.OCR_API_KEY:
        return {"available": False, "fields": {}, "message": "The reader is not connected. Enter the fields by hand."}
    if not mime.startswith("image/"):
        return {"available": False, "fields": {}, "message": "Automatic reading works on images. Enter the fields from this PDF by hand."}
    if not zones:
        return read_by_labels(doc_type, image, file_name, mime)
    try:
        r = requests.post(f"{C.OCR_URL}/api/documents/ocr-zones", headers={"X-API-Key": C.OCR_API_KEY},
                          files={"file": (file_name, image, mime)}, data={"zones": json.dumps({"zones": zones})}, timeout=90)
        r.raise_for_status()
        out = r.json()
    except (requests.RequestException, ValueError) as e:
        return {"available": False, "fields": {}, "message": f"The reader could not be reached ({type(e).__name__}). Enter the fields by hand."}
    fields = {}
    for z in out.get("zones", []):
        value = z.get("normalized") or z.get("text") or ""
        fields[z["key"]] = {"value": value, "confidence": round(float(z.get("confidence") or 0), 3),
                            "script": z.get("script", "unknown"), "bbox": z.get("bbox")}
    return {"available": True, "fields": fields, "message": ""}
