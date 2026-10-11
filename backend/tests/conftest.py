import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_db.name}"
os.environ["SEED_PASSWORD"] = "Sports@2026!"
os.environ["REG_RATE_LIMIT"] = "100000"
os.environ["APP_ENV"] = "development"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PW = "Sports@2026!"


@pytest.fixture(scope="session")
def client_factory():
    with TestClient(app):  # runs lifespan once (create tables + seed)
        def make():
            return TestClient(app)
        yield make


@pytest.fixture
def anon(client_factory):
    return client_factory()


def sign_in(c, email, pw=PW):
    r = c.post("/api/auth/login", json={"identifier": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["me"]


@pytest.fixture
def staff(client_factory):
    def go(email):
        c = client_factory()
        sign_in(c, email)
        return c
    return go
