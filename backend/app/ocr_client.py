"""Optional reader for scanned paper records (ocr.oqtekal.com, self-hosted and free).

It only ever *suggests* values. Every field is checked by an officer before anything becomes a registration,
and any failure here simply means the officer types the form in by hand.
"""
import json
from pathlib import Path

import requests

from . import settings as C

TEMPLATES = Path(__file__).resolve().parent.parent / "data" / "import_templates.json"


def zones_for(doc_type: str) -> list[dict]:
    try:
        return json.loads(TEMPLATES.read_text()).get(doc_type, {}).get("zones", [])
    except (OSError, ValueError):
        return []


def prefill(doc_type: str, image: bytes, file_name: str, mime: str) -> dict:
    """Suggestions per field: {"available": bool, "fields": {key: {value, confidence, script, bbox}}, "message": str}."""
    zones = zones_for(doc_type)
    if not C.OCR_API_KEY:
        return {"available": False, "fields": {}, "message": "The reader is not connected. Enter the fields by hand."}
    if not zones or not mime.startswith("image/"):
        return {"available": False, "fields": {}, "message": "No reading template for this form yet. Enter the fields by hand."}
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
