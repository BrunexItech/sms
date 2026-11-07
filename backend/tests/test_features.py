import re
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
         "level": "Amateur", "dob": "1999-01-01", "gender": "Female", "place": place(), "orgRegNo": "SOC/2020/1234"}
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
    # online payment is not live in tests, so approval is allowed without a paid fee by default ...
    admin = staff("super.admin@sports.example.ke")
    assert admin.get("/api/bootstrap?facilities=0").json()["payments"]["required"] is False
    # ... until an administrator requires it: then review does not need payment, approval does
    assert reg.put("/api/control/payment-rule", json={"required": True}).status_code == 403
    assert admin.put("/api/control/payment-rule", json={"required": True}).status_code == 200
    assert reg.post(f"/api/applications/{b['id']}/transition", json={"action": "approve"}).status_code == 409
    assert admin.put("/api/control/payment-rule", json={"required": False}).status_code == 200
    ok = reg.post(f"/api/applications/{b['id']}/transition", json={"action": "approve"})
    assert ok.status_code == 200 and ok.json()["application"]["payment"]["status"] == "Pending"
    assert "without payment" in ok.json()["application"]["history"][-1]["action"]
    assert admin.put("/api/control/payment-rule", json={"required": True}).status_code == 200
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


def test_staff_and_applicant_entrances_are_separate(client_factory):
    c = client_factory()
    staff_login = {"identifier": "registrar@sports.example.ke", "password": PW}
    # staff credentials on the public (applicant) sign-in are refused with a pointer to the staff portal
    r = c.post("/api/auth/login", json={**staff_login, "audience": "member"})
    assert r.status_code == 403 and "staff sign-in" in r.json()["detail"]
    assert c.get("/api/bootstrap?facilities=0").json()["me"] is None  # no session was created
    assert c.post("/api/auth/login", json={**staff_login, "audience": "staff"}).status_code == 200
    # an applicant at the staff portal gets the same generic failure as a wrong password
    d = client_factory()
    r = d.post("/api/auth/login", json={"identifier": "player@example.co.ke", "password": PW, "audience": "staff"})
    assert r.status_code == 401 and r.json()["detail"] == "Incorrect email/phone or password."
    assert d.post("/api/auth/login", json={"identifier": "player@example.co.ke", "password": PW, "audience": "member"}).status_code == 200


OFFICIALS = [
    {"role": "chairperson-president", "name": "Chair Person"}, {"role": "secretary-general-secretary", "name": "Sec Retary"},
    {"role": "treasurer-finance-officer", "name": "Tre Asurer"}, {"role": "chief-executive-officer-ceo", "name": "Chief Exec"},
]


def test_catalogue_matches_the_document(anon):
    boot = anon.get("/api/bootstrap?facilities=0").json()
    roles = boot["catalogue"]["roles"]
    assert len(roles) == 155
    groups = {r["group"] for r in roles}
    assert {"Club leadership and administration", "Teams and coaching", "Officials and competitions",
            "Health, welfare and integrity", "Operations and communications", "Athletics roles", "Esports roles"} <= groups
    assert any(r["name"] == "Treasurer/Finance Officer" for r in roles)
    feds = {f["sportId"]: f for f in boot["federations"]}
    assert len(feds) >= 49 and feds["squash"]["name"] == "Kenya Squash Rackets Association"
    assert feds["netball"]["name"] == "Kenya Netball Association"  # document's wording, not the earlier brief's
    assert feds["special-olympics"]["name"] == "Special Olympics Kenya" and "other" in feds
    assert all(f["status"] == "To be confirmed" for f in feds.values())  # nothing claimed as verified


def test_club_officials_and_personnel_roles(client_factory):
    c = client_factory()
    base = dict(type="Club", clubName="Treasury Test FC", sport="football")
    # treasurer is required, as are chairperson and secretary
    no_treasurer = [o for o in OFFICIALS if o["role"] != "treasurer-finance-officer"]
    assert c.post("/api/registrations", json=body(**base, clubOfficials=no_treasurer)).status_code == 422
    assert c.post("/api/registrations", json=body(**base, clubOfficials=OFFICIALS + [{"role": "head-coach", "name": "Not Leadership"}])).status_code == 422
    r = c.post("/api/registrations", json=body(**base, clubOfficials=OFFICIALS + [{"role": "vice-chairperson-vice-president", "name": "Vice Chair", "phone": "0712000009"}]))
    assert r.status_code == 201, r.text
    assert [o["role"] for o in r.json()["application"]["clubOfficials"]][:2] == ["chairperson-president", "secretary-general-secretary"]

    d = client_factory()
    person = dict(dob="1990-01-01", gender="Male")
    # a coach must pick a role of the matching type
    assert d.post("/api/registrations", json=body(type="Coach", **person)).status_code == 422
    assert d.post("/api/registrations", json=body(type="Coach", role="team-doctor", **person)).status_code == 422
    ok = d.post("/api/registrations", json=body(type="Coach", role="head-coach", **person))
    assert ok.status_code == 201 and ok.json()["application"]["roleName"] == "Head Coach"
    # sport-specific roles only fit their sport
    e = client_factory()
    assert e.post("/api/registrations", json=body(type="Coach", role="sprints-coach", sport="football", **person)).status_code == 422
    assert e.post("/api/registrations", json=body(type="Coach", role="sprints-coach", sport="athletics", **person)).status_code == 201
    # officials, health and operations are separate registrations in the same system
    for typ, role in [("Match / Competition Official", "referee"), ("Health & Welfare Staff", "physiotherapist"),
                      ("Operations & Admin Staff", "media-and-communications-officer")]:
        assert client_factory().post("/api/registrations", json=body(type=typ, role=role, **person)).status_code == 201, typ
    # "other" sport needs a name for the Registrar to review
    f = client_factory()
    assert f.post("/api/registrations", json=body(sport="other")).status_code == 422
    g = f.post("/api/registrations", json=body(sport="other", sportOther="Mbao (traditional board game)"))
    assert g.status_code == 201 and g.json()["application"]["sportOther"].startswith("Mbao")


def test_catalogue_sync_updates_untouched_rows_only(client_factory, staff):
    from app.models import Federation
    from app.seed import sync_catalogue
    with SessionLocal() as db:
        db.get(Federation, "judo").name = "Kenya Judo Federation"          # an old, unedited name
        db.get(Federation, "karate").name = "Registrar's confirmed name"   # edited by a person
        db.get(Federation, "karate").status = "Recognised"
        db.get(Federation, "squash").status = "Recognised"
        db.commit()
        sync_catalogue(db)
        assert db.get(Federation, "judo").name == "Kenya Judo Association"
        assert db.get(Federation, "karate").name == "Registrar's confirmed name"
        db.delete(db.get(Federation, "triathlon"))
        db.commit()
        sync_catalogue(db)
        assert db.get(Federation, "triathlon") is not None and db.get(Federation, "squash").status == "Recognised"


