import yfinance as yf
import pandas as pd
from typing import Any

TICKER_NORMALIZATION: dict[str, str] = {
    "GC": "GC=F",
    "HG": "HG=F",
    "CL": "CL=F",
    "NG": "NG=F",
    "SI": "SI=F",
    "ZC": "ZC=F",
    "ZW": "ZW=F",
    "ZS": "ZS=F",
    "ES": "ES=F",
    "NQ": "NQ=F",
    "YM": "YM=F",
    "RTY": "RTY=F",
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
    "ADA": "ADA-USD",
    "XRP": "XRP-USD",
}


def normalize_ticker(ticker: str) -> str:
    return TICKER_NORMALIZATION.get(ticker.upper(), ticker)


def get_ohlcv(ticker: str, interval: str, start: str, end: str) -> list[dict[str, Any]]:
    yt = normalize_ticker(ticker)
    df = yf.download(yt, start=start, end=end, interval=interval, auto_adjust=True, progress=False)
    if df.empty:
        return []
    df = df.dropna()
    df.index = pd.to_datetime(df.index)
    df = df.reset_index()

    # Flatten multi-level columns if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] if col[1] == '' else col[0] for col in df.columns]

    date_col = 'Date' if 'Date' in df.columns else 'Datetime'
    records = []
    for _, row in df.iterrows():
        records.append({
            "time": str(row[date_col])[:10],
            "open": round(float(row["Open"]), 6),
            "high": round(float(row["High"]), 6),
            "low": round(float(row["Low"]), 6),
            "close": round(float(row["Close"]), 6),
            "volume": int(row.get("Volume", 0) or 0),
        })
    return records


def get_latest_price(ticker: str) -> dict[str, Any]:
    yt = normalize_ticker(ticker)
    ticker_obj = yf.Ticker(yt)
    info = ticker_obj.fast_info
    try:
        price = float(info.last_price)
    except Exception:
        hist = ticker_obj.history(period="2d")
        price = float(hist["Close"].iloc[-1]) if not hist.empty else 0.0
    return {"ticker": ticker, "yf_ticker": yt, "price": round(price, 6)}


class YFinanceService:
    """Class wrapper around module-level functions. Satisfies PriceDataProvider."""

    def get_ohlcv(self, ticker: str, interval: str, start: str, end: str) -> list[dict[str, Any]]:
        return get_ohlcv(ticker, interval, start, end)

    def get_latest_price(self, ticker: str) -> dict[str, Any]:
        return get_latest_price(ticker)

    def ping(self) -> bool:
        return True
