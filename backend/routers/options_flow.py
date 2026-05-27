"""
Options flow router — all /api/options/* endpoints.

Exposes:
  GET  /api/options/chain      — Bloomberg OPT_CHAIN lookup
  POST /api/options/subscribe  — Real-time tick collection (blocking, Phase 5 → WebSocket)

All endpoints return HTTP 503 if the Bloomberg Terminal is not reachable
or the blpapi package is not installed.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query

from backend.models.options_models import (
    ChainRequest,
    ChainResponse,
    FlowRequest,
    FlowResponse,
)
from backend.services.blpapi_options_service import options_flow_service

router = APIRouter(prefix="/api/options", tags=["options"])


# ── Chain lookup ───────────────────────────────────────────────────────────────

@router.get(
    "/chain",
    response_model=ChainResponse,
    summary="Bloomberg options chain lookup",
    description=(
        "Fetches the options chain for the given underlying via Bloomberg DAPI "
        "(OPT_CHAIN reference-data field). Supports equity and commodity underlyings. "
        "Returns HTTP 503 if the Bloomberg Terminal is not connected."
    ),
)
def get_chain(
    underlying: str = Query(
        ...,
        description="Bloomberg security string, e.g. 'AAPL US Equity' or 'GC1 Comdty'.",
    ),
    expiry_yyyymmdd: str | None = Query(
        None,
        description="YYYYMMDD expiry filter (CHAIN_DATE override). Omit for full chain.",
    ),
    put_call: str | None = Query(
        None,
        description="'C' calls only / 'P' puts only (CHAIN_PUT_CALL override). Omit for all.",
    ),
) -> ChainResponse:
    try:
        tickers = options_flow_service.get_options_chain(
            underlying, expiry_yyyymmdd, put_call
        )
        return ChainResponse(underlying=underlying, tickers=tickers)
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="Bloomberg terminal not connected",
        )


# ── Real-time subscription ─────────────────────────────────────────────────────

@router.post(
    "/subscribe",
    response_model=FlowResponse,
    summary="Collect real-time options tick flow",
    description=(
        "Subscribes to Bloomberg DAPI market-data for the supplied option tickers "
        "and collects ticks for `duration_seconds`, then returns them all. "
        "Returns HTTP 503 if the Bloomberg Terminal is not connected."
    ),
)
async def subscribe_flow(body: FlowRequest) -> FlowResponse:
    # WIP — blocking call, replace with WebSocket in Phase 5
    loop = asyncio.get_running_loop()
    try:
        ticks = await loop.run_in_executor(
            None,
            lambda: options_flow_service.subscribe_options_flow(
                body.tickers,
                body.duration_seconds,
            ),
        )
        return FlowResponse(ticks=ticks)
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="Bloomberg terminal not connected",
        )
