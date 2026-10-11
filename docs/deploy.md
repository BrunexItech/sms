# Deploying

## 1. On the server

```bash
git clone <your-repo> sports && cd sports
cp .env.example .env && nano .env       # fill in the required block
docker compose up -d --build
docker compose logs -f api               # first start: migrates the database and creates your admin
```

The site listens on `127.0.0.1:8090`. Point your reverse proxy at it. Example nginx:

```nginx
server {
  server_name sports.example.go.ke;
  client_max_body_size 70m;              # trial videos are up to 60 MB
  location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Add TLS (certbot, or Cloudflare in front). Sessions use a `Secure` cookie in production, so HTTPS is required.

## 2. First sign-in
Sign in with `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`. You are sent to **Security** to choose your own password
(and turn on two-factor). Then open **Control Center**: appoint county officers and federation administrators
(the *Verification coverage* tab lists counties and sports with nobody assigned), and confirm each federation.

## 3. M-Pesa sandbox (free)
1. Create a free account at developer.safaricom.co.ke and make an app (enable *Lipa Na M-Pesa Sandbox*).
2. Copy the app's **Consumer Key** and **Consumer Secret**, and the sandbox **Passkey** shown under *Test credentials*, into `.env`.
   The sandbox shortcode `174379` is already the default.
3. `docker compose up -d` again. Registrations now show an M-Pesa prompt. Use the sandbox test phone numbers Safaricom lists on that page.
4. Safaricom must reach `https://<PUBLIC_URL>/api/mpesa/callback/<MPESA_CALLBACK_SECRET>`. If it cannot (e.g. local testing),
   the site polls Safaricom for the result instead, so payments still complete.
5. Going live later: set `MPESA_ENV=production` and your real shortcode, consumer key/secret and passkey. Nothing else changes.

## 4. Backups
Back up the `dbdata` (PostgreSQL) and `uploads` volumes. Example: `docker compose exec db pg_dump -U sports sports > backup.sql`.

## 5. Updating
`git pull && docker compose up -d --build`. Database changes ship as Alembic migrations and are applied on start.
