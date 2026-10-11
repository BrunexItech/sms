# National Sports Management Platform (Kenya)

Public site, applicant accounts, club portal and Ministry staff console, on a FastAPI backend.

## Run locally

```bash
# API (SQLite by default; set DATABASE_URL for PostgreSQL)
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --port 8000        # seeds demo data on first start

# Web (proxies /api to the API)
npm install && npm run dev               # http://localhost:3000
```

Tests: `cd backend && pytest`. Deploy with Docker: see [docs/deploy.md](docs/deploy.md).

## Who sees what

| Visitor | Can see |
|---|---|
| Public | Facilities, events, fees, federations, certificate verification. **Not** players or clubs. |
| Player (own account) | Their own registrations and status. |
| Verified club | Its own roster; can register and pay for players. |
| Federation admin | Members of their sport (no ID/KRA/phone/email). |
| County officer | Their county's applications and facilities. |
| Registrar / Integrity | National scope; Registrar decides, Integrity suspends. |
| Finance / ICT | Payments (no personal data) / accounts, fees, audit. |

Workflow, roles and data sources: [docs/operating-model.md](docs/operating-model.md).
