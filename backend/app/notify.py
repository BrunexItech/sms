"""In-app notifications, plus email when SMTP is configured. Never raises into a request."""
import logging
import smtplib
import threading
from datetime import datetime, timezone
from email.message import EmailMessage

from sqlalchemy.orm import Session

from . import settings as C
from .models import Notification, User

log = logging.getLogger("notify")


def _send(to: str, subject: str, body: str) -> None:
    try:
        m = EmailMessage()
        m["From"], m["To"], m["Subject"] = C.SMTP_FROM, to, subject
        m.set_content(body)
        with smtplib.SMTP(C.SMTP_HOST, C.SMTP_PORT, timeout=15) as s:
            s.starttls()
            if C.SMTP_USER:
                s.login(C.SMTP_USER, C.SMTP_PASSWORD)
            s.send_message(m)
    except Exception as e:  # noqa: BLE001
        log.warning("email to %s failed: %s", to, e)


def email(to: str, subject: str, body: str) -> None:
    if C.SMTP_HOST and to:
        threading.Thread(target=_send, args=(to, subject, body), daemon=True).start()


def notify(db: Session, user: User | None, title: str, body: str, link: str = "/account") -> None:
    if not user:
        return
    db.add(Notification(user_id=user.id, at=datetime.now(timezone.utc).isoformat(), title=title, body=body, link=link, read=False))
    email(user.email, f"{title} · Ministry of Sports", f"{body}\n\n{C.PUBLIC_URL}{link}\n")
