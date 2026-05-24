# Descartes

Professional research and trading signal platform with Bloomberg Terminal aesthetic.

---

## Modules

| Module | Route | Description |
|---|---|---|
| **LIVE TRADING** | `/live-trading` | Signal entry · Backtesting · Live tracking · Live prices · Analytics |
| **COMDTY FUNDAMENTALS** | `/commodities` | Alpha · Markets & Geopolitics · Risks · Companies · Technicals |
| **DATABASE** | `/database` | Price data management · AI-tagged research document store |

> Legacy route `/backtesting` redirects automatically to `/live-trading`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.11 + FastAPI + Uvicorn |
| Document store | PocketBase (self-hosted, single binary) |
| Price data (server) | SQLite via `backend/price_data.db` |
| Price data (client) | Browser `localStorage` (signals + cached price bars) |
| Charts | Lightweight Charts v4 (candlestick/line) + Recharts (equity curve) |
| Data provider | yfinance (via backend) |
| Export | SheetJS (Excel) |
| AI | Google Gemini API — `google-genai` SDK (`gemini-2.5-flash-lite`) |

---

## Quick Start

### 1 — Backend

```bash
# From project root
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r backend/requirements.txt

# Configure environment
copy backend\.env.example backend\.env
# Edit backend/.env and set:
#   GEMINI_API_KEY=your_google_ai_studio_key
#   (optional) GEMINI_MODEL=gemini-2.5-flash-lite

python -m uvicorn backend.main:app --reload --port 8000
```

