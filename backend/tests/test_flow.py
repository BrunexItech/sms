import itertools

import pytest
from conftest import PW, sign_in

_n = itertools.count(1)


def place(c):
    from app import refdata as R
    cty = next(x for x in R.admin()["counties"] if x["n"] == "Nairobi")
    s = cty["s"][0]
    return {"countyId": cty["id"], "subId": s["id"], "wardId": s["w"][0]["id"]}


def reg_body(kind="Player / Sportsperson", **kw):
    k = next(_n)
    b = {"type": kind, "name": f"Test Person{k} Kamau", "idNo": f"3{k:07d}", "kra": f"A{k:09d}K"[:11], "phone": "0712345678",
         "email": f"t{k}@example.co.ke", "password": "Passw0rdOK", "sport": "football", "level": "Amateur",
         "dob": "2000-05-05", "gender": "Male",
         "clubName": "", "notes": ""}
    b.update(kw)
    return b


def make(c, **kw):
    b = reg_body(**kw)
    b["place"] = place(c)
    return c.post("/api/registrations", json=b), b


def pay(c, aid):
    return c.post(f"/api/applications/{aid}/pay", json={"method": "M-Pesa", "ref": "", "otp": "123456"})


def test_public_cannot_see_people(anon):
    assert anon.get("/api/directory?tab=players").status_code == 401
    boot = anon.get("/api/bootstrap").json()
    assert boot["me"] is None and "applications" not in boot
    assert len(boot["facilities"]) > 400 and len(boot["federations"]) >= 30


def test_validation(anon):
    b = reg_body()
    b["place"] = place(anon)
    assert anon.post("/api/registrations", json={**b, "name": "Single"}).status_code == 422
    assert anon.post("/api/registrations", json={**b, "kra": "bad"}).status_code == 422
    assert anon.post("/api/registrations", json={**b, "password": "short"}).status_code == 422
    assert anon.post("/api/registrations", json={**b, "place": {"countyId": "x", "subId": "y", "wardId": "z"}}).status_code == 422
    assert anon.post("/api/registrations", json={**b, "type": "Club"}).status_code == 422  # org name + officials


