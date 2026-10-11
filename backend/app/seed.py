import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import refdata as R
from . import security as S
from . import settings as C
from .models import Application, Event, Facility, Federation, User

ROLE_LABEL = {"registrar": "Sports Registrar", "county_officer": "County Sports Officer",
              "federation_admin": "Federation Administrator", "integrity_officer": "Compliance & Integrity Officer"}


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _county(name: str) -> dict:
    c = next((x for x in R.admin()["counties"] if x["n"].lower().replace("'", "") == name.lower()), None)
    return c or R.admin()["counties"][0]


def _facilities(db: Session, t: str, demo: bool) -> None:
    n = 0
    for r in R.osm_facilities():
        n += 1
        idx = R.admin_index().get((r["c"], r["s"], r["w"])) if r.get("s") and r.get("w") else None
        county = next((c["n"] for c in R.admin()["counties"] if c["id"] == r["c"]), "")
        verified = demo and r["type"] == "Stadium" and n % 5 == 0
        db.add(Facility(id=r["id"], name=r["name"], type=r["type"] if r["type"] in R.FACILITY_TYPES else "Other",
                        sports=r["sports"], county_id=r["c"], sub_id=r.get("s") or "", ward_id=r.get("w") or "",
                        county=idx[0] if idx else county, sub_county=idx[1] if idx else "", ward=idx[2] if idx else "",
                        lat=r["lat"], lon=r["lon"], status="Verified" if verified else "Unverified",
                        condition="Good" if verified else None, source="OpenStreetMap", created_at=t,
                        history=[{"at": t, "by": "OpenStreetMap import", "role": "System", "action": "Imported from OpenStreetMap"}],
                        inspections=[{"at": _iso(30), "by": "Hassan Ali", "condition": "Good",
                                      "note": "Routine inspection. Surface and floodlights serviceable."}] if verified else []))


def sync_catalogue(db: Session) -> None:
    """Make an existing database match the sports/organisations directory in refdata. Safe to run on every start:
    it adds missing entries and refreshes only rows nobody has edited."""
    t = _iso(0)
    existing = {f.sport_id: f for f in db.scalars(select(Federation)).all()}
    for sid, sname, fed in R.SPORTS:
        f = existing.get(sid)
        if f is None:
            db.add(Federation(sport_id=sid, sport_name=sname, name=fed, status="To be confirmed", updated_at=t))
            continue
        f.sport_name = sname
        if f.status == "To be confirmed" and f.name == R.LEGACY_FEDERATION_NAMES.get(sid):
            f.name, f.updated_at = fed, t
    db.commit()


