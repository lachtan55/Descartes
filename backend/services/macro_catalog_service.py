"""
MacroCatalogService — manages the macro series registry.

Pre-DB: reads/writes from macro_catalog.json (mirrors macroCatalog.ts config).
Post-DB: replace file I/O with DB calls; zero route changes required.

On startup: initialises the JSON from the TypeScript config if missing.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

from fastapi import HTTPException

from backend.models.macro_models import (
    BridgeStatus,
    MacroDataPoint,
    MacroSeries,
)

# ── Paths ──────────────────────────────────────────────────────────────────────

_CATALOG_PATH = Path(__file__).parent.parent / "macro_catalog.json"

# ── Default catalog (mirrors macroCatalog.ts) ─────────────────────────────────
# Used to seed macro_catalog.json if it doesn't exist.

_DEFAULT_CATALOG: list[dict] = [
    # US
    {"id": "us_gdp_nominal_q",   "label": "US GDP Nominal (Quarterly)",    "region": "US",       "category": "gdp",       "frequency": "quarterly",    "source": "fred_api",      "bridge_status": "not_built", "unit": "Billions USD SAAR", "currency": "USD", "coverage_start": 1947, "active": True, "data_quality": "official", "is_core": True},
    {"id": "us_gdp_nominal_a",   "label": "US GDP Nominal (Annual)",       "region": "US",       "category": "gdp",       "frequency": "annual",       "source": "fred_api",      "bridge_status": "not_built", "unit": "Billions USD",      "currency": "USD", "coverage_start": 1929, "active": True, "data_quality": "official", "is_core": True},
    {"id": "us_gdp_growth_q",    "label": "US GDP Growth QoQ (Real)",      "region": "US",       "category": "gdp",       "frequency": "quarterly",    "source": "fred_api",      "bridge_status": "not_built", "unit": "% Change SAAR",     "currency": "USD", "coverage_start": 1947, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "A191RL1Q225SBEA"},
    {"id": "us_gdp_growth_a",    "label": "US GDP Growth YoY (Annual)",    "region": "US",       "category": "gdp",       "frequency": "annual",       "source": "fred_api",      "bridge_status": "not_built", "unit": "% Change",          "currency": "USD", "coverage_start": 1930, "active": True, "data_quality": "official", "is_core": True},
    {"id": "us_cpi_monthly",     "label": "US CPI All Items (Monthly)",    "region": "US",       "category": "inflation",  "frequency": "monthly",      "source": "fred_api",      "bridge_status": "not_built", "unit": "Index 1982-84=100", "currency": "USD", "coverage_start": 1947, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "CPIAUCSL"},
    {"id": "us_core_cpi_monthly","label": "US Core CPI (ex Food & Energy)","region": "US",       "category": "inflation",  "frequency": "monthly",      "source": "fred_api",      "bridge_status": "not_built", "unit": "Index 1982-84=100", "currency": "USD", "coverage_start": 1957, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "CPILFESL"},
    {"id": "us_ppi_monthly",     "label": "US PPI Final Demand",           "region": "US",       "category": "inflation",  "frequency": "monthly",      "source": "fred_api",      "bridge_status": "not_built", "unit": "Index 1982=100",    "currency": "USD", "coverage_start": 1913, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "PPIACO"},
    {"id": "us_fed_funds_rate",  "label": "US Federal Funds Rate",         "region": "US",       "category": "rates",      "frequency": "monthly",      "source": "fred_api",      "bridge_status": "not_built", "unit": "%",                 "currency": "USD", "coverage_start": 1954, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "FEDFUNDS"},
    {"id": "us_yield_2y",        "label": "US Treasury 2Y Yield",          "region": "US",       "category": "rates",      "frequency": "daily",        "source": "fred_api",      "bridge_status": "not_built", "unit": "%",                 "currency": "USD", "coverage_start": 1976, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "DGS2"},
    {"id": "us_yield_10y",       "label": "US Treasury 10Y Yield",         "region": "US",       "category": "rates",      "frequency": "daily",        "source": "fred_api",      "bridge_status": "not_built", "unit": "%",                 "currency": "USD", "coverage_start": 1962, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "DGS10"},
    # China
    {"id": "cn_gdp_nominal_a",   "label": "China GDP Nominal (Annual)",    "region": "China",    "category": "gdp",       "frequency": "annual",       "source": "manual_upload", "bridge_status": "not_built", "unit": "Trillion CNY",      "currency": "CNY", "coverage_start": 1978, "active": True, "data_quality": "official", "is_core": True, "china_disclaimer": True},
    {"id": "cn_gdp_growth_q",    "label": "China GDP Growth YoY (Qtly)",   "region": "China",    "category": "gdp",       "frequency": "quarterly",    "source": "manual_upload", "bridge_status": "not_built", "unit": "% YoY",             "currency": "CNY", "coverage_start": 1992, "active": True, "data_quality": "official", "is_core": True, "china_disclaimer": True},
    {"id": "cn_cpi_monthly",     "label": "China CPI (Monthly YoY %)",     "region": "China",    "category": "inflation",  "frequency": "monthly",      "source": "manual_upload", "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 1985, "active": True, "data_quality": "official", "is_core": True, "china_disclaimer": True},
    {"id": "cn_pboc_lpr_1y",     "label": "China PBOC LPR (1Y)",           "region": "China",    "category": "rates",      "frequency": "meeting_based","source": "manual_upload", "bridge_status": "not_built", "unit": "%",                 "coverage_start": 2019, "active": True, "data_quality": "official", "is_core": True, "china_disclaimer": True},
    # Eurozone
    {"id": "eu_gdp_growth_q",    "label": "Eurozone GDP Growth (Qtly)",    "region": "Eurozone", "category": "gdp",       "frequency": "quarterly",    "source": "ecb_api",       "bridge_status": "not_built", "unit": "% QoQ",             "currency": "EUR", "coverage_start": 1995, "active": True, "data_quality": "official", "is_core": True},
    {"id": "eu_hicp_monthly",    "label": "Eurozone HICP Inflation",       "region": "Eurozone", "category": "inflation",  "frequency": "monthly",      "source": "ecb_api",       "bridge_status": "not_built", "unit": "Index 2015=100",    "currency": "EUR", "coverage_start": 1996, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "ICP.M.U2.N.000000.4.INX"},
    {"id": "eu_ecb_deposit_rate","label": "ECB Deposit Facility Rate",     "region": "Eurozone", "category": "rates",      "frequency": "meeting_based","source": "ecb_api",       "bridge_status": "not_built", "unit": "%",                 "currency": "EUR", "coverage_start": 1999, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "FM.B.U2.EUR.4F.KR.DFR.LEV"},
    {"id": "eu_yield_10y_bund",  "label": "Germany 10Y Bund Yield",        "region": "Eurozone", "category": "rates",      "frequency": "daily",        "source": "ecb_api",       "bridge_status": "not_built", "unit": "%",                 "currency": "EUR", "coverage_start": 1993, "active": True, "data_quality": "official", "is_core": False},
    # Germany
    {"id": "de_gdp_nominal_a",   "label": "Germany GDP Nominal (Annual)",  "region": "Germany",  "category": "gdp",       "frequency": "annual",       "source": "worldbank_api", "bridge_status": "not_built", "unit": "Billion EUR",       "currency": "EUR", "coverage_start": 1991, "active": True, "data_quality": "official", "is_core": True},
    {"id": "de_gdp_growth_q",    "label": "Germany GDP Growth (Qtly)",     "region": "Germany",  "category": "gdp",       "frequency": "quarterly",    "source": "ecb_api",       "bridge_status": "not_built", "unit": "% QoQ",             "currency": "EUR", "coverage_start": 1991, "active": True, "data_quality": "official", "is_core": True},
    {"id": "de_hicp_monthly",    "label": "Germany HICP Inflation",        "region": "Germany",  "category": "inflation",  "frequency": "monthly",      "source": "ecb_api",       "bridge_status": "not_built", "unit": "Index 2015=100",    "currency": "EUR", "coverage_start": 1996, "active": True, "data_quality": "official", "is_core": True, "api_series_code": "ICP.M.DE.N.000000.4.INX"},
    # Japan
    {"id": "jp_gdp_nominal_a",   "label": "Japan GDP Nominal (Annual)",    "region": "Japan",    "category": "gdp",       "frequency": "annual",       "source": "manual_upload", "bridge_status": "not_built", "unit": "Trillion JPY",      "currency": "JPY", "coverage_start": 1994, "active": True, "data_quality": "official", "is_core": True},
    {"id": "jp_gdp_growth_q",    "label": "Japan GDP Growth (Qtly)",       "region": "Japan",    "category": "gdp",       "frequency": "quarterly",    "source": "manual_upload", "bridge_status": "not_built", "unit": "% QoQ",             "currency": "JPY", "coverage_start": 1994, "active": True, "data_quality": "official", "is_core": True},
    {"id": "jp_cpi_monthly",     "label": "Japan CPI (Monthly YoY %)",     "region": "Japan",    "category": "inflation",  "frequency": "monthly",      "source": "manual_upload", "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 1970, "active": True, "data_quality": "official", "is_core": True},
    {"id": "jp_boj_policy_rate", "label": "Japan BOJ Policy Rate",         "region": "Japan",    "category": "rates",      "frequency": "meeting_based","source": "manual_upload", "bridge_status": "not_built", "unit": "%",                 "coverage_start": 1998, "active": True, "data_quality": "official", "is_core": True},
    # Czechia
    {"id": "cz_gdp_nominal_a",   "label": "Czechia GDP Nominal (Annual)",  "region": "Czechia",  "category": "gdp",       "frequency": "annual",       "source": "czso_api",      "bridge_status": "not_built", "unit": "Billion CZK",       "currency": "CZK", "coverage_start": 1995, "active": True, "data_quality": "official", "is_core": True},
    {"id": "cz_gdp_growth_q",    "label": "Czechia GDP Growth (Qtly)",     "region": "Czechia",  "category": "gdp",       "frequency": "quarterly",    "source": "czso_api",      "bridge_status": "not_built", "unit": "% QoQ",             "currency": "CZK", "coverage_start": 1996, "active": True, "data_quality": "official", "is_core": True},
    {"id": "cz_cpi_monthly",     "label": "Czechia CPI (Monthly YoY %)",   "region": "Czechia",  "category": "inflation",  "frequency": "monthly",      "source": "czso_api",      "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 1993, "active": True, "data_quality": "official", "is_core": True},
    {"id": "cz_cnb_repo_rate",   "label": "Czechia CNB 2W Repo Rate",      "region": "Czechia",  "category": "rates",      "frequency": "meeting_based","source": "cnb_api",       "bridge_status": "not_built", "unit": "%",                 "coverage_start": 1993, "active": True, "data_quality": "official", "is_core": True},
    # Forecast series
    {"id": "imf_weo_us_gdp_growth","label": "IMF WEO — US GDP Growth",     "region": "US",       "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_us_cpi",     "label": "IMF WEO — US CPI Forecast",     "region": "US",       "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_cn_gdp_growth","label": "IMF WEO — China GDP Growth",  "region": "China",    "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True, "china_disclaimer": True},
    {"id": "imf_weo_cn_cpi",     "label": "IMF WEO — China CPI Forecast",  "region": "China",    "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True, "china_disclaimer": True},
    {"id": "imf_weo_eu_gdp_growth","label": "IMF WEO — Eurozone GDP Growth","region": "Eurozone","category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_eu_cpi",     "label": "IMF WEO — Eurozone CPI",        "region": "Eurozone", "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_de_gdp_growth","label": "IMF WEO — Germany GDP Growth","region": "Germany",  "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_de_cpi",     "label": "IMF WEO — Germany CPI",         "region": "Germany",  "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_jp_gdp_growth","label": "IMF WEO — Japan GDP Growth",  "region": "Japan",    "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_jp_cpi",     "label": "IMF WEO — Japan CPI",           "region": "Japan",    "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_cz_gdp_growth","label": "IMF WEO — Czechia GDP Growth","region": "Czechia",  "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% Real YoY",        "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
    {"id": "imf_weo_cz_cpi",     "label": "IMF WEO — Czechia CPI",         "region": "Czechia",  "category": "forecasts",  "frequency": "annual",       "source": "imf_weo_csv",   "bridge_status": "not_built", "unit": "% YoY",             "coverage_start": 2020, "active": True, "data_quality": "modeled",  "is_core": True},
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_catalog() -> list[dict]:
    if not _CATALOG_PATH.exists():
        _CATALOG_PATH.write_text(json.dumps(_DEFAULT_CATALOG, indent=2))
    return json.loads(_CATALOG_PATH.read_text())


def _save_catalog(catalog: list[dict]) -> None:
    _CATALOG_PATH.write_text(json.dumps(catalog, indent=2, default=str))


# ── Service ────────────────────────────────────────────────────────────────────

class MacroCatalogService:

    def get_catalog(
        self,
        region: str | None = None,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
        active_only: bool = False,
    ) -> list[MacroSeries]:
        data = _load_catalog()
        results = []
        for d in data:
            if region and d.get("region") != region:
                continue
            if category and d.get("category") != category:
                continue
            if status and d.get("bridge_status") != status:
                continue
            if active_only and not d.get("active", True):
                continue
            if search:
                q = search.lower()
                searchable = " ".join([
                    d.get("id", ""), d.get("label", ""), d.get("region", ""),
                    d.get("source", ""), d.get("notes", "") or "",
                ]).lower()
                if q not in searchable:
                    continue
            results.append(MacroSeries(**{k: v for k, v in d.items() if v is not None}))
        return results

    def get_series_metadata(self, series_id: str) -> MacroSeries:
        data = _load_catalog()
        for d in data:
            if d["id"] == series_id:
                return MacroSeries(**{k: v for k, v in d.items() if v is not None})
        raise HTTPException(status_code=404, detail=f"Series '{series_id}' not found")

    def get_bridge_status_all(self) -> dict[str, BridgeStatus]:
        catalog = _load_catalog()
        # Group by source, report "not_built" for all at launch
        sources: dict[str, list[str]] = {}
        for s in catalog:
            src = s.get("source", "unknown")
            sources.setdefault(src, []).append(s["id"])

        result: dict[str, BridgeStatus] = {}
        for source, series_ids in sources.items():
            result[source] = BridgeStatus(
                source_name=source,
                status="not_built",
                series_count=len(series_ids),
                last_error="Bridge not yet implemented — use manual upload or configure API key",
            )
        return result

    def upsert_series(self, series: MacroSeries) -> MacroSeries:
        data = _load_catalog()
        existing_idx = next((i for i, d in enumerate(data) if d["id"] == series.id), None)
        entry = series.model_dump(exclude_none=True)
        if existing_idx is not None:
            data[existing_idx] = {**data[existing_idx], **entry}
        else:
            data.append(entry)
        _save_catalog(data)
        return series

    def delete_series(self, series_id: str) -> None:
        data = _load_catalog()
        entry = next((d for d in data if d["id"] == series_id), None)
        if entry is None:
            raise HTTPException(status_code=404, detail=f"Series '{series_id}' not found")
        if entry.get("is_core", True):
            raise HTTPException(
                status_code=405,
                detail="Core series cannot be deleted. Deactivate it instead.",
            )
        _save_catalog([d for d in data if d["id"] != series_id])

    def toggle_active(self, series_id: str, active: bool) -> MacroSeries:
        data = _load_catalog()
        for d in data:
            if d["id"] == series_id:
                d["active"] = active
                _save_catalog(data)
                return MacroSeries(**{k: v for k, v in d.items() if v is not None})
        raise HTTPException(status_code=404, detail=f"Series '{series_id}' not found")

    def get_last_n_datapoints(self, series_id: str, n: int = 5) -> list[MacroDataPoint]:
        """Returns mock data — real data fetching wired in Phase 4+."""
        series = self.get_series_metadata(series_id)
        return _generate_mock_data(series, n)


# ── Mock data generator ────────────────────────────────────────────────────────

def _generate_mock_data(series: MacroSeries, n: int = 5) -> list[MacroDataPoint]:
    """Generate plausible stub data for display before bridges are built."""
    from datetime import timedelta

    today = date.today()

    MOCK_VALUES: dict[str, list[float]] = {
        "us_gdp_nominal_q":    [28800.0, 28560.0, 28320.0, 28080.0, 27840.0],
        "us_gdp_growth_q":     [2.4,  2.2,  2.8,  1.9,  3.1],
        "us_cpi_monthly":      [3.2,  3.3,  3.5,  3.7,  3.9],
        "us_core_cpi_monthly": [3.8,  3.9,  4.0,  4.1,  4.2],
        "us_fed_funds_rate":   [4.25, 4.25, 4.50, 4.50, 4.75],
        "us_yield_2y":         [4.10, 4.15, 4.20, 4.35, 4.50],
        "us_yield_10y":        [4.30, 4.25, 4.35, 4.40, 4.55],
        "cn_gdp_growth_q":     [5.0,  4.9,  5.1,  4.7,  5.3],
        "cn_cpi_monthly":      [0.3,  0.1, -0.1,  0.2,  0.4],
        "cn_pboc_lpr_1y":      [3.10, 3.10, 3.20, 3.45, 3.45],
        "eu_gdp_growth_q":     [0.3,  0.2,  0.1,  0.4,  0.2],
        "eu_hicp_monthly":     [2.4,  2.6,  2.9,  3.1,  2.8],
        "eu_ecb_deposit_rate": [2.50, 2.75, 3.00, 3.25, 3.50],
        "de_gdp_growth_q":     [-0.1, 0.1, -0.2, 0.2, 0.0],
        "de_hicp_monthly":     [2.2,  2.5,  2.8,  2.6,  2.4],
        "jp_gdp_growth_q":     [0.5,  0.3,  0.7,  0.2,  0.4],
        "jp_cpi_monthly":      [2.5,  2.7,  2.3,  2.8,  3.0],
        "jp_boj_policy_rate":  [0.25, 0.25, 0.10, 0.10, 0.10],
        "cz_gdp_growth_q":     [0.4,  0.2,  0.5,  0.3,  0.1],
        "cz_cpi_monthly":      [2.2,  2.5,  2.9,  3.4,  4.2],
        "cz_cnb_repo_rate":    [3.75, 4.00, 4.25, 4.50, 5.00],
    }

    values = MOCK_VALUES.get(series.id, [0.0] * n)

    freq_days = {
        "daily": 1, "weekly": 7, "monthly": 30,
        "quarterly": 92, "annual": 365, "meeting_based": 45,
    }
    step = freq_days.get(series.frequency, 30)

    points = []
    for i in range(n):
        d = today - timedelta(days=step * (n - 1 - i))
        val = values[i] if i < len(values) else 0.0
        points.append(MacroDataPoint(
            date=d.isoformat(),
            value=val,
            label=d.strftime("%b'%y"),
        ))
    return points


# Module-level singleton
catalog_service = MacroCatalogService()
