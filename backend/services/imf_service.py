"""
IMF World Economic Outlook (WEO) service — no real-time API.

Data must be downloaded as CSV from:
  https://www.imf.org/en/Publications/WEO/weo-database/
Published twice yearly: April + October.

WEO CSV format: columns include ISO country code, WEO subject code,
Subject Descriptor, Units, Scale, and one column per year.
Values may contain commas (thousands separator) and "n/a".

Key WEO subject codes:
  NGDPD       = GDP nominal (USD billions)
  NGDP_RPCH   = GDP growth % (real, year-on-year)
  PCPIPCH     = CPI inflation % change
  PCPIE       = CPI end-of-period
  GGXWDG_NGDP = Public debt % GDP

WEO country codes:
  111=US, 924=China, 163=Germany, 158=Japan,
  935=Euro area, 174=Czech Republic

Bridge status: NOT_BUILT — wire in Phase 5.
"""

from __future__ import annotations

import json
from pathlib import Path
from backend.models.macro_models import BridgeStatus, ForecastEntry

_WEO_STORE = Path(__file__).parent.parent / "weo_editions"


class IMFService:
    """IMF WEO CSV parser and forecast store — NOT YET BUILT."""

    async def parse_weo_csv(self, file_path: str, edition_label: str) -> dict:
        """Parse WEO CSV and return structured dict keyed by (country_code, subject_code, year)."""
        raise NotImplementedError("IMFService.parse_weo_csv not yet implemented. Wire in Phase 5.")

    async def get_forecast(
        self, indicator: str, weo_country_code: str, edition: str
    ) -> list[ForecastEntry]:
        raise NotImplementedError("IMFService.get_forecast not yet implemented.")

    async def get_revision_delta(
        self, indicator: str, country: str, edition1: str, edition2: str
    ) -> dict[int, float]:
        raise NotImplementedError("IMFService.get_revision_delta not yet implemented.")

    async def list_editions(self) -> list[str]:
        if not _WEO_STORE.exists():
            return []
        return [p.stem for p in _WEO_STORE.glob("*.json")]

    async def get_bridge_status(self) -> BridgeStatus:
        editions = await self.list_editions()
        if editions:
            return BridgeStatus(
                source_name="imf_weo_csv",
                status="manual",
                series_count=12,
                last_error=None,
            )
        return BridgeStatus(
            source_name="imf_weo_csv",
            status="not_built",
            series_count=12,
            last_error="No WEO editions uploaded. Download from imf.org/WEO and upload via /macro/weo-editions",
        )


imf_service = IMFService()
