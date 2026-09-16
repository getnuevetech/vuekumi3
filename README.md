# Vuekumi

**Vuekumi** — a stock image platform for authentic African photography.

Monorepo with React frontend, Fastify API, PostgreSQL, and Docker-based local development.

## Structure

```
apps/
  web/          React 19 + Vite + Tailwind (marketplace UI)
  api/          Fastify + Prisma + PostgreSQL
packages/
  shared/       Shared types and Zod schemas
```

## Quick start

### 1. Start database

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup API database

```bash
npm run build -w @vuekumi/shared
cd apps/api && npx prisma migrate dev --name init && npm run db:seed
```

### 4. Run dev servers

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

## Seed accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@vuekumi.com | Admin123! |
| Contributor | amara-okafor@vuekumi.demo | User12345! |
| Member | member@vuekumi.demo | User12345! |
| Agency | agency@vuekumi.demo | User12345! |
| Model | ada@vuekumi.demo (`/m/ada-molefe`) | User12345! |
| Dual-role | kofi-mensah@vuekumi.demo (`/p` + `/m`) | User12345! |
| Model invite | nomsa@vuekumi.demo | claim at `/invite/model/seed-nomsa-model-invite` |

## API

- `GET /api/health` — liveness
- `GET /api/ready` — Postgres readiness
- `POST /api/auth/register` · `login` · `logout` · `refresh`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password` · `reset-password/:token`
- `GET /api/auth/verify-email/:token`
- `GET /api/photos` · `GET /api/photos/:id`
- Agency, licences, media, payments, and admin routes under `/api/`

## Environment

Copy `.env.example` to `apps/api/.env` and adjust as needed.

Payment, email, AI, and storage keys are managed in **Admin → Settings** after login.

Production refuses weak `JWT_SECRET` / `COOKIE_SECRET` values. Liveness is `GET /api/health` (also `/healthz` behind nginx); readiness is `GET /api/ready` (`/readyz`).

## Checks

```bash
npm run ci        # typecheck, lint, API tests, Vite build
npm test          # API unit tests
npm run lint      # web ESLint
```

GitHub Actions runs the same checks on every push and pull request, then builds the API and nginx images.

## Deploy on AWS Lightsail (Ubuntu)

Full guide: **[deploy/lightsail/README.md](deploy/lightsail/README.md)**

```bash
# On a fresh Ubuntu Lightsail instance
git clone https://github.com/getnuevetech/vuekumi3.git /opt/vuekumi && cd /opt/vuekumi
sudo bash deploy/lightsail/setup.sh
cp deploy/lightsail/env.production.example .env && nano .env
bash deploy/lightsail/deploy.sh
# After DNS points to your static IP:
bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com
```