> **Gemini API key**: obtain a free key at [aistudio.google.com](https://aistudio.google.com). Keys from Google Cloud Console may have free-tier quota blocked.

### 2 — PocketBase (Database module)

The DATABASE documents tab requires a running PocketBase instance.

```bash
# Download the binary from https://pocketbase.io/docs/
./pocketbase serve --http="127.0.0.1:8090"

# Create collections (one-time setup)
python Database/pocketbase_schema.py http://localhost:8090 admin@example.com password
```

See [`Database/README.md`](Database/README.md) for full deployment instructions.

### 3 — Frontend

```bash
cd frontend
npm install

# (optional) copy and edit .env if PocketBase runs on a non-default URL
cp .env.example .env
# VITE_POCKETBASE_URL=http://localhost:8090

npm run dev
```

Open **http://localhost:5173**

---

## Bloomberg Command Bar

From the hub, type a command and press `Enter` or **GO**:

| Command | Navigates to |
|---|---|
| `LIVE TRADING` / `LT` / `BT` / `BACKTESTING` / `SIGNALS` | Live Trading module |
| `COMDTY` / `COMMODITIES` / `CF` | Commodities Fundamentals module |
| `DATABASE` / `DB` / `DOCS` | Database module |
| `HUB` / `HOME` | Hub page |

---

## Live Trading Module

### Tabs

| Tab | Description |
|---|---|
| **BACKTEST** | Configure and run backtests against stored price data |
| **SIGNALS** | Add, edit, parse, and manage trading signals |
| **LIVE TRACK** | Active signals dashboard with real-time P&L status |
| **LIVE PRICE** | Live streaming price chart (Interactive Brokers or TWS) |
| **ANALYTICS** | Performance analytics across the signal library |

### Signal Entry Formats

**Manual / rule-based parser** — paste one or more lines:

```
LONG GC | entry: 2345.50 | target: 2410.00 | sl: 2300.00 | momentum: strong up
SHORT COPX | entry: 38.20 | target: 35.00 | momentum: weak down | sl: 39.50
BTC-USD LONG entry=67000 target=72000 momentum=strong up
LONG AAPL entry: 185 target: 200 sl: 178 hold until 2025-09-01
```

Supported optional fields: `sl` / `stop`, `hold until YYYY-MM-DD`, `expiry: MMM D YYYY`, `notes`.

**AI parser (Gemini)** — paste free-form research text and let Gemini extract structured signals.

### Signal Expiration

Signals expire based on `holdUntil`:
- **Set**: signal expires at end-of-day on the specified date.
- **Not set**: signal expires at the last bar of the stored price dataset for that asset.

The backtest engine, Live Track filter, and status badges all use the same expiry logic.

### Backtest Engine

- Fetches or uses cached price data per asset (stored in `localStorage` / backend SQLite).
- **Market orders** fill at the open of the entry date bar.
- **Limit orders** scan forward from the entry date until the limit price is touched, or the signal expires.
- Closes at TP, SL, or expiry — whichever comes first.
- Results (P&L %, R-multiple, status) are written back into the signal library.

---

## Database Module

### Tabs

| Tab | Description |
|---|---|
| **DATABASE** | Fetch & store OHLCV price data from yFinance |
| **DOCUMENTS** | Upload, tag, and search research documents |

### Price Data (DATABASE tab)

- Fetches OHLCV bars (`1d` / `1wk` / `1mo`) from yFinance and stores them in `backend/price_data.db` (SQLite).
- **Automatic range merging**: fetching the same ticker at different date ranges merges all bars into one dataset (no duplicates, sorted by date).
- Data is also cached in `localStorage` for use by the Backtest and Live Track tabs.
- Per-dataset **DEL** button removes from both localStorage and the backend database.

### Documents (DOCUMENTS tab)

- Supports: PDF, DOCX, DOC, XLSX, CSV, TXT, MD.
- **AUTO-TAG**: extracts text from the file and calls Gemini to suggest tags, a title, and a summary.
- Tag taxonomy: `market`, `instrument`, `comdty`, `macro`, `exchange`, `currency`, `special`, `ticker`, `data_type`, `timeframe`.
- Tags can be reviewed and edited before saving.
- Bulk select + bulk delete supported.

---

## Backend API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/data/fetch` | Fetch & store OHLCV from yFinance |
| `GET` | `/api/data/tickers` | List stored tickers |
| `GET` | `/api/data/prices/{ticker}` | Get stored bars for a ticker |
| `DELETE` | `/api/data/prices/{ticker}` | Delete stored bars |
| `GET` | `/api/prices/{ticker}` | Live yFinance price fetch (used by Backtest) |
| `POST` | `/api/ai/parse` | Parse trading signals with Gemini |
| `POST` | `/api/db/extract-text` | Extract text from a document file URL |
| `POST` | `/api/db/suggest-tags` | Suggest tags/title/summary with Gemini |
| `WS` | `/api/ws/prices` | WebSocket for live price streaming |

---

## Configuration

### `backend/.env`

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash-lite   # optional override
```

### `frontend/.env`

```env
VITE_POCKETBASE_URL=http://localhost:8090
```

### Switching data provider from yfinance to FMP

In `backend/config.py`:
```python
PRICE_DATA_PROVIDER = "fmp"
```
Then implement `FMPService` in `backend/services/fmp_service.py` following the same interface as `yfinance_service.py`.

---

## Project Structure

```
Descartes-main/
├── backend/
│   ├── main.py                  # FastAPI app + router registration
│   ├── config.py                # Environment config (API keys, model names)
│   ├── gemini.py                # Shared Gemini helper (retry + model fallback)
│   ├── price_data.db            # SQLite OHLCV store (auto-created)
│   ├── routers/
│   │   ├── db.py                # Price data CRUD (/api/data/*)
│   │   ├── db_tagging.py        # Document extraction + AI tagging (/api/db/*)
│   │   ├── ai_parse.py          # Signal parsing (/api/ai/*)
│   │   ├── price_data.py        # Live yFinance fetch (/api/prices/*)
│   │   └── ws.py                # WebSocket price stream
│   └── services/
│       └── yfinance_service.py  # yFinance OHLCV adapter
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── BacktestTab.tsx
│   │   │   ├── SignalsTab.tsx
│   │   │   ├── LiveTrackTab.tsx
│   │   │   ├── BacktestingSection.tsx
│   │   │   └── database/
│   │   │       ├── DatabaseTab.tsx
│   │   │       ├── PriceDataTab.tsx
│   │   │       ├── DocumentList.tsx
│   │   │       └── TagReviewModal.tsx
│   │   ├── utils/
│   │   │   ├── backtestEngine.ts
│   │   │   ├── expiry.ts        # Unified signal expiry logic
│   │   │   ├── storage.ts       # localStorage helpers (signals + price data)
│   │   │   └── signalParser.ts
│   │   ├── config/
│   │   │   └── modules.ts       # Module/tab definitions
│   │   └── types/index.ts
│   └── package.json
├── Database/
│   ├── README.md                # PocketBase setup guide
│   └── pocketbase_schema.py     # Collection bootstrap script
└── START_DESCARTES.bat          # Windows one-click launcher
```
