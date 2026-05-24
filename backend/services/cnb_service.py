"""
CNB — Czech National Bank.
Base URL: https://www.cnb.cz/cnb/STAT.ARADY_PKG
No API key required.

CNB Inflation Reports (fan chart data) are among the best central bank
forecast publications globally. Published quarterly. Download from:
  cnb.cz/cs/menova-politika/prognoza/

Bridge status: NOT_BUILT — wire in Phase 6.
"""

from __future__ import annotations

from backend.models.macro_models import BridgeStatus, MacroDataPoint


class CNBService:
    """CNB data bridge — NOT YET BUILT."""

    async def get_cnb_policy_rate(self) -> list[MacroDataPoint]:
        """Fetch CNB 2-week repo rate history."""
        raise NotImplementedError("CNBService.get_cnb_policy_rate not yet implemented.")

    async def get_cnb_forecast(self, edition: str, indicator: str) -> list:
        """Fetch CNB forecast from Inflation Report XLS (manual upload fallback)."""
        raise NotImplementedError("CNBService.get_cnb_forecast not yet implemented.")

    async def list_cnb_forecast_editions(self) -> list[str]:
        return []

    async def get_cnb_decision_calendar(self) -> list[dict]:
        """Return CNB Board meeting dates."""
        raise NotImplementedError("CNBService.get_cnb_decision_calendar not yet implemented.")

    async def get_bridge_status(self) -> BridgeStatus:
        return BridgeStatus(
            source_name="cnb_api",
            status="not_built",
            series_count=2,
            last_error="CNB bridge not yet implemented. Wire in Phase 6.",
        )


cnb_service = CNBService()
