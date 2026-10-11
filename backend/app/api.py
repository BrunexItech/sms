import os
import random
from datetime import date, timedelta
from pathlib import Path

import pyotp
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import refdata as R
from . import settings as C
from .notify import notify
from . import security as S
from .db import get_db
from .models import Application, Audit, Event, Facility, Federation, Media, Notification, Setting, User
from . import rbac
from .rbac import CATALOG, DEFAULTS, ROLE_PERMS, STAFF_ROLES, SCOPE, app_in_scope, can, facility_in_scope
from .serial import app_out, directory_row, event_out, facility_out, federation_out, media_out, user_out

router = APIRouter(prefix="/api")

ROLE_LABEL = {
    "super_admin": "Super Administrator", "registrar": "Sports Registrar", "county_officer": "County Sports Officer", "federation_admin": "Federation Administrator",
    "facilities_officer": "Facilities Officer", "finance_officer": "Finance Officer",
    "integrity_officer": "Compliance & Integrity Officer", "system_admin": "System Administrator", "member": "Applicant",
}
DEMO_OTP = os.getenv("DEMO_OTP", "123456")
GENDERS = ("Female", "Male")
PAY_METHODS = {"M-Pesa", "Visa / Mastercard", "Mobile Money", "Bank transfer"}


class In(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


# ───────────── helpers ─────────────
def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def err(status: int, msg: str):
    raise HTTPException(status, msg)


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    tok = request.cookies.get(S.COOKIE)
    uid = S.read_token(tok) if tok else None
    u = db.get(User, uid) if uid else None
    return u if u and u.active else None


def need_user(u: User | None = Depends(optional_user)) -> User:
    if not u:
        err(401, "Please sign in.")
    return u


def log(db: Session, who: User | None, action: str, target: str, name: str | None = None):
    db.add(Audit(at=now(), actor=who.name if who else (name or "Applicant"),
                 role=ROLE_LABEL.get(who.role if who else "member", "Applicant"), action=action, target=target))


def hist(who: User | None, action: str, note: str | None = None, by: str | None = None, role: str | None = None) -> dict:
    h = {"at": now(), "by": by or (who.name if who else "System"),
         "role": role or ROLE_LABEL.get(who.role if who else "member", "System"), "action": action}
    if note:
        h["note"] = note
    return h


def rid(prefix: str, n: int = 6) -> str:
    return f"{prefix}{random.SystemRandom().randrange(10**(n-1), 10**n)}"


def fees(db: Session) -> dict:
    row = db.get(Setting, "fees")
    return {**R.DEFAULT_FEES, **(row.value if row else {})}


def the_federation(db: Session, sport: str) -> str:
    f = db.get(Federation, sport)
    return f.name if f else ""


def my_club(db: Session, u: User) -> Application | None:
    return db.scalars(select(Application).where(
        Application.owner_id == u.id, Application.type == "Club", Application.status == "Approved",
        Application.club_id.is_(None))).first()


EMAIL = re.compile(r"^\S+@\S+\.\S+$")
KRA = re.compile(r"^[AP]\d{9}[A-Z]$", re.I)
PHONE = re.compile(r"^(?:\+?254|0)?[17]\d{8}$")
IDNO = re.compile(r"^[A-Za-z0-9]{6,12}$")


def check_person(d, kra_required: bool = True, phone_required: bool = True, email_required: bool = True):
    if len(d.name.strip().split()) < 2:
        err(422, "Enter the full legal names (at least two names).")
    if not IDNO.match(d.id_no.strip()):
        err(422, "Enter a valid National ID, birth certificate or passport number.")
    if (kra_required or d.kra) and not KRA.match(d.kra.strip()):
        err(422, "KRA PIN looks like A012345678Z.")
    if (phone_required or d.phone) and not PHONE.match(re.sub(r"\s", "", d.phone)):
        err(422, "Use a Kenyan phone number, for example 0712 345 678.")
    if (email_required or d.email) and not EMAIL.match(d.email):
        err(422, "Enter a valid email address.")


def place_or_422(p) -> dict:
    pl = R.resolve_place(p.county_id, p.sub_id, p.ward_id)
    if not pl:
        err(422, "Choose a valid county, sub-county and ward.")
    return pl


def new_app(db: Session, d, owner: User, place: dict, status_by: str, *, club_id: str | None = None, fee_type: str | None = None) -> Application:
    if d.type not in R.STAKEHOLDER_TYPES:
        err(422, "Unknown stakeholder type.")
    if d.sport not in R.SPORT_IDS:
        err(422, "Choose a sport.")
    if d.level not in R.LEVELS:
        err(422, "Choose a competition level.")
    if d.type in R.ORG_TYPES and len((d.club_name or "").strip()) < 3:
        err(422, "Enter the organisation name.")
    if d.type == "Club":
        o = d.club_officials or {}
        if not str(o.get("chairman", "")).strip() or not str(o.get("secretary", "")).strip():
            err(422, "Club chairperson and secretary are required.")
    dob = gender = guardian = None
    if d.type == "Player / Sportsperson":
        try:
            born = date.fromisoformat((d.dob or "").strip())
        except ValueError:
            err(422, "Enter the player's date of birth.")
        today = date.today()
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        if not (5 <= age <= 90):
            err(422, "The date of birth looks wrong. Players must be between 5 and 90 years old.")
        if d.gender not in GENDERS:
            err(422, "Choose the player's gender (used for competition categories).")
        dob, gender = born.isoformat(), d.gender
        if age < 18:
            g = d.guardian or {}
            if len(str(g.get("name", "")).strip()) < 3 or not str(g.get("relationship", "")).strip():
                err(422, "Players under 18 need a parent or guardian's name and relationship.")
            if not PHONE.match(re.sub(r"\s", "", str(g.get("phone", "")))):
                err(422, "Enter the parent or guardian's phone number.")
            if g.get("consent") is not True:
                err(422, "A parent or guardian must consent to the registration.")
            guardian = {"name": str(g["name"]).strip(), "phone": str(g["phone"]).strip(),
                        "relationship": str(g["relationship"]).strip(), "consent": True}
        dup = db.scalars(select(Application).where(
            Application.type == "Player / Sportsperson", Application.id_no == d.id_no.strip(),
            Application.sport == d.sport, Application.status != "Rejected")).first()
        if dup:
            err(409, "A player with this ID is already registered or pending for this sport.")
    t = now()
    while True:
        aid = rid("NSMP-2026-")
        if not db.get(Application, aid):
            break
    a = Application(
        id=aid, owner_id=owner.id, club_id=club_id, type=d.type, name=d.name.strip(), id_no=d.id_no.strip(),
        kra=d.kra.strip().upper(), phone=d.phone.strip(), email=d.email.strip().lower(), sport=d.sport,
        federation=the_federation(db, d.sport), level=d.level, club_name=(d.club_name or "").strip(),
        officials=d.club_officials if d.type == "Club" else None, has_contract=d.has_contract,
        notes=(d.notes or "")[:500], status="Submitted", created_at=t, updated_at=t,
        lat=d.gps.lat if d.gps else None, lon=d.gps.lon if d.gps else None, dob=dob, gender=gender, guardian=guardian,
        pay_status="Pending", pay_amount=fees(db).get(fee_type or d.type, 500),
        history=[hist(None, "Submitted application", by=d.name.strip(), role=status_by)], **place,
    )
    db.add(a)
    return a


# ───────────── input models ─────────────
class PlaceIn(In):
    county_id: str
    sub_id: str
    ward_id: str


class GeoIn(In):
    lat: float
    lon: float


class RegisterIn(In):
    type: str
    name: str
    id_no: str
    kra: str = ""
    phone: str
    email: str
    password: str | None = None
    place: PlaceIn
    gps: GeoIn | None = None
    sport: str
    level: str = "Amateur"
    club_name: str = ""
    club_officials: dict | None = None
    has_contract: str | None = None
    notes: str = ""
    dob: str | None = None
    gender: str | None = None
    guardian: dict | None = None
    website: str = ""  # honeypot: real users never fill it


class PlayerIn(In):
    name: str
    id_no: str
    kra: str = ""
    phone: str = ""
    email: str = ""
    sport: str | None = None
    level: str = "Amateur"
    has_contract: str | None = "No"
    notes: str = ""
    place: PlaceIn | None = None
    dob: str | None = None
    gender: str | None = None
    guardian: dict | None = None


class LoginIn(In):
    identifier: str
    password: str
    code: str = ""


class PayIn(In):
    method: str
    ref: str = ""
    otp: str


class ClubPayIn(PayIn):
    application_ids: list[str]


class TransitionIn(In):
    action: str
    note: str = ""


class NoteIn(In):
    note: str = ""


class FacilityIn(In):
    name: str
    type: str
    sports: list[str]
    place: PlaceIn
    gps: GeoIn
    capacity: int | None = None
    ownership: str | None = None
    condition: str | None = None


class FacilityStatusIn(In):
    status: str
    note: str = ""


class InspectionIn(In):
    condition: str
    note: str


class FacilityPatch(In):
    capacity: int | None = None
    ownership: str | None = None
    sports: list[str] | None = None


class ManualPayIn(In):
    method: str
    ref: str


class FeeIn(In):
    amount: int


class StaffIn(In):
    name: str
    email: str
    role: str
    title: str = ""
    password: str
    county_id: str | None = None
    sport_id: str | None = None


class StaffPatch(In):
    role: str | None = None
    active: bool | None = None
    extra_perms: list[str] | None = None
    denied_perms: list[str] | None = None
    county_id: str | None = None
    sport_id: str | None = None
    password: str | None = None


class MediaRequestIn(In):
    note: str = ""


class RolePermsIn(In):
    perms: list[str]


class FederationIn(In):
    name: str
    status: str = "Recognised"
    contact_email: str = ""


# ───────────── public ─────────────
def stats(db: Session) -> dict:
    live = db.execute(select(Application.type, Application.sport, func.count()).where(
        Application.status.in_(["Approved", "Suspended"])).group_by(Application.type, Application.sport)).all()
    by_type: dict[str, int] = {}
    by_sport: dict[str, int] = {}
    for t, sp, n in live:
        by_type[t] = by_type.get(t, 0) + n
        by_sport[sp] = by_sport.get(sp, 0) + n
    return {
        "players": by_type.get("Player / Sportsperson", 0), "clubs": by_type.get("Club", 0),
        "teams": by_type.get("Technical Team", 0) + by_type.get("Coach", 0), "scouts": by_type.get("Scout", 0),
        "facilities": db.scalar(select(func.count()).select_from(Facility)) or 0,
        "events": db.scalar(select(func.count()).select_from(Event)) or 0,
        "bySport": by_sport,
    }


def session_data(db: Session, u: User) -> dict:
    out: dict = {}
    rule = evidence_rule(db)
    videos = dict(db.execute(select(Media.application_id, func.count()).where(Media.kind == "video").group_by(Media.application_id)).all())

    def flag(rows: list[dict], objs: list[Application]) -> list[dict]:
        for r, a in zip(rows, objs):
            r["evidenceNeeded"] = rule_applies(rule, a) and videos.get(a.id, 0) == 0 and a.status in ("Submitted", "Under review", "Needs info")
        return rows

    notes = db.scalars(select(Notification).where(Notification.user_id == u.id).order_by(Notification.id.desc()).limit(30)).all()
    out["notifications"] = [{"id": n.id, "at": n.at, "title": n.title, "body": n.body, "link": n.link, "read": n.read} for n in notes]
    if u.role == "member":
        apps = db.scalars(select(Application).where(Application.owner_id == u.id).order_by(Application.created_at.desc())).all()
        out["applications"] = flag([app_out(a, u, owner_view=True) for a in apps], list(apps))
        club = my_club(db, u)
        out["club"] = {"id": club.id, "name": club.club_name or club.name, "sport": club.sport,
                       "place": {"countyId": club.county_id, "subId": club.sub_id, "wardId": club.ward_id,
                                 "county": club.county, "subCounty": club.sub_county, "ward": club.ward}} if club else None
        return out
    if can(u, "applications.view") or can(u, "payments.view"):
        q = select(Application).order_by(Application.created_at.desc()).limit(3000)
        apps = [a for a in db.scalars(q).all() if app_in_scope(u, a)]
        out["applications"] = flag([app_out(a, u) for a in apps], apps)
    if can(u, "users.manage"):
        out["staff"] = [user_out(x) for x in db.scalars(select(User).where(User.role.in_(STAFF_ROLES))).all()]
    if can(u, "audit.view"):
        out["audit"] = [{"at": x.at, "actor": x.actor, "role": x.role, "action": x.action, "target": x.target}
                        for x in db.scalars(select(Audit).order_by(Audit.id.desc()).limit(300)).all()]
    return out


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/bootstrap")
def bootstrap(facilities: int = 1, db: Session = Depends(get_db), u: User | None = Depends(optional_user)):
    out = {
        "me": user_out(u) if u else None, "fees": fees(db), "stats": stats(db), "evidence": evidence_rule(db),
        "payments": {"mpesa": C.MPESA_READY, "demoOtp": not C.PRODUCTION and not C.MPESA_READY},
        "federations": [federation_out(f) for f in db.scalars(select(Federation).order_by(Federation.sport_name)).all()],
        "events": [event_out(e) for e in db.scalars(select(Event).where(Event.status == "Approved").order_by(Event.date)).all()],
    }
    if facilities:
        out["facilities"] = [facility_out(f) for f in db.scalars(select(Facility).order_by(Facility.county, Facility.name)).all()]
    if u:
        out.update(session_data(db, u))
    return out


@router.post("/auth/login")
def login(d: LoginIn, response: Response, request: Request, db: Session = Depends(get_db)):
    key = f"{request.client.host if request.client else '?'}:{d.identifier.lower()}"
    if S.too_many_attempts(key):
        err(429, "Too many attempts. Try again in a few minutes.")
    ident = d.identifier.strip().lower()
    u = db.scalars(select(User).where(User.email == ident)).first()
    if not u:  # allow phone sign-in
        norm = re.sub(r"\s", "", d.identifier)
        u = db.scalars(select(User).where(User.phone == norm)).first()
    if not u or not u.active or not S.verify_password(d.password, u.password_hash):
        err(401, "Incorrect email/phone or password.")
    if u.totp_enabled:
        if not d.code.strip():
            err(428, "otp_required")
        if not pyotp.TOTP(u.totp_secret or "").verify(d.code.strip(), valid_window=1):
            err(401, "That authenticator code is not correct.")
    S.clear_attempts(key)
    u.last_login = now()
    set_cookie(response, u)
    log(db, u, "Signed in", "session")
    db.commit()
    return {"me": user_out(u)}


def set_cookie(response: Response, u: User):
    response.set_cookie(S.COOKIE, S.make_token(u.id), max_age=S.TTL, httponly=True, samesite="lax",
                        secure=S.APP_ENV == "production", path="/")


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(S.COOKIE, path="/")
    return {"ok": True}


@router.get("/verify/{number}")
def verify(number: str, db: Session = Depends(get_db)):
    a = db.scalars(select(Application).where(Application.cert_no == number.strip().upper())).first()
    if not a or a.status not in ("Approved", "Suspended"):
        return {"found": False}
    expired = bool(a.expires_at and a.expires_at < now())
    return {"found": True, "valid": a.status == "Approved" and not expired, "status": "Expired" if expired and a.status == "Approved" else a.status,
            "holder": a.club_name or a.name, "type": a.type, "sport": a.sport, "county": a.county,
            "certificateNo": a.cert_no, "expiresAt": a.expires_at}


# ───────────── registration & payment ─────────────
@router.post("/registrations", status_code=201)
def register(d: RegisterIn, response: Response, request: Request, db: Session = Depends(get_db), u: User | None = Depends(optional_user)):
    if u and u.role != "member":
        err(403, "Staff accounts cannot submit registrations.")
    if d.website:
        err(422, "Could not submit the registration.")
    ip = request.client.host if request.client else "?"
    if not u and S.too_many_attempts(f"reg:{ip}", limit=int(os.getenv("REG_RATE_LIMIT", "20")), window=3600):
        err(429, "Too many registrations from this connection. Try again later.")
    check_person(d, kra_required=True)
    place = place_or_422(d.place)
    if not u:
        if not d.password or len(d.password) < 8 or not re.search(r"[A-Za-z]", d.password) or not re.search(r"\d", d.password):
            err(422, "Choose a password of at least 8 characters with letters and a number.")
        email = d.email.strip().lower()
        if db.scalars(select(User).where(User.email == email)).first():
            err(409, "An account with this email already exists. Please sign in first.")
        u = User(id=uuid4().hex, name=d.name.strip(), email=email, phone=re.sub(r"\s", "", d.phone),
                 password_hash=S.hash_password(d.password), role="member", created_at=now())
        db.add(u)
        set_cookie(response, u)
    a = new_app(db, d, u, place, "Applicant")
    log(db, u, "Submitted application", a.id)
    db.commit()
    return {"application": app_out(a, u, owner_view=True), "me": user_out(u)}


def settle(db: Session, a: Application, who: User, method: str, ref: str):
    a.pay_status, a.pay_method, a.pay_ref = "Paid", method, ref or rid("QK", 7)
    a.pay_at, a.receipt = now(), rid("RCT-")
    a.updated_at = now()
    a.history = [*a.history, hist(who, f"Payment received (KSh {a.pay_amount:,})", by=method, role="System")]
    if a.renewing:
        base = max(now(), a.expires_at or now())
        a.expires_at = (date.fromisoformat(base[:10]) + timedelta(days=C.CERT_VALID_DAYS)).isoformat()
        a.renewing = False
        a.history = [*a.history, hist(None, f"Renewed until {a.expires_at}", by="System", role="System")]
    log(db, who, "Payment received", a.id)


def check_pay(d: PayIn):
    if d.method not in PAY_METHODS:
        err(422, "Choose a payment method.")
    if C.PRODUCTION or C.MPESA_READY:
        err(400, "Pay with M-Pesa: this deployment uses live payment confirmation.")
    if d.otp != DEMO_OTP:
        err(422, "The one-time password is incorrect.")


@router.post("/applications/{aid}/pay")
def pay(aid: str, d: PayIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = db.get(Application, aid)
    if not a or a.owner_id != u.id:
        err(404, "Registration not found.")
    if a.pay_status != "Pending":
        err(409, "This registration is already paid.")
    check_pay(d)
    settle(db, a, u, d.method, d.ref)
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


@router.post("/applications/{aid}/resubmit")
def resubmit(aid: str, d: NoteIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = db.get(Application, aid)
    if not a or a.owner_id != u.id:
        err(404, "Registration not found.")
    if a.status != "Needs info":
        err(409, "This registration is not waiting for information.")
    if len(d.note.strip()) < 3:
        err(422, "Tell the reviewer what you have updated.")
    a.status, a.updated_at = "Under review", now()
    a.history = [*a.history, hist(u, "Information supplied", d.note.strip())]
    log(db, u, "Information supplied", a.id)
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


# ───────────── club portal ─────────────
@router.post("/club/players", status_code=201)
def add_player(d: PlayerIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    club = my_club(db, u)
    if not club:
        err(403, "Only a verified club can register players.")
    check_person(d, kra_required=False, phone_required=False, email_required=False)
    place = place_or_422(d.place) if d.place else {
        "county_id": club.county_id, "sub_id": club.sub_id, "ward_id": club.ward_id,
        "county": club.county, "sub_county": club.sub_county, "ward": club.ward}
    pd = RegisterIn(type="Player / Sportsperson", name=d.name, id_no=d.id_no, kra=d.kra, phone=d.phone, email=d.email,
                    place=d.place or PlaceIn(county_id=club.county_id, sub_id=club.sub_id, ward_id=club.ward_id),
                    sport=d.sport or club.sport, level=d.level, has_contract=d.has_contract or "No",
                    notes=d.notes, club_name="", dob=d.dob, gender=d.gender, guardian=d.guardian)
    a = new_app(db, pd, u, place, f"Club: {club.club_name or club.name}", club_id=club.id, fee_type="Player / Sportsperson")
    log(db, u, f"Registered player for {club.club_name or club.name}", a.id)
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


@router.post("/club/pay")
def club_pay(d: ClubPayIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    club = my_club(db, u)
    if not club:
        err(403, "Only a verified club can pay for players.")
    check_pay(d)
    apps = [db.get(Application, i) for i in d.application_ids]
    if not apps or any(a is None or a.owner_id != u.id or a.club_id != club.id for a in apps):
        err(404, "One or more players were not found on your roster.")
    todo = [a for a in apps if a.pay_status == "Pending"]
    if not todo:
        err(409, "Nothing to pay: these players are already paid.")
    for a in todo:
        settle(db, a, u, d.method, d.ref)
    db.commit()
    return {"applications": [app_out(a, u, owner_view=True) for a in todo]}


# ───────────── directory (restricted) ─────────────
TABS = {"players": ["Player / Sportsperson"],
        "clubs": ["Club", "Academy", "Sports Business", "Facility Operator", "Event Organiser", "Federation / Association"],
        "teams": ["Technical Team", "Coach"], "scouts": ["Scout", "Sports Agent / Manager"]}


@router.get("/directory")
def directory(tab: str = "players", q: str = "", county: str = "", sport: str = "", db: Session = Depends(get_db),
              u: User = Depends(need_user)):
    if tab not in TABS:
        err(422, "Unknown directory tab.")
    stmt = select(Application).where(Application.type.in_(TABS[tab]), Application.status.in_(["Approved", "Suspended"]))
    if u.role == "member":
        club = my_club(db, u)
        if not club:
            err(403, "The directory is available to verified clubs and Ministry staff.")
        stmt = select(Application).where(Application.type.in_(TABS[tab]), Application.owner_id == u.id,
                                         Application.status.in_(["Approved", "Suspended"]))
        # a club sees only its own roster and its own club record
        stmt = stmt.where((Application.club_id == club.id) | (Application.id == club.id))
    elif not can(u, "directory.view"):
        err(403, "Your role does not include the directory.")
    rows = [a for a in db.scalars(stmt.order_by(Application.name)).all() if u.role == "member" or app_in_scope(u, a)]
    needle = q.strip().lower()
    out = [directory_row(a) for a in rows
           if (not county or a.county_id == county) and (not sport or a.sport == sport)
           and (not needle or needle in f"{a.name} {a.club_name} {a.county} {a.sub_county} {a.sport}".lower())]
    return {"rows": out[:500], "total": len(out)}


# ───────────── workflow (staff) ─────────────
ACTIONS = {
    "review": ({"Submitted"}, "Under review", "applications.review", False),
    "need_info": ({"Under review"}, "Needs info", "applications.review", True),
    "info_received": ({"Needs info"}, "Under review", "applications.review", False),
    "endorse": ({"Under review"}, "Endorsed", "applications.endorse", False),
    "approve": ({"Under review", "Endorsed"}, "Approved", "applications.decide", False),
    "reject": ({"Submitted", "Under review", "Endorsed"}, "Rejected", "applications.decide", True),
    "suspend": ({"Approved"}, "Suspended", "records.suspend", True),
    "reinstate": ({"Suspended"}, "Approved", "records.suspend", True),
    "reopen": ({"Rejected"}, "Under review", "applications.decide", True),
}


def evidence_rule(db: Session) -> dict:
    row = db.get(Setting, "evidence")
    base = {"enabled": True, "levels": ["Professional", "Semi-Professional"], "sports": [], "clubDocuments": True}
    return {**base, **(row.value if row else {})}


def rule_applies(rule: dict, a: Application) -> bool:
    return bool(rule["enabled"] and a.type == "Player / Sportsperson" and not a.club_id and a.level in rule["levels"]
                and (not rule["sports"] or a.sport in rule["sports"]))


def count_media(db: Session, aid: str, kind: str) -> int:
    return db.scalar(select(func.count()).select_from(Media).where(Media.application_id == aid, Media.kind == kind)) or 0


def perform_transition(db: Session, u: User, a: Application, action: str, note: str) -> None:
    spec = ACTIONS.get(action)
    if not spec:
        err(422, "Unknown action.")
    allowed, to, perm, need_note = spec
    if not can(u, perm) or not app_in_scope(u, a):
        err(403, "You cannot perform this action on this record.")
    if a.status not in allowed:
        err(409, f"Cannot {action.replace('_', ' ')}: the record is {a.status}.")
    note = note.strip()
    if need_note and len(note) < 3:
        err(422, "A reason is required for this action.")
    if action == "approve":
        if a.pay_status != "Paid":
            err(409, "Cannot approve: the registration fee has not been paid.")
        if a.club_id:
            club = db.get(Application, a.club_id)
            if not club or club.status != "Approved":
                err(409, "Cannot approve: the player's club is not verified.")
        rule = evidence_rule(db)
        if rule_applies(rule, a) and a.status != "Endorsed" and count_media(db, a.id, "video") == 0:
            err(409, f"Cannot approve: a {a.level} player registering individually needs a trial video or federation endorsement.")
        if a.type == "Club" and rule["clubDocuments"] and count_media(db, a.id, "document") == 0:
            err(409, "Cannot approve: the club has not uploaded its constitution or registration documents.")
    a.status, a.updated_at = to, now()
    if to == "Approved":
        if not a.cert_no:
            while True:
                c = rid("KE-NSR-2026-", 5)
                if not db.scalars(select(Application).where(Application.cert_no == c)).first():
                    break
            a.cert_no = c
        if not a.expires_at:
            a.expires_at = (date.today() + timedelta(days=C.CERT_VALID_DAYS)).isoformat()
    if action in ("reopen", "reinstate"):
        a.appeal = None
    label = "Reinstated" if action == "reinstate" else {"info_received": "Information received", "reopen": "Reopened after appeal"}.get(action, to)
    a.history = [*a.history, hist(u, label, note or None)]
    log(db, u, f"Status → {to}", a.id)
    owner = db.get(User, a.owner_id) if a.owner_id else None
    if owner and owner.id != u.id:
        who = a.club_name or a.name
        extra = f" Reason: {note}" if note else ""
        notify(db, owner, f"{who}: {label}", f"The registration {a.id} is now {to}.{extra}")


@router.post("/applications/{aid}/transition")
def transition(aid: str, d: TransitionIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = db.get(Application, aid)
    if not a:
        err(404, "Registration not found.")
    perform_transition(db, u, a, d.action, d.note)
    db.commit()
    return {"application": app_out(a, u)}


class BulkIn(In):
    ids: list[str]
    action: str
    note: str = ""


@router.post("/applications/bulk")
def bulk_transition(d: BulkIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not d.ids or len(d.ids) > 100:
        err(422, "Choose between 1 and 100 registrations.")
    results = []
    for aid in dict.fromkeys(d.ids):
        a = db.get(Application, aid)
        try:
            if not a:
                err(404, "Registration not found.")
            perform_transition(db, u, a, d.action, d.note)
            db.commit()
            results.append({"id": aid, "ok": True})
        except HTTPException as e:
            db.rollback()
            results.append({"id": aid, "ok": False, "error": e.detail})
    return {"results": results, "done": sum(1 for r in results if r["ok"])}


# ───────────── facilities ─────────────
@router.post("/facilities", status_code=201)
def add_facility(d: FacilityIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if len(d.name.strip()) < 3:
        err(422, "Enter the facility name.")
    if d.type not in R.FACILITY_TYPES:
        err(422, "Choose a facility type.")
    if not d.sports or any(s not in R.SPORT_IDS for s in d.sports):
        err(422, "Choose at least one valid sport.")
    if d.condition and d.condition not in R.CONDITIONS:
        err(422, "Choose a valid condition.")
    if not (-5.3 <= d.gps.lat <= 5.6 and 33.3 <= d.gps.lon <= 42.3):
        err(422, "The location is outside Kenya.")
    if d.capacity is not None and not (0 <= d.capacity <= 500000):
        err(422, "Capacity looks wrong.")
    p = place_or_422(d.place)
    f = Facility(id=rid("REG-", 5), name=d.name.strip(), type=d.type, sports=d.sports, lat=d.gps.lat, lon=d.gps.lon,
                 capacity=d.capacity, ownership=d.ownership, condition=d.condition, status="Unverified",
                 source="Registered", created_by=u.id, created_at=now(),
                 history=[hist(u, "Registered facility")], inspections=[], **p)
    db.add(f)
    log(db, u, "Registered facility", f.id)
    db.commit()
    return {"facility": facility_out(f)}


def get_facility(db: Session, u: User, fid: str) -> Facility:
    f = db.get(Facility, fid)
    if not f:
        err(404, "Facility not found.")
    if not can(u, "facilities.verify") or not facility_in_scope(u, f):
        err(403, "You cannot manage this facility.")
    return f


@router.post("/facilities/{fid}/status")
def facility_status(fid: str, d: FacilityStatusIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    f = get_facility(db, u, fid)
    if d.status not in ("Verified", "Rejected", "Unverified"):
        err(422, "Invalid status.")
    if d.status == "Rejected" and len(d.note.strip()) < 3:
        err(422, "A reason is required to reject.")
    f.status = d.status
    f.history = [*f.history, hist(u, d.status, d.note.strip() or None)]
    log(db, u, f"Facility → {d.status}", f.id)
    db.commit()
    return {"facility": facility_out(f)}


@router.post("/facilities/{fid}/inspections")
def inspection(fid: str, d: InspectionIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    f = get_facility(db, u, fid)
    if d.condition not in R.CONDITIONS or len(d.note.strip()) < 3:
        err(422, "Choose a condition and add a note.")
    f.condition = d.condition
    f.inspections = [{"at": now(), "by": u.name, "condition": d.condition, "note": d.note.strip()}, *f.inspections]
    log(db, u, "Logged inspection", f.id)
    db.commit()
    return {"facility": facility_out(f)}


@router.patch("/facilities/{fid}")
def facility_patch(fid: str, d: FacilityPatch, db: Session = Depends(get_db), u: User = Depends(need_user)):
    f = get_facility(db, u, fid)
    if d.capacity is not None:
        if not (0 <= d.capacity <= 500000):
            err(422, "Capacity looks wrong.")
        f.capacity = d.capacity
    if d.ownership is not None:
        f.ownership = d.ownership
    if d.sports is not None:
        if any(s not in R.SPORT_IDS for s in d.sports):
            err(422, "Invalid sport.")
        f.sports = d.sports
    log(db, u, "Edited facility details", f.id)
    db.commit()
    return {"facility": facility_out(f)}


# ───────────── payments (finance) ─────────────
def pay_target(db: Session, u: User, aid: str) -> Application:
    a = db.get(Application, aid)
    if not a:
        err(404, "Registration not found.")
    if not can(u, "payments.reconcile"):
        err(403, "Your role cannot change payments.")
    return a


@router.post("/payments/{aid}/manual")
def manual_pay(aid: str, d: ManualPayIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = pay_target(db, u, aid)
    if a.pay_status != "Pending":
        err(409, "This registration is not awaiting payment.")
    if len(d.ref.strip()) < 3:
        err(422, "Enter the slip, cheque or receipt reference.")
    settle(db, a, u, d.method, d.ref.strip())
    a.reconciled = True
    db.commit()
    return {"application": app_out(a, u)}


@router.post("/payments/{aid}/reconcile")
def reconcile(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = pay_target(db, u, aid)
    if a.pay_status != "Paid":
        err(409, "Only paid registrations can be reconciled.")
    a.reconciled = not a.reconciled
    log(db, u, "Toggled reconciliation", a.id)
    db.commit()
    return {"application": app_out(a, u)}


@router.post("/payments/{aid}/refund")
def refund(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = pay_target(db, u, aid)
    if a.pay_status != "Paid":
        err(409, "Only paid registrations can be refunded.")
    a.pay_status = "Refunded"
    a.history = [*a.history, hist(u, "Refund issued")]
    log(db, u, "Refund issued", a.id)
    db.commit()
    return {"application": app_out(a, u)}


# ───────────── administration ─────────────
@router.put("/fees/{ftype}")
def set_fee(ftype: str, d: FeeIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "settings.manage"):
        err(403, "Only the System Administrator can change fees.")
    if ftype not in R.STAKEHOLDER_TYPES or not (0 <= d.amount <= 1_000_000):
        err(422, "Invalid fee.")
    row = db.get(Setting, "fees") or Setting(key="fees", value={})
    row.value = {**row.value, ftype: d.amount}
    db.merge(row)
    log(db, u, f"Fee for {ftype} → KSh {d.amount}", "settings")
    db.commit()
    return {"fees": fees(db)}


@router.post("/users", status_code=201)
def create_staff(d: StaffIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "users.manage"):
        err(403, "Only the System Administrator can create staff accounts.")
    if d.role not in STAFF_ROLES:
        err(422, "Choose a staff role.")
    if d.role == "super_admin" and u.role != "super_admin":
        err(403, "Only a Super Administrator can create another Super Administrator.")
    if not EMAIL.match(d.email) or len(d.name.strip()) < 3:
        err(422, "Enter the staff member's name and a valid email.")
    if len(d.password) < 8:
        err(422, "Password must be at least 8 characters.")
    scope = SCOPE.get(d.role)
    cname = None
    if scope == "county":
        c = next((x for x in R.admin()["counties"] if x["id"] == d.county_id), None)
        if not c:
            err(422, "A county officer must be assigned a county.")
        cname = c["n"]
    if scope == "sport" and d.sport_id not in R.SPORT_IDS:
        err(422, "A federation administrator must be assigned a sport.")
    if db.scalars(select(User).where(User.email == d.email.strip().lower())).first():
        err(409, "An account with this email already exists.")
    x = User(id=uuid4().hex, name=d.name.strip(), email=d.email.strip().lower(), password_hash=S.hash_password(d.password),
             role=d.role, title=d.title.strip() or ROLE_LABEL[d.role], must_change_password=True,
             county_id=d.county_id if scope == "county" else None,
             county_name=cname, sport_id=d.sport_id if scope == "sport" else None, created_at=now())
    db.add(x)
    log(db, u, f"Created staff account ({ROLE_LABEL[d.role]})", x.name)
    db.commit()
    return {"user": user_out(x)}


def active_super_admins(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.role == "super_admin", User.active.is_(True))) or 0


@router.patch("/users/{uid}")
def update_user(uid: str, d: StaffPatch, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "users.manage"):
        err(403, "You cannot manage accounts.")
    x = db.get(User, uid)
    if not x:
        err(404, "Account not found.")
    if x.role == "super_admin" and u.role != "super_admin":
        err(403, "Only a Super Administrator can change a Super Administrator.")
    rights_change = any(v is not None for v in (d.role, d.extra_perms, d.denied_perms))
    if rights_change and not can(u, "roles.manage"):
        err(403, "You cannot change roles or rights.")
    if x.id == u.id and (rights_change or d.active is not None):
        err(409, "You cannot change your own role, rights or access.")
    if x.role not in STAFF_ROLES and (rights_change or d.county_id or d.sport_id):
        err(422, "Applicant accounts have no staff role or scope.")
    if d.role:
        if d.role not in STAFF_ROLES:
            err(422, "Choose a staff role.")
        if d.role == "super_admin" and u.role != "super_admin":
            err(403, "Only a Super Administrator can assign that role.")
        if x.role == "super_admin" and d.role != "super_admin" and active_super_admins(db) <= 1:
            err(409, "There must always be one active Super Administrator.")
        x.role = d.role
    for field, val in (("extra_perms", d.extra_perms), ("denied_perms", d.denied_perms)):
        if val is not None:
            if any(p not in CATALOG for p in val):
                err(422, "Unknown right.")
            setattr(x, field, sorted(set(val)))
    if d.county_id:
        c = next((c for c in R.admin()["counties"] if c["id"] == d.county_id), None)
        if not c:
            err(422, "Unknown county.")
        x.county_id, x.county_name = c["id"], c["n"]
    if d.sport_id:
        if d.sport_id not in R.SPORT_IDS:
            err(422, "Unknown sport.")
        x.sport_id = d.sport_id
    sc = SCOPE.get(x.role)
    if x.role in STAFF_ROLES and ((sc == "county" and not x.county_id) or (sc == "sport" and not x.sport_id)):
        err(422, "That role needs a county or sport assignment.")
    if d.active is not None:
        if d.active is False and x.role == "super_admin" and active_super_admins(db) <= 1:
            err(409, "There must always be one active Super Administrator.")
        x.active = d.active
    if d.password:
        if len(d.password) < 8:
            err(422, "Password must be at least 8 characters.")
        x.password_hash = S.hash_password(d.password)
        x.must_change_password = True
    log(db, u, "Updated account", x.name)
    db.commit()
    return {"user": user_out(x)}


# ───────────── control centre ─────────────
@router.get("/control/overview")
def control_overview(db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not (can(u, "users.manage") or can(u, "roles.manage")):
        err(403, "The control centre is for administrators.")
    pending = {"Submitted", "Under review", "Needs info", "Endorsed"}
    apps = db.execute(select(Application.county_id, Application.sport, Application.status)).all()
    by_c: dict[str, int] = {}
    by_s: dict[str, int] = {}
    for cid, sp, st in apps:
        if st in pending:
            by_c[cid] = by_c.get(cid, 0) + 1
            by_s[sp] = by_s.get(sp, 0) + 1
    staff = db.scalars(select(User).where(User.active.is_(True), User.role.in_(["county_officer", "federation_admin"]))).all()
    off: dict[str, int] = {}
    adm: dict[str, int] = {}
    for x in staff:
        if x.role == "county_officer" and x.county_id:
            off[x.county_id] = off.get(x.county_id, 0) + 1
        if x.role == "federation_admin" and x.sport_id:
            adm[x.sport_id] = adm.get(x.sport_id, 0) + 1
    return {
        "catalog": CATALOG,
        "roles": [{"id": r, "perms": sorted(ROLE_PERMS[r]), "defaults": sorted(DEFAULTS[r]), "locked": r == "super_admin"}
                  for r in ["super_admin", "registrar", "county_officer", "federation_admin", "facilities_officer",
                            "finance_officer", "integrity_officer", "system_admin"]],
        "coverage": {
            "counties": [{"id": c["id"], "name": c["n"], "officers": off.get(c["id"], 0), "pending": by_c.get(c["id"], 0)}
                         for c in R.admin()["counties"]],
            "sports": [{"id": sid, "name": nm, "admins": adm.get(sid, 0), "pending": by_s.get(sid, 0)} for sid, nm, _ in R.SPORTS],
        },
        "applicants": db.scalar(select(func.count()).select_from(User).where(User.role == "member")) or 0,
    }


@router.put("/control/roles/{role}")
def set_role_perms(role: str, d: RolePermsIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "roles.manage"):
        err(403, "Only a Super Administrator can change role rights.")
    if role not in DEFAULTS or role in ("member", "super_admin"):
        err(422, "That role's rights cannot be edited.")
    if any(p not in CATALOG for p in d.perms):
        err(422, "Unknown right.")
    row = db.get(Setting, "role_perms") or Setting(key="role_perms", value={})
    row.value = {**row.value, role: sorted(set(d.perms))}
    db.merge(row)
    rbac.load_overrides(row.value)
    log(db, u, f"Rights changed for {ROLE_LABEL[role]}", role)
    db.commit()
    return {"role": {"id": role, "perms": sorted(ROLE_PERMS[role])}}


@router.get("/control/members")
def control_members(q: str = "", db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "users.manage"):
        err(403, "You cannot manage accounts.")
    counts = dict(db.execute(select(Application.owner_id, func.count()).group_by(Application.owner_id)).all())
    needle = q.strip().lower()
    users = [m for m in db.scalars(select(User).where(User.role == "member").order_by(User.created_at.desc())).all()
             if not needle or needle in f"{m.name} {m.email} {m.phone}".lower()]
    return {"total": len(users), "members": [{**user_out(m), "createdAt": m.created_at, "registrations": counts.get(m.id, 0)}
                                             for m in users[:200]]}


# ───────────── photos and trial videos ─────────────
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", str(Path(__file__).resolve().parent.parent / "uploads")))
LIMITS = {"document": 8 * 1024 * 1024, "photo": int(float(os.getenv("MAX_PHOTO_MB", "6")) * 1024 * 1024), "video": int(float(os.getenv("MAX_VIDEO_MB", "60")) * 1024 * 1024)}
QUOTA = {"photo": 8, "video": 4, "document": 6}


def sniff(head: bytes) -> tuple[str, str] | None:
    """(kind, mime) from the file's own bytes; the client's claimed type is never trusted."""
    if head[:4] == b"%PDF":
        return "document", "application/pdf"
    if head[:3] == b"\xff\xd8\xff":
        return "photo", "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "photo", "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "photo", "image/webp"
    if head[4:8] == b"ftyp":
        return "video", "video/quicktime" if head[8:12] == b"qt  " else "video/mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "video", "video/webm"
    return None


def media_access(db: Session, u: User, aid: str, write: bool = False) -> Application:
    a = db.get(Application, aid)
    if not a:
        err(404, "Registration not found.")
    owner = a.owner_id == u.id
    staff_ok = u.role in STAFF_ROLES and can(u, "applications.view") and app_in_scope(u, a)
    if write and not owner:
        err(403, "Only the account that registered this player can change their media.")
    if not (owner or staff_ok):
        err(404, "Registration not found.")
    return a


@router.post("/applications/{aid}/media", status_code=201)
async def upload_media(aid: str, kind: str = Form(...), title: str = Form(""), file: UploadFile = File(...),
                       db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = media_access(db, u, aid, write=True)
    if kind not in LIMITS:
        err(422, "Choose photo, video or document.")
    if kind == "document" and a.type not in R.ORG_TYPES:
        err(422, "Documents are uploaded for clubs and organisations.")
    if kind != "document" and a.type != "Player / Sportsperson":
        err(422, "Photos and trial videos belong to player records.")
    if a.status == "Rejected":
        err(409, "This registration was rejected.")
    have = db.scalar(select(func.count()).select_from(Media).where(Media.application_id == aid, Media.kind == kind)) or 0
    if have >= QUOTA[kind]:
        err(409, f"Limit reached: at most {QUOTA[kind]} {kind}s per player. Delete one first.")
    head = await file.read(16)
    found = sniff(head)
    ok_kind = found and ((kind == "document" and (found[0] == "document" or found[0] == "photo")) or found[0] == kind)
    if not ok_kind:
        err(422, "Unsupported file. Photos: JPG, PNG or WebP. Videos: MP4, MOV or WebM. Documents: PDF, JPG or PNG.")
    mid = uuid4().hex
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    path = MEDIA_DIR / mid
    size = len(head)
    try:
        with open(path, "wb") as fh:
            fh.write(head)
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > LIMITS[kind]:
                    err(413, f"File too large. Maximum {LIMITS[kind] // (1024 * 1024)} MB for a {kind}.")
                fh.write(chunk)
    except HTTPException:
        path.unlink(missing_ok=True)
        raise
    m = Media(id=mid, application_id=aid, kind=kind, title=title.strip()[:120], mime=found[1], size=size,
              path=str(path), uploader_id=u.id, created_at=now())
    db.add(m)
    if kind == "photo" and not a.photo_id:
        a.photo_id = mid
    req = a.media_request
    if kind == "video" and req and not req.get("fulfilledAt"):
        a.media_request = {**req, "fulfilledAt": now()}
        a.history = [*a.history, hist(u, "Trial video supplied")]
    log(db, u, f"Uploaded {kind}", aid)
    db.commit()
    return {"media": media_out(m, a.photo_id == mid)}


def media_requester(db: Session, u: User, aid: str) -> Application:
    a = db.get(Application, aid)
    ok = any(can(u, p) for p in ("applications.review", "applications.endorse", "applications.decide"))
    if not a or not ok or not app_in_scope(u, a):
        err(404 if not a else 403, "Registration not found." if not a else "You cannot request media for this record.")
    if a.type != "Player / Sportsperson":
        err(422, "Trial videos are requested from player records.")
    return a


@router.post("/applications/{aid}/media-request")
def request_media(aid: str, d: MediaRequestIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = media_requester(db, u, aid)
    note = d.note.strip()[:300]
    a.media_request = {"kind": "video", "note": note, "by": u.name, "role": ROLE_LABEL[u.role], "at": now(), "fulfilledAt": None}
    a.history = [*a.history, hist(u, "Trial video requested", note or None)]
    log(db, u, "Requested trial video", a.id)
    db.commit()
    return {"application": app_out(a, u)}


@router.delete("/applications/{aid}/media-request")
def cancel_media_request(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = media_requester(db, u, aid)
    if not a.media_request:
        err(404, "There is no open request.")
    a.media_request = None
    log(db, u, "Cancelled trial video request", a.id)
    db.commit()
    return {"application": app_out(a, u)}


@router.get("/applications/{aid}/media")
def list_media(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = media_access(db, u, aid)
    rows = db.scalars(select(Media).where(Media.application_id == aid).order_by(Media.created_at.desc())).all()
    return {"media": [media_out(m, m.id == a.photo_id) for m in rows]}


def media_row(db: Session, u: User, mid: str, write: bool = False) -> tuple[Media, Application]:
    m = db.get(Media, mid)
    if not m:
        err(404, "File not found.")
    a = media_access(db, u, m.application_id)
    if write and not (a.owner_id == u.id or (can(u, "applications.decide") and app_in_scope(u, a))):
        err(403, "You cannot change this file.")
    return m, a


@router.get("/media/{mid}")
def get_media(mid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    m, _ = media_row(db, u, mid)
    if not Path(m.path).exists():
        err(404, "File not found.")
    return FileResponse(m.path, media_type=m.mime, headers={"Cache-Control": "private, max-age=300",
                                                            "X-Content-Type-Options": "nosniff"})


@router.delete("/media/{mid}")
def delete_media(mid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    m, a = media_row(db, u, mid, write=True)
    Path(m.path).unlink(missing_ok=True)
    db.delete(m)
    if a.photo_id == mid:
        nxt = db.scalars(select(Media).where(Media.application_id == a.id, Media.kind == "photo", Media.id != mid)).first()
        a.photo_id = nxt.id if nxt else None
    log(db, u, f"Removed {m.kind}", a.id)
    db.commit()
    return {"ok": True}


@router.post("/media/{mid}/primary")
def make_primary(mid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    m, a = media_row(db, u, mid, write=True)
    if m.kind != "photo":
        err(422, "Only a photo can be the profile photo.")
    a.photo_id = mid
    db.commit()
    return {"application": app_out(a, u, owner_view=a.owner_id == u.id)}


@router.put("/federations/{sport_id}")
def save_federation(sport_id: str, d: FederationIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not can(u, "federations.manage"):
        err(403, "Your role cannot manage federations.")
    f = db.get(Federation, sport_id)
    if not f:
        err(404, "Sport not found.")
    if len(d.name.strip()) < 3 or d.status not in ("Recognised", "To be confirmed"):
        err(422, "Enter the federation name and a valid status.")
    if d.contact_email and not EMAIL.match(d.contact_email):
        err(422, "Enter a valid contact email.")
    f.name, f.status, f.contact_email, f.updated_at = d.name.strip(), d.status, d.contact_email.strip(), now()
    # keep the snapshot on open applications in sync is unnecessary: new ones read the live value
    log(db, u, f"Federation updated ({f.sport_name})", f.sport_id)
    db.commit()
    return {"federation": federation_out(f)}
