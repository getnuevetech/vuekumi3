#!/usr/bin/env bash
# Write docker/nginx/nginx.runtime.conf (HTTP-only, or HTTPS if certs exist).
# Usage: bash deploy/lightsail/write-nginx-config.sh [domain]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
OUT="docker/nginx/nginx.runtime.conf"
DOMAIN="${1:-}"

if [[ -z "$DOMAIN" && -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
  DOMAIN="${DOMAIN:-}"
  if [[ -z "$DOMAIN" && "${WEB_URL:-}" == https://* ]]; then
    DOMAIN="${WEB_URL#https://}"
    DOMAIN="${DOMAIN%%/*}"
  fi
fi

if docker compose version &>/dev/null; then
  DC="docker compose"
elif sudo -n docker compose version &>/dev/null 2>&1; then
  DC="sudo docker compose"
else
  DC="docker compose"
fi

has_cert=0
if [[ -n "$DOMAIN" ]]; then
  if $DC -f "$COMPOSE_FILE" exec -T nginx test -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null; then
    has_cert=1
  else
    # Do not `compose run certbot` here — the service entrypoint is a 12h sleep.
    while read -r vol; do
      [[ -z "$vol" ]] && continue
      if docker run --rm -v "${vol}:/certs:ro" alpine:3.20 \
        test -f "/certs/live/${DOMAIN}/fullchain.pem" 2>/dev/null; then
        has_cert=1
        break
      fi
    done < <(docker volume ls -q | grep -E 'certbot-certs$' || true)
  fi
fi

if [[ "$has_cert" -eq 1 ]]; then
  echo "==> Certificates found for ${DOMAIN} — writing HTTPS nginx config"
  cat > "$OUT" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location /api/ {
        proxy_pass http://api:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 64m;
        proxy_request_buffering off;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
else
  echo "==> No TLS cert yet — HTTP only (port 443 will not serve HTTPS until ssl-init)"
  cp docker/nginx/nginx.prod.conf "$OUT"
fi
