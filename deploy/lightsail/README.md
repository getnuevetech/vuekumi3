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
git checkout cursor/vuekumi-backend-foundation-9c19   # or your deploy branch
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

```bash
bash deploy/lightsail/deploy.sh
```

This will:

1. `npm ci` and build the frontend + shared package
2. Build the API Docker image
3. Start Postgres, Redis, API, nginx
4. Run database migrations automatically (API entrypoint)
5. Seed demo data (admin user + photos)

**Test:** open `http://YOUR_STATIC_IP` in a browser.

| Account | Email | Password |
|---|---|---|
| Admin | admin@vuekumi.com | Admin123! |
| Contributor | amara-okafor@vuekumi.demo | User12345! |

Change the admin password immediately after first login.

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
git pull
bash deploy/lightsail/deploy.sh
```

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
| Login cookies not set | Ensure `WEB_URL` matches the URL you visit (http vs https) |
| Build runs out of memory | Use a 4 GB Lightsail plan or build frontend locally and copy `apps/web/dist` |
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
