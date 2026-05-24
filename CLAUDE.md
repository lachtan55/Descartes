# CLAUDE.md — Descartes

Bloomberg Terminal-style investment research application. Three processes run simultaneously: PocketBase (database), FastAPI (backend), Vite+React (frontend).

---

## Architecture

```
PocketBase  :8090  — document store (SQLite, Go binary in Database/)
FastAPI     :8000  — REST API (Python, venv at project root)
Vite/React  :5173  — frontend, proxies /api to :8000
```

> **Note:** WebSocket support (`/ws` proxy) is scaffolded in Vite config but not yet implemented. Do not assume any WS endpoints exist. Remove `/ws` proxy entry until WS is actively built.

**Start order: PocketBase → FastAPI → Frontend** (contents of `START_DESCARTES.txt` should be reproduced here when finalized)

---

## Storage Architecture

Three distinct storage backends — understand which is which before writing any data code:

| Store | Technology | Used For |
|---|---|---|
| PocketBase `:8090` | SQLite via Go binary | User documents, uploaded files, research library, star/unstar state |
| `price_data.db` | SQLite (backend root) | Cached OHLCV price data from yfinance / IB TWS |
| `macro_catalog.json` | JSON flat file (backend root) | Data bridge registry — maps series IDs to sources, bridge statuses, metadata |

> **Critical naming distinction:** `macro_catalog.json` is the **data bridge registry** (backend internals, never shown in UI). The **MacroCatalog UI section** is a document viewer that reads PocketBase collections filtered to macroeconomic research. These are entirely separate things — never conflate them.

> **`macro_catalog.json` fragility:** This file is auto-seeded on first API call if missing. Manual edits to bridge statuses persist as long as the file exists. If deleted, customizations are lost. Treat it as a config file and back it up. Future: migrate to a PocketBase collection.

---

## Tech Stack

### Frontend (`frontend/`)

**Runtime requirement:** Node.js ≥ 18

| Concern | Library | Notes |
|---|---|---|
| Framework | React 19, TypeScript 5.2 (strict) | |
| Build | Vite 5.1 | |
| Routing | react-router-dom v7 | |
| Charts | recharts 2.10.3 | **LOCKED on v2.x** — v3 has breaking API changes. Do not upgrade past 2.x under any circumstances. Currently pinned at 2.10.3. |
| Candlestick charts | lightweight-charts 4.1 | **LOCKED at 4.1** — do not upgrade without testing |
| Database client | pocketbase JS SDK 0.26.9 | Frontend queries PocketBase directly |
| Markdown | react-markdown + remark-gfm | |
| Document viewers | react-pdf (PDF), mammoth (DOCX), xlsx (CSV/XLSX) | |
| State | `useState` + `useEffect` | No React Query, no Zustand |
| Styling | **Custom CSS only** | No Tailwind, no CSS Modules, no UI libraries |

### Backend (`backend/`)

**Runtime requirement:** Python ≥ 3.10

| Concern | Library | Notes |
|---|---|---|
| Framework | FastAPI + uvicorn | |
| Validation | Pydantic v2 | |
| HTTP client | httpx (async) | |
| Price data | yfinance, pandas | |
| AI providers | anthropic, google-genai, openai | |
| Local storage | SQLite (`price_data.db` at backend root), JSON file (`macro_catalog.json` at backend root) | |
| IB TWS | ib_insync via `tws_service.py` | ⚠ `ib_insync` is minimally maintained — community fork `ib_async` is the successor. Migrate when stable. |

---

## Commands

### Frontend
```bash
cd frontend
npm install           # install deps
npm run dev           # dev server → http://localhost:5173
npm run build         # tsc && vite build (production)
npm run preview       # preview production build
npx tsc --noEmit      # type-check only
```

### Backend
```bash
# Windows — always use python.exe -m pip, never bare pip.exe (resolves wrong venv)
venv\Scripts\activate
.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
uvicorn backend.main:app --reload --port 8000   # dev only — --reload is not for production

# Unix
source venv/bin/activate
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000   # dev only
```

### Type generation (Pydantic → TypeScript)
```bash
# Run after ANY change to backend/models/macro_models.py
# Windows
.\venv\Scripts\python.exe scripts/gen_macro_types.py

# Unix
python scripts/gen_macro_types.py
```

> **`frontend/src/pages/macro/types.ts` is auto-generated. Never edit it by hand.** The single source of truth is `backend/models/macro_models.py`. Run `python scripts/gen_macro_types.py` after every model change. The script (`scripts/gen_macro_types.py`) reads Pydantic JSON schemas and writes TypeScript interfaces. Note: `datamodel-code-generator` does not support Python files as input — it only converts JSON Schema → Python models (opposite direction). Use the custom script instead.

### PocketBase
```bash
cd Database
.\pocketbase.exe serve   # Windows
./pocketbase serve       # Unix
# Admin UI: http://127.0.0.1:8090/_/
# Migrations in Database/pb_migrations/ auto-apply on startup
```

### Health checks
```
GET http://localhost:8000/api/health    # FastAPI
GET http://localhost:8090/api/health    # PocketBase
```

