import asyncio
from typing import AsyncGenerator
from backend.services.ib.connection_manager import IBConnectionManager

try:
    from ib_insync import Contract
    _HAS_IB = True
except ImportError:
    _HAS_IB = False
    Contract = None  # type: ignore


class StreamManager:
    def __init__(self, manager: IBConnectionManager) -> None:
        self._manager = manager
        # symbol -> {"bars": RealTimeBarList, "queue": asyncio.Queue, "count": int}
        self._subscriptions: dict[str, dict] = {}

    async def subscribe(
        self,
        symbol: str,
        sec_type: str = "CONTFUT",
        exchange: str = "SMART",
        currency: str = "USD",
    ) -> AsyncGenerator[dict, None]:
        if not self._manager.is_connected():
            raise RuntimeError("IB Gateway not connected")

        ib = self._manager.client

        if symbol not in self._subscriptions:
            contract = Contract(
                symbol=symbol,
                secType=sec_type,
                exchange=exchange,
                currency=currency,
            )
            queue: asyncio.Queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            bars = ib.reqRealTimeBars(contract, 5, "TRADES", False)

            def on_bar_update(bars, has_new_bar):
                if has_new_bar and bars:
                    bar = bars[-1]
                    loop.call_soon_threadsafe(queue.put_nowait, {
                        "time": int(bar.time.timestamp()),
                        "open": bar.open_,
                        "high": bar.high,
                        "low": bar.low,
                        "close": bar.close,
                        "volume": bar.volume,
                    })

            bars.updateEvent += on_bar_update
            self._subscriptions[symbol] = {"bars": bars, "queue": queue, "count": 0}

        self._subscriptions[symbol]["count"] += 1
        queue = self._subscriptions[symbol]["queue"]

        try:
            while True:
                if not self._manager.is_connected():
                    await asyncio.sleep(2)
                    continue
                try:
                    bar = await asyncio.wait_for(queue.get(), timeout=10.0)
                    yield bar
                except asyncio.TimeoutError:
                    continue
        except GeneratorExit:
            pass
        finally:
            if symbol in self._subscriptions:
                self._subscriptions[symbol]["count"] -= 1
                if self._subscriptions[symbol]["count"] <= 0:
                    ib.cancelRealTimeBars(self._subscriptions[symbol]["bars"])
                    del self._subscriptions[symbol]
