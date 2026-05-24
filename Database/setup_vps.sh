#!/usr/bin/env bash
# Descartes DATABASE — Hetzner CX22 VPS Setup Script
# Run as root on a fresh Ubuntu 24.04 LTS instance:
#   bash setup_vps.sh <your-domain> <admin-email> <admin-password>
# Example:
#   bash setup_vps.sh db.descartes.yourdomain.com admin@yourdomain.com s3cr3tpassword

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <admin-email> <admin-password>}"
ADMIN_EMAIL="${2:?Usage: $0 <domain> <admin-email> <admin-password>}"
ADMIN_PASSWORD="${3:?Usage: $0 <domain> <admin-email> <admin-password>}"

PB_DIR=/opt/pocketbase
PB_DATA_DIR="$PB_DIR/pb_data"
BACKUP_DIR=/opt/backups
PB_USER=pocketbase

echo "=== [1/6] System update ==="
apt-get update -qq && apt-get upgrade -y -qq

echo "=== [2/6] Install dependencies ==="
apt-get install -y -qq unzip curl wget ufw

echo "=== [3/6] Install PocketBase ==="
useradd --system --no-create-home --shell /sbin/nologin "$PB_USER" 2>/dev/null || true
mkdir -p "$PB_DIR" "$PB_DATA_DIR" "$BACKUP_DIR"

PB_VERSION=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')
echo "Latest PocketBase: $PB_VERSION"
wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
  -O /tmp/pocketbase.zip
unzip -o /tmp/pocketbase.zip -d "$PB_DIR" pocketbase
chmod +x "$PB_DIR/pocketbase"
chown -R "$PB_USER:$PB_USER" "$PB_DIR" "$BACKUP_DIR"

echo "=== [4/6] Create systemd service ==="
cat > /etc/systemd/system/pocketbase.service << EOF
[Unit]
Description=PocketBase — Descartes Database
After=network.target

[Service]
User=$PB_USER
WorkingDirectory=$PB_DIR
ExecStart=$PB_DIR/pocketbase serve --http="127.0.0.1:8090"
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pocketbase
systemctl start pocketbase
echo "PocketBase started — waiting for it to initialize..."
sleep 5

echo "=== [5/6] Install & configure Caddy ==="
apt-get install -y -qq debian-keyring debian-archive-keyring
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
apt-get update -qq
apt-get install -y -qq caddy

cat > /etc/caddy/Caddyfile << EOF
$DOMAIN {
    reverse_proxy localhost:8090
}
EOF

systemctl enable caddy
systemctl restart caddy

echo "=== [6/6] Backup cron job ==="
cat > /usr/local/bin/pb-backup.sh << 'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=/opt/backups
PB_DIR=/opt/pocketbase
STAMP=$(date +%Y%m%d_%H%M%S)
$PB_DIR/pocketbase backup --dir="$BACKUP_DIR" 2>/dev/null || \
  zip -qr "$BACKUP_DIR/pb_backup_$STAMP.zip" "$PB_DIR/pb_data"
find "$BACKUP_DIR" -name "*.zip" -mtime +7 -delete
BACKUP
chmod +x /usr/local/bin/pb-backup.sh

echo "0 2 * * * root /usr/local/bin/pb-backup.sh >> /var/log/pb-backup.log 2>&1" \
  > /etc/cron.d/pocketbase-backup

echo "=== Firewall ==="
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  SETUP COMPLETE                                      ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  PocketBase admin: https://$DOMAIN/_/              ║"
echo "║  NEXT STEP: run pocketbase_schema.py to create      ║"
echo "║  collections and seed the tag taxonomy.             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Create admin account:"
echo "  $PB_DIR/pocketbase admin create $ADMIN_EMAIL $ADMIN_PASSWORD"
