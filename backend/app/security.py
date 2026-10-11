import base64
import hashlib
import hmac
import os
import time
from collections import defaultdict, deque

import jwt

APP_ENV = os.getenv("APP_ENV", "development")
SECRET = os.getenv("SECRET_KEY", "")
if not SECRET:
    if APP_ENV == "production":
        raise RuntimeError("SECRET_KEY must be set in production")
    SECRET = "dev-only-secret-change-me-0123456789abcdef"
if APP_ENV == "production" and len(SECRET) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters in production")
COOKIE = "sms_session"
TTL = 60 * 60 * 8


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return base64.b64encode(salt + h).decode()


def verify_password(pw: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored)
        salt, h = raw[:16], raw[16:]
        c = hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(c, h)
    except Exception:
        return False


def make_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": int(time.time()) + TTL}, SECRET, algorithm="HS256")


def read_token(token: str) -> str | None:
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])["sub"]
    except Exception:
        return None


_attempts: dict[str, deque] = defaultdict(deque)


def too_many_attempts(key: str, limit: int = 8, window: int = 600) -> bool:
    now = time.time()
    q = _attempts[key]
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


def clear_attempts(key: str) -> None:
    _attempts.pop(key, None)
