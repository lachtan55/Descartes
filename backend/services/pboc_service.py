"""
PBOC — People's Bank of China.
STUB ONLY — Bridge not built.

Note: China data always has data_quality="official_nbs" and china_disclaimer=True.
Manual upload fallback available via DataUploadModal.
"""

from __future__ import annotations

from backend.models.macro_models import BridgeStatus, MacroDataPoint


class PBOCService:
    """PBOC data bridge — STUB. Returns bridge_status: not_built."""

    async def get_pboc_lpr(self) -> list[MacroDataPoint]:
        raise NotImplementedError(
            "PBOC bridge not built. Use manual upload for China rate data."
        )

    async def get_bridge_status(self) -> BridgeStatus:
        return BridgeStatus(
            source_name="pboc",
            status="not_built",
            series_count=2,
            last_error="PBOC API integration not built. Use manual upload fallback.",
        )


pboc_service = PBOCService()
