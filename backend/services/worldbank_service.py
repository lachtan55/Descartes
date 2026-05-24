"""
World Bank Open Data API — no API key required.
Base URL: https://api.worldbank.org/v2/
Coverage: Global; annual data, typically lags 1–2 years.

Country codes: USA, CHN, DEU, JPN, CZE, XC (Euro area)
Key indicators:
  NY.GDP.MKTP.CD    = GDP nominal (current USD)
  NY.GDP.MKTP.KD.ZG = GDP growth % (annual)
  FP.CPI.TOTL.ZG    = CPI inflation % (annual)

Bridge status: NOT_BUILT — wire in Phase 5.
"""

from __future__ import annotations

import httpx
from backend.models.macro_models import BridgeStatus, MacroDataPoint

WORLDBANK_BASE_URL = "https://api.worldbank.org/v2"

COUNTRY_CODES: dict[str, str] = {
    "US":       "USA",
    "China":    "CHN",
    "Eurozone": "XC",
    "Germany":  "DEU",
    "Japan":    "JPN",
    "Czechia":  "CZE",
}


class WorldBankService:
    """World Bank data bridge — NOT YET BUILT."""

    async def get_indicator(
        self,
        indicator: str,
        country_code: str,
        start_year: int,
        end_year: int,
    ) -> list[dict]:
        """
        Fetch indicator data from World Bank.
        Response is [metadata, data_array] — parse data_array.
        """
        raise NotImplementedError(
            "WorldBankService.get_indicator not yet implemented. Wire in Phase 5."
        )

    async def get_bridge_status(self) -> BridgeStatus:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{WORLDBANK_BASE_URL}/country/USA/indicator/NY.GDP.MKTP.CD",
                    params={"format": "json", "per_page": 1},
                )
            if resp.status_code == 200:
                return BridgeStatus(source_name="worldbank_api", status="connected", series_count=6)
        except Exception as e:
            return BridgeStatus(source_name="worldbank_api", status="not_built", last_error=str(e))
        return BridgeStatus(source_name="worldbank_api", status="not_built")


worldbank_service = WorldBankService()
