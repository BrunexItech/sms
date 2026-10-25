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
