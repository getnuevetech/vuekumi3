#!/usr/bin/env bash
# Run once on a fresh Ubuntu Lightsail instance (22.04 or 24.04)
#   sudo bash deploy/lightsail/setup.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

APP_USER="${SUDO_USER:-ubuntu}"

echo "==> Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo "==> Installing dependencies..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates ufw

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Installing Docker Compose plugin..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-compose-plugin 2>/dev/null || true

echo "==> Adding ${APP_USER} to docker group..."
usermod -aG docker "$APP_USER" || true

echo "==> Configuring firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Creating app directory..."
mkdir -p /opt/vuekumi
chown -R "${APP_USER}:$(id -gn "$APP_USER")" /opt/vuekumi 2>/dev/null || true

echo ""
echo "Setup complete. Docker is installed — Node.js is not required on the host."
echo ""
echo "IMPORTANT: log out and back in (or run: newgrp docker) so docker works without sudo."
echo ""
echo "Next:"
echo "  1. cd /opt/vuekumi"
echo "  2. cp deploy/lightsail/env.production.example .env && nano .env"
echo "  3. bash deploy/lightsail/deploy.sh"
echo ""
