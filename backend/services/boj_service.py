"""
BOJ — Bank of Japan.
STUB ONLY — Bridge not built.

Manual upload fallback available via DataUploadModal.
"""

from __future__ import annotations

from backend.models.macro_models import BridgeStatus, MacroDataPoint


class BOJService:
    """BOJ data bridge — STUB. Returns bridge_status: not_built."""

    async def get_boj_policy_rate(self) -> list[MacroDataPoint]:
        raise NotImplementedError(
            "BOJ bridge not built. Use manual upload for Japan rate data."
        )

    async def get_boj_outlook_report(self) -> dict:
        raise NotImplementedError(
            "BOJ Outlook Report parsing not built. Download from boj.or.jp manually."
        )

    async def get_bridge_status(self) -> BridgeStatus:
        return BridgeStatus(
            source_name="boj",
            status="not_built",
            series_count=2,
            last_error="BOJ API integration not built. Use manual upload fallback.",
        )


boj_service = BOJService()