def test_frontend_and_backend_sport_catalogues_match():
    """src/data/sports.ts and app/refdata.py must list the same sports, or pickers and validation drift apart."""
    import pathlib
    ts = (pathlib.Path(__file__).resolve().parents[2] / "src" / "data" / "sports.ts").read_text()
    front = set(re.findall(r'^\s*s\("([a-z0-9-]+)"', ts, flags=re.M))
    assert front == R.SPORT_IDS, (front ^ R.SPORT_IDS)
    imgs = pathlib.Path(__file__).resolve().parents[2] / "public" / "sports"
    assert all((imgs / f"{i}.jpg").exists() for i in front), [i for i in front if not (imgs / f"{i}.jpg").exists()]


def test_public_club_register_and_player_roles(client_factory, staff):
    club = dict(type="Club", clubName="Public Register FC", sport="football")
    c = client_factory()
    r = c.post("/api/registrations", json=body(**club, clubOfficials=OFFICIALS))
    assert r.status_code == 201, r.text
    # pending clubs are not listed; the endpoint needs no sign-in and carries no personal data
    anon = client_factory()
    assert "Public Register FC" not in anon.get("/api/clubs").text
    pay(c, r.json()["application"]["id"])
    reg = staff("registrar@sports.example.ke")
    aid = r.json()["application"]["id"]
    assert reg.post(f"/api/applications/{aid}/transition", json={"action": "review"}).status_code == 200
    reg.post(f"/api/applications/{aid}/transition", json={"action": "approve"})
    listed = anon.get("/api/clubs?q=public register").json()
    if listed["total"]:  # approval may wait for club documents under the evidence rule
        row = listed["rows"][0]
        assert not {"idNo", "kra", "phone", "email"} & set(row)
    # players may pick a player role; a coaching role is refused, a bad id is refused
    assert client_factory().post("/api/registrations", json=body(role="team-captain")).status_code == 201
    assert client_factory().post("/api/registrations", json=body(role="head-coach")).status_code == 422
    # staff can filter independent players
    assert reg.get("/api/directory?tab=players&club=none").status_code == 200
    assert anon.get("/api/directory?tab=players").status_code in (401, 403)


def test_organisation_registration_number_and_contact_person(client_factory):
    base = dict(type="Club", clubName="Reg Number FC", sport="football", clubOfficials=OFFICIALS, kra="")
    # optional: a club without a certificate yet can still register, but a malformed number is refused
    assert client_factory().post("/api/registrations", json=body(**base, orgRegNo="")).status_code == 201
    assert client_factory().post("/api/registrations", json=body(**{**base, "clubName": "Bad Number FC"}, orgRegNo="@@")).status_code == 422
    ok = client_factory().post("/api/registrations", json=body(**base))
    assert ok.status_code == 201, ok.text
    assert ok.json()["application"]["orgRegNo"] == "SOC/2020/1234"
    # a player is not asked for one and it is not stored
    p = client_factory().post("/api/registrations", json=body())
    assert p.status_code == 201 and p.json()["application"]["orgRegNo"] == ""


def test_club_page_lists_only_opted_in_verified_players(client_factory, staff):
    reg = staff("registrar@sports.example.ke")
    c = client_factory()
    r = c.post("/api/registrations", json=body(type="Club", clubName="Roster Page FC", sport="football", clubOfficials=OFFICIALS))
    cid = r.json()["application"]["id"]
    pay(c, cid)
    assert c.post(f"/api/applications/{cid}/media", data={"kind": "document", "title": "Constitution"},
                  files={"file": ("c.pdf", b"%PDF-1.4\n" + b"0" * 64, "application/pdf")}).status_code == 201
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "review"}).status_code == 200
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 200
    anon = client_factory()
    assert anon.get(f"/api/clubs/{cid}").status_code == 200
    shown = c.post("/api/club/players", json={"name": "Listed Player One", "idNo": "31000001", "level": "Amateur",
                                              "dob": "1999-01-01", "gender": "Male", "publicListing": True}).json()["application"]
    hidden = c.post("/api/club/players", json={"name": "Hidden Player Two", "idNo": "31000002", "level": "Amateur",
                                               "dob": "1999-01-01", "gender": "Male"}).json()["application"]
    for p in (shown, hidden):
        pay(c, p["id"])
        reg.post(f"/api/applications/{p['id']}/transition", json={"action": "review"})
        reg.post(f"/api/applications/{p['id']}/transition", json={"action": "approve"})
    page = anon.get(f"/api/clubs/{cid}").json()
    names = [p["name"] for p in page["players"]]
    assert "Listed Player One" in names and "Hidden Player Two" not in names
    assert not {"idNo", "phone", "dob"} & set(page["players"][0])
    assert any(o["role"] == "Treasurer/Finance Officer" for o in page["officials"])
    assert not any({"phone", "email"} & set(o) for o in page["officials"])
    assert c.post(f"/api/applications/{hidden['id']}/listing", json={"listed": True}).status_code == 200
    assert "Hidden Player Two" in [p["name"] for p in anon.get(f"/api/clubs/{cid}").json()["players"]]
    assert anon.get("/api/clubs/NSMP-2026-000000").status_code == 404


