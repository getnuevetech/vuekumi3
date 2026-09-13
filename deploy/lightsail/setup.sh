#!/usr/bin/env bash
# Run once on a fresh Ubuntu Lightsail instance (22.04 or 24.04)
# Usage: curl -fsSL <raw-url>/setup.sh | bash
#    or: sudo bash deploy/lightsail/setup.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "==> Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

echo "==> Installing dependencies..."
apt-get install -y -qq git curl ca-certificates ufw

echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Installing Docker Compose plugin..."
apt-get install -y -qq docker-compose-plugin 2>/dev/null || true

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
chown -R "${SUDO_USER:-ubuntu}:$(id -gn "${SUDO_USER:-ubuntu}")" /opt/vuekumi 2>/dev/null || true

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Clone the repo into /opt/vuekumi"
echo "  2. Copy deploy/lightsail/env.production.example to .env and edit"
echo "  3. Run: bash deploy/lightsail/deploy.sh"
echo ""
