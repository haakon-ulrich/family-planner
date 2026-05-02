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

echo "==> Restarting service..."
systemctl restart family-planner
systemctl status family-planner --no-pager

echo "==> Done."
