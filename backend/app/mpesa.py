"""Safaricom Daraja client (STK push). Sandbox by default; set MPESA_ENV=production for live."""
import base64
import re
import time
from datetime import datetime

import requests

from . import settings as C

_token: dict = {"value": "", "exp": 0.0}


class MpesaError(Exception):
    pass


def normalise_phone(raw: str) -> str:
    p = re.sub(r"[\s\-+]", "", raw)
    if p.startswith("0"):
        p = "254" + p[1:]
    if not re.fullmatch(r"254[17]\d{8}", p):
        raise MpesaError("Enter a valid Safaricom number, for example 0712 345 678.")
    return p


def _auth() -> str:
    if _token["value"] and _token["exp"] > time.time() + 30:
        return _token["value"]
    try:
        r = requests.get(f"{C.MPESA_BASE}/oauth/v1/generate", params={"grant_type": "client_credentials"},
                         auth=(C.MPESA_CONSUMER_KEY, C.MPESA_CONSUMER_SECRET), timeout=15)
        r.raise_for_status()
        j = r.json()
        _token.update(value=j["access_token"], exp=time.time() + int(j.get("expires_in", 3599)))
        return _token["value"]
    except Exception as e:  # noqa: BLE001
        raise MpesaError("M-Pesa is temporarily unavailable. Please try again shortly.") from e


def _password() -> tuple[str, str]:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return base64.b64encode(f"{C.MPESA_SHORTCODE}{C.MPESA_PASSKEY}{ts}".encode()).decode(), ts


def stk_push(phone: str, amount: int, reference: str, desc: str, callback_url: str) -> dict:
    pw, ts = _password()
    body = {"BusinessShortCode": C.MPESA_SHORTCODE, "Password": pw, "Timestamp": ts, "TransactionType": C.MPESA_TXN_TYPE,
            "Amount": amount, "PartyA": phone, "PartyB": C.MPESA_SHORTCODE, "PhoneNumber": phone,
            "CallBackURL": callback_url, "AccountReference": reference[:12], "TransactionDesc": desc[:13]}
    try:
        r = requests.post(f"{C.MPESA_BASE}/mpesa/stkpush/v1/processrequest", json=body,
                          headers={"Authorization": f"Bearer {_auth()}"}, timeout=20)
        j = r.json()
    except MpesaError:
        raise
    except Exception as e:  # noqa: BLE001
        raise MpesaError("Could not reach M-Pesa. Please try again.") from e
    if j.get("ResponseCode") != "0":
        raise MpesaError(j.get("errorMessage") or j.get("ResponseDescription") or "M-Pesa did not accept the request.")
    return j


def stk_query(checkout_request_id: str) -> dict:
    pw, ts = _password()
    try:
        r = requests.post(f"{C.MPESA_BASE}/mpesa/stkpushquery/v1/query",
                          json={"BusinessShortCode": C.MPESA_SHORTCODE, "Password": pw, "Timestamp": ts,
                                "CheckoutRequestID": checkout_request_id},
                          headers={"Authorization": f"Bearer {_auth()}"}, timeout=20)
        return r.json()
    except MpesaError:
        raise
    except Exception as e:  # noqa: BLE001
        raise MpesaError("Could not reach M-Pesa.") from e
