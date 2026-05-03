#!/usr/bin/env bash
# Pull latest changes and rebuild. Run from the project root as root.
# Usage: sudo bash scripts/update.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[[ $EUID -eq 0 ]] || { echo "ERROR: Run as root: sudo bash $0"; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "ERROR: Run from the project root."; exit 1; }

echo "==> Pulling latest changes..."
cd "$APP_DIR"
git pull

echo "==> Installing dependencies..."
npm ci

echo "==> Building..."
npm run build

echo "==> Syncing vacuum sidecar dependencies..."
cd "$APP_DIR/services/vacuum"
uv sync
chmod -R a+rX /root/.local/share/uv/python/
cd "$APP_DIR"

echo "==> Restarting services..."
systemctl restart family-planner
systemctl restart family-planner-vacuum
systemctl status family-planner family-planner-vacuum --no-pager

echo "==> Done."