def test_full_club_and_player_workflow(client_factory, staff):
    club_c = client_factory()
    r, b = make(club_c, kind="Club", clubName="Workflow Warriors FC",
                clubOfficials={"chairman": "Chair Person", "ceo": "", "secretary": "Sec Retary", "phone": ""})
    assert r.status_code == 201, r.text
    cid = r.json()["application"]["id"]

    # cannot add players before verification
    pl = {"name": "Early Bird Player", "idNo": "41000001", "level": "Amateur", "dob": "2001-02-03", "gender": "Male"}
    assert club_c.post("/api/club/players", json=pl).status_code == 403
    # cannot approve while unpaid or skip review
    reg = staff("registrar@sports.example.ke")
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 409
    assert pay(club_c, cid).status_code == 200
    assert pay(club_c, cid).status_code == 409  # already paid
    DOC = b"%PDF-1.4\n" + b"0" * 64
    assert nbo_review_first(staff, cid) is None  # county officer reviews before the Registrar can decide
    reg0 = staff("registrar@sports.example.ke")
    assert reg0.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 409  # still no docs / not endorsed
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 409  # still Submitted

    # a club cannot be approved without its constitution / registration documents
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 409
    assert club_c.post(f"/api/applications/{cid}/media", data={"kind": "document", "title": "Constitution"},
                       files={"file": ("c.pdf", DOC, "application/pdf")}).status_code == 201
    # wrong county officer cannot touch it; right one can
    ug = staff("uasingishu.sports@sports.example.ke")
    assert ug.post(f"/api/applications/{cid}/transition", json={"action": "review"}).status_code == 403
    nbo = staff("nairobi.sports@sports.example.ke")
    # (already moved to Under review above)
    # county officer cannot approve
    assert nbo.post(f"/api/applications/{cid}/transition", json={"action": "approve"}).status_code == 403
    # federation admin of another sport cannot endorse
    ath = staff("membership@athletics.example.ke")
    assert ath.post(f"/api/applications/{cid}/transition", json={"action": "endorse"}).status_code == 403
    fb = staff("registrations@fkf.example.ke")
    assert fb.post(f"/api/applications/{cid}/transition", json={"action": "endorse"}).status_code == 200
    # reject needs a reason, approve issues a certificate
    assert reg.post(f"/api/applications/{cid}/transition", json={"action": "reject"}).status_code == 422
    ok = reg.post(f"/api/applications/{cid}/transition", json={"action": "approve"})
    assert ok.status_code == 200 and ok.json()["application"]["certificateNo"].startswith("KE-NSR-2026-")
    cert = ok.json()["application"]["certificateNo"]
    v = client_factory().get(f"/api/verify/{cert}").json()
    assert v["found"] and v["valid"] and v["holder"] == "Workflow Warriors FC" and "idNo" not in v

    # now the club registers players
    p = club_c.post("/api/club/players", json={"name": "Roster Player One", "idNo": "41000002", "level": "Amateur",
                                               "dob": "2001-02-03", "gender": "Female"})
    assert p.status_code == 201, p.text
    pid = p.json()["application"]["id"]
    assert p.json()["application"]["clubId"] == cid and p.json()["application"]["clubName"] == ""
    dup = club_c.post("/api/club/players", json={"name": "Roster Player One", "idNo": "41000002", "dob": "2001-02-03", "gender": "Female"})
    assert dup.status_code == 409
    # club pays for the roster; payment OTP is enforced
    assert club_c.post("/api/club/pay", json={"applicationIds": [pid], "method": "M-Pesa", "otp": "000000"}).status_code == 422
    assert club_c.post("/api/club/pay", json={"applicationIds": [pid], "method": "M-Pesa", "ref": "", "otp": "123456"}).status_code == 200
    # a player cannot be approved without review
    assert reg.post(f"/api/applications/{pid}/transition", json={"action": "approve"}).status_code == 409
    assert nbo.post(f"/api/applications/{pid}/transition", json={"action": "review"}).status_code == 200
    assert reg.post(f"/api/applications/{pid}/transition", json={"action": "approve"}).status_code == 200

    # roster is visible to the club (redacted) and not to another club
    rows = club_c.get("/api/directory?tab=players").json()["rows"]
    assert any(x["id"] == pid and x["name"] == "Roster Player One" for x in rows) and all("idNo" not in x for x in rows)
    other = client_factory()
    make(other, kind="Club", clubName="Other Club FC", clubOfficials={"chairman": "A B", "secretary": "C D"})
    assert other.get("/api/directory?tab=players").status_code == 403  # not verified yet

    # suspension needs a reason and is reversible
    integ = staff("integrity@sports.example.ke")
    assert integ.post(f"/api/applications/{cid}/transition", json={"action": "suspend"}).status_code == 422
    assert integ.post(f"/api/applications/{cid}/transition", json={"action": "suspend", "note": "Inquiry"}).status_code == 200
    assert client_factory().get(f"/api/verify/{cert}").json()["valid"] is False
    assert integ.post(f"/api/applications/{cid}/transition", json={"action": "reinstate", "note": "Cleared"}).status_code == 200


def test_staff_visibility_and_pii(staff):
    fed = staff("membership@athletics.example.ke")
    apps = fed.get("/api/bootstrap?facilities=0").json()["applications"]
    assert apps and all(a["sport"] == "athletics" for a in apps)
    assert all(a["idNo"] == "" and a["email"] == "" for a in apps)
    nbo = staff("nairobi.sports@sports.example.ke").get("/api/bootstrap?facilities=0").json()["applications"]
    assert nbo and all(a["place"]["county"] == "Nairobi" for a in nbo)
    assert any(a["idNo"] for a in nbo)
    ict = staff("ict@sports.example.ke").get("/api/bootstrap?facilities=0").json()
    assert "applications" not in ict and len(ict["staff"]) >= 9
    fin = staff("finance@sports.example.ke").get("/api/bootstrap?facilities=0").json()["applications"]
    assert fin and all(a["idNo"] == "" for a in fin)


def test_member_isolation(client_factory):
    me = client_factory()
    sign_in(me, "player@example.co.ke")
    assert me.get("/api/directory?tab=players").status_code == 403
    mine = me.get("/api/bootstrap?facilities=0").json()["applications"]
    assert len(mine) == 1 and mine[0]["name"] == "Amina Otieno"
    club = client_factory()
    sign_in(club, "club.manager@example.co.ke")
    boot = club.get("/api/bootstrap?facilities=0").json()
    assert boot["club"]["name"] == "Kasarani Rangers FC"
    assert club.get("/api/directory?tab=players").json()["total"] >= 1
    # members cannot use staff endpoints
    assert club.post("/api/applications/NSMP-2026-100037/transition", json={"action": "review"}).status_code == 403
    assert club.put("/api/fees/Club", json={"amount": 1}).status_code == 403
    assert club.get("/api/directory?tab=clubs").json()["total"] == 1  # only its own club


