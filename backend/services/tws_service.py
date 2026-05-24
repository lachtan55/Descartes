# Deprecated — split into ib/connection_manager.py and ib/data_service.py
from backend.services.ib.connection_manager import IBConnectionManager
from backend.services.ib.data_service import IBDataService

# IB connection ports — double-check before connecting, wrong port = wrong account
TWS_LIVE_PORT    = 7496   # TWS live trading
TWS_PAPER_PORT   = 7497   # TWS paper trading
GATEWAY_LIVE_PORT  = 4001   # IB Gateway live trading
GATEWAY_PAPER_PORT = 4002   # IB Gateway paper trading (default used in this codebase)

__all__ = ["IBConnectionManager", "IBDataService",
           "TWS_LIVE_PORT", "TWS_PAPER_PORT", "GATEWAY_LIVE_PORT", "GATEWAY_PAPER_PORT"]
