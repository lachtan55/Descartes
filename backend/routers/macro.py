"""
Macro router — all /api/macro/* endpoints.

Phases implemented:
  Phase 1-3: Catalog CRUD, bridge status, AI models list, mock region data
  Phase 4+:  Live data routes (wire to services when bridges are built)
"""

from __future__ import annotations

from datetime import datetime, date

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from backend.models.macro_models import (
    AIModelInfo,
    AIReportRequest,
    BridgeStatus,
    CPIData,
    ForecastEntry,
    GDPData,
    HighlightedDocument,
    MacroDataPoint,
    MacroReport,
    MacroSeries,
    OutlookTable,
    RatesData,
    UploadResult,
)
from backend.services.macro_catalog_service import catalog_service
from backend.services.macro_ai_service import macro_ai_service
from backend.services.tag_mapping_service import tag_mapping_service

router = APIRouter(prefix="/api/macro", tags=["macro"])


# ── Catalog ────────────────────────────────────────────────────────────────────

@router.get("/catalog", response_model=list[MacroSeries])
def get_catalog(
    region: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    active_only: bool = Query(False),
):
    return catalog_service.get_catalog(
        region=region, category=category,
        status=status, search=search,
        active_only=active_only,
    )


@router.get("/catalog/{series_id}", response_model=MacroSeries)
def get_series(series_id: str):
    return catalog_service.get_series_metadata(series_id)


@router.post("/catalog", response_model=MacroSeries, status_code=201)
def create_series(series: MacroSeries):
    # Check for duplicate
    existing = catalog_service.get_catalog()
    if any(s.id == series.id for s in existing):
        raise HTTPException(status_code=409, detail=f"Series '{series.id}' already exists")
    series.is_core = False  # user-created series are never core
    return catalog_service.upsert_series(series)


@router.put("/catalog/{series_id}", response_model=MacroSeries)
def update_series(series_id: str, series: MacroSeries):
    if series_id != series.id:
        raise HTTPException(status_code=422, detail="series_id in path must match series.id in body")
    return catalog_service.upsert_series(series)


@router.delete("/catalog/{series_id}")
def delete_series(series_id: str):
    catalog_service.delete_series(series_id)
    return {"deleted": series_id}


class ToggleActiveBody(BaseModel):
    active: bool


@router.patch("/catalog/{series_id}/active")
def toggle_series_active(series_id: str, body: ToggleActiveBody):
    return catalog_service.toggle_active(series_id, body.active)


# ── Data ───────────────────────────────────────────────────────────────────────

@router.get("/data/{series_id}", response_model=list[MacroDataPoint])
def get_series_data(series_id: str, n: int = Query(20, ge=1, le=500)):
    """Return last N data points for a series (mock data until bridges built)."""
    return catalog_service.get_last_n_datapoints(series_id, n)


@router.post("/refresh/{series_id}")
def trigger_refresh(series_id: str):
    """Trigger a data refresh. Returns 503 if bridge not built."""
    series = catalog_service.get_series_metadata(series_id)
    if series.bridge_status == "not_built":
        raise HTTPException(
            status_code=503,
            detail=f"Bridge for '{series.source}' not yet built. Cannot refresh.",
        )
    return {"job_id": f"job_{series_id}_{datetime.utcnow().isoformat()}", "status": "queued"}


# ── Bridge status ──────────────────────────────────────────────────────────────

@router.get("/bridge-status", response_model=list[BridgeStatus])
def get_all_bridge_statuses():
    return list(catalog_service.get_bridge_status_all().values())


# ── Region data (returns mock until bridges built) ─────────────────────────────

@router.get("/gdp/{region}", response_model=GDPData)
def get_gdp(region: str):
    return _get_mock_gdp(region)


@router.get("/cpi/{region}", response_model=CPIData)
def get_cpi(region: str):
    return _get_mock_cpi(region)


@router.get("/rates/{region}", response_model=RatesData)
def get_rates(region: str):
    return _get_mock_rates(region)


@router.get("/outlook/{region}/{indicator}", response_model=OutlookTable)
def get_outlook(region: str, indicator: str):
    return _get_mock_outlook(region, indicator)


