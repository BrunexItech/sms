import hashlib
import io
import secrets
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pyotp
import qrcode
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import mpesa
from . import refdata as R
from . import security as S
from . import settings as C
from .api import (ROLE_LABEL, In, app_out, can, err, evidence_rule, hist, log, need_user, now, optional_user, payment_required,
                  settle, app_in_scope, user_out, fees, rid)
from .db import get_db
from .models import Application, Event, Notification, PasswordReset, PaymentAttempt, Setting, User
from .notify import email, notify
from .rbac import STAFF_ROLES

router = APIRouter(prefix="/api")


# ───────────── password reset / change, 2FA ─────────────
class ForgotIn(In):
    identifier: str


class ResetIn(In):
    token: str
    password: str


class ChangeIn(In):
    current: str
    new: str


class CodeIn(In):
    code: str
    password: str = ""


def strong(pw: str) -> bool:
    return len(pw) >= 8 and any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw)


@router.post("/auth/forgot")
def forgot(d: ForgotIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "?"
    if S.too_many_attempts(f"forgot:{ip}", limit=6, window=3600):
        err(429, "Too many requests. Try again later.")
    ident = d.identifier.strip().lower()
    u = db.scalars(select(User).where(User.email == ident)).first()
    out: dict = {"ok": True, "message": "If that account exists, a reset link has been sent."}
    if u and u.active:
        token = secrets.token_urlsafe(32)
        db.add(PasswordReset(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=u.id,
                             expires_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(), used=False))
        db.commit()
        link = f"{C.PUBLIC_URL}/reset?token={token}"
        email(u.email, "Reset your password · Ministry of Sports", f"Use this link within one hour:\n\n{link}\n\nIf you did not ask for this, ignore it.")
        if not C.PRODUCTION and not C.SMTP_HOST:
            out["devLink"] = f"/reset?token={token}"  # development only: no mail server configured
    return out


@router.post("/auth/reset")
def reset(d: ResetIn, db: Session = Depends(get_db)):
    if not strong(d.password):
        err(422, "Use at least 8 characters, with letters and a number.")
    row = db.get(PasswordReset, hashlib.sha256(d.token.encode()).hexdigest())
    if not row or row.used or row.expires_at < now():
        err(400, "This reset link is invalid or has expired. Request a new one.")
    u = db.get(User, row.user_id)
    if not u:
        err(400, "This reset link is invalid or has expired.")
    u.password_hash = S.hash_password(d.password)
    u.must_change_password = False
    row.used = True
    log(db, u, "Password reset", "account")
    db.commit()
    return {"ok": True}


@router.post("/auth/change-password")
def change_password(d: ChangeIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not S.verify_password(d.current, u.password_hash):
        err(401, "Your current password is not correct.")
    if not strong(d.new):
        err(422, "Use at least 8 characters, with letters and a number.")
    if d.new == d.current:
        err(422, "Choose a password different from the current one.")
    u.password_hash = S.hash_password(d.new)
    u.must_change_password = False
    log(db, u, "Changed password", "account")
    db.commit()
    return {"me": user_out(u)}


@router.post("/auth/2fa/setup")
def totp_setup(db: Session = Depends(get_db), u: User = Depends(need_user)):
    if u.totp_enabled:
        err(409, "Two-factor authentication is already on.")
    u.totp_secret = pyotp.random_base32()
    db.commit()
    uri = pyotp.TOTP(u.totp_secret).provisioning_uri(name=u.email, issuer_name="Ministry of Sports Kenya")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    import base64
    return {"secret": u.totp_secret, "uri": uri, "qr": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()}


@router.post("/auth/2fa/enable")
def totp_enable(d: CodeIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not u.totp_secret or not pyotp.TOTP(u.totp_secret).verify(d.code.strip(), valid_window=1):
        err(422, "That code is not correct. Check your authenticator app and try again.")
    u.totp_enabled = True
    log(db, u, "Enabled two-factor authentication", "account")
    db.commit()
    return {"me": user_out(u)}


@router.post("/auth/2fa/disable")
def totp_disable(d: CodeIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if u.role in STAFF_ROLES and C.REQUIRE_STAFF_2FA:
        err(403, "Two-factor authentication is mandatory for staff.")
    if not S.verify_password(d.password, u.password_hash) or not u.totp_secret or not pyotp.TOTP(u.totp_secret).verify(d.code.strip(), valid_window=1):
        err(401, "Password or code is not correct.")
    u.totp_enabled, u.totp_secret = False, None
    log(db, u, "Disabled two-factor authentication", "account")
    db.commit()
    return {"me": user_out(u)}


@router.post("/notifications/read")
def read_notifications(db: Session = Depends(get_db), u: User = Depends(need_user)):
    for n in db.scalars(select(Notification).where(Notification.user_id == u.id, Notification.read.is_(False))).all():
        n.read = True
    db.commit()
    return {"ok": True}


# ───────────── renewal, appeal, certificate ─────────────
class NoteIn(In):
    note: str


def own_app(db: Session, u: User, aid: str) -> Application:
    a = db.get(Application, aid)
    if not a or a.owner_id != u.id:
        err(404, "Registration not found.")
    return a


class ListingIn(In):
    listed: bool


@router.post("/applications/{aid}/listing")
def set_listing(aid: str, d: ListingIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = own_app(db, u, aid)
    if a.type != "Player / Sportsperson":
        err(422, "Only players can be listed on a club page.")
    a.public_listed = d.listed
    a.history = [*a.history, hist(u, "Public listing " + ("on" if d.listed else "off"))]
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


@router.post("/applications/{aid}/renew")
def renew(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = own_app(db, u, aid)
    if a.status != "Approved":
        err(409, "Only an approved registration can be renewed.")
    if a.renewing:
        err(409, "A renewal is already awaiting payment.")
    if a.expires_at and date.fromisoformat(a.expires_at[:10]) - date.today() > timedelta(days=60):
        err(409, "Renewal opens 60 days before your certificate expires.")
    a.renewing, a.pay_status, a.pay_amount = True, "Pending", fees(db).get(a.type, 500)
    a.pay_method = a.pay_ref = a.pay_at = a.receipt = None
    a.reconciled = False
    a.history = [*a.history, hist(u, "Renewal requested")]
    log(db, u, "Renewal requested", a.id)
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


@router.post("/applications/{aid}/appeal")
def appeal(aid: str, d: NoteIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = own_app(db, u, aid)
    if a.status not in ("Rejected", "Suspended"):
        err(409, "Only a rejected or suspended registration can be appealed.")
    if a.appeal:
        err(409, "An appeal is already with the Registrar.")
    if len(d.note.strip()) < 10:
        err(422, "Explain your appeal in a sentence or two.")
    a.appeal = {"note": d.note.strip()[:1000], "at": now(), "by": u.name}
    a.history = [*a.history, hist(u, "Appeal lodged", d.note.strip()[:300])]
    log(db, u, "Appeal lodged", a.id)
    for r in db.scalars(select(User).where(User.role.in_(["registrar", "super_admin"]), User.active.is_(True))).all():
        notify(db, r, "Appeal lodged", f"{a.club_name or a.name} ({a.id}) appealed a {a.status.lower()} decision.", "/console/applications")
    db.commit()
    return {"application": app_out(a, u, owner_view=True)}


@router.get("/applications/{aid}/certificate.pdf")
def certificate(aid: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    a = db.get(Application, aid)
    if not a:
        err(404, "Registration not found.")
    staff_ok = u.role in STAFF_ROLES and can(u, "applications.view") and app_in_scope(u, a)
    if a.owner_id != u.id and not staff_ok:
        err(404, "Registration not found.")
    if a.status != "Approved" or not a.cert_no:
        err(409, "A certificate is issued once the registration is approved.")
    buf = io.BytesIO()
    w, h = A4
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"Certificate {a.cert_no}")
    c.setStrokeColorRGB(0.96, 0.71, 0)
    c.setLineWidth(4)
    c.rect(28, 28, w - 56, h - 56)
    c.setLineWidth(1)
    c.setStrokeColorRGB(0.02, 0.18, 0.34)
    c.rect(40, 40, w - 80, h - 80)
    x = w / 2
    c.setFillColorRGB(0.78, 0.16, 0.16)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(x, h - 100, "REPUBLIC OF KENYA")
    c.setFillColorRGB(0.02, 0.18, 0.34)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(x, h - 125, "MINISTRY OF SPORTS")
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(x, h - 200, "Certificate of Registration")
    c.setFont("Helvetica", 13)
    c.setFillColorRGB(0.25, 0.3, 0.4)
    c.drawCentredString(x, h - 250, "This certifies that")
    c.setFillColorRGB(0.02, 0.18, 0.34)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(x, h - 295, a.club_name or a.name)
    sport = next((n for sid, n, _ in R.SPORTS if sid == a.sport), a.sport)
    c.setFont("Helvetica", 13)
    c.setFillColorRGB(0.25, 0.3, 0.4)
    c.drawCentredString(x, h - 335, f"is registered as {a.type} in {sport}, {a.county} County.")
    c.drawCentredString(x, h - 360, f"Federation: {a.federation}")
    c.setFont("Helvetica-Bold", 14)
    c.setFillColorRGB(0.02, 0.18, 0.34)
    c.drawCentredString(x, h - 420, f"Certificate No. {a.cert_no}")
    c.setFont("Helvetica", 11)
    c.drawCentredString(x, h - 442, f"Valid until {a.expires_at or 'renewal'}")
    qr = qrcode.make(f"{C.PUBLIC_URL}/verify?no={a.cert_no}")
    qb = io.BytesIO()
    qr.save(qb, format="PNG")
    qb.seek(0)
    c.drawImage(ImageReader(qb), x - 55, 150, 110, 110)
    c.setFont("Helvetica", 9)
    c.drawCentredString(x, 135, f"Scan to verify: {C.PUBLIC_URL}/verify?no={a.cert_no}")
    c.drawCentredString(x, 70, "Issued electronically by the Office of the Sports Registrar. Verify authenticity online.")
    c.showPage()
    c.save()
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{a.cert_no}.pdf"', "Cache-Control": "private, max-age=60"})


# ───────────── events ─────────────
class EventIn(In):
    name: str
    sport: str
    date: str
    venue: str
    county_id: str
    level: str = "Amateur"


@router.post("/events", status_code=201)
def submit_event(d: EventIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    org = db.scalars(select(Application).where(
        Application.owner_id == u.id, Application.status == "Approved",
        Application.type.in_(["Club", "Academy", "Event Organiser", "Federation / Association", "Sports Business"]))).first()
    if not org:
        err(403, "Only verified clubs and organisations can submit events.")
    c = next((x for x in R.admin()["counties"] if x["id"] == d.county_id), None)
    try:
        when = date.fromisoformat(d.date)
    except ValueError:
        err(422, "Enter the event date.")
    if not c or d.sport not in R.SPORT_IDS or d.level not in R.LEVELS:
        err(422, "Choose a valid county, sport and level.")
    if len(d.name.strip()) < 5 or len(d.venue.strip()) < 3:
        err(422, "Enter the event name and venue.")
    if when < date.today():
        err(422, "The event date must be in the future.")
    e = Event(id=rid("EVT-", 5), name=d.name.strip(), sport=d.sport, date=when.isoformat(), venue=d.venue.strip(),
              county=c["n"], county_id=c["id"], organiser=org.club_name or org.name, level=d.level, status="Pending", owner_id=u.id)
    db.add(e)
    log(db, u, "Submitted event", e.id)
    db.commit()
    return {"event": {"id": e.id, "status": e.status}}


@router.get("/events/pending")
def pending_events(db: Session = Depends(get_db), u: User = Depends(need_user)):
    rows = db.scalars(select(Event).where(Event.status == "Pending").order_by(Event.date)).all()
    mine = u.role == "member"
    review = u.role in STAFF_ROLES and (can(u, "applications.review") or can(u, "applications.decide"))
    if not mine and not review:
        err(403, "You cannot review events.")
    out = []
    for e in rows:
        if mine and e.owner_id != u.id:
            continue
        if review and u.role == "county_officer" and e.county_id != u.county_id:
            continue
        out.append({"id": e.id, "name": e.name, "sport": e.sport, "date": e.date, "venue": e.venue, "county": e.county,
                    "countyId": e.county_id, "organiser": e.organiser, "level": e.level, "status": e.status})
    return {"events": out}


class DecisionIn(In):
    approve: bool
    note: str = ""


@router.post("/events/{eid}/decision")
def decide_event(eid: str, d: DecisionIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    e = db.get(Event, eid)
    if not e or e.status != "Pending":
        err(404, "Event not found.")
    if not (can(u, "applications.decide") or can(u, "applications.review")) or (u.role == "county_officer" and e.county_id != u.county_id):
        err(403, "You cannot review this event.")
    if not d.approve and len(d.note.strip()) < 3:
        err(422, "A reason is required to decline.")
    e.status = "Approved" if d.approve else "Declined"
    log(db, u, f"Event {e.status.lower()}", e.id)
    notify(db, db.get(User, e.owner_id) if e.owner_id else None, f"Event {e.status.lower()}: {e.name}",
           "Your event is now listed publicly." if d.approve else f"It was declined. {d.note.strip()}", "/events")
    db.commit()
    return {"ok": True}


# ───────────── evidence rule (control centre) ─────────────
class EvidenceIn(In):
    enabled: bool
    levels: list[str]
    sports: list[str] = []
    club_documents: bool = True


@router.put("/control/evidence")
def set_evidence(d: EvidenceIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not (can(u, "roles.manage") or can(u, "settings.manage")):
        err(403, "Only an administrator can change the evidence rule.")
    if any(l not in R.LEVELS for l in d.levels) or any(s not in R.SPORT_IDS for s in d.sports):
        err(422, "Invalid level or sport.")
    row = db.get(Setting, "evidence") or Setting(key="evidence", value={})
    row.value = {"enabled": d.enabled, "levels": d.levels, "sports": d.sports, "clubDocuments": d.club_documents}
    db.merge(row)
    log(db, u, "Evidence rule changed", "settings")
    db.commit()
    return {"evidence": evidence_rule(db)}


class PaymentRuleIn(In):
    required: bool


@router.put("/control/payment-rule")
def set_payment_rule(d: PaymentRuleIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not (can(u, "roles.manage") or can(u, "settings.manage")):
        err(403, "Only an administrator can change the payment rule.")
    row = db.get(Setting, "payment_rule") or Setting(key="payment_rule", value={})
    row.value = {"required": d.required}
    db.merge(row)
    log(db, u, f"Payment before approval {'required' if d.required else 'waived'}", "settings")
    db.commit()
    return {"required": payment_required(db)}


# ───────────── M-Pesa (Daraja) ─────────────
class MpesaIn(In):
    application_ids: list[str]
    phone: str


@router.post("/pay/mpesa", status_code=201)
def pay_mpesa(d: MpesaIn, db: Session = Depends(get_db), u: User = Depends(need_user)):
    if not C.MPESA_READY:
        err(501, "M-Pesa is not configured on this server.")
    if S.too_many_attempts(f"stk:{u.id}", limit=6, window=600):
        err(429, "Too many payment attempts. Wait a few minutes.")
    apps = [db.get(Application, i) for i in dict.fromkeys(d.application_ids)]
    if not apps or any(a is None or a.owner_id != u.id for a in apps):
        err(404, "Registration not found.")
    if any(a.pay_status != "Pending" for a in apps):
        err(409, "One or more of these registrations is already paid.")
    try:
        phone = mpesa.normalise_phone(d.phone)
        amount = sum(a.pay_amount for a in apps)
        aid = uuid4().hex
        res = mpesa.stk_push(phone, amount, apps[0].id[-6:] if len(apps) == 1 else "ROSTER", "Registration",
                             f"{C.PUBLIC_URL}/api/mpesa/callback/{C.MPESA_CALLBACK_SECRET}")
    except mpesa.MpesaError as e:
        err(502, str(e))
    t = now()
    att = PaymentAttempt(id=aid, checkout_request_id=res.get("CheckoutRequestID"), user_id=u.id,
                         application_ids=[a.id for a in apps], amount=amount, phone=phone, status="Pending",
                         created_at=t, updated_at=t)
    db.add(att)
    log(db, u, "M-Pesa STK push sent", aid)
    db.commit()
    return {"attemptId": aid, "message": "Check your phone and enter your M-Pesa PIN."}


def finish_attempt(db: Session, att: PaymentAttempt, code: int | None, desc: str, receipt: str | None) -> None:
    if att.status != "Pending":
        return  # idempotent: callback and polling may both arrive
    if code == 0:
        payer = db.get(User, att.user_id)
        for aid in att.application_ids:
            a = db.get(Application, aid)
            if a and a.pay_status == "Pending":
                settle(db, a, payer, "M-Pesa", receipt or "")
        att.status, att.receipt = "Success", receipt
        notify(db, payer, "Payment received", f"KSh {att.amount:,} received via M-Pesa. Receipt {receipt or ''}.", "/account")
    else:
        att.status = "Cancelled" if code == 1032 else "Failed"
    att.result_desc, att.updated_at = (desc or "")[:200], now()


@router.post("/mpesa/callback/{secret}")
async def mpesa_callback(secret: str, request: Request, db: Session = Depends(get_db)):
    if not secrets.compare_digest(secret, C.MPESA_CALLBACK_SECRET):
        err(404, "Not found.")
    try:
        cb = (await request.json())["Body"]["stkCallback"]
        att = db.scalars(select(PaymentAttempt).where(PaymentAttempt.checkout_request_id == cb["CheckoutRequestID"])).first()
        if att:
            items = {i["Name"]: i.get("Value") for i in (cb.get("CallbackMetadata") or {}).get("Item", [])}
            paid = int(float(items.get("Amount", 0))) if cb["ResultCode"] == 0 else 0
            if cb["ResultCode"] == 0 and paid < att.amount:
                finish_attempt(db, att, -1, "Amount received was less than the amount due.", None)
            else:
                finish_attempt(db, att, int(cb["ResultCode"]), cb.get("ResultDesc", ""), items.get("MpesaReceiptNumber"))
            db.commit()
    except Exception:  # noqa: BLE001  (always acknowledge so Safaricom stops retrying malformed calls)
        db.rollback()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/pay/attempts/{attempt_id}")
def attempt_status(attempt_id: str, db: Session = Depends(get_db), u: User = Depends(need_user)):
    att = db.get(PaymentAttempt, attempt_id)
    if not att or att.user_id != u.id:
        err(404, "Payment not found.")
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(att.created_at)).total_seconds()
    if att.status == "Pending" and C.MPESA_READY and att.checkout_request_id and age > 12:
        try:  # the callback may not reach this server (e.g. local development); ask Safaricom directly
            q = mpesa.stk_query(att.checkout_request_id)
            if "ResultCode" in q:
                finish_attempt(db, att, int(q["ResultCode"]), q.get("ResultDesc", ""), None)
                db.commit()
        except mpesa.MpesaError:
            pass
    if att.status == "Pending" and age > 180:
        finish_attempt(db, att, 1037, "The request timed out. No money was taken.", None)
        db.commit()
    return {"status": att.status, "message": att.result_desc, "receipt": att.receipt}
