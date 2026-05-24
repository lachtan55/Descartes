from typing import Any
from backend.services.ib.connection_manager import IBConnectionManager


class IBDataService:
    """Fetches price data via TWS. Implements PriceDataProvider.

    All data-fetching methods belong here; connection lifecycle stays in
    IBConnectionManager.

    Usage (once ib_insync is installed):
        from ib_insync import Stock, Future, util
        contract = Stock(ticker, 'SMART', 'USD')
        bars = self._manager._ib.reqHistoricalData(
            contract, endDateTime='', durationStr='365 D',
            barSizeSetting='1 day', whatToShow='MIDPOINT', useRTH=True,
        )
        df = util.df(bars)
    """

    def __init__(self, manager: IBConnectionManager) -> None:
        self._manager = manager

    def ping(self) -> bool:
        return self._manager.is_connected()

    def get_ohlcv(self, ticker: str, interval: str, start: str, end: str) -> list[dict[str, Any]]:
        raise NotImplementedError(
            "TWS integration pending. See data_service.py docstring for implementation guide."
        )

    def get_latest_price(self, ticker: str) -> dict[str, Any]:
        raise NotImplementedError("TWS integration pending.")