def test_federation_and_county_branch_hierarchy(client_factory, staff):
    reg = staff("registrar@sports.example.ke")
    doc = {"kind": "document", "title": "Constitution"}
    pdf = {"file": ("c.pdf", b"%PDF-1.4\n" + b"0" * 64, "application/pdf")}
    base = dict(sport="volleyball", clubOfficials=OFFICIALS, level="Amateur")

    # a branch cannot register before its national federation is verified
    anon = client_factory()
    assert anon.get("/api/federations/volleyball/national").json()["rows"] == []
    assert client_factory().post("/api/registrations", json=body(type="County Branch", clubName="Nakuru Volleyball", **base)).status_code == 422

    # the national federation names president, secretary and treasurer
    fed_c = client_factory()
    no_tr = [o for o in OFFICIALS if o["role"] != "treasurer-finance-officer"]
    assert fed_c.post("/api/registrations", json=body(type="Federation / Association", clubName="Kenya Volleyball Federation", **{**base, "clubOfficials": no_tr})).status_code == 422
    r = fed_c.post("/api/registrations", json=body(type="Federation / Association", clubName="Kenya Volleyball Federation", **base))
    assert r.status_code == 201, r.text
    fid = r.json()["application"]["id"]
    pay(fed_c, fid)
    assert fed_c.post(f"/api/applications/{fid}/media", data=doc, files=pdf).status_code == 201
    assert reg.post(f"/api/applications/{fid}/transition", json={"action": "review"}).status_code == 200
    assert reg.post(f"/api/applications/{fid}/transition", json={"action": "approve"}).status_code == 200

    # approval makes it the sport's federation of record
    page = anon.get("/api/federations/volleyball").json()
    assert page["federation"]["name"] == "Kenya Volleyball Federation" and page["national"]["id"] == fid
    assert {o["role"] for o in page["national"]["officials"]} >= {"Treasurer/Finance Officer"}
    assert anon.get("/api/federations/volleyball/national").json()["rows"][0]["id"] == fid

    # county branch: needs the right parent, then appears under it once verified
    br = client_factory()
    assert br.post("/api/registrations", json=body(type="County Branch", clubName="Nakuru Volleyball", **{**base, "sport": "football"}, parentId=fid)).status_code == 422
    r2 = br.post("/api/registrations", json=body(type="County Branch", clubName="Nakuru Volleyball Association", parentId=fid, **base))
    assert r2.status_code == 201, r2.text
    bid = r2.json()["application"]["id"]
    assert not anon.get("/api/federations/volleyball").json()["branches"]
    pay(br, bid)
    assert br.post(f"/api/applications/{bid}/media", data=doc, files=pdf).status_code == 201
    reg.post(f"/api/applications/{bid}/transition", json={"action": "review"})
    assert reg.post(f"/api/applications/{bid}/transition", json={"action": "approve"}).status_code == 200
    branches = anon.get("/api/federations/volleyball").json()["branches"]
    assert [b["name"] for b in branches] == ["Nakuru Volleyball Association"]
    assert not any({"phone", "email"} & set(o) for o in branches[0]["officials"])
    listed = anon.get("/api/branches?q=nakuru").json()
    assert listed["total"] == 1 and listed["rows"][0]["sport"] == "volleyball" and "phone" not in listed["rows"][0]
    # a federation or branch is not listed as a club, and no public list or profile exposes certificate numbers
    clubs = anon.get("/api/clubs?q=volleyball").json()
    assert not any(r["type"] in ("Federation / Association", "County Branch") for r in clubs["rows"])
    assert anon.get(f"/api/clubs/{fid}").status_code == 404 and anon.get(f"/api/clubs/{bid}").status_code == 404
    for url in ("/api/clubs", "/api/branches", "/api/federations/volleyball"):
        assert "certificateNo" not in anon.get(url).text, url
    assert anon.get("/api/federations/nope").status_code == 404


def test_national_body_is_located_by_county_and_has_no_level(client_factory, staff):
    county_only = {"countyId": place()["countyId"]}
    base = dict(sport="athletics", clubOfficials=OFFICIALS)
    # a federation needs only a county and no competition level; address is kept
    r = client_factory().post("/api/registrations", json=body(type="Federation / Association", clubName="Athletics Test Federation",
                                                              place=county_only, level="", address="Kasarani, off Thika Road", **base))
    assert r.status_code == 201, r.text
    app = r.json()["application"]
    assert app["level"] == "" and app["address"].startswith("Kasarani") and app["place"]["subCounty"] == ""
    # a club still needs the full place and a valid level
    assert client_factory().post("/api/registrations", json=body(type="Club", clubName="Ward Needed FC", place=county_only, sport="football", clubOfficials=OFFICIALS)).status_code == 422
    assert client_factory().post("/api/registrations", json=body(type="Club", clubName="Level Needed FC", level="", sport="football", clubOfficials=OFFICIALS)).status_code == 422
    # a bad county is refused
    assert client_factory().post("/api/registrations", json=body(type="Federation / Association", clubName="Nowhere Federation", place={"countyId": "KE999"}, level="", **base)).status_code == 422
    # the county officer of the head-office county cannot act on a national federation; the Registrar can
    fid = app["id"]
    assert staff("nairobi.sports@sports.example.ke").post(f"/api/applications/{fid}/transition", json={"action": "review"}).status_code == 403
    assert staff("registrar@sports.example.ke").post(f"/api/applications/{fid}/transition", json={"action": "review"}).status_code == 200


def test_simulated_payment_needs_no_otp_and_is_labelled(client_factory, monkeypatch):
    c = client_factory()
    a = make(c)
    # wrong OTP is refused while simulation is off (development)
    assert c.post(f"/api/applications/{a['id']}/pay", json={"method": "M-Pesa", "ref": "0712345678", "otp": "000000"}).status_code == 422
    monkeypatch.setattr(C, "SIMULATE_PAYMENTS", True)
    assert c.get("/api/bootstrap?facilities=0").json()["payments"]["simulate"] is True
    r = c.post(f"/api/applications/{a['id']}/pay", json={"method": "M-Pesa", "ref": "0712345678", "otp": "123456"})
    assert r.status_code == 200, r.text
    pay_ = r.json()["application"]["payment"]
    assert pay_["status"] == "Paid" and pay_["method"] == "M-Pesa (simulated)" and pay_["receipt"]


def test_registrar_publishes_official_event_directly(client_factory, staff):
    from datetime import date as _d, timedelta as _t
    ev = {"name": "National Sports Day 2027", "sport": "athletics", "date": (_d.today() + _t(days=40)).isoformat(),
          "venue": "Kasarani Stadium", "countyId": place()["countyId"], "level": "Professional"}
    assert staff("nairobi.sports@sports.example.ke").post("/api/events/official", json=ev).status_code == 403
    assert client_factory().post("/api/events/official", json=ev).status_code == 401
    r = staff("registrar@sports.example.ke").post("/api/events/official", json=ev)
    assert r.status_code == 201 and r.json()["event"]["status"] == "Approved"
    listed = client_factory().get("/api/bootstrap?facilities=0").json()["events"]
    assert any(e["name"] == "National Sports Day 2027" and e["organiser"] == "Ministry of Sports" for e in listed)
    assert staff("registrar@sports.example.ke").post("/api/events/official", json={**ev, "date": "2020-01-01"}).status_code == 422


def _scan(c, doc_type="player"):
    r = c.post("/api/imports", data={"doc_type": doc_type}, files={"file": ("form.png", PNG, "image/png")})
    assert r.status_code == 201, r.text
    return r.json()["import"]


