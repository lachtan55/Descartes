from fastapi import APIRouter, HTTPException, Query, Depends
from backend.providers.base import PriceDataProvider
from backend.dependencies import get_provider
from datetime import date, timedelta

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/{ticker}")
def fetch_price_data(
    ticker: str,
    interval: str = Query("1d"),
    start: str = Query(default=None),
    end: str = Query(default=None),
    provider: PriceDataProvider = Depends(get_provider),
):
    if start is None:
        start = str(date.today() - timedelta(days=365))
    if end is None:
        end = str(date.today())
    try:
        bars = provider.get_ohlcv(ticker, interval, start, end)
        if not bars:
            raise HTTPException(
                status_code=404,
                detail=f"No data returned for '{ticker}'. "
                       f"Try appending '=F' for futures (e.g. GC=F) or '-USD' for crypto."
            )
        return {"ticker": ticker, "interval": interval, "bars": bars}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ticker}/latest")
def fetch_latest_price(
    ticker: str,
    provider: PriceDataProvider = Depends(get_provider),
):
    try:
        return provider.get_latest_price(ticker)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
