import itertools
from datetime import date, timedelta

import pyotp
from conftest import PW, sign_in

from app import refdata as R
from app import settings as C
from app.db import SessionLocal
from app.models import Application

_n = itertools.count(500)
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


def place():
    c = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    return {"countyId": c["id"], "subId": c["s"][0]["id"], "wardId": c["s"][0]["w"][0]["id"]}


def body(**kw):
    k = next(_n)
    b = {"type": "Player / Sportsperson", "name": f"Feature Person{k} Otieno", "idNo": f"5{k:07d}", "kra": f"A{k:09d}F"[:11],
         "phone": "0712345678", "email": f"f{k}@example.co.ke", "password": "Passw0rdOK", "sport": "football",
         "level": "Amateur", "dob": "1999-01-01", "gender": "Female", "place": place()}
    b.update(kw)
    return b


def make(c, **kw):
    r = c.post("/api/registrations", json=body(**kw))
    assert r.status_code == 201, r.text
    return r.json()["application"]


def pay(c, aid):
    assert c.post(f"/api/applications/{aid}/pay", json={"method": "M-Pesa", "ref": "", "otp": "123456"}).status_code == 200


def to_review(staff, aid):
    assert staff("nairobi.sports@sports.example.ke").post(f"/api/applications/{aid}/transition", json={"action": "review"}).status_code == 200


def test_profile_fields_and_minors(anon):
    assert anon.post("/api/registrations", json=body(dob=None)).status_code == 422
    assert anon.post("/api/registrations", json=body(gender="Unknown")).status_code == 422
    assert anon.post("/api/registrations", json=body(dob="2999-01-01")).status_code == 422
    minor = date.today().replace(year=date.today().year - 12).isoformat()
    assert anon.post("/api/registrations", json=body(dob=minor)).status_code == 422  # no guardian
    g = {"name": "Mary Otieno", "phone": "0712000999", "relationship": "Mother", "consent": False}
    assert anon.post("/api/registrations", json=body(dob=minor, guardian=g)).status_code == 422  # no consent
    ok = anon.post("/api/registrations", json=body(dob=minor, guardian={**g, "consent": True}))
    assert ok.status_code == 201 and ok.json()["application"]["guardian"]["relationship"] == "Mother"
    # honeypot
    assert anon.post("/api/registrations", json=body(website="http://spam")).status_code == 422


def test_evidence_rule_for_individual_professionals(client_factory, staff):
    c = client_factory()
    a = make(c, level="Professional")
    pay(c, a["id"])
    to_review(staff, a["id"])
    reg = staff("registrar@sports.example.ke")
    boot = c.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert boot["evidenceNeeded"] is True
    assert reg.post(f"/api/applications/{a['id']}/transition", json={"action": "approve"}).status_code == 409
    assert c.post(f"/api/applications/{a['id']}/media", data={"kind": "video"}, files={"file": ("v.mp4", MP4, "video/mp4")}).status_code == 201
    assert reg.post(f"/api/applications/{a['id']}/transition", json={"action": "approve"}).status_code == 200
    # amateur individuals are not held to it; the Control Center can switch it off
    sa = staff("super.admin@sports.example.ke")
    b = client_factory()
    p = make(b, level="Semi-Professional")
    pay(b, p["id"])
    to_review(staff, p["id"])
    assert reg.post(f"/api/applications/{p['id']}/transition", json={"action": "approve"}).status_code == 409
    assert sa.put("/api/control/evidence", json={"enabled": False, "levels": ["Professional"], "sports": [], "clubDocuments": True}).status_code == 200
    assert reg.post(f"/api/applications/{p['id']}/transition", json={"action": "approve"}).status_code == 200
    sa.put("/api/control/evidence", json={"enabled": True, "levels": ["Professional", "Semi-Professional"], "sports": [], "clubDocuments": True})
    assert staff("registrar@sports.example.ke").put("/api/control/evidence", json={"enabled": False, "levels": []}).status_code == 403