def test_paper_record_import_player_and_club(client_factory, staff):
    nbo = staff("nairobi.sports@sports.example.ke")
    reg = staff("registrar@sports.example.ke")
    c = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    s = c["s"][0]
    assert client_factory().post("/api/imports", data={"doc_type": "player"}, files={"file": ("f.png", PNG, "image/png")}).status_code == 401
    assert nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("f.exe", b"MZ" + b"0" * 40, "application/octet-stream")}).status_code == 422

    rec = _scan(nbo)
    assert rec["status"] == "Pending" and rec["readerOn"] is False  # no reader key in tests: entered by hand
    messy = {"name": "JOHN KAMAU MWANGI", "id_no": "ID No: 34567891", "phone": "0712 345 678", "dob": "15/04/1990", "gender": "Male",
             "sport": "Athletics", "level": "Amateur", "county": "nairobi COUNTY", "sub_county": s["n"], "ward": s["w"][0]["n"],
             "kra": "a 123456789 z", "certificate_number": "OLD/1999/55"}
    saved = nbo.put(f"/api/imports/{rec['id']}", json={"fields": messy}).json()["import"]
    assert saved["cleaned"]["phone"] == "+254712345678" and saved["cleaned"]["dob"] == "1990-04-15" and saved["cleaned"]["kra"] == "A123456789Z"
    assert saved["cleaned"]["id_no"] == "34567891" and saved["cleaned"]["sport"] == "athletics" and saved["place"]["wardId"]
    assert not saved["warnings"]
    done = nbo.post(f"/api/imports/{rec['id']}/import")
    assert done.status_code == 200, done.text
    app_id = done.json()["applicationId"]
    got = next(a for a in reg.get("/api/bootstrap?facilities=0").json()["applications"] if a["id"] == app_id)
    assert got["legacy"] is True and got["legacyCertNo"] == "OLD/1999/55" and got["status"] == "Submitted"
    assert got["payment"]["status"] == "Paid" and got["payment"]["amount"] == 0 and got["idNo"] == "34567891"
    assert not got.get("publicListed")  # legacy players stay off public club pages until they opt in
    # the same ID in the same sport cannot be imported twice
    again = _scan(nbo)
    nbo.put(f"/api/imports/{again['id']}", json={"fields": messy})
    assert nbo.post(f"/api/imports/{again['id']}/import").status_code == 409
    assert nbo.post(f"/api/imports/{again['id']}/reject", json={"note": "duplicate"}).json()["import"]["status"] == "Rejected"
    # a county officer cannot import a record from another county; the Registrar can
    ug = next(x for x in R.admin()["counties"] if x["n"] == "Uasin Gishu")
    far = _scan(nbo)
    nbo.put(f"/api/imports/{far['id']}", json={"fields": {**messy, "id_no": "45678912", "county": "Uasin Gishu", "sub_county": ug["s"][0]["n"], "ward": ug["s"][0]["w"][0]["n"]}})
    assert nbo.post(f"/api/imports/{far['id']}/import").status_code == 403
    # county officers see their own uploads only; the Registrar sees all
    assert far["id"] not in [x["id"] for x in staff("uasingishu.sports@sports.example.ke").get("/api/imports").json()["imports"]]
    assert far["id"] in [x["id"] for x in reg.get("/api/imports").json()["imports"]]
    assert reg.post(f"/api/imports/{far['id']}/import").status_code == 200
    # a club needs its three officials
    club = _scan(reg, "club")
    base = {"club_name": "Old Paper Club", "name": "Mary Wanjiru Njeri", "id_no": "23456789", "phone": "0722111222", "sport": "football",
            "county": "Nairobi", "sub_county": s["n"], "ward": s["w"][0]["n"], "chair_name": "Peter Otieno", "secretary_name": "Jane Achieng"}
    reg.put(f"/api/imports/{club['id']}", json={"fields": base})
    assert reg.post(f"/api/imports/{club['id']}/import").status_code == 422
    reg.put(f"/api/imports/{club['id']}", json={"fields": {**base, "treasurer_name": "Samuel Kiprop"}})
    assert reg.post(f"/api/imports/{club['id']}/import").status_code == 200


