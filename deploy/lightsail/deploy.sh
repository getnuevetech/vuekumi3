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

echo "==> Building images (frontend + API) — this may take several minutes..."
$DC -f "$COMPOSE_FILE" build

echo "==> Starting services..."
$DC -f "$COMPOSE_FILE" up -d

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
$DC -f "$COMPOSE_FILE" exec -T api npx tsx prisma/seed.ts || \
  echo "Seed note: if data already exists this is fine — try logging in."

echo ""
echo "Deploy complete."
echo "  Site:  ${WEB_URL}"
echo "  Admin: ${WEB_URL}/admin"
echo "  Login: admin@vuekumi.com / Admin123!  (change this password)"
echo "  Keys:  Admin → Settings  (Stripe, Flutterwave, OpenAI, Resend, storage)"
echo ""
echo "Logs:  $DC -f $COMPOSE_FILE logs -f"
echo "SSL:   bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com"