def test_password_reset_change_and_2fa(client_factory, anon):
    c = client_factory()
    a = make(c)
    email = a["email"]
    r = anon.post("/api/auth/forgot", json={"identifier": email}).json()
    assert r["ok"] and r["devLink"].startswith("/reset?token=")
    token = r["devLink"].split("token=")[1]
    assert anon.post("/api/auth/reset", json={"token": token, "password": "short"}).status_code == 422
    assert anon.post("/api/auth/reset", json={"token": token, "password": "NewPassw0rd"}).status_code == 200
    assert anon.post("/api/auth/reset", json={"token": token, "password": "NewPassw0rd2"}).status_code == 400  # single use
    assert anon.post("/api/auth/forgot", json={"identifier": "nobody@example.com"}).json()["ok"]  # no account enumeration
    me = client_factory()
    assert me.post("/api/auth/login", json={"identifier": email, "password": "NewPassw0rd"}).status_code == 200
    assert me.post("/api/auth/change-password", json={"current": "wrong", "new": "Another1pass"}).status_code == 401
    assert me.post("/api/auth/change-password", json={"current": "NewPassw0rd", "new": "Another1pass"}).status_code == 200
    # two-factor
    s = me.post("/api/auth/2fa/setup").json()
    assert s["qr"].startswith("data:image/png")
    assert me.post("/api/auth/2fa/enable", json={"code": "000000"}).status_code == 422
    assert me.post("/api/auth/2fa/enable", json={"code": pyotp.TOTP(s["secret"]).now()}).status_code == 200
    again = client_factory()
    assert again.post("/api/auth/login", json={"identifier": email, "password": "Another1pass"}).status_code == 428
    assert again.post("/api/auth/login", json={"identifier": email, "password": "Another1pass", "code": "000000"}).status_code == 401
    ok = again.post("/api/auth/login", json={"identifier": email, "password": "Another1pass", "code": pyotp.TOTP(s["secret"]).now()})
    assert ok.status_code == 200


def test_staff_must_change_initial_password(staff, client_factory):
    sa = staff("super.admin@sports.example.ke")
    cid = place()["countyId"]
    r = sa.post("/api/users", json={"name": "Initial Pwd Officer", "email": "initial.pwd@sports.example.ke", "role": "county_officer",
                                    "password": "Initial1pass", "countyId": cid})
    assert r.status_code == 201
    c = client_factory()
    me = c.post("/api/auth/login", json={"identifier": "initial.pwd@sports.example.ke", "password": "Initial1pass"}).json()["me"]
    assert me["mustChangePassword"] is True
    assert c.post("/api/auth/change-password", json={"current": "Initial1pass", "new": "Mine2secure"}).json()["me"]["mustChangePassword"] is False


def test_renewal_appeal_certificate_bulk(client_factory, staff):
    c = client_factory()
    a = make(c)
    pay(c, a["id"])
    nbo, reg = staff("nairobi.sports@sports.example.ke"), staff("registrar@sports.example.ke")
    # bulk: review two at once; failures are reported per item
    d = client_factory()
    b = make(d)
    r = nbo.post("/api/applications/bulk", json={"ids": [a["id"], b["id"], "NSMP-2026-000000"], "action": "review"}).json()
    assert r["done"] == 2 and not next(x for x in r["results"] if x["id"] == "NSMP-2026-000000")["ok"]
    # review does not need payment, approval does
    assert reg.post(f"/api/applications/{b['id']}/transition", json={"action": "approve"}).status_code == 409
    assert reg.post(f"/api/applications/{a['id']}/transition", json={"action": "approve"}).status_code == 200
    ap = c.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert ap["expiresAt"] and ap["certificateNo"]
    # PDF certificate: owner yes, stranger no
    pdf = c.get(f"/api/applications/{a['id']}/certificate.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF") and pdf.headers["content-type"] == "application/pdf"
    assert client_factory().get(f"/api/applications/{a['id']}/certificate.pdf").status_code == 401
    # renewal is not open until 60 days before expiry
    assert c.post(f"/api/applications/{a['id']}/renew").status_code == 409
    with SessionLocal() as db:
        x = db.get(Application, a["id"])
        x.expires_at = (date.today() + timedelta(days=20)).isoformat()
        db.commit()
    assert c.post(f"/api/applications/{a['id']}/renew").json()["application"]["renewing"] is True
    assert c.post(f"/api/applications/{a['id']}/renew").status_code == 409
    pay(c, a["id"])
    renewed = c.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert renewed["renewing"] is False and renewed["expiresAt"] > (date.today() + timedelta(days=300)).isoformat()
    # expired certificates fail verification
    with SessionLocal() as db:
        x = db.get(Application, a["id"])
        x.expires_at = "2020-01-01T00:00:00+00:00"
        db.commit()
    v = client_factory().get(f"/api/verify/{ap['certificateNo']}").json()
    assert v["found"] and v["valid"] is False and v["status"] == "Expired"
    # appeal -> registrar reopens
    e = client_factory()
    rj = make(e)
    pay(e, rj["id"])
    nbo.post(f"/api/applications/{rj['id']}/transition", json={"action": "review"})
    assert reg.post(f"/api/applications/{rj['id']}/transition", json={"action": "reject", "note": "Incomplete"}).status_code == 200
    assert e.post(f"/api/applications/{rj['id']}/appeal", json={"note": "short"}).status_code == 422
    assert e.post(f"/api/applications/{rj['id']}/appeal", json={"note": "I have since supplied the missing documents."}).status_code == 200
    assert e.post(f"/api/applications/{rj['id']}/appeal", json={"note": "Second appeal is refused."}).status_code == 409
    assert nbo.post(f"/api/applications/{rj['id']}/transition", json={"action": "reopen", "note": "ok"}).status_code == 403
    assert reg.post(f"/api/applications/{rj['id']}/transition", json={"action": "reopen", "note": "Appeal accepted"}).status_code == 200
    note = e.get("/api/bootstrap?facilities=0").json()["notifications"]
    assert any("Reopened" in n["title"] for n in note)
    assert e.post("/api/notifications/read").status_code == 200
    assert all(n["read"] for n in e.get("/api/bootstrap?facilities=0").json()["notifications"])


