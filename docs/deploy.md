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
    proxy_read_timeout 180s;             # reading a paper scan can take a while
    proxy_send_timeout 180s;
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
A `backup` service runs with the rest of the stack. When it starts, and then every 24 hours, it writes two files into `~/sports/backups/`:
`db-YYYYMMDD-HHMM.sql.gz` (the database) and `uploads-YYYYMMDD-HHMM.tar.gz` (uploaded files and scans).
It only adds files. Look at it with `ls -lh ~/sports/backups` and `docker-compose logs backup`.

- **Keep copies off the server.** A backup on the same machine does not survive losing the machine. Copy the folder to another computer regularly, for example `scp -r user@server:~/sports/backups ./sports-backups`.
- **Tidy old files by hand** when the folder gets large, deleting the oldest `db-` and `uploads-` files you no longer need.
- **Restore the database** (this replaces current data, so do it only to recover): stop the app with `docker-compose stop api web`, then
  `gunzip -c backups/db-YYYYMMDD-HHMM.sql.gz | docker-compose exec -T db psql -U sports sports`, then `docker-compose start api web`.
- **Restore uploads:** `docker-compose run --rm -v "$PWD/backups:/backups" api sh -c "tar -xzf /backups/uploads-YYYYMMDD-HHMM.tar.gz -C /data/uploads"`.

## 5. Updating
`git pull && docker compose up -d --build`. Database changes ship as Alembic migrations and are applied on start.