def seed(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    t = _iso(0)
    # Federations: names are those listed in the Ministry brief; the Registrar confirms each one.
    for sid, sname, fed in R.SPORTS:
        db.add(Federation(sport_id=sid, sport_name=sname, name=fed, status="To be confirmed", updated_at=t))

    if not C.SEED_DEMO:
        email, pw = os.getenv("BOOTSTRAP_ADMIN_EMAIL", ""), os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
        if not email or len(pw) < 10:
            raise RuntimeError("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (10+ chars) for the first start.")
        db.add(User(id="u-super", name=os.getenv("BOOTSTRAP_ADMIN_NAME", "Super Administrator"), email=email.lower(),
                    password_hash=S.hash_password(pw), role="super_admin", title="Super Administrator",
                    must_change_password=True, created_at=t))
        _facilities(db, t, demo=False)
        db.commit()
        return

    pw = os.getenv("SEED_PASSWORD", "Sports@2026!")
    ph = S.hash_password(pw)

    def staff(key, name, email, role, title, county=None, sport=None):
        c = _county(county) if county else None
        db.add(User(id=key, name=name, email=email, password_hash=ph, role=role, title=title, county_id=c["id"] if c else None,
                    county_name=c["n"] if c else None, sport_id=sport, created_at=t))

    staff("u-super", "Daniel Mutiso", "super.admin@sports.example.ke", "super_admin", "Super Administrator, Ministry of Sports")
    staff("u-registrar", "Grace Wanjiku", "registrar@sports.example.ke", "registrar", "Sports Registrar")
    staff("u-county-nbi", "Peter Otieno", "nairobi.sports@sports.example.ke", "county_officer", "County Sports Officer, Nairobi", county="Nairobi")
    staff("u-county-ug", "Jane Chebet", "uasingishu.sports@sports.example.ke", "county_officer", "County Sports Officer, Uasin Gishu", county="Uasin Gishu")
    staff("u-fed-ath", "Samuel Kiprop", "membership@athletics.example.ke", "federation_admin", "Athletics Kenya, Membership", sport="athletics")
    staff("u-fed-fb", "Linet Achieng", "registrations@fkf.example.ke", "federation_admin", "FKF, Registrations", sport="football")
    staff("u-fac", "Hassan Ali", "facilities@sports.example.ke", "facilities_officer", "Facilities Officer")
    staff("u-fin", "Mary Njeri", "finance@sports.example.ke", "finance_officer", "Finance Officer")
    staff("u-int", "Amani Mwangi", "integrity@sports.example.ke", "integrity_officer", "Compliance & Integrity Officer")
    staff("u-ict", "Kevin Mutua", "ict@sports.example.ke", "system_admin", "ICT, System Administrator")
    for key, name, email in [("u-club", "John Mwangi", "club.manager@example.co.ke"), ("u-player", "Amina Otieno", "player@example.co.ke")]:
        db.add(User(id=key, name=name, email=email, phone="0712000111" if key == "u-club" else "0722000222",
                    password_hash=ph, role="member", created_at=t))
    db.flush()

    n = [0]

    def app(owner, typ, name, sport, county, status, *, paid=True, club_id=None, club_name="", level="Amateur", age=10, id_no=None):
        n[0] += 1
        c = _county(county)
        s = c["s"][n[0] % len(c["s"])]
        w = s["w"][n[0] % max(1, len(s["w"]))]
        fed = db.get(Federation, sport).name
        fee = 2000 if typ == "Club" else 500
        created = _iso(age + 2)
        hist = [{"at": created, "by": name, "role": "Applicant", "action": "Submitted application"}]
        if paid:
            hist.append({"at": created, "by": "M-Pesa", "role": "System", "action": f"Payment received (KSh {fee:,})"})
        if status != "Submitted":
            hist.append({"at": _iso(age + 1), "by": "Peter Otieno", "role": "County Sports Officer", "action": "Under review"})
        if status in ("Endorsed", "Approved", "Suspended"):
            hist.append({"at": _iso(age), "by": "Federation Administrator", "role": "Federation Administrator", "action": "Endorsed"})
        if status in ("Approved", "Suspended"):
            hist.append({"at": _iso(age), "by": "Grace Wanjiku", "role": "Sports Registrar", "action": "Approved"})
        if status == "Suspended":
            hist.append({"at": _iso(1), "by": "Amani Mwangi", "role": "Compliance & Integrity Officer", "action": "Suspended",
                         "note": "Pending outcome of integrity inquiry."})
        if status == "Needs info":
            hist.append({"at": _iso(age), "by": "Peter Otieno", "role": "County Sports Officer", "action": "Needs info",
                         "note": "Please confirm your club's registered address."})
        if status == "Rejected":
            hist.append({"at": _iso(age), "by": "Grace Wanjiku", "role": "Sports Registrar", "action": "Rejected",
                         "note": "Duplicate of an existing registered record."})
        a = Application(
            id=f"NSMP-2026-{100000 + n[0] * 37}", owner_id=owner, club_id=club_id, type=typ, name=name,
            id_no=id_no or str(20000000 + n[0] * 123457)[:8], kra=f"A{100000000 + n[0] * 7919}Z"[:11],
            phone=f"07{10000000 + n[0] * 482173}"[:10], email=f"{name.lower().replace(' ', '.')}@example.co.ke",
            county_id=c["id"], sub_id=s["id"], ward_id=w["id"], county=c["n"], sub_county=s["n"], ward=w["n"],
            sport=sport, federation=fed, level=level, club_name=club_name, status=status, created_at=created,
            updated_at=_iso(max(0, age - 1)), history=hist, pay_status="Paid" if paid else "Pending", pay_amount=fee,
            pay_method="M-Pesa" if paid else None, pay_ref=f"QK{7000000 + n[0] * 3571}" if paid else None,
            pay_at=created if paid else None, receipt=f"RCT-{500100 + n[0] * 11}" if paid else None,
            reconciled=paid and n[0] % 2 == 0, cert_no=f"KE-NSR-2026-{4100 + n[0] * 13}" if status in ("Approved", "Suspended") else None,
            officials={"chairman": "Demo Chair", "ceo": "", "secretary": "Demo Secretary", "phone": ""} if typ == "Club" else None,
            has_contract="No" if typ == "Player / Sportsperson" else None, demo=True,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=300)).date().isoformat() if status in ("Approved", "Suspended") else None,
            dob="2001-04-12" if typ == "Player / Sportsperson" else None, gender="Male" if typ == "Player / Sportsperson" else None,
        )
        db.add(a)
        return a

    # demo club manager's verified club and roster
    club = app("u-club", "Club", "Kasarani Rangers FC", "football", "Nairobi", "Approved", club_name="Kasarani Rangers FC",
               level="Semi-Professional", age=30)
    club.name = "John Mwangi"
    for nm, st, paid in [("Brian Odhiambo", "Approved", True), ("Kevin Kamau", "Under review", True), ("Allan Mutua", "Submitted", False)]:
        app("u-club", "Player / Sportsperson", nm, "football", "Nairobi", st, paid=paid, club_id=club.id, age=8)
    app("u-player", "Player / Sportsperson", "Amina Otieno", "athletics", "Uasin Gishu", "Under review", level="Professional", age=5)

    people = [("Wanjiru Mwangi", "athletics", "Uasin Gishu", "Approved"), ("Faith Chepkoech", "athletics", "Nandi", "Approved"),
              ("Daniel Kimani", "football", "Kiambu", "Under review"), ("Aisha Hassan", "boxing", "Garissa", "Submitted"),
              ("Samuel Ruto", "rugby", "Nairobi", "Suspended"), ("Esther Achieng", "netball", "Kisumu", "Approved"),
              ("David Barasa", "volleyball", "Bungoma", "Endorsed"), ("Mercy Wekesa", "swimming", "Mombasa", "Approved"),
              ("Victor Kosgei", "hockey", "Kericho", "Needs info"), ("Lucy Njoroge", "cycling", "Nyeri", "Rejected")]
    for i, (nm, sp, co, st) in enumerate(people):
        app(None, "Player / Sportsperson", nm, sp, co, st, level="Semi-Professional", age=6 + i * 3)
    orgs = [("Club", "Iten Altitude Running Club", "athletics", "Elgeyo-Marakwet", "Approved"),
            ("Academy", "Coast Aquatics Academy", "swimming", "Mombasa", "Approved"),
            ("Club", "Nakuru Hawks Basketball", "basketball", "Nakuru", "Needs info"),
            ("Club", "Mombasa Dhow Rugby", "rugby", "Mombasa", "Submitted"),
            ("Technical Team", "Kisumu Coaching Panel", "football", "Kisumu", "Approved"),
            ("Coach", "Peter Langat", "athletics", "Uasin Gishu", "Approved"),
            ("Scout", "Collins Owino", "football", "Nairobi", "Approved"),
            ("Sports Business", "Savannah Sports Management", "football", "Nairobi", "Approved"),
            ("Federation / Association", "Meru Tennis Union", "tennis", "Meru", "Under review"),
            ("Event Organiser", "Otieno Marathon Events", "athletics", "Nairobi", "Submitted")]
    for i, (typ, nm, sp, co, st) in enumerate(orgs):
        a = app(None, typ, nm, sp, co, st, club_name=nm if typ in R.ORG_TYPES else "", age=4 + i * 4)
        if typ in ("Coach", "Scout"):
            a.club_name = ""

    _facilities(db, t, demo=True)

    events = [("Nairobi Youth Football Cup", "football", "Nairobi", "Kasarani, Nairobi", "Nairobi County Sports Office", "Youth / Junior", 9),
              ("Rift Valley Cross-Country Championships", "athletics", "Uasin Gishu", "Eldoret", "Athletics Kenya", "Professional", 16),
              ("Coast Open Swimming Gala", "swimming", "Mombasa", "Mombasa", "Kenya Aquatics", "Amateur", 23),
              ("Kisumu Netball Invitational", "netball", "Kisumu", "Kisumu", "Kenya Netball Federation", "Semi-Professional", 30),
              ("Nakuru Rugby Sevens", "rugby", "Nakuru", "Nakuru Athletic Club", "Kenya Rugby Union (KRU)", "Semi-Professional", 37),
              ("National Schools Volleyball Finals", "volleyball", "Machakos", "Machakos", "Kenya Volleyball Federation", "Youth / Junior", 44),
              ("Kenya Open Boxing Championship", "boxing", "Nairobi", "Nyayo National Stadium", "Boxing Federation of Kenya", "Amateur", 51),
              ("Mount Kenya Cycling Classic", "cycling", "Nyeri", "Nyeri", "Cycling Kenya", "Amateur", 58)]
    for i, (nm, sp, co, venue, org, lvl, days) in enumerate(events):
        c = _county(co)
        db.add(Event(id=f"EVT-{1000 + i}", name=nm, sport=sp, date=(datetime.now(timezone.utc) + timedelta(days=days)).isoformat(),
                     venue=venue, county=c["n"], county_id=c["id"], organiser=org, level=lvl))
    db.commit()