# ── Forecast providers ─────────────────────────────────────────────────────────

class CustomProviderRequest(BaseModel):
    provider: str
    provider_label: str
    region: str
    indicator: str
    values: dict[int, float | None]  # year → value
    unit: str


@router.post("/outlook/custom-provider", status_code=201)
def add_custom_provider(req: CustomProviderRequest):
    """Persist a user-defined forecast provider row."""
    # Phase 8 TODO: save to DB/JSON store
    return {"status": "ok", "provider": req.provider}


@router.delete("/outlook/custom-provider/{provider_id}")
def delete_custom_provider(provider_id: str, region: str = Query(...)):
    _LOCKED = {"imf", "world_bank", "oecd", "ecb", "fed", "boj", "pboc", "cnb", "bundesbank"}
    if provider_id in _LOCKED:
        raise HTTPException(
            status_code=403,
            detail=f"'{provider_id}' is a locked default provider for this region and cannot be removed.",
        )
    return {"deleted": provider_id}


# ── AI ────────────────────────────────────────────────────────────────────────

@router.get("/ai-models", response_model=list[AIModelInfo])
def get_ai_models():
    """Returns only models whose API key is configured in .env."""
    return macro_ai_service.get_available_models()


@router.post("/ai-report", response_model=MacroReport)
async def generate_ai_report(req: AIReportRequest):
    return await macro_ai_service.generate_report(req)


# ── Highlighted documents ──────────────────────────────────────────────────────

@router.get("/highlighted-docs/{region}", response_model=list[HighlightedDocument])
async def get_highlighted_docs(region: str):
    """
    Returns starred documents with a MACRO tag matching the region.
    The frontend also queries PocketBase directly — this endpoint provides
    a server-side aggregation alternative (Phase 7).
    """
    return await tag_mapping_service.get_highlighted_docs(region)


# ── WEO editions ───────────────────────────────────────────────────────────────

@router.get("/weo-editions")
async def list_weo_editions():
    from backend.services.imf_service import imf_service
    return await imf_service.list_editions()


