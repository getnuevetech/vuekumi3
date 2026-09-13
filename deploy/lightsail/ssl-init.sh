#!/usr/bin/env bash
# Obtain Let's Encrypt certificate and enable HTTPS in nginx.
# Usage: bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com

set -euo pipefail

DOMAIN="${1:?Usage: ssl-init.sh <domain> <email>}"
EMAIL="${2:?Usage: ssl-init.sh <domain> <email>}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"

if docker compose version &>/dev/null; then
  DC="docker compose"
elif sudo -n docker compose version &>/dev/null 2>&1; then
  DC="sudo docker compose"
else
  DC="docker-compose"
fi

echo "==> Making sure HTTP nginx is up for the ACME challenge..."
bash "$ROOT/deploy/lightsail/write-nginx-config.sh"
$DC -f "$COMPOSE_FILE" up -d nginx

echo "==> Requesting certificate for ${DOMAIN} and www.${DOMAIN}..."
echo "    Talking to Let's Encrypt (usually 15–45s). Ctrl+C if this sits idle with no certbot logs."
# Must override the service entrypoint — otherwise this starts the 12h renew sleep loop.
$DC -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive \
  --keep-until-expiring \
  -d "$DOMAIN" -d "www.${DOMAIN}"

# Persist DOMAIN so later deploys restore HTTPS after git pull
if [[ -f .env ]]; then
  if grep -q '^DOMAIN=' .env; then
    sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" .env
  else
    echo "DOMAIN=${DOMAIN}" >> .env
  fi
  if grep -q '^WEB_URL=' .env; then
    sed -i "s|^WEB_URL=.*|WEB_URL=https://${DOMAIN}|" .env
  else
    echo "WEB_URL=https://${DOMAIN}" >> .env
  fi
fi

echo "==> Writing HTTPS nginx config..."
bash "$ROOT/deploy/lightsail/write-nginx-config.sh" "$DOMAIN"

echo "==> Restarting nginx and api (cookies use WEB_URL)..."
$DC -f "$COMPOSE_FILE" up -d nginx api

echo ""
echo "SSL enabled for https://${DOMAIN}"
echo "If the browser still times out, open Lightsail → Networking and allow HTTPS (443)."
echo "Certificate auto-renews via the certbot container."
