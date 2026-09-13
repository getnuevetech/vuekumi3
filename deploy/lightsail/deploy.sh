#!/usr/bin/env bash
# Build and deploy Vuekumi on the Lightsail instance.
# Run from repo root: bash deploy/lightsail/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy deploy/lightsail/env.production.example to .env and configure it."
  exit 1
fi

# shellcheck disable=SC1091
source .env

for var in POSTGRES_PASSWORD JWT_SECRET COOKIE_SECRET WEB_URL; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set in .env"
    exit 1
  fi
done

echo "==> Installing Node dependencies..."
npm ci

echo "==> Building shared package..."
npm run build -w @vuekumi/shared

echo "==> Building frontend (production)..."
# Same-origin API — no VITE_API_URL needed
npm run build -w @vuekumi/web

echo "==> Building and starting Docker services..."
docker compose -f "$COMPOSE_FILE" build --no-cache api
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Waiting for API health..."
for i in $(seq 1 30); do
  if curl -sf http://localhost/api/health >/dev/null 2>&1; then
    echo "API is healthy."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "WARNING: API health check timed out. Check logs:"
    echo "  docker compose -f $COMPOSE_FILE logs api"
    exit 1
  fi
  sleep 2
done

echo "==> Seeding database (idempotent on re-run)..."
docker compose -f "$COMPOSE_FILE" exec -T api npx tsx prisma/seed.ts || \
  echo "Seed note: if data already exists, errors are expected — check logs if login fails."

echo ""
echo "Deploy complete."
echo "  Site:  ${WEB_URL:-http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP')}"
echo "  Admin: ${WEB_URL:-http://YOUR_IP}/admin  (login: admin@vuekumi.com / Admin123!)"
echo ""
echo "Logs:  docker compose -f $COMPOSE_FILE logs -f"
echo "SSL:   bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com"