@router.post("/weo-editions", status_code=201)
async def upload_weo_edition(
    file: UploadFile = File(...),
    edition_label: str = Query(..., description="e.g. 'Apr2025'"),
):
    """Upload a WEO CSV file. Phase 5 TODO: parse and store."""
    raise HTTPException(
        status_code=501,
        detail="WEO CSV upload not yet implemented. Wire in Phase 5.",
    )


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload/{series_id}", response_model=UploadResult)
async def upload_series_data(series_id: str, file: UploadFile = File(...)):
    """Manual CSV/XLSX upload for bridge_status=manual series. Phase 8 TODO."""
    raise HTTPException(
        status_code=501,
        detail="Manual data upload not yet implemented. Wire in Phase 8.",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK DATA GENERATORS — replaced by live data in Phase 4+
# ═══════════════════════════════════════════════════════════════════════════════

def _dp(d: str, value: float) -> MacroDataPoint:
    """Create a MacroDataPoint with an auto-generated chart label."""
    dt = date.fromisoformat(d)
    # e.g. "Q1'22" for quarterly, "Jan'22" for monthly, "2022" for annual
    month = dt.month
    if month in (1, 2, 3):
        label = f"Q1'{dt.strftime('%y')}"
    elif month in (4, 5, 6):
        label = f"Q2'{dt.strftime('%y')}"
    elif month in (7, 8, 9):
        label = f"Q3'{dt.strftime('%y')}"
    else:
        label = f"Q4'{dt.strftime('%y')}"
    return MacroDataPoint(date=d, value=value, label=label)


def _get_mock_gdp(region: str) -> GDPData:
    MOCK: dict[str, tuple[list, list]] = {
        "US": (
            [_dp(d, v) for d, v in [
                ("2020-01-01", 21480), ("2020-04-01", 19637), ("2020-07-01", 21170),
                ("2020-10-01", 21494), ("2021-01-01", 22017), ("2021-04-01", 22741),
                ("2021-07-01", 23202), ("2021-10-01", 24004), ("2022-01-01", 24385),
                ("2022-04-01", 24599), ("2022-07-01", 25248), ("2022-10-01", 26136),
                ("2023-01-01", 26465), ("2023-04-01", 27057), ("2023-07-01", 27610),
                ("2023-10-01", 28135), ("2024-01-01", 28494), ("2024-04-01", 28828),
                ("2024-07-01", 29340), ("2024-10-01", 29720),
            ]],
            [_dp(d, v) for d, v in [
                ("2020-01-01", -5.0), ("2020-04-01", -28.1), ("2020-07-01", 34.8),
                ("2020-10-01", 4.5), ("2021-01-01", 6.3), ("2021-04-01", 6.7),
                ("2021-07-01", 2.3), ("2021-10-01", 7.0), ("2022-01-01", -1.6),
                ("2022-04-01", -0.6), ("2022-07-01", 3.2), ("2022-10-01", 2.6),
                ("2023-01-01", 2.2), ("2023-04-01", 2.4), ("2023-07-01", 4.9),
                ("2023-10-01", 3.4), ("2024-01-01", 1.6), ("2024-04-01", 3.1),
                ("2024-07-01", 2.8), ("2024-10-01", 2.3),
            ]],
        ),
        "Eurozone": (
            [_dp(d, v) for d, v in [
                ("2020-01-01", 2990), ("2021-01-01", 3140), ("2022-01-01", 3400),
                ("2023-01-01", 3540), ("2024-01-01", 3620),
            ]],
            [_dp(d, v) for d, v in [
                ("2022-01-01", 0.5), ("2022-04-01", 0.8), ("2022-07-01", 0.4),
                ("2022-10-01", -0.1), ("2023-01-01", 0.0), ("2023-04-01", 0.1),
                ("2023-07-01", -0.1), ("2023-10-01", 0.0), ("2024-01-01", 0.3),
                ("2024-04-01", 0.4), ("2024-07-01", 0.2), ("2024-10-01", 0.3),
            ]],
        ),
        "Germany": (
            [_dp(d, v) for d, v in [
                ("2019-01-01", 3473), ("2020-01-01", 3332), ("2021-01-01", 3601),
                ("2022-01-01", 3869), ("2023-01-01", 4082), ("2024-01-01", 4190),
            ]],
            [_dp(d, v) for d, v in [
                ("2022-01-01", 0.8), ("2022-04-01", 0.1), ("2022-07-01", 0.4),
                ("2022-10-01", -0.4), ("2023-01-01", -0.3), ("2023-04-01", 0.0),
                ("2023-07-01", -0.1), ("2023-10-01", 0.0), ("2024-01-01", -0.2),
                ("2024-04-01", 0.1), ("2024-07-01", -0.3), ("2024-10-01", 0.1),
            ]],
        ),
        "China": (
            [_dp(d, v) for d, v in [
                ("2019-01-01", 98.9), ("2020-01-01", 101.6), ("2021-01-01", 114.4),
                ("2022-01-01", 120.5), ("2023-01-01", 126.1), ("2024-01-01", 134.9),
            ]],
            [_dp(d, v) for d, v in [
                ("2022-01-01", 4.8), ("2022-04-01", 0.4), ("2022-07-01", 3.9),
                ("2022-10-01", 2.9), ("2023-01-01", 4.5), ("2023-04-01", 6.3),
                ("2023-07-01", 4.9), ("2023-10-01", 5.2), ("2024-01-01", 5.3),
                ("2024-04-01", 4.7), ("2024-07-01", 4.6), ("2024-10-01", 5.0),
            ]],
        ),
        "Japan": (
            [_dp(d, v) for d, v in [
                ("2019-01-01", 557), ("2020-01-01", 537), ("2021-01-01", 553),
                ("2022-01-01", 591), ("2023-01-01", 591), ("2024-01-01", 605),
            ]],
            [_dp(d, v) for d, v in [
                ("2022-01-01", 0.1), ("2022-04-01", -0.1), ("2022-07-01", 1.1),
                ("2022-10-01", -0.3), ("2023-01-01", 0.5), ("2023-04-01", 1.3),
                ("2023-07-01", -0.8), ("2023-10-01", 0.1), ("2024-01-01", -0.6),
                ("2024-04-01", 0.8), ("2024-07-01", 0.7), ("2024-10-01", 0.3),
            ]],
        ),
        "Czechia": (
            [_dp(d, v) for d, v in [
                ("2019-01-01", 5793), ("2020-01-01", 5657), ("2021-01-01", 6054),
                ("2022-01-01", 6793), ("2023-01-01", 7244), ("2024-01-01", 7550),
            ]],
            [_dp(d, v) for d, v in [
                ("2022-01-01", 0.4), ("2022-04-01", 0.7), ("2022-07-01", 0.4),
                ("2022-10-01", -0.4), ("2023-01-01", -0.2), ("2023-04-01", 0.0),
                ("2023-07-01", 0.3), ("2023-10-01", 0.5), ("2024-01-01", 0.4),
                ("2024-04-01", 0.6), ("2024-07-01", 0.3), ("2024-10-01", 0.5),
            ]],
        ),
    }
    if region not in MOCK:
        # Return empty data for unknown regions
        return GDPData(region=region, nominal=[], growth=[])
    nominal, growth = MOCK[region]
    return GDPData(region=region, nominal=nominal, growth=growth)


def _get_mock_cpi(region: str) -> CPIData:
    MOCK_CPI: dict[str, list[tuple[str, float]]] = {
        "US": [("2020-01-01", 2.5), ("2020-07-01", 1.0), ("2021-01-01", 1.4), ("2021-07-01", 5.4),
               ("2022-01-01", 7.5), ("2022-07-01", 8.5), ("2022-10-01", 7.7), ("2023-01-01", 6.4),
               ("2023-04-01", 4.9), ("2023-07-01", 3.2), ("2023-10-01", 3.2), ("2024-01-01", 3.1),
               ("2024-04-01", 3.4), ("2024-07-01", 2.9), ("2024-10-01", 2.6)],
        "Eurozone": [("2021-01-01", 0.9), ("2021-07-01", 2.2), ("2022-01-01", 5.1),
                     ("2022-07-01", 8.9), ("2023-01-01", 8.6), ("2023-07-01", 5.3),
                     ("2024-01-01", 2.8), ("2024-07-01", 2.6), ("2024-10-01", 2.3)],
        "Germany": [("2021-01-01", 1.0), ("2021-07-01", 3.8), ("2022-01-01", 5.1),
                    ("2022-07-01", 8.5), ("2023-01-01", 9.2), ("2023-07-01", 6.2),
                    ("2024-01-01", 2.9), ("2024-07-01", 2.6), ("2024-10-01", 2.0)],
        "China": [("2020-01-01", 5.4), ("2021-01-01", -0.3), ("2022-01-01", 0.9),
                  ("2022-07-01", 2.7), ("2023-01-01", 2.1), ("2023-07-01", -0.3),
                  ("2024-01-01", -0.8), ("2024-07-01", 0.5), ("2024-10-01", 0.3)],
        "Japan": [("2021-01-01", -0.6), ("2022-01-01", 0.5), ("2022-07-01", 2.4),
                  ("2023-01-01", 4.3), ("2023-07-01", 3.3), ("2024-01-01", 2.5),
                  ("2024-07-01", 2.8), ("2024-10-01", 2.3)],
        "Czechia": [("2021-01-01", 2.2), ("2022-01-01", 9.9), ("2022-07-01", 17.5),
                    ("2023-01-01", 15.0), ("2023-07-01", 8.8), ("2024-01-01", 2.8),
                    ("2024-07-01", 2.2), ("2024-10-01", 2.6)],
    }
    MOCK_CORE: dict[str, list[tuple[str, float]]] = {
        "US": [("2021-01-01", 1.4), ("2022-01-01", 5.9), ("2022-07-01", 5.9),
               ("2023-01-01", 5.6), ("2023-07-01", 4.7), ("2024-01-01", 3.9),
               ("2024-07-01", 3.2), ("2024-10-01", 3.3)],
    }
    def _pts(items: list[tuple[str, float]]) -> list[MacroDataPoint]:
        return [_dp(d, v) for d, v in (items or [])]

    cpi_data = MOCK_CPI.get(region, [])
    core_data = MOCK_CORE.get(region, [])

    return CPIData(
        region=region,
        cpi=_pts(cpi_data),
        core_cpi=_pts(core_data),
    )


def _get_mock_rates(region: str) -> RatesData:
    POLICY: dict[str, list[tuple[str, float]]] = {
        "US": [("2020-01-01", 1.75), ("2020-03-16", 0.25), ("2021-01-01", 0.13),
               ("2022-03-17", 0.38), ("2022-05-05", 0.88), ("2022-06-16", 1.63),
               ("2022-07-28", 2.38), ("2022-09-22", 3.13), ("2022-11-03", 3.88),
               ("2022-12-15", 4.38), ("2023-02-02", 4.63), ("2023-03-23", 4.88),
               ("2023-05-04", 5.13), ("2023-07-27", 5.38), ("2024-09-19", 5.00),
               ("2024-11-07", 4.75), ("2024-12-19", 4.50), ("2025-01-30", 4.25)],
        "Eurozone": [("2019-09-18", -0.50), ("2022-07-27", 0.00), ("2022-09-14", 0.75),
                     ("2022-11-02", 1.50), ("2022-12-14", 2.00), ("2023-02-02", 2.50),
                     ("2023-03-22", 3.00), ("2023-05-04", 3.25), ("2023-06-15", 3.50),
                     ("2023-09-14", 4.00), ("2024-06-06", 3.75), ("2024-09-12", 3.50),
                     ("2024-10-17", 3.25), ("2024-12-12", 3.00), ("2025-01-30", 2.75),
                     ("2025-03-06", 2.50)],
        "Germany": [("2022-07-27", 0.00), ("2023-09-14", 4.00), ("2024-06-06", 3.75),
                    ("2025-03-06", 2.50)],  # ECB rate applies
        "China": [("2019-08-20", 4.25), ("2020-02-20", 4.05), ("2022-05-20", 3.70),
                  ("2023-06-20", 3.55), ("2023-08-21", 3.45), ("2024-07-22", 3.35),
                  ("2024-10-21", 3.10)],
        "Japan": [("2016-02-16", -0.10), ("2024-03-19", 0.10), ("2024-07-31", 0.25)],
        "Czechia": [("2020-05-11", 0.25), ("2022-02-03", 4.25), ("2022-06-22", 7.00),
                    ("2022-08-04", 7.00), ("2023-06-22", 7.00), ("2023-12-21", 6.75),
                    ("2024-02-08", 6.25), ("2024-03-21", 5.75), ("2024-05-02", 5.25),
                    ("2024-06-27", 4.75), ("2024-08-01", 4.50), ("2024-09-26", 4.25),
                    ("2024-11-07", 4.00), ("2024-12-19", 3.75)],
    }
    YIELD_2Y: dict[str, list[tuple[str, float]]] = {
        "US": [("2022-01-01", 0.82), ("2022-07-01", 2.84), ("2022-10-01", 4.27),
               ("2023-01-01", 4.42), ("2023-07-01", 5.00), ("2024-01-01", 4.43),
               ("2024-07-01", 4.75), ("2024-10-01", 3.97), ("2025-01-01", 4.28)],
    }
    YIELD_10Y: dict[str, list[tuple[str, float]]] = {
        "US": [("2022-01-01", 1.63), ("2022-07-01", 3.01), ("2022-10-01", 4.21),
               ("2023-01-01", 3.87), ("2023-07-01", 4.01), ("2024-01-01", 3.97),
               ("2024-07-01", 4.42), ("2024-10-01", 4.28), ("2025-01-01", 4.60)],
    }

    def _pts(items: list[tuple[str, float]]) -> list[MacroDataPoint]:
        return [_dp(d, v) for d, v in (items or [])]

    return RatesData(
        region=region,
        policy_rate=_pts(POLICY.get(region, [])),
        yield_2y=_pts(YIELD_2Y.get(region, [])),
        yield_10y=_pts(YIELD_10Y.get(region, [])),
    )


def _get_mock_outlook(region: str, indicator: str) -> OutlookTable:
    """Generate a mock forecast outlook table with locked providers."""

    LOCKED: dict[str, list[str]] = {
        "US":       ["imf", "world_bank", "oecd", "fed"],
        "China":    ["imf", "world_bank", "pboc"],
        "Eurozone": ["imf", "world_bank", "oecd", "ecb"],
        "Germany":  ["imf", "world_bank", "oecd", "ecb", "bundesbank"],
        "Japan":    ["imf", "world_bank", "oecd", "boj"],
        "Czechia":  ["imf", "world_bank", "oecd", "cnb"],
    }

    # values keyed by provider_id → year_str → float
    MOCK_VALUES: dict[str, dict[str, dict[str, dict[str, float]]]] = {
        "US": {
            "gdp_growth": {
                "imf":        {"2025": 2.3, "2026": 2.1, "2027": 1.9},
                "world_bank": {"2025": 2.1, "2026": 1.9, "2027": 1.8},
                "oecd":       {"2025": 2.4, "2026": 2.2, "2027": 2.0},
                "fed":        {"2025": 2.2, "2026": 2.0},
            },
            "cpi": {
                "imf":        {"2025": 2.8, "2026": 2.4, "2027": 2.2},
                "world_bank": {"2025": 3.0, "2026": 2.5},
                "oecd":       {"2025": 2.9, "2026": 2.4},
                "fed":        {"2025": 2.6, "2026": 2.3},
            },
            "policy_rate": {
                "imf":  {"2025": 4.00, "2026": 3.50},
                "oecd": {"2025": 4.00, "2026": 3.25},
                "fed":  {"2025": 3.75, "2026": 3.25},
            },
        },
        "China": {
            "gdp_growth": {
                "imf":        {"2025": 4.6, "2026": 4.5, "2027": 4.3},
                "world_bank": {"2025": 4.5, "2026": 4.4},
                "pboc":       {"2025": 5.0, "2026": 4.8},
            },
            "cpi": {
                "imf":        {"2025": 1.2, "2026": 1.8},
                "world_bank": {"2025": 1.0, "2026": 1.5},
                "pboc":       {"2025": 1.5, "2026": 2.0},
            },
            "policy_rate": {
                "imf":  {"2025": 3.00, "2026": 2.80},
                "pboc": {"2025": 3.00, "2026": 2.75},
            },
        },
        "Eurozone": {
            "gdp_growth": {
                "imf":        {"2025": 1.0, "2026": 1.5, "2027": 1.7},
                "world_bank": {"2025": 0.9, "2026": 1.4},
                "oecd":       {"2025": 1.1, "2026": 1.6},
                "ecb":        {"2025": 0.9, "2026": 1.4, "2027": 1.6},
            },
            "cpi": {
                "imf":        {"2025": 2.3, "2026": 2.0},
                "oecd":       {"2025": 2.4, "2026": 2.0},
                "ecb":        {"2025": 2.3, "2026": 1.9},
            },
            "policy_rate": {
                "ecb":  {"2025": 2.00, "2026": 1.75},
                "imf":  {"2025": 2.25, "2026": 2.00},
                "oecd": {"2025": 2.00, "2026": 1.75},
            },
        },
        "Germany": {
            "gdp_growth": {
                "imf":        {"2025": 0.3, "2026": 1.1, "2027": 1.4},
                "world_bank": {"2025": 0.2, "2026": 1.0},
                "oecd":       {"2025": 0.4, "2026": 1.2},
                "ecb":        {"2025": 0.3, "2026": 1.1},
                "bundesbank": {"2025": 0.2, "2026": 1.3},
            },
            "cpi": {
                "imf":        {"2025": 2.2, "2026": 2.0},
                "oecd":       {"2025": 2.3, "2026": 2.0},
                "bundesbank": {"2025": 2.1, "2026": 1.9},
            },
            "policy_rate": {
                "ecb":        {"2025": 2.00, "2026": 1.75},
                "imf":        {"2025": 2.25, "2026": 2.00},
            },
        },
        "Japan": {
            "gdp_growth": {
                "imf":        {"2025": 1.1, "2026": 0.9, "2027": 0.8},
                "world_bank": {"2025": 1.0, "2026": 0.8},
                "oecd":       {"2025": 1.2, "2026": 1.0},
                "boj":        {"2025": 1.0, "2026": 1.0},
            },
            "cpi": {
                "imf":  {"2025": 2.4, "2026": 2.0},
                "oecd": {"2025": 2.5, "2026": 2.1},
                "boj":  {"2025": 2.4, "2026": 2.1},
            },
            "policy_rate": {
                "imf":  {"2025": 0.75, "2026": 1.00},
                "boj":  {"2025": 0.50, "2026": 0.75},
                "oecd": {"2025": 0.50, "2026": 0.75},
            },
        },
        "Czechia": {
            "gdp_growth": {
                "imf":        {"2025": 2.2, "2026": 2.7},
                "world_bank": {"2025": 2.0, "2026": 2.5},
                "oecd":       {"2025": 2.3, "2026": 2.8},
                "cnb":        {"2025": 2.5, "2026": 2.9},
            },
            "cpi": {
                "imf":  {"2025": 2.5, "2026": 2.3},
                "oecd": {"2025": 2.6, "2026": 2.4},
                "cnb":  {"2025": 2.4, "2026": 2.2},
            },
            "policy_rate": {
                "cnb":  {"2025": 3.50, "2026": 3.00},
                "imf":  {"2025": 3.75, "2026": 3.25},
                "oecd": {"2025": 3.50, "2026": 3.00},
            },
        },
    }

    PROVIDER_LABELS: dict[str, str] = {
        "imf": "IMF Apr 2025 WEO", "world_bank": "World Bank Mar 2025",
        "oecd": "OECD Mar 2025", "fed": "Fed SEP Mar 2025",
        "ecb": "ECB Mar 2025 Proj.", "bundesbank": "Bundesbank Dec 2024",
        "boj": "BOJ Jan 2025 Outlook", "pboc": "PBOC 2025",
        "cnb": "CNB Feb 2025 IR",
    }
    PROVIDER_COLORS: dict[str, str] = {
        "imf": "#4285F4", "world_bank": "#34A853", "oecd": "#FBBC05",
        "fed": "#1565C0", "ecb": "#003087", "bundesbank": "#CC0000",
        "boj": "#CC0000", "pboc": "#DD0000", "cnb": "#0057A5",
    }

    locked_providers = LOCKED.get(region, ["imf", "world_bank", "oecd"])
    region_data = MOCK_VALUES.get(region, MOCK_VALUES["US"])
    indicator_data = region_data.get(indicator, region_data.get("gdp_growth", {}))

    years = ["2025", "2026", "2027"]
    entries: list[ForecastEntry] = []
    values_by_year: dict[str, list[float]] = {y: [] for y in years}

    for prov_id in locked_providers:
        prov_vals = indicator_data.get(prov_id, {})
        # Build values dict padded with None for missing years
        row_values: dict[str, float | None] = {y: prov_vals.get(y) for y in years}
        entries.append(ForecastEntry(
            provider_id=prov_id,
            provider_label=PROVIDER_LABELS.get(prov_id, prov_id.upper()),
            color=PROVIDER_COLORS.get(prov_id, "#888888"),
            is_locked=True,
            values=row_values,
            vintage=PROVIDER_LABELS.get(prov_id),
        ))
        for y in years:
            v = prov_vals.get(y)
            if v is not None:
                values_by_year[y].append(v)

    # Compute consensus (median), high, low per year
    def _median(lst: list[float]) -> float | None:
        if not lst:
            return None
        s = sorted(lst)
        return s[len(s) // 2]

    consensus = {y: _median(values_by_year[y]) for y in years}
    high = {y: (max(values_by_year[y]) if values_by_year[y] else None) for y in years}
    low  = {y: (min(values_by_year[y]) if values_by_year[y] else None) for y in years}

    return OutlookTable(
        region=region,
        indicator=indicator,
        years=years,
        entries=entries,
        consensus=consensus,
        high=high,
        low=low,
    )
