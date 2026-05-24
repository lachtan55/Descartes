# Descartes — DATABASE Module

Self-hosted AI-tagged research document store. Accessible from the Descartes hub at `/database`.

## Overview

- **Storage**: PocketBase (SQLite + file storage, single Go binary)
- **Hosting**: Hetzner CX22 VPS (~€3.79/mo), served via Caddy with auto-TLS
- **Tagging**: Google Gemini 1.5 Flash — text is extracted by the FastAPI backend and sent to Gemini; tags are reviewed by the user before saving
- **Viewers**: PDF, DOCX, CSV/XLSX, Markdown, TXT — all in-browser, no external tab

## Deployment (first time)

### 1 — Provision VPS

Get a Hetzner CX22 with Ubuntu 24.04 LTS. Then from your local machine:

```bash
ssh root@<vps-ip>
bash <(curl -s https://...) # or scp setup_vps.sh root@<vps-ip>:
bash setup_vps.sh db.yourdescartes.com admin@example.com YourSecurePassword
```

Or copy the script and run it directly on the VPS:

```bash
scp setup_vps.sh root@<vps-ip>:~/
ssh root@<vps-ip>
bash setup_vps.sh db.yourdescartes.com admin@example.com YourSecurePassword
```

The script installs PocketBase, creates a systemd service, installs Caddy with auto-TLS, and sets up a daily backup cron job.

### 2 — Create PocketBase admin account

```bash
ssh root@<vps-ip>
/opt/pocketbase/pocketbase admin create admin@example.com YourSecurePassword
```

Or go to `https://db.yourdescartes.com/_/` and create it via the web UI on first visit.

### 3 — Bootstrap collections

From your local machine (requires `pip install requests`):

```bash
python pocketbase_schema.py https://db.yourdescartes.com admin@example.com YourSecurePassword
```

This creates the `documents` and `tag_taxonomy` collections and seeds all ~60 taxonomy entries.

### 4 — Configure frontend

In `../frontend/.env`:
```
VITE_POCKETBASE_URL=https://db.yourdescartes.com
```

Rebuild: `cd ../frontend && npm run build`

### 5 — Configure backend

`GEMINI_API_KEY` is already in `../backend/.env`. The two DATABASE endpoints (`/api/db/extract-text`, `/api/db/suggest-tags`) are part of the existing FastAPI backend — no separate service needed.

---

## Ongoing operations

### Backup

Backups run automatically at 02:00 UTC daily via cron. Kept for 7 days at `/opt/backups/`.

Manual backup via PocketBase admin UI: `https://db.yourdescartes.com/_/` → Settings → Backups → Create.

### Restore

Download the backup `.zip` from the admin UI, then:

```bash
scp backup.zip root@<vps-ip>:/opt/pocketbase/
ssh root@<vps-ip>
systemctl stop pocketbase
cd /opt/pocketbase && unzip -o backup.zip
systemctl start pocketbase
```

### Update PocketBase

```bash
ssh root@<vps-ip>
systemctl stop pocketbase
PB_VERSION=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')
wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip
unzip -o /tmp/pb.zip -d /opt/pocketbase pocketbase
chmod +x /opt/pocketbase/pocketbase
systemctl start pocketbase
```

---

## Tag taxonomy

Tags use the structure `{ category, value }`. Categories and their colors:

| Category | Color | Example values |
|---|---|---|
| `market` | cyan | `stock_market`, `comdty_market`, `crypto_market` |
| `instrument` | blue | `stock`, `ETF`, `futures`, `options` |
| `comdty` | amber | `comdty_colored-metals`, `comdty_energy`, `comdty_grain` |
| `macro` | violet | `CPI_US`, `PMI_EU`, `GDP_CN`, `INTEREST-RATE_CZ` |
| `exchange` | slate | `IB_NYSE`, `IB_NASDAQ`, `HL_EXCHANGE` |
| `currency` | teal | `USD`, `EUR`, `CZK`, `CNY` |
| `special` | orange | `short_squeeze`, `insider_buy`, `m_and_a`, `supply_disruption` |
| `ticker` | green | `NYSE:HBM`, `COMEX:GC`, `CME:ES` |
| `data_type` | grey | `thesis`, `research_report`, `earnings`, `macro_data` |
| `timeframe` | dim white | `daily`, `weekly`, `quarterly` |

`ticker`, `currency`, and `macro` are free-form — any value is valid.

---

## Files

| File | Purpose |
|---|---|
| `setup_vps.sh` | Full VPS provisioning script (Hetzner CX22, Ubuntu 24.04) |
| `pocketbase_schema.py` | Creates collections + seeds taxonomy via PocketBase Admin API |
