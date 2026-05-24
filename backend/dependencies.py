from backend.config import PRICE_DATA_PROVIDER
from backend.providers.base import PriceDataProvider


def get_provider() -> PriceDataProvider:
    if PRICE_DATA_PROVIDER == "ib":
        from backend.services.ib.connection_manager import IBConnectionManager
        from backend.services.ib.data_service import IBDataService
        manager = IBConnectionManager.get_instance()
        return IBDataService(manager)
    from backend.services.yfinance_service import YFinanceService
    return YFinanceService()