def test_reader_status_never_exposes_the_key(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    assert nbo.get("/api/imports/reader/status").json()["configured"] is False
    monkeypatch.setattr(S, "OCR_API_KEY", "oqk_secret_value")

    class R:
        status_code = 200
    seen = {}

    def fake_get(url, headers=None, timeout=0):
        seen["h"] = headers
        return R()

    monkeypatch.setattr(ocr_client.requests, "get", fake_get)
    res = nbo.get("/api/imports/reader/status")
    assert res.json()["ok"] is True and "oqk_secret_value" not in res.text and seen["h"]["X-API-Key"] == "oqk_secret_value"
    R.status_code = 401
    assert nbo.get("/api/imports/reader/status").json()["ok"] is False


def test_label_reader_takes_values_from_printed_labels():
    from app import label_reader as L
    def line(t, x, y, w=300, c=0.95):
        return {"text": t, "confidence": c, "bbox": [x, y, w, 30]}
    lines = [
        line("PLAYER REGISTRATION FORM", 60, 20),
        line("Full names: JOHN KAMAU MWANGI", 60, 100),
        line("ID No: 34567891", 60, 150),
        line("Date of birth", 60, 200, 160), line("15/04/1990", 260, 200, 150),   # value to the right
        line("Phone", 60, 250, 100), line("0712 345 678", 60, 285, 180),          # value just below
        line("Sport: Athletics", 60, 340),
        line("County: Nairobi", 60, 390),
        line("Parent / Guardian name: Mary Mwangi", 60, 440),
        line("Guardian phone: 0722 111 222", 60, 490),
    ]
    got = L.read("player", lines)
    assert got["name"]["value"] == "JOHN KAMAU MWANGI" and got["id_no"]["value"] == "34567891"
    assert got["dob"]["value"] == "15/04/1990" and got["phone"]["value"] == "0712 345 678"
    assert got["sport"]["value"] == "Athletics" and got["county"]["value"] == "Nairobi"
    assert got["guardian_name"]["value"] == "Mary Mwangi" and got["guardian_phone"]["value"] == "0722 111 222"
    # a label with no value never invents one
    assert "email" not in L.read("player", [line("E-mail", 60, 100)])
    club = L.read("club", [line("Name of Club: Kibera Stars FC", 60, 100), line("Treasurer: Samuel Kiprop", 60, 150), line("Treasurer phone: 0733 000 111", 60, 200)])
    assert club["club_name"]["value"] == "Kibera Stars FC" and club["treasurer_name"]["value"] == "Samuel Kiprop" and club["treasurer_phone"]["value"] == "0733 000 111"


def test_upload_fills_fields_from_the_readers_text(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    monkeypatch.setattr(S, "OCR_API_KEY", "k")

    class R:
        status_code = 200
        def raise_for_status(self): pass
        def json(self):
            return {"lines": [{"text": "Full names: JANE ACHIENG OTIENO", "confidence": 0.93, "bbox": [60, 100, 300, 30]},
                              {"text": "ID No: 23456789", "confidence": 0.9, "bbox": [60, 150, 300, 30]}]}
    monkeypatch.setattr(ocr_client.requests, "post", lambda *a, **k: R())
    rec = _scan(nbo)
    assert rec["readerOn"] is True and rec["fields"]["name"] == "Jane Achieng Otieno" and rec["suggestions"]["id_no"]["confidence"] == 0.9
    R.status_code = 404
    assert _scan(nbo)["readerOn"] is False  # text service missing: officer keys by hand, nothing breaks


def _reader_lines(sub, ward, conf=0.95, extra=()):
    def ln(t, i, c=conf):
        return {"text": t, "confidence": c, "bbox": [60, 80 + i * 45, 320, 30]}
    rows = ["Full names: JANE ACHIENG OTIENO", "ID No: 23456789", "Date of birth: 12/03/1998", "Gender: Female", "Sport: Athletics",
            "County: Nairobi", f"Sub-county: {sub}", f"Ward: {ward}", *extra]
    return [ln(t, i) for i, t in enumerate(rows)]


def test_a_confident_scan_is_registered_without_anyone_typing(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo, admin = staff("nairobi.sports@sports.example.ke"), staff("super.admin@sports.example.ke")
    c = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    sub, ward = c["s"][0]["n"], c["s"][0]["w"][0]["n"]
    monkeypatch.setattr(S, "OCR_API_KEY", "k")
    lines = {"v": _reader_lines(sub, ward)}

    class Rsp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"lines": lines["v"]}
    monkeypatch.setattr(ocr_client.requests, "post", lambda *a, **k: Rsp())

    # by default every read waits for an officer to look at the scan and press Approve
    first = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("z.png", PNG, "image/png")}).json()
    assert first["autoImported"] is False and first["import"]["status"] == "Pending" and first["import"]["fields"]["name"] == "Jane Achieng Otieno"
    assert nbo.post(f"/api/imports/{first['import']['id']}/reject", json={"note": "test"}).status_code == 200
    # an administrator may let clear scans skip the check
    assert admin.put("/api/imports/rule", json={"auto": True, "minConfidence": 0.85}).status_code == 200
    res = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("a.png", PNG, "image/png")}).json()
    assert res["autoImported"] is True and res["applicationId"] and res["import"]["status"] == "Imported"
    app = next(a for a in staff("registrar@sports.example.ke").get("/api/bootstrap?facilities=0").json()["applications"] if a["id"] == res["applicationId"])
    assert app["legacy"] and app["status"] == "Submitted" and app["name"] == "Jane Achieng Otieno" and "automatically" in app["history"][-1]["action"]

    # the same person again: a duplicate is never auto-imported, it waits for an officer with the reason
    dup = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("b.png", PNG, "image/png")}).json()
    assert dup["autoImported"] is False and dup["import"]["status"] == "Pending" and "already registered" in dup["import"]["note"]

    # a doubtful read (low confidence) waits for a check
    lines["v"] = _reader_lines(sub, ward, conf=0.6, extra=["Email: x@y.co"])
    lines["v"][1]["text"] = "ID No: 34567890"
    low = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("c.png", PNG, "image/png")}).json()
    assert low["autoImported"] is False and low["import"]["status"] == "Pending"

    # an administrator can switch automatic import off
    lines["v"] = _reader_lines(sub, ward)
    lines["v"][1]["text"] = "ID No: 45678901"
    assert nbo.put("/api/imports/rule", json={"auto": False, "minConfidence": 0.85}).status_code == 403
    assert admin.put("/api/imports/rule", json={"auto": False, "minConfidence": 0.85}).status_code == 200
    off = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("d.png", PNG, "image/png")}).json()
    assert off["autoImported"] is False and off["import"]["status"] == "Pending"
    assert admin.put("/api/imports/rule", json={"auto": True, "minConfidence": 0.85}).status_code == 200


def test_embedded_scanner_token_and_fields(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    assert nbo.post("/api/imports/reader/embed", json={"docType": "player"}).status_code == 503  # no key: nothing to open
    monkeypatch.setattr(S, "OCR_API_KEY", "oqk_secret")

    class Rsp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"token": "short-lived-token"}
    seen = {}
    def fake_post(url, headers=None, **k):
        seen["url"], seen["key"] = url, (headers or {}).get("X-API-Key")
        return Rsp()
    monkeypatch.setattr(ocr_client.requests, "post", fake_post)
    res = nbo.post("/api/imports/reader/embed", json={"docType": "player"})
    assert res.status_code == 200 and "short-lived-token" in res.json()["url"] and "/embed/scan?" in res.json()["url"]
    assert "oqk_secret" not in res.text and seen["url"].endswith("/api/embed/token") and seen["key"] == "oqk_secret"
    monkeypatch.setattr(S, "OCR_TYPE_PLAYER", "type-123")
    assert "&type_id=type-123" in nbo.post("/api/imports/reader/embed", json={"docType": "player"}).json()["url"]
    assert "type_id" not in nbo.post("/api/imports/reader/embed", json={"docType": "club"}).json()["url"]

    # what the scanner posts back (list or map, its own key names) becomes our fields, ready for Approve
    import json as _j
    scanned = _j.dumps([{"key": "full_name", "value": "PETER OTIENO", "confidence": 0.9}, {"key": "id_number", "value": "12345678"},
                        {"key": "date_of_birth", "value": "01/02/1995"}, {"key": "unknown_thing", "value": "x"}])
    r = nbo.post("/api/imports", data={"doc_type": "player", "scanned": scanned}, files={"file": ("s.png", PNG, "image/png")}).json()["import"]
    assert r["readerOn"] and r["fields"] == {"name": "Peter Otieno", "id_no": "12345678", "dob": "1995-02-01"}
    assert r["suggestions"]["name"]["confidence"] == 0.9 and r["suggestions"]["id_no"]["confidence"] == 0.8
    assert r["cleaned"]["dob"] == "1995-02-01"


def test_uploaded_image_is_read_by_the_readers_form_type(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    monkeypatch.setattr(S, "OCR_API_KEY", "oqk_k")
    monkeypatch.setattr(S, "OCR_TYPE_PLAYER", "type-player")
    ocr_client._TOKEN.update({"v": None, "exp": 0.0})
    calls = []

    class Rsp:
        status_code = 200
        def __init__(self, body): self.body = body
        def raise_for_status(self): pass
        def json(self): return self.body

    def fake_post(url, headers=None, files=None, data=None, timeout=0):
        calls.append((url, dict(headers or {}), dict(data or {})))
        if url.endswith("/api/embed/token"):
            return Rsp({"token": "tok-1", "expires_in": 900})
        return Rsp({"fields": [{"key": "full_name", "value": "John Kamau Mwangi", "confidence": 0.8754, "bbox": None},
                               {"key": "id_number", "value": "12345678", "confidence": 0.8754, "bbox": None},
                               {"key": "phone", "value": "", "confidence": 0.0, "bbox": None}]})
    monkeypatch.setattr(ocr_client.requests, "post", fake_post)
    r = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("p.png", PNG, "image/png")}).json()["import"]
    assert r["readerOn"] and r["fields"] == {"name": "John Kamau Mwangi", "id_no": "12345678"}  # blank phone stays blank
    extract = next(c for c in calls if c[0].endswith("/api/embed/extract"))
    assert extract[1] == {"X-Embed-Token": "tok-1"} and extract[2] == {"kind": "document", "type_id": "type-player"}
    # the token is reused for the next upload within its lifetime
    nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("q.png", PNG, "image/png")})
    assert sum(1 for c in calls if c[0].endswith("/api/embed/token")) == 1
    # a PDF is not sent to the reader: the officer is told why
    pdf = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("f.pdf", b"%PDF-1.4\n" + b"0" * 40, "application/pdf")}).json()["import"]
    assert pdf["readerOn"] is False and "image" in pdf["reader"]


