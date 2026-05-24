"""
Pydantic data models for the Macroeconomics page.
Aligned with frontend macro/types.ts expectations.
"""

from __future__ import annotations

from pydantic import BaseModel


# ── Catalog ────────────────────────────────────────────────────────────────────

class MacroSeries(BaseModel):
    id: str
    label: str
    region: str
    category: str           # gdp | inflation | rates | forecasts | custom
    frequency: str          # daily | weekly | monthly | quarterly | annual | meeting_based
    source: str
    bridge_status: str      # connected | stale | manual | not_built
    endpoint: str | None = None
    api_series_code: str | None = None
    unit: str
    currency: str | None = None
    coverage_start: int
    last_updated: str | None = None
    active: bool = True
    data_quality: str = "official"
    notes: str | None = None
    is_core: bool = True
    china_disclaimer: bool = False


# ── Data points ────────────────────────────────────────────────────────────────

class MacroDataPoint(BaseModel):
    """Single data point. `label` is a human-readable X-axis label for charts."""
    date: str          # ISO date string
    value: float
    label: str | None = None   # e.g. "Q1'22", "Jan'24" — for chart X-axis


# ── Aggregate data containers ──────────────────────────────────────────────────

class GDPData(BaseModel):
    region: str
    nominal: list[MacroDataPoint] | None = None
    growth: list[MacroDataPoint] | None = None
    last_updated: str | None = None


class CPIData(BaseModel):
    region: str
    cpi: list[MacroDataPoint] | None = None
    core_cpi: list[MacroDataPoint] | None = None
    last_updated: str | None = None


class RatesData(BaseModel):
    region: str
    policy_rate: list[MacroDataPoint] | None = None
    yield_2y: list[MacroDataPoint] | None = None
    yield_10y: list[MacroDataPoint] | None = None
    last_updated: str | None = None


# ── Forecasts / Outlook ────────────────────────────────────────────────────────

class ForecastEntry(BaseModel):
    """One provider's row in an outlook table."""
    provider_id: str
    provider_label: str            # e.g. "IMF Apr 2025 WEO"
    color: str                     # hex color for chart/table row
    is_locked: bool = False
    values: dict[str, float | None]  # year_str → value, e.g. {"2025": 2.3}
    vintage: str | None = None


class OutlookTable(BaseModel):
    """Multi-provider forecast table for a region × indicator combination."""
    region: str
    indicator: str
    years: list[str]                             # ["2025", "2026", "2027"]
    entries: list[ForecastEntry]
    consensus: dict[str, float | None] | None = None
    high: dict[str, float | None] | None = None
    low: dict[str, float | None] | None = None


# ── Bridge status ──────────────────────────────────────────────────────────────

class BridgeStatus(BaseModel):
    source_name: str
    status: str                 # connected | stale | manual | not_built
    series_count: int = 0
    last_refreshed: str | None = None
    last_error: str | None = None


# ── AI reports ────────────────────────────────────────────────────────────────

class AIReportRequest(BaseModel):
    region: str
    model: str = "claude-sonnet-4-5-20251022"  # full versioned string; verify against Anthropic docs


class MacroReport(BaseModel):
    model: str
    region: str
    content: str
    generated_at: str
    error: str | None = None


# ── Highlighted documents ──────────────────────────────────────────────────────

class HighlightedDocument(BaseModel):
    id: str
    title: str
    data_type: str | None = None
    starred_at: str | None = None
    tags: list[dict] = []
    file_url: str | None = None


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResult(BaseModel):
    series_id: str
    rows_imported: int
    date_range_start: str | None = None
    date_range_end: str | None = None
    bridge_status: str


# ── Models list ───────────────────────────────────────────────────────────────

class AIModelInfo(BaseModel):
    id: str
    label: str
    provider: str
    description: str
    available: bool             # True if API key configured
