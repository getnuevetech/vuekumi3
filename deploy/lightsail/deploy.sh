#!/usr/bin/env bash
# Build and deploy Vuekumi using Docker only — no host Node/npm required.
# Run from repo root: bash deploy/lightsail/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found."
  echo "  cp deploy/lightsail/env.production.example .env"
  echo "  nano .env"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

for var in POSTGRES_PASSWORD JWT_SECRET COOKIE_SECRET WEB_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set in .env"
    exit 1
  fi
done

if docker compose version &>/dev/null; then
  DC="docker compose"
elif sudo -n docker compose version &>/dev/null 2>&1; then
  DC="sudo docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  echo "ERROR: Docker Compose not found."
  echo "  Run once: sudo bash deploy/lightsail/setup.sh"
  echo "  Then log out and back in, or: sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi

echo "==> Ensuring swap so parallel TypeScript builds cannot freeze the instance..."
if [[ -x "$ROOT/deploy/lightsail/ensure-swap.sh" ]] || [[ -f "$ROOT/deploy/lightsail/ensure-swap.sh" ]]; then
  bash "$ROOT/deploy/lightsail/ensure-swap.sh" || echo "WARNING: could not add swap (need sudo). Build may still freeze on 1–2 GB RAM."
fi

# Compose builds nginx + api at the same time by default. Two Node compiles
# on a 1–2 GB Lightsail box swap-thrash and look "stuck" at tsc / vite.
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
PROGRESS=(--progress=plain)
if ! $DC -f "$COMPOSE_FILE" build --help 2>&1 | grep -q -- '--progress'; then
  PROGRESS=()
fi

echo "==> Building frontend image (nginx)…"
$DC -f "$COMPOSE_FILE" build "${PROGRESS[@]}" nginx

echo "==> Building API image…"
$DC -f "$COMPOSE_FILE" build "${PROGRESS[@]}" api

echo "==> Writing nginx runtime config (restores HTTPS if certs already exist)..."
bash "$ROOT/deploy/lightsail/write-nginx-config.sh"

echo "==> Starting services..."
$DC -f "$COMPOSE_FILE" up -d nginx api postgres redis certbot

echo "==> Waiting for API health..."
healthy=0
for i in $(seq 1 45); do
  if curl -sf http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "API is healthy."
    healthy=1
    break
  fi
  sleep 2
done

if [[ $healthy -eq 0 ]]; then
  echo "WARNING: API health check timed out. Recent logs:"
  $DC -f "$COMPOSE_FILE" logs --tail=80 api
  exit 1
fi

echo "==> Seeding database..."
if $DC -f "$COMPOSE_FILE" exec -T api npx tsx prisma/seed.ts; then
  echo "Seed complete."
else
  echo "WARNING: seed failed. Demo logins will not work until it succeeds."
  echo "  Retry: $DC -f $COMPOSE_FILE exec -T api npx tsx prisma/seed.ts"
fi

echo ""
echo "Deploy complete."
echo "  Site:  ${WEB_URL}"
echo "  Admin: ${WEB_URL}/admin"
echo "  Login: admin@vuekumi.com / Admin123!  (change this password)"
echo "  Keys:  Admin → Settings  (Stripe, Flutterwave, OpenAI, Resend, storage)"
echo ""
echo "Logs:  $DC -f $COMPOSE_FILE logs -f"
echo "SSL:   bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com"
