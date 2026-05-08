#!/usr/bin/env bash
# Provisions a fresh Raspberry Pi 5 (Pi OS Lite 64-bit, Bookworm) for family-planner.
# Run from the project root as root: sudo bash scripts/install.sh
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR=/var/lib/family-planner
ENV_FILE=/etc/family-planner/.env
SERVICE_USER=family-planner
KIOSK_USER=kiosk

# ── Sanity checks ─────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { echo "ERROR: Run as root: sudo bash $0"; exit 1; }
[[ -f "$APP_DIR/package.json" ]] || { echo "ERROR: Run from the project root."; exit 1; }

echo "==> Installing family-planner from $APP_DIR"

# ── 1. System packages ────────────────────────────────────────────────────────
echo "==> Updating package lists..."
apt-get update -qq

echo "==> Installing system packages..."
apt-get install -y --no-install-recommends \
  curl \
  sway \
  chromium \
  fonts-noto-color-emoji \
  ffmpeg

# ── 2. Node.js LTS (NodeSource) ───────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "==> Installing Node.js LTS..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
else
  echo "==> Node.js $(node --version) already installed"
fi

# ── 3. Service user (runs the Node.js backend) ────────────────────────────────
if ! id -u "$SERVICE_USER" &>/dev/null; then
  echo "==> Creating service user: $SERVICE_USER"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# ── 4. Kiosk user (owns the Wayland session and browser) ─────────────────────
if ! id -u "$KIOSK_USER" &>/dev/null; then
  echo "==> Creating kiosk user: $KIOSK_USER"
  useradd --create-home --shell /bin/bash "$KIOSK_USER"
fi
# cage needs access to DRM and input devices
usermod -aG video,input "$KIOSK_USER" 2>/dev/null || true

# ── 5. Data directories ───────────────────────────────────────────────────────
echo "==> Creating data directories under $DATA_DIR..."
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/uploads"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"

# ── 6. Environment file ───────────────────────────────────────────────────────
mkdir -p /etc/family-planner
if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Creating $ENV_FILE from env.example..."
  cp "$APP_DIR/env.example" "$ENV_FILE"
  sed -i "s|^DB_PATH=.*|DB_PATH=$DATA_DIR/app.db|" "$ENV_FILE"
  sed -i "s|^UPLOAD_DIR=.*|UPLOAD_DIR=$DATA_DIR/uploads|" "$ENV_FILE"
  # Uncomment and set BACKUP_DIR
  sed -i "s|^# BACKUP_DIR=.*|BACKUP_DIR=$DATA_DIR/backups|" "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
  chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"

  echo ""
  echo "  ┌─────────────────────────────────────────────────────────┐"
  echo "  │  REQUIRED: edit $ENV_FILE and fill in:       │"
  echo "  │    SECRET_KEY  (run: openssl rand -hex 32)              │"
  echo "  │    GOOGLE_SERVICE_ACCOUNT_EMAIL                         │"
  echo "  │    GOOGLE_PRIVATE_KEY                                   │"
  echo "  │    GOOGLE_CALENDAR_ID                                   │"
  echo "  │    WEATHER_LATITUDE / WEATHER_LONGITUDE                 │"
  echo "  └─────────────────────────────────────────────────────────┘"
  echo ""
else
  echo "==> $ENV_FILE already exists — skipping (edit manually to update)"
fi

# ── 7. Build ──────────────────────────────────────────────────────────────────
echo "==> Installing npm dependencies..."
cd "$APP_DIR"
npm ci

echo "==> Building app (web + server)..."
npm run build

# ── 8. Permissions ────────────────────────────────────────────────────────────
echo "==> Setting app permissions..."
chown -R root:root "$APP_DIR"
chmod -R o-w "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"

# ── 9. systemd service ────────────────────────────────────────────────────────
echo "==> Installing systemd service..."
cp "$APP_DIR/scripts/family-planner.service" /etc/systemd/system/family-planner.service
systemctl daemon-reload
systemctl enable family-planner
systemctl restart family-planner
echo "==> family-planner.service started"

# ── 10. uv (Python package manager for the vacuum sidecar) ───────────────────
if ! command -v uv &>/dev/null; then
  echo "==> Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local sh