def test_deleting_a_paper_record_removes_it_completely_and_old_ones_expire(staff, client_factory):
    from datetime import datetime, timedelta, timezone
    from pathlib import Path
    from app.db import SessionLocal
    from app.imports import purge_scans
    from app.models import LegacyImport
    nbo, admin = staff("nairobi.sports@sports.example.ke"), staff("super.admin@sports.example.ke")
    rec = _scan(nbo)
    with SessionLocal() as db:
        path = Path(db.get(LegacyImport, rec["id"]).path)
    assert path.exists() and nbo.get(f"/api/imports/{rec['id']}/image").status_code == 200
    assert client_factory().delete(f"/api/imports/{rec['id']}").status_code == 401
    assert nbo.delete(f"/api/imports/{rec['id']}").status_code == 200
    # nothing is left: no file, no row, not in any list
    assert not path.exists()
    assert nbo.get(f"/api/imports/{rec['id']}").status_code == 404 and nbo.get(f"/api/imports/{rec['id']}/image").status_code == 404
    assert rec["id"] not in [x["id"] for x in admin.get("/api/imports").json()["imports"]]
    with SessionLocal() as db:
        assert db.get(LegacyImport, rec["id"]) is None

    # a finished record older than the retention period is removed completely by the daily sweep; a pending one never is
    old, fresh, pending = _scan(nbo), _scan(nbo), _scan(nbo)
    nbo.post(f"/api/imports/{old['id']}/reject", json={"note": "x"})
    nbo.post(f"/api/imports/{fresh['id']}/reject", json={"note": "x"})
    with SessionLocal() as db:
        db.get(LegacyImport, old["id"]).updated_at = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat(timespec="seconds")
        db.get(LegacyImport, pending["id"]).updated_at = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat(timespec="seconds")
        old_path = Path(db.get(LegacyImport, old["id"]).path)
        db.commit()
        assert purge_scans(db) >= 1
        assert db.get(LegacyImport, old["id"]) is None and not old_path.exists()
        assert db.get(LegacyImport, fresh["id"]) is not None and db.get(LegacyImport, pending["id"]) is not None
    assert admin.put("/api/imports/rule", json={"auto": False, "minConfidence": 0.85, "retentionDays": 7}).json()["retentionDays"] == 7
    assert admin.put("/api/imports/rule", json={"auto": False, "minConfidence": 0.85, "retentionDays": 30}).status_code == 200


def test_values_misread_by_real_ocr_are_repaired():
    """Strings taken from a real OCR run over printed forms and phone photos."""
    from app.imports import clean
    from app import label_reader as L
    f, warn, place = clean("club", {"org_reg_no": "S0C/2019/04512", "id_no": "23456789", "phone": "0722111222", "ward": "KayoleNorth",
                                    "county": "NAIROBI", "sub_county": "Embakasi Central", "kra": "A12345678OZ"})
    assert f["org_reg_no"] == "SOC/2019/04512" and f["phone"] == "+254722111222" and f["kra"] == "A123456780Z"
    assert (f["county"], f["sub_county"], f["ward"]) == ("Nairobi", "Embakasi Central", "Kayole North") and place["wardId"]
    assert clean("player", {"id_no": "3456789l"})[0]["id_no"] == "34567891"  # a lower-case L read for a 1
    assert clean("player", {"id_no": "A1234567"})[0]["id_no"] == "A1234567"  # a passport keeps its letter
    assert clean("player", {"id_no": "B1234567"})[0]["id_no"] == "B1234567"
    # "Contact ID Number" on a club form is the contact person's ID, not unmatched text
    assert L.read("club", [{"text": "Contact ID Number: 23456789", "confidence": 0.9, "bbox": [0, 0, 300, 30]}])["id_no"]["value"] == "23456789"


def test_a_blank_field_never_takes_the_next_label_as_its_value():
    """From a real OCR run: empty Guardian fields and an empty Certificate Number, followed by Signature and Date lines."""
    from app import label_reader as L
    def ln(t, y, x=60, w=420):
        return {"text": t, "confidence": 0.95, "bbox": [x, y, w, 30]}
    lines = [ln("Ward: Kayole North", 100), ln("Guardian Name:", 150), ln("Guardian Phone:", 200), ln("Guardian Relationship:", 250),
             ln("Certificate Number:", 300), ln("Signature: ____________________", 380), ln("Date: ____________", 450)]
    got = L.read("player", lines)
    assert got["ward"]["value"] == "Kayole North"
    for k in ("guardian_name", "guardian_phone", "guardian_relationship", "certificate_number"):
        assert k not in got, (k, got.get(k))
    # a value on the line below is still found when the next line is not a label
    got = L.read("player", [ln("Phone", 100, w=120), ln("0712 345 678", 140, w=240)])
    assert got["phone"]["value"] == "0712 345 678"


def test_label_matching_is_word_bounded_and_values_that_look_like_labels_survive():
    from app import label_reader as L
    def ln(t, y): return {"text": t, "confidence": 0.9, "bbox": [60, y, 400, 30]}
    # "Wardhere" is a value, not the label "Ward"; "Team Alpha" is a club name that starts with a label word
    assert "ward" not in L.read("player", [ln("Wardhere", 100)])
    assert L.read("club", [ln("Name of Club: Team Alpha Sports", 100)])["club_name"]["value"] == "Team Alpha Sports"
    assert L.read("player", [ln("Sports Day Form", 100)]) == {}