def test_events_submission_and_approval(client_factory, staff):
    club = client_factory()
    sign_in(club, "club.manager@example.co.ke")
    nbi = place()["countyId"]
    ev = {"name": "Kasarani Charity Cup", "sport": "football", "date": (date.today() + timedelta(days=30)).isoformat(),
          "venue": "Kasarani", "countyId": nbi, "level": "Amateur"}
    r = club.post("/api/events", json=ev)
    assert r.status_code == 201
    eid = r.json()["event"]["id"]
    assert eid not in [e["id"] for e in club.get("/api/bootstrap?facilities=0").json()["events"]]  # not public yet
    assert club.post("/api/events", json={**ev, "date": "2020-01-01"}).status_code == 422
    other = client_factory()
    sign_in(other, "player@example.co.ke")
    assert other.post("/api/events", json=ev).status_code == 403  # unverified player
    ug = staff("uasingishu.sports@sports.example.ke")
    assert ug.post(f"/api/events/{eid}/decision", json={"approve": True}).status_code == 403  # other county
    nbo = staff("nairobi.sports@sports.example.ke")
    assert nbo.post(f"/api/events/{eid}/decision", json={"approve": True}).status_code == 200
    assert eid in [e["id"] for e in club.get("/api/bootstrap?facilities=0").json()["events"]]


def test_mpesa_stk_flow_with_callback(client_factory, monkeypatch):
    from app import mpesa
    c = client_factory()
    a = make(c)
    assert c.post("/api/pay/mpesa", json={"applicationIds": [a["id"]], "phone": "0712345678"}).status_code == 501  # not configured
    monkeypatch.setattr(C, "MPESA_READY", True)
    monkeypatch.setattr(mpesa, "stk_push", lambda *x, **k: {"ResponseCode": "0", "CheckoutRequestID": "ws_CO_TEST_1"})
    assert c.post("/api/pay/mpesa", json={"applicationIds": [a["id"]], "phone": "12345"}).status_code == 502  # bad phone
    r = c.post("/api/pay/mpesa", json={"applicationIds": [a["id"]], "phone": "0712345678"})
    assert r.status_code == 201
    aid = r.json()["attemptId"]
    assert c.get(f"/api/pay/attempts/{aid}").json()["status"] == "Pending"
    # the OTP route is closed while M-Pesa is the provider
    assert c.post(f"/api/applications/{a['id']}/pay", json={"method": "M-Pesa", "ref": "", "otp": "123456"}).status_code == 400
    hook = f"/api/mpesa/callback/{C.MPESA_CALLBACK_SECRET}"
    cb = {"Body": {"stkCallback": {"MerchantRequestID": "m1", "CheckoutRequestID": "ws_CO_TEST_1", "ResultCode": 0, "ResultDesc": "ok",
          "CallbackMetadata": {"Item": [{"Name": "Amount", "Value": 500}, {"Name": "MpesaReceiptNumber", "Value": "QJK1ABC234"}]}}}}
    assert client_factory().post("/api/mpesa/callback/wrong-secret", json=cb).status_code == 404
    assert client_factory().post(hook, json=cb).json()["ResultCode"] == 0
    assert client_factory().post(hook, json=cb).json()["ResultCode"] == 0  # replay is harmless
    done = c.get(f"/api/pay/attempts/{aid}").json()
    assert done["status"] == "Success" and done["receipt"] == "QJK1ABC234"
    paid = c.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert paid["payment"]["status"] == "Paid" and paid["payment"]["ref"] == "QJK1ABC234"
    # a cancelled payment leaves the registration unpaid
    b = make(client_factory())
    d = client_factory()
    sign_in(d, "player@example.co.ke")
    mine = [x for x in d.get("/api/bootstrap?facilities=0").json()["applications"] if x["payment"]["status"] == "Pending"]
    if mine:
        monkeypatch.setattr(mpesa, "stk_push", lambda *x, **k: {"ResponseCode": "0", "CheckoutRequestID": "ws_CO_TEST_2"})
        att = d.post("/api/pay/mpesa", json={"applicationIds": [mine[0]["id"]], "phone": "0712345678"}).json()["attemptId"]
        cancel = {"Body": {"stkCallback": {"CheckoutRequestID": "ws_CO_TEST_2", "ResultCode": 1032, "ResultDesc": "Request cancelled by user"}}}
        client_factory().post(hook, json=cancel)
        assert d.get(f"/api/pay/attempts/{att}").json()["status"] == "Cancelled"
