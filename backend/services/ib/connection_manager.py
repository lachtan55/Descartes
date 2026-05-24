from __future__ import annotations
from typing import Any

# IB connection ports — double-check before connecting, wrong port = wrong account
TWS_LIVE_PORT      = 7496   # TWS live trading
TWS_PAPER_PORT     = 7497   # TWS paper trading
GATEWAY_LIVE_PORT  = 4001   # IB Gateway live trading
GATEWAY_PAPER_PORT = 4002   # IB Gateway paper trading

try:
    from ib_insync import IB as _IB
    _HAS_IB = True
except ImportError:
    _IB = None  # type: ignore
    _HAS_IB = False


class IBConnectionManager:
    """Owns the ib_insync IB() singleton and manages connection lifecycle."""

    _instance: IBConnectionManager | None = None

    def __init__(self) -> None:
        self._ib: Any = _IB() if _HAS_IB else None
        self._connected: bool = False
        self._host: str | None = None
        self._port: int | None = None

    @classmethod
    def get_instance(cls) -> IBConnectionManager:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def client(self) -> Any:
        """Returns the IB() instance. Raises RuntimeError if not connected."""
        if not self.is_connected():
            raise RuntimeError("IB Gateway not connected")
        return self._ib

    @property
    def host(self) -> str | None:
        return self._host

    @property
    def port(self) -> int | None:
        return self._port

    def is_connected(self) -> bool:
        if _HAS_IB and self._ib is not None:
            return self._ib.isConnected()
        return self._connected

    async def connect(self, host: str = "127.0.0.1", port: int = GATEWAY_PAPER_PORT, client_id: int = 1) -> None:
        if not _HAS_IB or self._ib is None:
            raise RuntimeError(
                "ib_insync is not installed. Run: pip install ib_insync"
            )
        await self._ib.connectAsync(host, port, clientId=client_id, timeout=10, readonly=True)
        self._host = host
        self._port = port

    async def disconnect(self) -> None:
        """Calls ib.disconnect()."""
        if _HAS_IB and self._ib is not None and self._ib.isConnected():
            self._ib.disconnect()
        self._connected = False
        self._host = None
        self._port = None

    async def reconnect(self, host: str = "127.0.0.1", port: int = GATEWAY_PAPER_PORT, client_id: int = 1) -> None:
        await self.disconnect()
        await self._ib.connectAsync(host, port, clientId=client_id, timeout=10, readonly=True)
        self._host = host
        self._port = port