def test_garbled_labels_and_levels_from_a_poor_scan_are_recovered():
    """Strings from a real OCR run over a dim, blurred phone photo."""
    from app import label_reader as L
    from app.imports import clean
    def ln(t, y): return {"text": t, "confidence": 0.84, "bbox": [60, y, 400, 30]}
    got = L.read("player", [ln("REPUBLICOFKENYA-SPORTSREGISTRY-PLAYERFORM", 40), ln("Names:PETEROTIENO ODHIAMBO", 100), ln("DO.B:03/11/1998", 140),
                            ln("E-mait:peter.ojexample.co.ke", 180), ln("Diseiplie: Football", 220), ln("Category:Sem-Profesuonal", 260),
                            ln("County Nairohd", 300), ln("Coustitueney Embekasi East", 340), ln("Ward:Lower Savanna", 380)])
    assert got["dob"]["value"] == "03/11/1998" and got["email"]["value"] == "peter.ojexample.co.ke" and got["sport"]["value"] == "Football"
    assert got["level"]["value"] == "Sem-Profesuonal" and got["county"]["value"] == "Nairohd" and got["sub_county"]["value"] == "Embekasi East"
    f, warn, place = clean("player", {k: v["value"] for k, v in got.items()})
    assert f["level"] == "Semi-Professional" and f["county"] == "Nairobi" and f["sub_county"] == "Embakasi East" and f["sport"] == "football"
    assert any("email" in w.lower() for w in warn)  # the lost @ is flagged for the officer
    # titles are not mistaken for fields
    assert L.read("player", [ln("MINISTRY OF SPORTS REGISTRY", 40), ln("Sports Day Form", 80)]) == {}


def test_a_name_with_lost_spaces_is_flagged_for_the_officer():
    from app.imports import clean
    assert any("spaces" in w for w in clean("player", {"name": "PETEROTIENOODHIAMBO"})[1])
    assert not any("spaces" in w for w in clean("player", {"name": "Peter Otieno Odhiambo"})[1])


def test_a_pdf_is_split_into_one_paper_record_per_page(staff, monkeypatch):
    import io
    from reportlab.pdfgen import canvas as rl
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    buf = io.BytesIO()
    c = rl.Canvas(buf)
    for n in range(2):
        c.setFont("Helvetica", 18)
        c.drawString(72, 700, f"Full Name: Test Person Page{n + 1}")
        c.drawString(72, 660, f"ID No: 3456789{n}")
        c.showPage()
    c.save()
    seen = []

    class Rsp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"lines": [{"text": "Full Name: PDF PERSON", "confidence": 0.9, "bbox": [60, 100, 300, 30]}]}
    def fake_post(url, headers=None, files=None, **k):
        seen.append(files["file"][2]); return Rsp()
    monkeypatch.setattr(S, "OCR_API_KEY", "k")
    monkeypatch.setattr(ocr_client.requests, "post", fake_post)
    res = nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": ("forms.pdf", buf.getvalue(), "application/pdf")}).json()
    assert len(res["imports"]) == 2 and [r["fileName"] for r in res["imports"]] == ["forms (page 1).png", "forms (page 2).png"]
    assert all(r["mime"] == "image/png" and r["readerOn"] and r["fields"]["name"] == "Pdf Person" for r in res["imports"])
    assert seen == ["image/png", "image/png"]  # the reader receives images, never the PDF
    img = nbo.get(f"/api/imports/{res['imports'][0]['id']}/image")
    assert img.status_code == 200 and img.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_a_person_can_claim_a_record_imported_from_paper(client_factory, staff, monkeypatch):
    nbo = staff("nairobi.sports@sports.example.ke")
    c = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    s = c["s"][0]
    fields = {"name": "Claim Me Please", "id_no": "67890123", "dob": "02/02/1996", "gender": "Female", "sport": "volleyball", "level": "Amateur",
              "phone": "0711 222 333", "county": "Nairobi", "sub_county": s["n"], "ward": s["w"][0]["n"]}
    rec = _scan(nbo)
    nbo.put(f"/api/imports/{rec['id']}", json={"fields": fields})
    aid = nbo.post(f"/api/imports/{rec['id']}/import").json()["applicationId"]

    me = client_factory()
    make(me)                                  # an ordinary applicant with an account
    assert client_factory().post("/api/claim-record", json={"idNo": "67890123"}).status_code == 401
    bad = me.post("/api/claim-record", json={"idNo": "67890123", "dob": "03/03/1996", "phone": "0711222333"})
    assert bad.status_code == 404 and "could not match" in bad.json()["detail"]   # wrong date of birth: says nothing about which part
    assert me.post("/api/claim-record", json={"idNo": "67890123", "dob": "02/02/1996", "phone": "0700000000"}).status_code == 404
    assert me.post("/api/claim-record", json={"idNo": "67890123", "dob": "02/02/1996"}).status_code == 422
    ok = me.post("/api/claim-record", json={"idNo": "67890123", "dob": "02/02/1996", "phone": "0711 222 333"})
    assert ok.status_code == 200 and ok.json()["application"]["id"] == aid and ok.json()["application"]["idNo"] == "67890123"
    mine = [a["id"] for a in me.get("/api/bootstrap?facilities=0").json()["applications"]]
    assert aid in mine
    # once claimed, nobody else can claim it
    other = client_factory(); make(other)
    assert other.post("/api/claim-record", json={"idNo": "67890123", "dob": "02/02/1996", "phone": "0711222333"}).status_code == 404
    assert staff("registrar@sports.example.ke").post("/api/claim-record", json={"idNo": "1", "phone": "1"}).status_code == 403


