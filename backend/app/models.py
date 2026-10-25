from sqlalchemy import JSON, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String, default="")
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="member")
    title: Mapped[str] = mapped_column(String, default="")
    county_id: Mapped[str | None] = mapped_column(String, nullable=True)
    county_name: Mapped[str | None] = mapped_column(String, nullable=True)
    sport_id: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    extra_perms: Mapped[list] = mapped_column(JSON, default=list)
    denied_perms: Mapped[list] = mapped_column(JSON, default=list)
    last_login: Mapped[str | None] = mapped_column(String, nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    totp_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String)


class Federation(Base):
    __tablename__ = "federations"
    sport_id: Mapped[str] = mapped_column(String, primary_key=True)
    sport_name: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Recognised")  # Recognised | To be confirmed
    contact_email: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[str] = mapped_column(String, default="")


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    club_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    parent_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)  # county branch -> national federation
    type: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    id_no: Mapped[str] = mapped_column(String, default="", index=True)
    kra: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    county_id: Mapped[str] = mapped_column(String, index=True)
    sub_id: Mapped[str] = mapped_column(String)
    ward_id: Mapped[str] = mapped_column(String)
    county: Mapped[str] = mapped_column(String)
    sub_county: Mapped[str] = mapped_column(String)
    ward: Mapped[str] = mapped_column(String)
    lat: Mapped[float | None] = mapped_column(nullable=True)
    lon: Mapped[float | None] = mapped_column(nullable=True)
    sport: Mapped[str] = mapped_column(String, index=True)
    federation: Mapped[str] = mapped_column(String, default="")
    level: Mapped[str] = mapped_column(String, default="Amateur")
    club_name: Mapped[str] = mapped_column(String, default="")
    officials: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    has_contract: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="Submitted", index=True)
    cert_no: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)
    history: Mapped[list] = mapped_column(JSON, default=list)
    pay_status: Mapped[str] = mapped_column(String, default="Pending")
    pay_amount: Mapped[int] = mapped_column(Integer, default=0)
    pay_method: Mapped[str | None] = mapped_column(String, nullable=True)
    pay_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    pay_at: Mapped[str | None] = mapped_column(String, nullable=True)
    receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_id: Mapped[str | None] = mapped_column(String, nullable=True)
    media_request: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    role: Mapped[str | None] = mapped_column(String, nullable=True)  # role catalogue id
    public_listed: Mapped[bool] = mapped_column(Boolean, default=False)  # shown on the club's public page
    org_reg_no: Mapped[str] = mapped_column(String, default="")  # society / company / registrar certificate number
    sport_other: Mapped[str] = mapped_column(String, default="")  # name given when the sport is "other"
    dob: Mapped[str | None] = mapped_column(String, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    guardian: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[str | None] = mapped_column(String, nullable=True)
    renewing: Mapped[bool] = mapped_column(Boolean, default=False)
    appeal: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Media(Base):
    __tablename__ = "media"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    application_id: Mapped[str] = mapped_column(String, index=True)
    kind: Mapped[str] = mapped_column(String)  # photo | video
    title: Mapped[str] = mapped_column(String, default="")
    mime: Mapped[str] = mapped_column(String)
    size: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String)
    uploader_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class Facility(Base):
    __tablename__ = "facilities"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    type: Mapped[str] = mapped_column(String)
    sports: Mapped[list] = mapped_column(JSON, default=list)
    county_id: Mapped[str] = mapped_column(String, index=True)
    sub_id: Mapped[str] = mapped_column(String, default="")
    ward_id: Mapped[str] = mapped_column(String, default="")
    county: Mapped[str] = mapped_column(String)
    sub_county: Mapped[str] = mapped_column(String, default="")
    ward: Mapped[str] = mapped_column(String, default="")
    lat: Mapped[float] = mapped_column()
    lon: Mapped[float] = mapped_column()
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ownership: Mapped[str | None] = mapped_column(String, nullable=True)
    condition: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="Unverified", index=True)
    source: Mapped[str] = mapped_column(String, default="Registered")
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    history: Mapped[list] = mapped_column(JSON, default=list)
    inspections: Mapped[list] = mapped_column(JSON, default=list)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    sport: Mapped[str] = mapped_column(String)
    date: Mapped[str] = mapped_column(String)
    venue: Mapped[str] = mapped_column(String)
    county: Mapped[str] = mapped_column(String)
    county_id: Mapped[str] = mapped_column(String)
    organiser: Mapped[str] = mapped_column(String)
    level: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Approved", index=True)
    owner_id: Mapped[str | None] = mapped_column(String, nullable=True)


class Audit(Base):
    __tablename__ = "audit"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[str] = mapped_column(String)
    actor: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    target: Mapped[str] = mapped_column(String)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    at: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String)
    link: Mapped[str] = mapped_column(String, default="/account")
    read: Mapped[bool] = mapped_column(Boolean, default=False)


class PasswordReset(Base):
    __tablename__ = "password_resets"
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    expires_at: Mapped[str] = mapped_column(String)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    checkout_request_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    application_ids: Mapped[list] = mapped_column(JSON, default=list)
    amount: Mapped[int] = mapped_column(Integer)
    phone: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="Pending")  # Pending | Success | Failed | Cancelled
    result_desc: Mapped[str] = mapped_column(String, default="")
    receipt: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)