def test_facilities_and_payments(client_factory, staff):
    m = client_factory()
    assert m.post("/api/facilities", json={}).status_code in (401, 422)
    mem = client_factory()
    r, _ = make(mem)
    assert r.status_code == 201
    body = {"name": "Mwiki Youth Ground", "type": "Football Pitch", "sports": ["football"], "place": place(mem),
            "gps": {"lat": -1.2, "lon": 36.9}, "capacity": 1500}
    f = mem.post("/api/facilities", json=body)
    assert f.status_code == 201
    fid = f.json()["facility"]["id"]
    assert mem.post("/api/facilities", json={**body, "gps": {"lat": 40, "lon": 0}}).status_code == 422
    assert mem.post(f"/api/facilities/{fid}/status", json={"status": "Verified"}).status_code == 403
    ug = staff("uasingishu.sports@sports.example.ke")
    assert ug.post(f"/api/facilities/{fid}/status", json={"status": "Verified"}).status_code == 403  # other county
    nbo = staff("nairobi.sports@sports.example.ke")
    assert nbo.post(f"/api/facilities/{fid}/status", json={"status": "Verified"}).status_code == 200
    assert nbo.post(f"/api/facilities/{fid}/inspections", json={"condition": "Good", "note": "Surface ok"}).status_code == 200
    # finance
    fin = staff("finance@sports.example.ke")
    apps = fin.get("/api/bootstrap?facilities=0").json()["applications"]
    unpaid = next(a for a in apps if a["payment"]["status"] == "Pending")
    assert fin.post(f"/api/payments/{unpaid['id']}/manual", json={"method": "Bank transfer", "ref": "SLIP-001"}).status_code == 200
    assert fin.post(f"/api/payments/{unpaid['id']}/refund").status_code == 200
    reg = staff("registrar@sports.example.ke")
    assert reg.post(f"/api/payments/{unpaid['id']}/refund").status_code == 403


def test_admin_and_audit(staff, anon):
    ict = staff("ict@sports.example.ke")
    assert ict.put("/api/fees/Club", json={"amount": 2500}).status_code == 200
    assert anon.get("/api/bootstrap").json()["fees"]["Club"] == 2500
    assert ict.put("/api/fees/Club", json={"amount": 2000}).status_code == 200
    assert ict.put("/api/fees/Club", json={"amount": -5}).status_code == 422
    new = ict.post("/api/users", json={"name": "New Officer", "email": "new.officer@sports.example.ke", "role": "county_officer",
                                       "password": "Passw0rdOK", "countyId": place(ict)["countyId"]})
    assert new.status_code == 201
    assert ict.post("/api/users", json={"name": "No County", "email": "nc@sports.example.ke", "role": "county_officer",
                                        "password": "Passw0rdOK"}).status_code == 422
    # separation of duties: registrar cannot manage users or fees
    reg = staff("registrar@sports.example.ke")
    assert reg.post("/api/users", json={"name": "Some One", "email": "so@sports.example.ke", "role": "registrar", "password": "Passw0rdOK"}).status_code == 403
    # registrar manages federations
    r = reg.put("/api/federations/football", json={"name": "Football Kenya Federation (FKF)", "status": "Recognised"})
    assert r.status_code == 200 and r.json()["federation"]["status"] == "Recognised"
    assert ict.put("/api/federations/nope", json={"name": "Whatever Fed"}).status_code == 404
    audit = ict.get("/api/bootstrap?facilities=0").json()["audit"]
    assert any("Fee for Club" in a["action"] for a in audit)


def test_login_rules(anon):
    assert anon.post("/api/auth/login", json={"identifier": "registrar@sports.example.ke", "password": "wrong"}).status_code == 401
    me = sign_in(anon, "REGISTRAR@sports.example.ke")
    assert me["role"] == "registrar"
    assert anon.post("/api/auth/logout").status_code == 200
    anon.cookies.clear()
    assert anon.get("/api/bootstrap").json()["me"] is None


