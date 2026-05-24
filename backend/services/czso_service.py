"""
CZSO — Czech Statistical Office.
Base URL: https://vdb.czso.cz/pll/eweb/
No API key required.

Bridge status: NOT_BUILT — wire in Phase 6.
"""

from __future__ import annotations

from backend.models.macro_models import BridgeStatus, MacroDataPoint


class CZSOService:
    """CZSO data bridge — NOT YET BUILT."""

    async def get_czech_gdp_nominal(self) -> list[MacroDataPoint]:
        raise NotImplementedError("CZSOService.get_czech_gdp_nominal not yet implemented.")

    async def get_czech_gdp_growth(self) -> list[MacroDataPoint]:
        raise NotImplementedError("CZSOService.get_czech_gdp_growth not yet implemented.")

    async def get_czech_cpi(self) -> list[MacroDataPoint]:
        raise NotImplementedError("CZSOService.get_czech_cpi not yet implemented.")

    async def get_bridge_status(self) -> BridgeStatus:
        return BridgeStatus(
            source_name="czso_api",
            status="not_built",
            series_count=3,
            last_error="CZSO bridge not yet implemented. Wire in Phase 6.",
        )


czso_service = CZSOService()
