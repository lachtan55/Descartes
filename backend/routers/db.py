"""
db.py — Price data persistence router.

Provides:
  POST /api/data/fetch          — pull OHLCV bars from yfinance and store in SQLite
  GET  /api/data/tickers        — list all tickers stored in the backend DB
  GET  /api/data/prices/{ticker} — retrieve stored bars for a ticker
"""

import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.yfinance_service import get_ohlcv

router = APIRouter(prefix="/api/data", tags=["data"])

# ── Database location ────────────────────────────────────────────────────────
_DB_PATH = Path(__file__).parent.parent / "price_data.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_schema() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS price_bars (
                ticker   TEXT    NOT NULL,
                time     TEXT    NOT NULL,
                open     REAL    NOT NULL,
                high     REAL    NOT NULL,
                low      REAL    NOT NULL,
                close    REAL    NOT NULL,
                volume   INTEGER NOT NULL DEFAULT 0,
                interval TEXT    NOT NULL DEFAULT '1d',
                PRIMARY KEY (ticker, time, interval)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_price_bars_ticker
            ON price_bars (ticker, interval, time)
        """)
        conn.commit()


# Ensure schema exists when the module is imported
_ensure_schema()


# ── Pydantic models ───────────────────────────────────────────────────────────

class FetchRequest(BaseModel):
    ticker: str
    start: str
    end: str
    interval: str = "1d"


class FetchResponse(BaseModel):
    ticker: str
    rows: int
    start: str | None = None
    end: str | None = None
    interval: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/fetch", response_model=FetchResponse)
def fetch_and_store(body: FetchRequest):
    """
    Fetch OHLCV data from yfinance and persist in the backend SQLite database.
    Returns a summary: ticker, rows stored, actual date range covered.
    """
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=422, detail="ticker is required")

    try:
        bars = get_ohlcv(ticker, body.interval, body.start, body.end)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"yfinance error: {exc}")

    if not bars:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No data returned for '{ticker}'. "
                "Try appending '=F' for futures (e.g. GC=F) or '-USD' for crypto."
            ),
        )

    # INSERT OR REPLACE — re-fetching the same range updates existing rows
    with _get_conn() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO price_bars
                (ticker, time, open, high, low, close, volume, interval)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    ticker,
                    b["time"], b["open"], b["high"], b["low"],
                    b["close"], b["volume"], body.interval,
                )
                for b in bars
            ],
        )
        conn.commit()

    times = [b["time"] for b in bars]
    return FetchResponse(
        ticker=ticker,
        rows=len(bars),
        start=min(times),
        end=max(times),
        interval=body.interval,
    )


@router.get("/tickers")
def list_tickers():
    """Return all distinct tickers stored in the backend database."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT ticker, interval, "
            "MIN(time) AS first, MAX(time) AS last, COUNT(*) AS bars "
            "FROM price_bars GROUP BY ticker, interval ORDER BY ticker"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/prices/{ticker}")
def get_stored_prices(ticker: str, interval: str = "1d"):
    """Return stored OHLCV bars for a ticker from the backend database."""
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT time, open, high, low, close, volume FROM price_bars "
            "WHERE ticker = ? AND interval = ? ORDER BY time",
            (ticker.upper(), interval),
        ).fetchall()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No stored data for '{ticker}' at interval '{interval}'.",
        )
    return {
        "ticker": ticker.upper(),
        "interval": interval,
        "bars": [dict(r) for r in rows],
    }


@router.delete("/prices/{ticker}")
def delete_stored_prices(ticker: str, interval: str | None = None):
    """
    Delete stored bars for a ticker.
    If interval is provided, only that interval is deleted.
    Otherwise all intervals for the ticker are removed.
    """
    t = ticker.upper()
    with _get_conn() as conn:
        if interval:
            conn.execute(
                "DELETE FROM price_bars WHERE ticker = ? AND interval = ?",
                (t, interval),
            )
        else:
            conn.execute("DELETE FROM price_bars WHERE ticker = ?", (t,))
        deleted = conn.total_changes
        conn.commit()
    return {"ticker": t, "interval": interval, "deleted_rows": deleted}