# ───────────── control centre and media ─────────────
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


def test_super_admin_control_centre(staff, client_factory):
    sa = staff("super.admin@sports.example.ke")
    me = sa.get("/api/bootstrap?facilities=0").json()["me"]
    assert me["role"] == "super_admin" and "roles.manage" in me["perms"] and "applications.decide" in me["perms"]
    ov = sa.get("/api/control/overview").json()
    assert len(ov["coverage"]["counties"]) == 47 and any(r["id"] == "registrar" for r in ov["roles"])
    gaps = [c for c in ov["coverage"]["counties"] if c["officers"] == 0]
    assert gaps  # most counties have no officer yet: the control centre surfaces that

    # system admin can open the control centre but cannot change rights
    ict = staff("ict@sports.example.ke")
    assert ict.get("/api/control/overview").status_code == 200
    assert ict.put("/api/control/roles/registrar", json={"perms": ["applications.view"]}).status_code == 403
    # super admin edits a role's rights and it takes effect immediately
    r = sa.put("/api/control/roles/federation_admin", json={"perms": ["applications.view", "directory.view"]})
    assert r.status_code == 200
    ath = staff("membership@athletics.example.ke")
    cid = next(a["id"] for a in ath.get("/api/bootstrap?facilities=0").json()["applications"] if a["status"] == "Under review")
    assert ath.post(f"/api/applications/{cid}/transition", json={"action": "endorse"}).status_code == 403
    sa.put("/api/control/roles/federation_admin", json={"perms": ["applications.view", "applications.endorse", "directory.view"]})
    assert ath.post(f"/api/applications/{cid}/transition", json={"action": "endorse"}).status_code == 200
    assert sa.put("/api/control/roles/super_admin", json={"perms": []}).status_code == 422

    # per-user grant and deny; scope stays county-limited
    users = sa.get("/api/bootstrap?facilities=0").json()["staff"]
    nbo = next(x for x in users if x["email"].startswith("nairobi.sports"))
    assert sa.patch(f"/api/users/{nbo['id']}", json={"extraPerms": ["applications.decide"]}).status_code == 200
    nbo_c = staff("nairobi.sports@sports.example.ke")
    me2 = nbo_c.get("/api/bootstrap?facilities=0").json()
    assert "applications.decide" in me2["me"]["perms"]
    assert sa.patch(f"/api/users/{nbo['id']}", json={"extraPerms": [], "deniedPerms": ["applications.review"]}).status_code == 200
    assert "applications.review" not in staff("nairobi.sports@sports.example.ke").get("/api/bootstrap?facilities=0").json()["me"]["perms"]
    sa.patch(f"/api/users/{nbo['id']}", json={"deniedPerms": []})
    # guard rails
    reg = staff("registrar@sports.example.ke")
    assert reg.patch(f"/api/users/{nbo['id']}", json={"active": False}).status_code == 403  # no users.manage
    me_id = sa.get("/api/bootstrap?facilities=0").json()["me"]["id"]
    assert sa.patch(f"/api/users/{me_id}", json={"active": False}).status_code == 409
    assert ict.patch(f"/api/users/{me_id}", json={"active": False}).status_code == 403  # only a super admin touches one
    # deactivated accounts cannot sign in
    assert sa.patch(f"/api/users/{nbo['id']}", json={"active": False}).status_code == 200
    c = client_factory()
    assert c.post("/api/auth/login", json={"identifier": "nairobi.sports@sports.example.ke", "password": PW}).status_code == 401
    sa.patch(f"/api/users/{nbo['id']}", json={"active": True})
    assert any(m["email"] == "player@example.co.ke" for m in sa.get("/api/control/members?q=amina").json()["members"])