else
  echo "==> uv $(uv --version) already installed"
fi

# ── 11. Vacuum sidecar Python venv ────────────────────────────────────────────
echo "==> Setting up vacuum sidecar Python venv..."
cd "$APP_DIR/services/vacuum"
uv sync
chmod -R a+rX /root/.local/share/uv/python/
cd "$APP_DIR"

# ── 12. Vacuum data directory and env ─────────────────────────────────────────
VACUUM_DATA_DIR=/var/lib/family-planner/vacuum
echo "==> Creating vacuum data directory: $VACUUM_DATA_DIR"
mkdir -p "$VACUUM_DATA_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$VACUUM_DATA_DIR"
chmod 750 "$VACUUM_DATA_DIR"

if ! grep -q "^VACUUM_DATA_DIR=" "$ENV_FILE" 2>/dev/null; then
  echo "VACUUM_DATA_DIR=$VACUUM_DATA_DIR" >> "$ENV_FILE"
fi

# ── 13. Vacuum sidecar systemd service ────────────────────────────────────────
echo "==> Installing vacuum sidecar service..."
cp "$APP_DIR/scripts/family-planner-vacuum.service" /etc/systemd/system/family-planner-vacuum.service
systemctl daemon-reload
systemctl enable family-planner-vacuum
# Service is NOT started here — Roborock auth setup must run first (see Next steps)
echo "==> family-planner-vacuum.service installed (not started)"

# ── 14. Media sidecar Python venv ─────────────────────────────────────────────
echo "==> Setting up media sidecar Python venv..."
cd "$APP_DIR/services/media"
uv sync
chmod -R a+rX /root/.local/share/uv/python/
cd "$APP_DIR"

# ── 15. Media data directory and env ──────────────────────────────────────────
MEDIA_DATA_DIR=/var/lib/family-planner/media
echo "==> Creating media data directory: $MEDIA_DATA_DIR"
mkdir -p "$MEDIA_DATA_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$MEDIA_DATA_DIR"
chmod 750 "$MEDIA_DATA_DIR"

if ! grep -q "^MEDIA_DATA_DIR=" "$ENV_FILE" 2>/dev/null; then
  cat >> "$ENV_FILE" << MEDIA_ENV
MEDIA_DATA_DIR=$MEDIA_DATA_DIR
YTDLP_COOKIES_FILE=$MEDIA_DATA_DIR/yt-cookies.txt
CAST_DEVICE_NAME=Living Room speaker
MEDIA_SIDECAR_PORT=3002
MEDIA_ENV
fi

# ── 16. Media sidecar systemd service ─────────────────────────────────────────
echo "==> Installing media sidecar service..."
cp "$APP_DIR/scripts/family-planner-media.service" /etc/systemd/system/family-planner-media.service
systemctl daemon-reload
systemctl enable family-planner-media
# Service is NOT started here — yt-cookies.txt and artists.json must be in place first
echo "==> family-planner-media.service installed (not started)"

# ── 17. Mower sidecar Python venv ─────────────────────────────────────────────
echo "==> Setting up mower sidecar Python venv..."
cd "$APP_DIR/services/mower"
uv sync
chmod -R a+rX /root/.local/share/uv/python/
cd "$APP_DIR"

# ── 18. Mower sidecar env ─────────────────────────────────────────────────────
if ! grep -q "^MAMMOTION_ID=" "$ENV_FILE" 2>/dev/null; then
  cat >> "$ENV_FILE" << MOWER_ENV
MAMMOTION_ID=
MAMMOTION_PASSWORD=
MAMMOTION_DEVICE_NAME=Luba-VPHZXWVD
MOWER_SIDECAR_PORT=3003
MOWER_SIDECAR_URL=http://localhost:3003
MOWER_ENV
fi

# ── 19. Mower sidecar systemd service ─────────────────────────────────────────
echo "==> Installing mower sidecar service..."
cp "$APP_DIR/scripts/family-planner-mower.service" /etc/systemd/system/family-planner-mower.service
systemctl daemon-reload
systemctl enable family-planner-mower
# Service is NOT started here — MAMMOTION_ID and MAMMOTION_PASSWORD must be set first
echo "==> family-planner-mower.service installed (not started)"

