import asyncio
import os
import warnings
from contextlib import asynccontextmanager

warnings.filterwarnings("ignore", message=".*(alias|validation_alias|serialization_alias).*attribute.*")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (register tables)
from . import settings
from .api import router
from .imports import router as imports_router
from .api2 import router as router2
from .db import Base, SessionLocal, engine
from . import rbac
from .models import Setting
from .seed import seed, sync_catalogue


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.PRODUCTION:
        Base.metadata.create_all(engine)  # production schemas are managed by `alembic upgrade head`
    with SessionLocal() as db:
        seed(db)
        sync_catalogue(db)
        row = db.get(Setting, "role_perms")
        rbac.load_overrides(row.value if row else None)
    # scans of closed paper records are removed after the retention period (checked at start and every 6 hours)
    from .imports import purge_scans

    async def sweep():
        while True:
            try:
                with SessionLocal() as db:
                    purge_scans(db)
            except Exception:  # never let clean-up stop the app
                pass
            await asyncio.sleep(6 * 3600)

    task = asyncio.create_task(sweep())
    yield
    task.cancel()


app = FastAPI(title="National Sports Management Platform API", version="1.0", lifespan=lifespan,
              docs_url=None if os.getenv("APP_ENV") == "production" else "/api/docs", openapi_url=None if os.getenv("APP_ENV") == "production" else "/api/openapi.json")
origins = [o for o in os.getenv("CORS_ORIGINS", "").split(",") if o]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
app.include_router(router2)
app.include_router(imports_router)