def test_player_photos_and_trial_videos(client_factory, staff):
    owner = client_factory()
    sign_in(owner, "player@example.co.ke")
    aid = owner.get("/api/bootstrap?facilities=0").json()["applications"][0]["id"]
    up = lambda c, kind, data, name="f.bin": c.post(f"/api/applications/{aid}/media", data={"kind": kind, "title": "Trial"},
                                                    files={"file": (name, data, "application/octet-stream")})
    p = up(owner, "photo", PNG)
    assert p.status_code == 201 and p.json()["media"]["primary"] is True  # first photo becomes the profile photo
    v = up(owner, "video", MP4)
    assert v.status_code == 201
    assert up(owner, "photo", MP4).status_code == 422          # video bytes sent as a photo
    assert up(owner, "video", b"not a video at all").status_code == 422
    assert up(owner, "photo", b"<script>alert(1)</script>").status_code == 422
    # the player (and only staff in scope) can fetch it
    assert owner.get(p.json()["media"]["url"]).status_code == 200
    assert client_factory().get(p.json()["media"]["url"]).status_code == 401
    ug = staff("uasingishu.sports@sports.example.ke")  # player is in Uasin Gishu
    assert ug.get(f"/api/applications/{aid}/media").json()["media"]
    nbo = staff("nairobi.sports@sports.example.ke")
    assert nbo.get(f"/api/applications/{aid}/media").status_code == 404   # outside scope
    stranger = client_factory()
    sign_in(stranger, "club.manager@example.co.ke")
    assert stranger.get(f"/api/applications/{aid}/media").status_code == 404
    assert up(stranger, "photo", PNG).status_code == 403
    # profile photo switch + delete
    second = up(owner, "photo", PNG).json()["media"]
    assert owner.post(f"/api/media/{second['id']}/primary").json()["application"]["photoUrl"].endswith(second["id"])
    assert owner.delete(f"/api/media/{second['id']}").status_code == 200
    assert stranger.delete(f"/api/media/{p.json()['media']['id']}").status_code in (403, 404)
    # club roster players can carry media too (owner is the club account)
    club = client_factory()
    sign_in(club, "club.manager@example.co.ke")
    roster = [a for a in club.get("/api/bootstrap?facilities=0").json()["applications"] if a["clubId"]]
    assert club.post(f"/api/applications/{roster[0]['id']}/media", data={"kind": "photo"},
                     files={"file": ("a.png", PNG, "image/png")}).status_code == 201


def test_trial_video_is_optional_but_can_be_requested(client_factory, staff):
    owner = client_factory()
    r, _ = make(owner)
    aid = r.json()["application"]["id"]
    assert pay(owner, aid).status_code == 200
    nbo = staff("nairobi.sports@sports.example.ke")
    reg = staff("registrar@sports.example.ke")
    # no media at all: review and approval still work (video is never a requirement)
    assert nbo.post(f"/api/applications/{aid}/transition", json={"action": "review"}).status_code == 200
    # the person in charge asks for a video
    q = nbo.post(f"/api/applications/{aid}/media-request", json={"note": "Show a 40 m sprint"})
    assert q.status_code == 200 and q.json()["application"]["mediaRequest"]["fulfilledAt"] is None
    mine = owner.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert mine["mediaRequest"]["note"] == "Show a 40 m sprint" and mine["mediaRequest"]["role"] == "County Sports Officer"
    # out-of-scope officer and the owner cannot raise or cancel requests
    assert staff("uasingishu.sports@sports.example.ke").post(f"/api/applications/{aid}/media-request", json={}).status_code == 403
    assert owner.post(f"/api/applications/{aid}/media-request", json={}).status_code in (401, 403)
    # uploading the video fulfils the request; a photo alone would not
    owner.post(f"/api/applications/{aid}/media", data={"kind": "photo"}, files={"file": ("a.png", PNG, "image/png")})
    assert owner.get("/api/bootstrap?facilities=0").json()["applications"][0]["mediaRequest"]["fulfilledAt"] is None
    assert owner.post(f"/api/applications/{aid}/media", data={"kind": "video", "title": "Sprint"},
                      files={"file": ("a.mp4", MP4, "video/mp4")}).status_code == 201
    done = owner.get("/api/bootstrap?facilities=0").json()["applications"][0]
    assert done["mediaRequest"]["fulfilledAt"] and any(h["action"] == "Trial video supplied" for h in done["history"])
    # cancelling and approving without a video also work
    assert nbo.post(f"/api/applications/{aid}/media-request", json={"note": "Another clip"}).status_code == 200
    assert nbo.delete(f"/api/applications/{aid}/media-request").json()["application"]["mediaRequest"] is None
    assert reg.post(f"/api/applications/{aid}/transition", json={"action": "approve"}).status_code == 200


def nbo_review_first(staff, cid):
    nbo = staff("nairobi.sports@sports.example.ke")
    r = nbo.post(f"/api/applications/{cid}/transition", json={"action": "review"})
    assert r.status_code == 200, r.text