# ── 20. Kiosk autologin on tty1 ──────────────────────────────────────────────
echo "==> Configuring kiosk autologin..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

cat > "/home/$KIOSK_USER/.bash_profile" << 'PROFILE_EOF'
# Only launch the kiosk when on tty1
[[ "$(tty)" == "/dev/tty1" ]] || return

# Prevent Chromium from showing a "restore session?" dialog after a crash
mkdir -p ~/.config/chromium/Default
printf '{"profile":{"exit_type":"Normal","exited_cleanly":true}}\n' \
  > ~/.config/chromium/Default/Preferences

# Wait for the backend to be ready before launching Chromium
echo "Waiting for family-planner backend..."
until curl -sf http://localhost:3000/api/health >/dev/null 2>&1; do
  sleep 2
done

# Launch sway (Wayland compositor); hides cursor at compositor level
exec sway
PROFILE_EOF

mkdir -p "/home/$KIOSK_USER/.config/sway"
cat > "/home/$KIOSK_USER/.config/sway/config" << 'SWAY_EOF'
# Minimal kiosk compositor config
output * bg #000000 solid_color
seat * hide_cursor 0
focus_follows_mouse no

bar {
  mode invisible
}

# Launch Chromium; restart automatically on crash
exec bash -c 'while true; do \
  chromium \
    --ozone-platform=wayland \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=Translate,TranslateUI \
    --check-for-update-interval=31536000 \
    --no-first-run \
    --app=http://localhost:3000/; \
  sleep 2; \
done'
SWAY_EOF

chown -R "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.config"

chown "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.bash_profile"
systemctl daemon-reload

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "==> Installation complete!"
echo ""
echo "  Next steps:"
if [[ ! -f "$ENV_FILE" ]] || grep -q '^SECRET_KEY=$' "$ENV_FILE" 2>/dev/null; then
  echo "  1. Fill in required values:  sudo nano $ENV_FILE"
  echo "     (SECRET_KEY, GOOGLE_*, WEATHER_*, ROBOROCK_USERNAME, ROBOROCK_PASSWORD)"
  echo "  2. Restart the Node service: sudo systemctl restart family-planner"
else
  echo "  1. Env file already configured."
fi
echo ""
echo "  3. Run the one-time Roborock auth setup (interactive — enter email code):"
echo "     sudo -u $SERVICE_USER bash -c '"
echo "       set -a; source $ENV_FILE; set +a"
echo "       cd /opt/family-planner/services/vacuum"
echo "       .venv/bin/python scripts/setup_auth.py"
echo "     '"
echo ""
echo "  4. Start the vacuum sidecar:  sudo systemctl start family-planner-vacuum"
echo ""
echo "  5. Set up the media sidecar:"
echo "     a. Copy yt-cookies.txt to /var/lib/family-planner/media/yt-cookies.txt"
echo "     b. Copy artists.json to /var/lib/family-planner/media/artists.json"
echo "     c. Fix permissions: sudo chown -R family-planner:family-planner /var/lib/family-planner/media"
echo "     d. Edit CAST_DEVICE_NAME in $ENV_FILE if needed"
echo "     e. Start the service: sudo systemctl start family-planner-media"
echo ""
echo "  6. Set up the mower sidecar:"
echo "     a. Set MAMMOTION_ID and MAMMOTION_PASSWORD in $ENV_FILE"
echo "     b. Optionally update MAMMOTION_DEVICE_NAME (default: Luba-VPHZXWVD)"
echo "     c. Start the service: sudo systemctl start family-planner-mower"
echo ""
echo "  7. Reboot for kiosk:          sudo reboot"
echo ""
echo "  Useful commands:"
echo "    sudo journalctl -u family-planner -f          # backend logs"
echo "    sudo journalctl -u family-planner-vacuum -f   # vacuum sidecar logs"
echo "    sudo journalctl -u family-planner-media -f    # media sidecar logs"
echo "    sudo journalctl -u family-planner-mower -f    # mower sidecar logs"
echo "    sudo systemctl status family-planner          # service status"
echo "    sudo systemctl status family-planner-vacuum   # sidecar status"
echo "    sudo systemctl status family-planner-media    # media sidecar status"
echo "    sudo systemctl status family-planner-mower    # mower sidecar status"
