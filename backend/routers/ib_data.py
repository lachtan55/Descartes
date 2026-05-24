import asyncio
import calendar
from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Request
from backend.services.ib.connection_manager import IBConnectionManager

try:
    from ib_insync import Contract
    _HAS_IB = True
except ImportError:
    _HAS_IB = False
    Contract = None  # type: ignore


def _to_timestamp(d) -> int:
    if isinstance(d, datetime):
        return int(d.timestamp())
    elif isinstance(d, date):
        return calendar.timegm(d.timetuple())
    else:
        return int(d)


router = APIRouter(tags=["ib"])


@router.get("/api/contracts/search")
async def search_contracts(q: str, request: Request):
    if not q or len(q.strip()) < 1:
        return []

    manager: IBConnectionManager = request.app.state.connection_manager
    if not manager.is_connected():
        raise HTTPException(status_code=503, detail="IB Gateway not connected")

    ib = manager.client
    loop = asyncio.get_event_loop()
    try:
        results = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: ib.reqMatchingSymbols(q.strip())),
            timeout=8.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="IB search timed out")

    return [
        {
            "symbol": c.contract.symbol,
            "local_symbol": c.contract.localSymbol or c.contract.symbol,
            "display_name": c.contract.localSymbol or c.contract.symbol,
            "sec_type": c.contract.secType,
            "exchange": c.contract.primaryExchange or c.contract.exchange or "",
            "currency": c.contract.currency,
            "last_trade_date": c.contract.lastTradeDateOrContractMonth or None,
        }
        for c in (results or [])[:8]
    ]


@router.get("/api/ib/bars/{symbol}")
async def get_historical_bars(
    symbol: str,
    request: Request,
    timeframe: str = "1D",  # "1H" | "1D" | "1W" | "1M" | "6M" | "1Y" | "MAX"
    end_date: str = "",     # ISO format "2024-01-15 10:30:00" or "" for now
    sec_type: str = "CONTFUT",
    exchange: str = "SMART",
    currency: str = "USD",
):
    manager: IBConnectionManager = request.app.state.connection_manager
    if not manager.is_connected():
        raise HTTPException(status_code=503, detail="IB Gateway not connected")

    ib = manager.client
    contract = Contract(
        symbol=symbol,
        secType=sec_type,
        exchange=exchange,
        currency=currency,
    )

    # Map timeframe to (durationStr, barSizeSetting, whatToShow)
    timeframe_config = {
        "1H":  ("1 D",  "1 min",   "TRADES"),
        "1D":  ("5 D",  "5 mins",  "TRADES"),
        "1W":  ("1 M",  "30 mins", "TRADES"),
        "1M":  ("6 M",  "1 hour",  "TRADES"),
        "6M":  ("1 Y",  "4 hours", "TRADES"),
        "1Y":  ("2 Y",  "1 day",   "ADJUSTED_LAST"),
        "MAX": ("10 Y", "1 week",  "ADJUSTED_LAST"),
    }
    duration, bar_size, what_to_show = timeframe_config.get(timeframe, ("5 D", "5 mins", "TRADES"))
    request_timeout = 20.0 if timeframe == "MAX" else 15.0

    try:
        bars = await asyncio.wait_for(
            ib.reqHistoricalDataAsync(
                contract,
                endDateTime=end_date,
                durationStr=duration,
                barSizeSetting=bar_size,
                whatToShow=what_to_show,
                useRTH=False,
                formatDate=2,
            ),
            timeout=request_timeout,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="IB historical data timed out")

    return [
        {
            "time": _to_timestamp(bar.date),
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
        }
        for bar in (bars or [])
    ]
