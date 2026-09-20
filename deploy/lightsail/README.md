# Deploy Vuekumi on AWS Lightsail (Ubuntu)

This guide deploys the full stack on a **single Lightsail instance** using Docker Compose:

| Service | Role |
|---|---|
| **nginx** | Serves React SPA + proxies `/api` |
| **api** | Fastify backend (runs Prisma migrations on start) |
| **postgres** | Database |
| **redis** | Queue cache (ready for future workers) |
| **certbot** | Auto-renews Let's Encrypt SSL |

---

## 1. Create the Lightsail instance

1. In [AWS Lightsail](https://lightsail.aws.amazon.com/), create an instance:
   - **Platform:** Linux/Unix
   - **Blueprint:** Ubuntu 24.04 LTS (or 22.04)
   - **Plan:** at least $12/mo (2 GB RAM recommended for Docker builds)
2. Attach a **Static IP** and note it.
3. In **Networking → Firewall**, ensure these ports are open:
   - SSH (22)
   - HTTP (80)
   - HTTPS (443)
4. Point your domain's **A record** to the static IP (optional for first test; use IP directly).

---

## 2. Initial server setup (run once)

SSH into the instance:

```bash
ssh ubuntu@YOUR_STATIC_IP
```

Clone the repository:

```bash
sudo mkdir -p /opt/vuekumi
sudo chown ubuntu:ubuntu /opt/vuekumi
git clone https://github.com/getnuevetech/vuekumi3.git /opt/vuekumi
cd /opt/vuekumi
git checkout main   # or the branch you are deploying
```

Run the setup script (installs Docker, UFW firewall):

```bash
sudo bash deploy/lightsail/setup.sh
```

Log out and back in so Docker group permissions apply:

```bash
exit
ssh ubuntu@YOUR_STATIC_IP
cd /opt/vuekumi
```

---

## 3. Configure environment

```bash
cp deploy/lightsail/env.production.example .env
nano .env
```

Generate secrets:

```bash
openssl rand -base64 48   # use for JWT_SECRET
openssl rand -base64 48   # use for COOKIE_SECRET
```

Set at minimum:

```env
DOMAIN=photos.yourdomain.com
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<generated>
COOKIE_SECRET=<generated>
WEB_URL=http://YOUR_STATIC_IP        # change to https:// after SSL step
```

Do **not** put Stripe / Flutterwave / OpenAI / Resend keys in `.env`.
After deploy, sign in as admin and open **Settings** to paste those keys.

---

## 4. Deploy

### First boot (empty database)

Seed is **destructive** and **off by default**. On a brand-new instance only:

```bash
SEED_DEMO=1 bash deploy/lightsail/deploy.sh
```

That builds images, starts services, runs migrations, then wipes and loads demo
accounts/photos. Change the admin password immediately. Do **not** leave
`SEED_DEMO=1` in `.env` after the first boot.

| Account | Email | Password |
|---|---|---|
| Admin | admin@vuekumi.com | Admin123! |
| Contributor | amara-okafor@vuekumi.demo | User12345! |

### Routine redeploy (preserve live data)

```bash
bash deploy/lightsail/deploy.sh
```

This will:

1. Build the nginx (SPA) and API Docker images
2. Start Postgres, Redis, API, nginx, certbot
3. Run database migrations automatically (API entrypoint)
4. **Skip** seed unless `SEED_DEMO=1` is set

**Test:** open `http://YOUR_STATIC_IP` in a browser.

Then open **Admin → Settings** and add:

- Stripe (secret, publishable, webhook)
- Flutterwave (secret, public)
- Resend (email)
- OpenAI + Replicate (AI)
- Object storage credentials

---

## 5. Enable HTTPS (recommended)

Once your domain A record points to the static IP:

```bash
bash deploy/lightsail/ssl-init.sh photos.yourdomain.com you@yourdomain.com
```

This obtains a Let's Encrypt certificate, updates nginx for HTTPS, and sets `WEB_URL` to `https://...`.

---

## 6. Operations

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f api
```

### Redeploy after code changes

```bash
cd /opt/vuekumi
git pull origin main
bash deploy/lightsail/deploy.sh
```

Do **not** pass `SEED_DEMO=1` on a live site. Seed deletes users, grants,
payments, and photos before recreating the demo library.

### Catch-up redeploy (Track O2 — Phases 23–45 + cookie fix)

Use this when production is behind `main` (HTTP admin cookie fix, Rights 2.0,
Arc C/D, Phase 41 homepage pins, staff queues, act-as, seed fixtures, Phase 45
smoke). Run on the Lightsail host as `ubuntu`.

```bash
cd /opt/vuekumi

# 1. Backup first
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U vuekumi vuekumi > backup-$(date +%Y%m%d-%H%M).sql

# 2. Confirm you will NOT seed
grep -E '^SEED_DEMO=' .env || true
# Ensure SEED_DEMO is unset or 0

# 3. Pull and redeploy (migrations run via API entrypoint; seed skipped)
git fetch origin main
git checkout main
git pull origin main
bash deploy/lightsail/deploy.sh

# 4. Confirm SHA and health
git rev-parse --short HEAD
curl -sf "${WEB_URL}/api/health" && echo
```

Smoke after deploy:

1. Admin login at `${WEB_URL}/admin` (HTTP cookie Secure fix if TLS is not live yet)
2. Public home loads; `/admin/homepage` reachable for a staff user with `content.featured`
3. A people photo without two-party commercial clearance is not sold as commercial
4. Model guest rights / invite page still loads for a known invite token
5. `/admin/representation` queue loads for staff

Then set `WEB_URL=https://…` and re-run `ssl-init.sh` if the domain already has certs.
Rotate the demo admin password if seed ever ran on this instance.

### Live inventory note (Track O0 — 19 Sep 2026)

External probe of `http://vuekumi.com` (no SSH): API health/ready OK; HTTPS TLS
handshake fails; HTTP admin login sets cookies **without** `Secure`; admin
homepage / bookings / campaigns / representation / partner-keys routes respond
(Phases 31–43 shapes present). Demo admin password **was** still `Admin123!` at
the O0 probe — **rotated 19 Sep 2026** (O3 password step). Full write-up:
[`docs/06-OPS-INVENTORY-AND-DECISION-BRIEF.md`](../../docs/06-OPS-INVENTORY-AND-DECISION-BRIEF.md).

On-host SHA confirm is still required before marking O2 done:

```bash
ssh ubuntu@YOUR_STATIC_IP
cd /opt/vuekumi && git fetch origin main && git rev-parse --short HEAD
git rev-parse --short origin/main
```

### Post-deploy secrets + TLS (Track O3)

1. Live demo password `Admin123!` for `admin@vuekumi.com` was rotated on
   **19 Sep 2026** and no longer works. If you do not have the current secret,
   use **Admin password recovery** below (Lightsail browser SSH).
2. Confirm Admin Settings → payment / AI / email keys are production values (not
   empty placeholders).
3. Fix TLS before flipping scheme:
   ```bash
   cd /opt/vuekumi
   bash deploy/lightsail/ssl-init.sh   # or renew existing certs
   ```
4. Only after `curl -sf https://vuekumi.com/api/health` succeeds:
   - set `WEB_URL=https://vuekumi.com` in `.env`
   - redeploy **without** `SEED_DEMO=1`
5. Re-check login cookies over HTTPS include `Secure`.
6. ~~Rotate remaining seed staff logins~~ **Phases 47–48:** live `@vuekumi.demo`
   and admin demo passwords rotated (secrets not in git). Local/CI seed still uses
   `Admin123!` / `User12345!` by design.

### Admin password recovery (on-host)

Use when `admin@vuekumi.com` (or another staff account) is locked and you have
Lightsail SSH (browser or key). Replace `NEW_HASH` with a bcrypt hash (cost 12)
of your chosen password:

```bash
# On any machine with Node + bcryptjs:
node -e "require('bcryptjs').hash('YOUR_CHOSEN_PASSWORD',12).then(console.log)"
```

```bash
ssh ubuntu@YOUR_STATIC_IP   # or Lightsail browser SSH
cd /opt/vuekumi
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vuekumi vuekumi -c \
  "UPDATE \"User\" SET \"passwordHash\" = 'NEW_HASH' WHERE email = 'admin@vuekumi.com';"
```

**Finance recovery (Phase 47)** — `finance@vuekumi.demo` was rotated but the new
secret was lost to API rate-limit. On the host, set a bcrypt hash you control:

```bash
node -e "require('bcryptjs').hash('YOUR_CHOSEN_PASSWORD',12).then(console.log)"
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vuekumi vuekumi -c \
  "UPDATE \"User\" SET \"passwordHash\" = 'NEW_HASH' WHERE email = 'finance@vuekumi.demo';"
```

A ready-made hash/password pair was delivered in the Phase 47 operator message
(not stored in git). Prefer generating your own.

Then sign in at `http://vuekumi.com/login` (until TLS works) and change the
password again from Account settings so the SQL value is not the long-term secret.

### Production smoke sign-off (Track O4)

Run against the live `WEB_URL` after O2/O3. Check boxes on the host or in an
ops ticket — Playwright CI smoke is not a substitute.

External API smoke **19 Sep 2026 (Phase 47)** against `http://vuekumi.com`:

| # | Check | Pass? |
| --- | --- | --- |
| 1 | `GET ${WEB_URL}/api/health` and `/api/ready` → 200 | **Pass** |
| 2 | Public home loads; featured slots API shape present | **Pass** |
| 3 | Admin login works on the **actual** scheme (HTTP or HTTPS) | **Pass** (HTTP) |
| 4 | `/admin` overview + `/admin/homepage` for `content.featured` | **Pass** (API) |
| 5 | `/admin/bookings`, `/admin/campaigns`, `/admin/representation` load | **Pass** (API) |
| 6 | People photo without two-party clearance: commercial not offered | **Pass** |
| 7 | Model guest invite / rights page loads for a known token | **Pass** (`seed-nomsa-model-invite`) |
| 8 | Partner key read fails without key (401); succeeds with a live key if issued | **Pass** (401 only) |
| 9 | Demo admin password no longer `Admin123!` | **Pass** (+ support/moderator `User12345!` rejected) |
| 10 | If `WEB_URL` is https: browser cookie Secure; HTTP→HTTPS redirect sane | **Fail** — HTTPS TLS still broken |

Signer / date: Phase 47 cloud agent / 19 Sep 2026 (API-only; re-sign after TLS)

### Database backup

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vuekumi vuekumi > backup-$(date +%Y%m%d).sql
```

### Restore backup

```bash
cat backup-20260913.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vuekumi vuekumi
```

### Stop / start

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## 7. Upgrading to Lightsail Managed PostgreSQL (optional)

For production at scale, move the database off the instance:

1. Create a **Lightsail Managed Database** (PostgreSQL).
2. Update `.env`:
   ```env
   DATABASE_URL=postgresql://user:pass@ls-xxx.region.rds.amazonaws.com:5432/vuekumi
   ```
3. Remove the `postgres` service from `docker-compose.prod.yml`.
4. Redeploy.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `API health check timed out` | `docker compose -f docker-compose.prod.yml logs api` — usually bad `DATABASE_URL` or migration error |
| 502 on `/api` | API container not running; check `docker compose ps` |
| Login cookies not set | Ensure `WEB_URL` matches the URL you visit (http vs https). Pull `main` for the HTTP Secure-cookie fix if TLS is not live yet. |
| Live users disappeared after redeploy | Seed ran. Redeploys must **not** set `SEED_DEMO=1`. Restore from `pg_dump` backup if you have one. |
| IP works, `https://vuekumi.com` times out | Port 80 is serving; 443 has no TLS. Run `bash deploy/lightsail/ssl-init.sh vuekumi.com you@email.com` and allow HTTPS (443) in Lightsail Networking. `git pull` no longer wipes HTTPS — deploy rewrites `nginx.runtime.conf` when certs exist |
| Build looks stuck on `tsc` / `vite build` | Two images were compiling at once and froze a 1–2 GB box. Pull this branch and re-run `bash deploy/lightsail/deploy.sh` (builds one image at a time + adds 2G swap). Still tight: use a 2 GB+ plan |
| Port 80 in use | `sudo lsof -i :80` — stop conflicting service |

---

## Architecture

```
Internet
    │
    ▼
Lightsail Static IP :80 / :443
    │
    ▼
┌─────────────────────────────────┐
│  nginx (SPA + /api proxy)       │
│  api (Fastify :3001)            │
│  postgres (:5432 internal)      │
│  redis (:6379 internal)         │
│  certbot (SSL renewal)          │
└─────────────────────────────────┘
```
