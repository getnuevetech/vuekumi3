#!/usr/bin/env bash
# Add 2G of swap on small Lightsail boxes so Docker + tsc/vite do not freeze.
set -euo pipefail

mem_kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)
swap_kb=$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)

if (( mem_kb >= 3500000 )); then
  echo "RAM $((mem_kb / 1024)) MB — swap not required."
  exit 0
fi

if (( swap_kb >= 1000000 )); then
  echo "Swap $((swap_kb / 1024)) MB already present."
  exit 0
fi

echo "Low RAM ($((mem_kb / 1024)) MB) and swap $((swap_kb / 1024)) MB."
echo "Creating 2G /swapfile so image builds do not thrash..."

run() {
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile 2>/dev/null || true
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
}

if [[ ${EUID} -eq 0 ]]; then
  run
else
  sudo bash -c "$(declare -f run); run"
fi

echo "Swap is on: $(awk '/^SwapTotal:/{print int($2/1024) \" MB\"}' /proc/meminfo)"
