FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /data/uploads && useradd -r -u 10001 app && chown -R app /data /srv
USER app
ENV MEDIA_DIR=/data/uploads APP_ENV=production
EXPOSE 8000
# Migrate, then serve. Behind the reverse proxy, so trust forwarded headers.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