---

## Project Structure

```
frontend/src/
  App.tsx                     routes only (add new <Route> here)
  main.tsx                    BrowserRouter entry point
  styles.css                  single global stylesheet + CSS variables
  components/
    SectionShell.tsx          wraps every section (top bar, tab nav, error boundary)
                              health check runs once on app init — NOT on every mount
                              failed health check shows non-blocking status banner only,
                              never blocks section rendering
  config/
    modules.ts                MODULES array + auto-generated COMMAND_MAP (Bloomberg aliases)
    regionConfig.ts           REGIONS + REGION_MAP for macro page
  lib/
    pocketbase.ts             PocketBase client + all document CRUD + star/unstar (documents)
  pages/
    HubPage.tsx               Bloomberg command bar + module grid
    {Name}Section.tsx         top-level page per module
    macro/
      types.ts                ⚠ AUTO-GENERATED — do not edit by hand
                              regenerate with: python scripts/gen_macro_types.py (see Commands)
      tabs/
        MaintenanceTab.tsx
        ByRegionTab.tsx
        AlphaTab.tsx          STUB — not yet implemented, renders placeholder only
      components/             chart sections, panels, BloombergChartWrapper
      utils/timeframe.ts      timeframe filter logic (YTD/1Y/5Y/10Y/15Y/20Y)
    documents/                DocumentList, FileViewer, viewers (PDF/DOCX/CSV/MD)
                              reads PocketBase — shows research library documents only
                              formerly named database/ — treat that name as legacy

backend/
  main.py                     FastAPI app, CORS middleware, router registration
  config.py                   reads .env → exports constants
  routers/                    one file per feature group; register in main.py
  models/
    macro_models.py           Pydantic models — SINGLE SOURCE OF TRUTH for macro types
                              TypeScript types are generated from this file
  services/
    macro_catalog_service.py  catalog CRUD against macro_catalog.json
    macro_ai_service.py       routes claude-*/gemini-*/gpt-* to correct SDK
    fred_service.py           FRED bridge stub (Phase 4)
    ecb_service.py            ECB bridge stub
    czso_service.py           CZSO (Czech Statistical Office) bridge stub
    cnb_service.py            ČNB bridge stub
  gemini.py                   Google GenAI low-level helper — called by macro_ai_service.py
                              kept at backend root for historical reasons; do not move without
                              updating all imports
  macro_catalog.json          auto-seeded on first API call if missing (see Storage Architecture)
  price_data.db               SQLite cache for OHLCV price data
  .env                        API keys — never commit

Database/
  pocketbase.exe              PocketBase binary
  pb_data/                    PocketBase data — back this up regularly
  pb_migrations/              JS migrations auto-applied on startup
```

---

## Coding Style

### TypeScript / React

**Components**
- Default export for every component file; named exports for types/constants.
- One component per file. File name = component name (PascalCase).
- Section pages (e.g. `MacroeconomicsSection.tsx`) own their tab state and fetch top-level data. Sub-components receive data as props.

**Styling**
- All layout and component styles via inline `style={{}}` using CSS variables — never hardcode colour hex values directly.
- CSS class names only for global structural elements defined in `styles.css`.
- Key design tokens:
  ```
  --bg-primary: #0d0d0d      --text-primary: #f0f0f0
  --bg-secondary: #141414    --text-secondary: #a0a0a0
  --bg-panel: #1a1a1a        --text-muted: #606060
  --border: #2a2a2a
  --accent-amber: #f0a500
  --accent-green: #00c851
  --accent-red: #ff3d3d
  --accent-blue: #4da6ff
  --font-mono: 'JetBrains Mono'
  --font-ui: 'IBM Plex Sans'
  ```

**Data fetching**
- Local `useState` + `useEffect` with a `const load = async () => {...}` pattern. No React Query.
- Backend base URL hardcoded per component: `const API = 'http://localhost:8000'`
- Error handling split by action type:
  - **Background fetches** (data load on mount): silent `catch {}` — UI shows empty/loading state.
  - **User-initiated actions** (form submit, delete, save): catch and surface error inline in the UI.
  - API calls returning a known error should include it as a field in the response payload, not as HTTP 500.

**Types**
- Strict TypeScript. No `any`. Use `unknown` with explicit type narrowing instead.
- If `any` is absolutely unavoidable (e.g. external library with untyped callbacks), mark it with an inline comment: `// eslint-disable-next-line @typescript-eslint/no-explicit-any — reason`.
- `frontend/src/pages/macro/types.ts` is **auto-generated** — never add manual types to this file.
- Use `type` keyword for import-only types: `import type { Foo } from './types'`.

**State patterns**
- Tab state: `useState<'TAB_A' | 'TAB_B'>('TAB_A')` with a union type literal.
- Configuration (regions, modules, indicators) lives in `src/config/` as exported constants, never hardcoded inline.

### Python / FastAPI

**Runtime and imports**
- Python ≥ 3.10 required.
- `from __future__ import annotations` at the top of every service/model file (kept for consistency; technically redundant on 3.10+ but harmless).
- Module-level docstring describing the file's purpose and key routes.

