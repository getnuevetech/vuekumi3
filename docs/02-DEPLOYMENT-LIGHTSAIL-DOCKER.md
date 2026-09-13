# Vuekumi — Development & Deployment Plan (Docker on AWS Lightsail)

Companion documents: `00-CODE-REVIEW.md` and `01-IMPLEMENTATION-PLAN.md`.

**Status: plan only. Nothing here is provisioned or committed until approved.**

Everything runs in Docker — local development, CI, staging, and production — so the same
image that passes CI is the image that serves traffic. AWS Lightsail is the target host, in
two stages: a single Docker Compose instance for MVP/staging, then Lightsail container
services with managed data stores as traffic grows.

---

## 1. Local development

One command starts the whole stack: `docker compose up`.

`infra/docker/docker-compose.dev.yml` services:

| Service | Image | Purpose | Port |
| --- | --- | --- | --- |
| `web` | node:22-alpine (bind-mounted source) | Vite dev server with HMR | 3000 |
| `api` | node:22-alpine (bind-mounted source) | NestJS in watch mode | 4000 |
| `worker` | node:22-alpine | BullMQ consumers in watch mode | — |
| `postgres` | postgres:16-alpine | Database, named volume, healthcheck | 5432 |
| `redis` | redis:7-alpine | Cache, queues, rate limits | 6379 |
| `minio` | minio/minio | S3-compatible storage, mirrors production bucket layout | 9000/9001 |
| `mailpit` | axllent/mailpit | Catches all outbound email | 8025 |

Details that matter:

- `node_modules` lives in an anonymous volume so the host's platform-specific binaries (notably `sharp`) never leak into the container.
- Migrations and seed run as explicit one-shot commands (`docker compose run --rm api npm run db:migrate`, `… db:seed`), never automatically on container start.
- The seed loads the current `src/data/content.ts` fixtures and uploads `public/images/**` into MinIO, so a fresh checkout looks exactly like today's demo.
- A `.env.example` at the repo root documents every variable; `.env` stays gitignored (it already is).
- **Prerequisite fix:** the committed `package-lock.json` has 125 entries resolving to a private mirror (`npm.mirrors.msh.team`), so `npm ci` — which every Docker build should use — fails outside that network. Regenerate the lockfile against `https://registry.npmjs.org` and pin the registry in `.npmrc` before any image build work (Phase 1 of the implementation plan).

---

## 2. Images

Three production images, all multi-stage, Alpine-based, running as a non-root user, with
pinned base-image digests and `HEALTHCHECK` instructions.

**`infra/docker/web.Dockerfile`** — build stage runs `npm ci && npm run build` with
`VITE_*` build args baked in (Vite inlines env at build time, so staging and production get
separate images); runtime stage is `nginx:alpine` serving `/usr/share/nginx/html`.

`infra/docker/nginx.conf` provides:
- SPA history fallback (`try_files $uri $uri/ /index.html`) — required, since the app uses client-side routing with `base: '/'`.
- Immutable, one-year cache headers for `/assets/*` (Vite content-hashes filenames) and `no-cache` for `index.html`.
- gzip + Brotli precompression.
- Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.
- `/api/` proxied to the API service so the browser sees one origin (no CORS, and refresh cookies stay first-party).
- `/healthz` returning 200 for the load balancer.

**`infra/docker/api.Dockerfile`** — deps → build → runtime; runtime carries only production
dependencies plus the generated Prisma client; `dumb-init` as PID 1; listens on 4000;
`GET /healthz` (liveness) and `GET /readyz` (checks Postgres, Redis, and storage).

**`infra/docker/worker.Dockerfile`** — same build, different entrypoint. Needs `sharp`, so
build `libvips` deps explicitly and verify the Alpine/musl binary at image-build time.

Image hygiene: `.dockerignore` excluding `node_modules`, `dist`, `.git`, `docs`, `*.md`, and
`public/images` in the API/worker images; Trivy scan in CI failing on HIGH/CRITICAL; images
tagged with the git SHA (never only `latest`).

---

## 3. Production topology

### Stage 1 (recommended start) — single Lightsail instance + Docker Compose

Cheapest, simplest, and enough for launch traffic.