def test_email_status_and_test_message(staff, monkeypatch):
    from app import notify, settings as S
    admin, nbo = staff("super.admin@sports.example.ke"), staff("nairobi.sports@sports.example.ke")
    assert nbo.get("/api/control/email").status_code == 403
    assert admin.get("/api/control/email").json()["configured"] is False
    assert admin.post("/api/control/email/test").status_code == 409
    monkeypatch.setattr(S, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(S, "SMTP_FROM", "no-reply@example.ke")
    sent = {}
    monkeypatch.setattr(notify, "send_now", lambda to, subj, body: sent.update(to=to) or None)
    assert admin.get("/api/control/email").json()["configured"] is True
    assert admin.post("/api/control/email/test").json()["ok"] is True and sent["to"] == "super.admin@sports.example.ke"
    monkeypatch.setattr(notify, "send_now", lambda *a: "SMTPAuthenticationError: bad password")
    r = admin.post("/api/control/email/test")
    assert r.status_code == 502 and "bad password" in r.json()["detail"]


def _png(w=1200, h=1600, blur=0.0, shade=255):
    import io, random
    from PIL import Image, ImageDraw, ImageFilter
    im = Image.new("RGB", (w, h), (shade, shade, shade))
    d = ImageDraw.Draw(im)
    r = random.Random(3)
    for y in range(60, h - 60, 40):  # rows of text-like strokes
        x = 60
        while x < w - 120:
            ww = r.randint(18, 90)
            d.rectangle((x, y, x + ww, y + 16), fill=(20, 20, 20))
            x += ww + 14
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur)).resize((w // 2, h // 2))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def test_poor_scans_are_flagged_and_the_same_file_twice_is_noticed(staff):
    nbo = staff("nairobi.sports@sports.example.ke")
    up = lambda data, name: nbo.post("/api/imports", data={"doc_type": "player"}, files={"file": (name, data, "image/png")}).json()["import"]
    good = up(_png(), "good.png")
    assert good["quality"]["ok"] is True and good["quality"]["issues"] == [] and good["duplicateOf"] is None
    bad = up(_png(w=1000, h=1400, blur=6.0), "blurry.png")
    assert bad["quality"]["ok"] is False and any("blurry" in i or "small" in i for i in bad["quality"]["issues"])
    dark = up(_png(shade=40), "dark.png")
    assert any("dark" in i for i in dark["quality"]["issues"])
    again = up(_png(), "good-again.png")  # byte-identical to the first upload
    assert again["duplicateOf"] and again["duplicateOf"]["id"] == good["id"]


def test_one_form_over_several_pages_merges_the_fields(staff, monkeypatch):
    import io
    from reportlab.pdfgen import canvas as rl
    from app import ocr_client, settings as S
    nbo = staff("nairobi.sports@sports.example.ke")
    buf = io.BytesIO()
    c = rl.Canvas(buf)
    for n in range(2):
        c.drawString(72, 700, f"page {n + 1}")
        c.showPage()
    c.save()
    answers = iter([{"lines": [{"text": "Full Name: Two Page Person", "confidence": 0.9, "bbox": [60, 100, 300, 30]}]},
                    {"lines": [{"text": "Full Name: WRONG LATER NAME", "confidence": 0.9, "bbox": [60, 100, 300, 30]},
                               {"text": "ID No: 45678901", "confidence": 0.9, "bbox": [60, 150, 300, 30]}]}])

    class Rsp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return next(answers)
    monkeypatch.setattr(S, "OCR_API_KEY", "k")
    monkeypatch.setattr(ocr_client.requests, "post", lambda *a, **k: Rsp())
    res = nbo.post("/api/imports", data={"doc_type": "player", "one_form": "1"}, files={"file": ("two.pdf", buf.getvalue(), "application/pdf")}).json()
    assert len(res["imports"]) == 1 and res["import"]["pageCount"] == 2
    assert res["import"]["fields"]["name"] == "Two Page Person" and res["import"]["fields"]["id_no"] == "45678901"  # page 2 fills the gap, never overwrites
    assert nbo.get(f"/api/imports/{res['import']['id']}/image?page=2").status_code == 200
    assert nbo.get(f"/api/imports/{res['import']['id']}/image?page=3").status_code == 410
    from pathlib import Path
    from app.db import SessionLocal
    from app.models import LegacyImport
    with SessionLocal() as db:
        files = [Path(db.get(LegacyImport, res["import"]["id"]).path), *map(Path, db.get(LegacyImport, res["import"]["id"]).ocr["pages"])]
    assert all(f.exists() for f in files)
    assert nbo.delete(f"/api/imports/{res['import']['id']}").status_code == 200
    assert not any(f.exists() for f in files)  # every page file goes with the record


def test_suspect_fields_are_flagged_and_accuracy_is_counted(staff, monkeypatch):
    from app import ocr_client, settings as S
    nbo, admin = staff("nairobi.sports@sports.example.ke"), staff("super.admin@sports.example.ke")
    c = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    s = c["s"][0]
    lines = [("Full Name", "PETEROTIENOODHIAMBO"), ("ID No", "12345678"), ("Date of Birth", "01/02/1995"), ("Gender", "Male"), ("Sport", "Athletics"),
             ("County", "Nairobi"), ("Sub-County", s["n"]), ("Ward", s["w"][0]["n"]), ("Phone", "0712345678")]

    class Rsp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"lines": [{"text": f"{k}: {v}", "confidence": 0.9, "bbox": [60, 80 + i * 45, 320, 30]} for i, (k, v) in enumerate(lines)]}
    monkeypatch.setattr(S, "OCR_API_KEY", "k")
    monkeypatch.setattr(ocr_client.requests, "post", lambda *a, **k: Rsp())
    before = admin.get("/api/imports/accuracy").json()
    rec = _scan(nbo)
    assert "name" in rec["flags"] and "spaces" in rec["flags"]["name"] and "id_no" not in rec["flags"]   # the merged name is the one to check
    # the officer fixes the name and adds the email the reader missed, then approves
    fixed = {**rec["fields"], "name": "Peter Otieno Odhiambo", "email": "p@example.co.ke"}
    assert nbo.put(f"/api/imports/{rec['id']}", json={"fields": fixed}).json()["import"]["flags"] == {}
    assert nbo.post(f"/api/imports/{rec['id']}/import").status_code == 200
    after = admin.get("/api/imports/accuracy").json()
    assert after["records"] == before["records"] + 1
    by = {f["field"]: f for f in after["fields"]}
    assert by["name"]["corrected"] >= 1 and by["email"]["missed"] >= 1 and by["id_no"]["kept"] >= 1
    assert after["overall"] is not None and 0 < after["overall"] < 1


def test_the_reader_is_retried_once_after_a_server_error(staff, monkeypatch):
    from app import ocr_client, settings as S
    monkeypatch.setattr(ocr_client.time, "sleep", lambda s: None)
    monkeypatch.setattr(S, "OCR_API_KEY", "k")
    calls = []

    class Rsp:
        def __init__(self, code): self.status_code = code
        def raise_for_status(self): pass
        def json(self): return {"lines": [{"text": "Full Name: Retry Person", "confidence": 0.9, "bbox": [60, 100, 300, 30]}]}
    def flaky(*a, **k):
        calls.append(1)
        if len(calls) == 1:
            raise ocr_client.requests.ConnectionError("reader restarting")
        return Rsp(200)
    monkeypatch.setattr(ocr_client.requests, "post", flaky)
    rec = _scan(staff("nairobi.sports@sports.example.ke"))
    assert len(calls) == 2 and rec["readerOn"] and rec["fields"]["name"] == "Retry Person"


def test_empty_schema_read_falls_back_to_label_reading(monkeypatch):
    from app import ocr_client as oc
    class R:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"fields": [{"key": "full_name", "value": ""}]}
    monkeypatch.setattr(oc, "embed_token", lambda fresh=False: "t")
    monkeypatch.setattr(oc, "_post", lambda *a, **k: R())
    monkeypatch.setattr(oc, "read_by_labels", lambda *a, **k: {"available": True, "fields": {"name": {"value": "X"}}, "message": ""})
    out = oc.read_by_type("player", b"x", "a.png", "image/png", "tid")
    assert out["fields"]["name"]["value"] == "X"


def test_reader_polygon_boxes_become_rectangles():
    from app.ocr_client import _box
    assert _box([[80, 150], [520, 150], [520, 180], [80, 180]]) == [80, 150, 440, 30]
    assert _box([1, 2, 3, 4]) == [1, 2, 3, 4] and _box(None) == [0, 0, 0, 0]
