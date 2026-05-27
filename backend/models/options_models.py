"""
Pydantic v2 models for the options flow feature.

Chain lookup and real-time subscription request/response shapes.
TypeScript types for these are NOT auto-generated (options page is Phase 5).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Chain lookup ───────────────────────────────────────────────────────────────

class ChainRequest(BaseModel):
    """Query parameters for GET /api/options/chain."""

    underlying: str = Field(
        ...,
        description=(
            "Bloomberg security identifier, e.g. 'AAPL US Equity' or 'GC1 Comdty'."
        ),
        examples=["AAPL US Equity", "GC1 Comdty"],
    )
    expiry_yyyymmdd: str | None = Field(
        None,
        description=(
            "Restrict the chain to a single expiry date (YYYYMMDD). "
            "Maps to the CHAIN_DATE Bloomberg override. "
            "Omit to retrieve the full chain across all expiries."
        ),
        examples=["20250620", "20251219"],
    )
    put_call: str | None = Field(
        None,
        description=(
            "'C' — calls only.  'P' — puts only.  Omit for all. "
            "Maps to the CHAIN_PUT_CALL Bloomberg override."
        ),
        examples=["C", "P"],
    )


class ChainResponse(BaseModel):
    """Response for GET /api/options/chain."""

    underlying: str = Field(..., description="The underlying security queried.")
    tickers: list[str] = Field(
        ...,
        description="Bloomberg ticker strings for each option in the chain.",
    )


# ── Real-time subscription ─────────────────────────────────────────────────────

class FlowRequest(BaseModel):
    """Request body for POST /api/options/subscribe."""

    tickers: list[str] = Field(
        ...,
        description="Bloomberg option ticker strings to subscribe to.",
        examples=[["AAPL US 01/17/25 C225 Equity", "AAPL US 01/17/25 P225 Equity"]],
    )
    duration_seconds: int = Field(
        30,
        ge=1,
        le=3600,
        description="How long to collect ticks before returning (seconds). Default: 30.",
    )


class FlowResponse(BaseModel):
    """Response for POST /api/options/subscribe."""

    ticks: list[dict] = Field(  # typed more strictly in Phase 5
        ...,
        description=(
            "Collected tick dicts in arrival order. "
            "Each dict contains 'ticker' plus whichever Bloomberg fields were "
            "published for that update (absent fields are omitted, not None)."
        ),
    )
