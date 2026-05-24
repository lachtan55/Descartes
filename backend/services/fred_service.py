"""
FRED API client — primary source for US macro data.

Base URL: https://api.stlouisfed.org/fred/
Free API key: https://fred.stlouisfed.org/docs/api/api_key.html

Bridge status: NOT_BUILT — connect in Phase 4.

Series ID mapping:
  GDP               → us_gdp_nominal_q
  A191RL1Q225SBEA   → us_gdp_growth_q
  CPIAUCSL          → us_cpi_monthly
  CPILFESL          → us_core_cpi_monthly
  PPIACO            → us_ppi_monthly
  FEDFUNDS          → us_fed_funds_rate
  DGS2              → us_yield_2y
  DGS10             → us_yield_10y
"""

from __future__ import annotations

import httpx
from datetime import date

from backend.config import FRED_API_KEY
from backend.models.macro_models import BridgeStatus, MacroDataPoint


FRED_BASE_URL = "https://api.stlouisfed.org/fred"

SERIES_MAP: dict[str, str] = {
    "us_gdp_nominal_q":    "GDP",
    "us_gdp_growth_q":     "A191RL1Q225SBEA",
    "us_cpi_monthly":      "CPIAUCSL",
    "us_core_cpi_monthly": "CPILFESL",
    "us_ppi_monthly":      "PPIACO",
    "us_fed_funds_rate":   "FEDFUNDS",
    "us_yield_2y":         "DGS2",
    "us_yield_10y":        "DGS10",
}


class FREDService:
    """FRED data bridge — NOT YET BUILT."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def get_series(
        self,
        series_id: str,
        start: str,
        end: str,
        frequency: str = "m",
    ) -> list[MacroDataPoint]:
        """
        Fetch observations for a FRED series.
        frequency: d=daily, m=monthly, q=quarterly, a=annual
        """
        raise NotImplementedError(
            "FREDService.get_series not yet implemented. "
            "Configure FRED_API_KEY and wire up in Phase 4."
        )

    async def get_bridge_status(self) -> BridgeStatus:
        """Ping FRED API to check connection status."""
        if not FRED_API_KEY:
            return BridgeStatus(
                source_name="fred_api",
                status="not_built",
                last_error="FRED_API_KEY not configured",
                series_count=10,
            )

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{FRED_BASE_URL}/series",
                    params={"series_id": "GDP", "api_key": FRED_API_KEY, "file_type": "json"},
                )
            if resp.status_code == 200:
                return BridgeStatus(source_name="fred_api", status="connected", series_count=10)
            return BridgeStatus(
                source_name="fred_api", status="not_built",
                last_error=f"HTTP {resp.status_code}",
            )
        except Exception as e:
            return BridgeStatus(
                source_name="fred_api", status="not_built",
                last_error=str(e),
            )


fred_service = FREDService()