```
Route 53 / DNS
      │
      ▼
Lightsail instance (Ubuntu 24.04, 2 GB / 2 vCPU to start)
  Docker Compose:
    caddy      ← automatic Let's Encrypt TLS, reverse proxy, HTTP/2 + HTTP/3
    web        ← nginx + built static assets
    api        ← NestJS
    worker     ← BullMQ consumers
    redis      ← named volume on an attached block-storage disk
    backup     ← cron sidecar: pg_dump → S3/Lightsail bucket
      │
      ├── Lightsail Managed Database (PostgreSQL) — automated backups + PITR
      └── Lightsail bucket or S3 + CDN — originals (private) & derivatives (public)
```

Choices and rationale:

- **Managed database from day one, not Postgres-in-a-container.** Automated backups, point-in-time recovery, and version upgrades are worth far more than the monthly saving, and it makes the Stage 2 migration a no-op.
- **Redis in a container is acceptable**, because it is used for cache, rate limits, and BullMQ jobs that are all replayable — but its volume must live on the attached disk and be included in snapshots. Lightsail has no managed Redis.
- **Object storage is mandatory** and never the instance filesystem: private originals, public derivatives, CDN in front, signed time-limited URLs for paid downloads.
- **Attached block-storage disk** for Redis data, Docker volumes, and logs, so the instance can be rebuilt without data loss.
- Instance snapshots on a schedule, plus nightly `pg_dump` to a bucket with lifecycle rules — and a **restore drill** before go-live, because an untested backup is not a backup.
- Firewall: 80/443 open; SSH restricted to known IPs or accessed via Lightsail's browser console; the database reachable only from the instance (private networking, public access disabled).
- Static IP attached, and a separate, smaller staging instance built from the same Compose file.

Known limitation, stated plainly: one instance is a single point of failure, and deploys
cause a few seconds of interruption unless the Compose rollout is health-gated. Acceptable
for MVP, not for scale — hence Stage 2.

### Stage 2 (scale-out) — Lightsail container services

```
Lightsail container service "vuekumi-web"  (nginx + static, scale ≥2)  ← public endpoint + TLS
Lightsail container service "vuekumi-api"  (api, scale ≥2)
Lightsail container service "vuekumi-worker" (worker, scale 1..n, private)
Lightsail Managed Database (PostgreSQL, high-availability plan)
S3 + CloudFront for media
Redis: ElastiCache via VPC peering, or a dedicated small Lightsail instance
```

Constraints that shape this design (verified against current AWS documentation):

- Container services have **only ephemeral storage** — no volume mounts, no attachable disks. Anything stateful must live in the managed database, object storage, or an external Redis. This is why Redis cannot simply move into the container service alongside the API.
- Pricing is per node: Nano $7, Micro $10, Small $15, Medium $40, Large $80, XLarge $160 per month, multiplied by node count, each service including 500 GB/month of data transfer (overage from $0.09/GB).
- TLS, HTTPS endpoints, and load balancing across nodes are built in — no Caddy/ALB needed at this stage.
- Container services are not offered in every AWS region; confirm availability for the chosen region (`af-south-1` for African latency vs `eu-west-1` for the broadest service coverage) **before** committing, since region choice also affects managed-database and bucket options.

Migration path from Stage 1 is deliberately small: the images are identical, the database and
bucket are already external, so it is a registry push plus a DNS cutover.

---

## 4. CI/CD

`.github/workflows/ci.yml` (every push and PR):
`npm ci` → typecheck → lint → unit tests → `vite build` → API tests against Postgres and
Redis service containers → build all three images → Trivy scan → Playwright E2E against a
Compose-composed stack. Merges blocked on failure.

`.github/workflows/deploy.yml` (tag or manual dispatch, environment-gated):

1. Build images tagged with the git SHA and the target environment.
2. Push to the Lightsail container registry (`aws lightsail push-container-image`) or GHCR.
3. Run `prisma migrate deploy` as a discrete, gated step — never on container start, and reviewed for backwards compatibility so the previous release keeps working during rollover.
4. Deploy:
   - Stage 1: SSH → `docker compose pull && docker compose up -d --wait` with health gating and automatic rollback to the previous SHA on failure.
   - Stage 2: `aws lightsail create-container-service-deployment` with the new image tags; Lightsail health-checks before shifting traffic.
