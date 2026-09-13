#!/usr/bin/env bash
# Obtain Let's Encrypt certificate and enable HTTPS in nginx.
# Usage: bash deploy/lightsail/ssl-init.sh your-domain.com you@email.com

set -euo pipefail

DOMAIN="${1:?Usage: ssl-init.sh <domain> <email>}"
EMAIL="${2:?Usage: ssl-init.sh <domain> <email>}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF="docker/nginx/nginx.prod.conf"

echo "==> Requesting certificate for $DOMAIN..."
docker compose -f "$COMPOSE_FILE" run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  -d "$DOMAIN"

echo "==> Writing HTTPS nginx config..."
cat > "$NGINX_CONF" <<EOF
# HTTP — ACME challenge + redirect to HTTPS
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

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
        client_max_body_size 50m;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Update WEB_URL in .env
if grep -q '^WEB_URL=' .env; then
  sed -i "s|^WEB_URL=.*|WEB_URL=https://${DOMAIN}|" .env
else
  echo "WEB_URL=https://${DOMAIN}" >> .env
fi

echo "==> Restarting nginx and api (for updated WEB_URL cookies)..."
docker compose -f "$COMPOSE_FILE" up -d nginx api

echo ""
echo "SSL enabled for https://${DOMAIN}"
echo "Certificate auto-renews via the certbot container."
