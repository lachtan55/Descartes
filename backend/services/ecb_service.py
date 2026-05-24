"""
ECB Statistical Data Warehouse — no API key required.
Base URL: https://data-api.ecb.europa.eu/service/
SDMX REST API — returns JSON.

Key series keys:
  ECB deposit rate: FM.B.U2.EUR.4F.KR.DFR.LEV
  HICP Eurozone:    ICP.M.U2.N.000000.4.INX
  HICP Germany:     ICP.M.DE.N.000000.4.INX

Bridge status: NOT_BUILT — wire in Phase 6.
"""

from __future__ import annotations

import httpx
from backend.models.macro_models import BridgeStatus, MacroDataPoint

ECB_BASE_URL = "https://data-api.ecb.europa.eu/service/data"


class ECBService:
    """ECB SDW data bridge — NOT YET BUILT."""

    async def get_series(
        self,
        series_key: str,
        start: str,
        end: str,
    ) -> list[MacroDataPoint]:
        """
        Fetch time series from ECB SDW.
        series_key: e.g. "FM.B.U2.EUR.4F.KR.DFR.LEV"
        """
        raise NotImplementedError(
            "ECBService.get_series not yet implemented. Wire in Phase 6."
        )

    async def get_ecb_policy_rate(self) -> list[MacroDataPoint]:
        raise NotImplementedError("ECBService.get_ecb_policy_rate not yet implemented.")

    async def get_hicp(self, country_code: str) -> list[MacroDataPoint]:
        """country_code: 'U2' for Eurozone, 'DE' for Germany"""
        raise NotImplementedError("ECBService.get_hicp not yet implemented.")

    async def get_bridge_status(self) -> BridgeStatus:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{ECB_BASE_URL}/FM.B.U2.EUR.4F.KR.DFR.LEV",
                    params={"format": "jsondata", "lastNObservations": 1},
                    headers={"Accept": "application/json"},
                )
            if resp.status_code == 200:
                return BridgeStatus(source_name="ecb_api", status="connected", series_count=5)
        except Exception as e:
            return BridgeStatus(source_name="ecb_api", status="not_built", last_error=str(e))
        return BridgeStatus(source_name="ecb_api", status="not_built")


ecb_service = ECBService()