5. Smoke-test the public endpoints (`/healthz`, `/readyz`, homepage, `/api/v1/photos`), then notify.

Secrets live in GitHub Environments and AWS SSM Parameter Store, injected at deploy time.
Staging deploys automatically from `main`; production requires a manual approval.

---

## 5. Configuration

Grouped in `.env.example`, supplied via SSM/Lightsail environment variables in production:

- **Web (build-time)**: `VITE_API_URL`, `VITE_CDN_URL`, `VITE_SENTRY_DSN`, `VITE_ENV`.
- **API**: `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `CORS_ORIGINS`, `APP_URL`.
- **Storage**: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_PUBLIC`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `CDN_URL`, `DOWNLOAD_URL_TTL`.
- **Payments**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, plus each provider's webhook secret.
- **Email**: `RESEND_API_KEY` or SES credentials, `MAIL_FROM`.
- **Ops**: `SENTRY_DSN`, `LOG_LEVEL`, `RATE_LIMIT_*`, `FEATURE_FLAGS`.

Rules: no secret in the repo or in an image layer; distinct credentials per environment;
documented rotation procedure; production database credentials never on a developer machine.

---

## 6. Operations

- **Monitoring**: Lightsail metric alarms (CPU, data transfer, database connections/storage), an external uptime check on `/healthz`, Sentry for both apps, and BullMQ queue-depth alerts. Logs to stdout in JSON, shipped to CloudWatch Logs with retention set.
- **Backups**: managed-database automated backups plus PITR; nightly `pg_dump` to a bucket with lifecycle rules; instance/disk snapshots; **quarterly restore drills**.
- **Runbooks** (`docs/runbooks/`): deploy and rollback, failed payout, webhook replay, stuck image job, database restore, secret rotation, incident response.
- **Scaling triggers**, documented in advance: p95 API latency, queue depth, database CPU, and container-service data-transfer overage each map to a specific action (add nodes, upsize the database, move Redis out, add CDN caching).

---

## 7. Indicative monthly cost

| Item | Stage 1 (MVP) | Stage 2 (scale) |
| --- | --- | --- |
| Compute | Instance ~$12–24 | web 2×Micro $20 + api 2×Small $30 + worker 1×Micro $10 |
| Database | Managed PostgreSQL from ~$15 | HA plan, ~$60+ |
| Redis | in-container (included) | small instance ~$10, or ElastiCache |
| Object storage + CDN | Bucket ~$1–5 + transfer | S3 + CloudFront, usage-based |
| Block storage / snapshots | ~$5 | ~$5 |
| **Approximate total** | **~$35–50** | **~$135–200+** |

Figures are list prices at time of writing for planning only — image-heavy egress is the
variable that dominates, so validate against the 500 GB/month included transfer and the
$0.09/GB overage once real traffic exists.

---

## 8. Deployment work sequence

1. Regenerate the lockfile against the public npm registry and pin `.npmrc`; confirm `npm ci && npm run build` on a clean machine.
2. Add `web.Dockerfile`, `nginx.conf`, `.dockerignore`, and `docker-compose.dev.yml` for the **frontend only** — this alone gives a containerised, deployable static site and validates the pipeline before any backend exists.
3. Add the CI workflow (typecheck, lint, test, build, image build, scan).
4. Provision staging: Lightsail instance, static IP, firewall, attached disk, Caddy, DNS, TLS. Deploy the web image and verify SPA routing, caching, and security headers.
5. Add `api.Dockerfile`/`worker.Dockerfile` and the full dev Compose stack as the backend lands (implementation plan Phase 3).
6. Provision the managed database and buckets; wire migrations and the seed into the deploy workflow.
7. Add monitoring, alarms, backups, and the first restore drill.
8. Production environment, manual-approval deploy, smoke tests, rollback rehearsal.
9. Go-live checklist: licensed imagery replacing the demo photos, legal pages published, payment providers in live mode, email deliverability (SPF/DKIM/DMARC), `robots.txt`/sitemap, CSP tightened, load test passed, runbooks reviewed.