**Module structure**
- Routers: `router = APIRouter(prefix="/api/...", tags=["..."])`, one file per domain.
- Services: class-based with a module-level singleton at the bottom: `service = MyService()`.
- Register all routers in `backend/main.py`.
- New model files go in `backend/models/`.

**Naming**
- Private helpers: underscore prefix (`_load_catalog`, `_dp`, `_get_mock_gdp`).
- Section dividers: `# ── Section Name ─────────────────────────────────────────────`.

**Type hints — Python 3.10+ style throughout**
- `str | None` (not `Optional[str]`). Do not import `Optional` from `typing`.
- `list[dict]`, `dict[str, list[str]]` — lowercase generics everywhere.
- `X | None = None` for optional parameters.

**Error handling**
- Use `raise HTTPException(status_code=..., detail="...")` for all client errors.
- Wrap external API calls in `try/except Exception as exc` and either re-raise as HTTPException or return an error field in the response model.
- Core series deletion guard: `is_core=True` → **405 Method Not Allowed**, not 404, not 403.
  - 403 = authentication/authorization failure — incorrect here.
  - 405 = operation not permitted on this resource — semantically correct.

**CORS**
- CORS middleware is configured in `backend/main.py` to allow `http://localhost:5173`.
- If adding new origins, update `allow_origins` in `main.py` — do not set `allow_origins=["*"]` in production.

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Done | Core architecture — PocketBase, FastAPI, React shell, Bloomberg UI |
| 2 | ✅ Done | Macro page — catalog, AI reports, regional views |
| 3 | 🔄 Active | Document library, price data, equity/commodity sections |
| 4 | 📋 Planned | Live data bridges — FRED, ECB, CZSO, ČNB |
| 5 | 📋 Planned | IB TWS live integration, WebSocket price streaming |

> Update this table when phases complete or scope changes.

---

## Adding a New Module

1. Add entry to `MODULES` in `frontend/src/config/modules.ts` — `COMMAND_MAP` auto-generates from the `commands` array.
2. Add `<Route path="/{id}" element={<YourSection />} />` in `frontend/src/App.tsx`.
3. Create `frontend/src/pages/YourSection.tsx` using `<SectionShell moduleId="...">` as the wrapper.
4. Create `backend/models/your_models.py` with Pydantic request/response models.
5. Create `backend/routers/your_router.py` with `router = APIRouter(prefix="/api/your", tags=["your"])`.
6. Register: `app.include_router(your_router.router)` in `backend/main.py`.

---

## Adding a New Data Bridge (Macro)

1. Create `backend/services/{source}_service.py` following the pattern of `fred_service.py`.
2. Implement `get_bridge_status()` — return `BridgeStatus` with a real connectivity check.
3. Wire into `backend/routers/macro.py` replacing the corresponding `_get_mock_*()` call.
4. Update `get_bridge_status_all()` in `macro_catalog_service.py` to call the new service.
5. Update `macro_catalog.json` — set `bridge_status = "connected"` for that source's entries.
   > ⚠ `macro_catalog.json` is auto-seeded only if missing. Manual edits persist. Back it up before editing.

---

## Environment Variables

`backend/.env`:
```
GEMINI_API_KEY=...                          # Required — Gemini AI
FRED_API_KEY=                               # Phase 4 — free at fred.stlouisfed.org
ANTHROPIC_API_KEY=                          # For Claude AI reports
OPENAI_API_KEY=                             # For GPT AI reports
AI_REPORT_DEFAULT_MODEL=claude-sonnet-4-5-20251022   # Verify against Anthropic docs — must be full versioned string
MACRO_DATA_CACHE_TTL_HOURS=24               # Controls TTL in macro_catalog_service.py in-memory cache
```

`frontend/.env`:
```
VITE_POCKETBASE_URL=http://localhost:8090
```

---

## Key Constraints

- **recharts stays on v2.x** — v3 has breaking API changes. Currently pinned at `2.10.3` in `package.json`. Never upgrade to v3.
- **lightweight-charts stays at 4.1** — do not upgrade without regression testing all candlestick views.
- **`macro/types.ts` is auto-generated** — source of truth is `backend/models/macro_models.py`. Run codegen after every model change. Never edit `types.ts` by hand.
- **No UI component libraries** — MUI, Chakra, Tailwind are not used. Keep it that way.
- **PocketBase migrations** in `Database/pb_migrations/` auto-apply on every startup.
- **`macro_catalog.json`** is auto-created on first API call if missing — treat as config, back it up.
- **IB TWS ports:**
  - `7496` = TWS live trading
  - `7497` = TWS paper trading
  - `4001` = IB Gateway live trading
  - `4002` = IB Gateway paper trading
  - Always confirm which mode before connecting. Wrong port = wrong account.
- **No test suite configured.** Verify correctness with smoke test scripts or `npx tsc --noEmit`.
- **Python ≥ 3.10 required.** Use `str | None` and lowercase generics everywhere — no `Optional`, no `List`, no `Dict` from `typing`.
