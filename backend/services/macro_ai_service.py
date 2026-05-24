"""
MacroAIService — generates AI macro overview reports.

Routes to correct provider SDK based on model string:
  claude-*  → Anthropic SDK
  gemini-*  → Google GenAI SDK (via existing gemini.py helper)
  gpt-*     → OpenAI SDK

All models only appear in the available list if their API key is configured.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import HTTPException

from backend.config import ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, AI_REPORT_DEFAULT_MODEL
from backend.models.macro_models import AIModelInfo, AIReportRequest, MacroReport
from backend.services.macro_catalog_service import catalog_service

# ── Model registry ────────────────────────────────────────────────────────────

_ANTHROPIC_MODELS: list[dict[str, str]] = [
    {"id": "claude-sonnet-4-6",           "label": "Claude Sonnet 4.6",  "description": "Balanced — recommended for macro analysis"},
    {"id": "claude-opus-4-7",             "label": "Claude Opus 4.7",    "description": "Most thorough — detailed multi-factor analysis"},
    {"id": "claude-haiku-4-5-20251001",   "label": "Claude Haiku 4.5",   "description": "Fastest — brief summaries"},
]

_GOOGLE_MODELS: list[dict[str, str]] = [
    {"id": "gemini-2.5-pro",              "label": "Gemini 2.5 Pro",     "description": "Google — high-quality analysis"},
    {"id": "gemini-2.5-flash-lite",       "label": "Gemini 2.5 Flash",   "description": "Google — fast, good default"},
]

_OPENAI_MODELS: list[dict[str, str]] = [
    {"id": "gpt-4o",                      "label": "GPT-4o",             "description": "OpenAI — multimodal, versatile"},
    {"id": "gpt-4.1",                     "label": "GPT-4.1",            "description": "OpenAI — latest flagship"},
]


class MacroAIService:

    def get_available_models(self) -> list[AIModelInfo]:
        available: list[AIModelInfo] = []

        for m in _ANTHROPIC_MODELS:
            available.append(AIModelInfo(
                id=m["id"], label=m["label"],
                provider="anthropic", description=m["description"],
                available=bool(ANTHROPIC_API_KEY),
            ))

        for m in _GOOGLE_MODELS:
            available.append(AIModelInfo(
                id=m["id"], label=m["label"],
                provider="google", description=m["description"],
                available=bool(GEMINI_API_KEY),
            ))

        for m in _OPENAI_MODELS:
            available.append(AIModelInfo(
                id=m["id"], label=m["label"],
                provider="openai", description=m["description"],
                available=bool(OPENAI_API_KEY),
            ))

        return available

    def build_data_context(self, region: str) -> str:
        """
        Assembles latest macro data for the region into a text block
        suitable for injection into an AI system prompt.
        """
        lines: list[str] = [
            f"MACRO DATA CONTEXT — {region.upper()}",
            f"As of: {datetime.utcnow().strftime('%Y-%m-%d')}",
            "",
        ]

        # Fetch last 4 data points for key series
        series_by_region = {
            s.id: s for s in catalog_service.get_catalog(region=region, active_only=True)
        }

        def _format_series(series_id: str, label: str) -> None:
            if series_id not in series_by_region:
                return
            pts = catalog_service.get_last_n_datapoints(series_id, 4)
            if not pts:
                return
            latest = pts[-1]
            lines.append(f"{label}: {latest.value} (as of {latest.date})")
            if len(pts) > 1:
                prior = pts[-2]
                delta = latest.value - prior.value
                lines.append(f"  Prior reading: {prior.value} | Change: {delta:+.2f}")

        # GDP
        gdp_growth_id = {
            "US": "us_gdp_growth_q", "China": "cn_gdp_growth_q",
            "Eurozone": "eu_gdp_growth_q", "Germany": "de_gdp_growth_q",
            "Japan": "jp_gdp_growth_q", "Czechia": "cz_gdp_growth_q",
        }.get(region)
        if gdp_growth_id:
            _format_series(gdp_growth_id, "GDP Growth")

        # CPI
        cpi_id = {
            "US": "us_cpi_monthly", "China": "cn_cpi_monthly",
            "Eurozone": "eu_hicp_monthly", "Germany": "de_hicp_monthly",
            "Japan": "jp_cpi_monthly", "Czechia": "cz_cpi_monthly",
        }.get(region)
        if cpi_id:
            _format_series(cpi_id, "CPI / Inflation")

        # Core CPI (US only for now)
        if region == "US":
            _format_series("us_core_cpi_monthly", "Core CPI")

        # Policy rate
        rate_id = {
            "US": "us_fed_funds_rate", "China": "cn_pboc_lpr_1y",
            "Eurozone": "eu_ecb_deposit_rate", "Japan": "jp_boj_policy_rate",
            "Czechia": "cz_cnb_repo_rate",
        }.get(region)
        if rate_id:
            _format_series(rate_id, "Policy Rate")

        # Yield curve (US)
        if region == "US":
            _format_series("us_yield_2y",  "2Y Treasury Yield")
            _format_series("us_yield_10y", "10Y Treasury Yield")

        lines.append("")
        lines.append("NOTE: Series currently returning placeholder data. Bridges not yet built.")

        return "\n".join(lines)

    def _build_system_prompt(self, region: str, context: str, length_hint: str) -> str:
        length_instructions = {
            "brief":    "Write a concise 2-paragraph summary. No bullet lists. Direct, actionable.",
            "medium":   "Write a structured 4-5 paragraph analysis covering growth, inflation, and monetary policy.",
            "detailed": "Write a comprehensive 6-8 paragraph analysis including risks, outlook, and cross-regional comparisons.",
        }
        length_instr = length_instructions.get(length_hint, length_instructions["medium"])

        return f"""You are a senior macroeconomic analyst with expertise in global financial markets.

You are generating a macro overview report for {region} for a professional investment application.

OUTPUT FORMAT:
- Use clear section headers (##) for major themes
- Write in a professional, analytical tone suitable for institutional investors
- Be specific with numbers, dates, and comparisons where data permits
- Avoid vague statements; ground analysis in the provided data
- Do not add excessive caveats about data quality — note it once if relevant and move on
- {length_instr}

CURRENT MACRO DATA:
{context}
"""

    async def generate_report(self, request: AIReportRequest) -> MacroReport:
        context = self.build_data_context(request.region)
        system_prompt = self._build_system_prompt(request.region, context, "medium")
        user_prompt = f"Provide a comprehensive macro overview for {request.region}."

        model = request.model or "claude-sonnet-4-6"
        try:
            content = await self._route_to_provider(model, system_prompt, user_prompt)
            return MacroReport(
                model=model,
                region=request.region,
                content=content,
                generated_at=datetime.utcnow().isoformat(),
            )
        except Exception as exc:
            # Return error in the payload rather than raising — lets UI show the error inline
            return MacroReport(
                model=model,
                region=request.region,
                content="",
                generated_at=datetime.utcnow().isoformat(),
                error=str(exc),
            )

    async def _route_to_provider(self, model: str, system: str, user: str) -> str:
        if model.startswith("claude"):
            return await self._call_anthropic(model, system, user)
        elif model.startswith("gemini"):
            return await self._call_google(model, system, user)
        elif model.startswith("gpt"):
            return await self._call_openai(model, system, user)
        else:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown model provider for model '{model}'. Use claude-*, gemini-*, or gpt-*.",
            )

    async def _call_anthropic(self, model: str, system: str, user: str) -> str:
        if not ANTHROPIC_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="ANTHROPIC_API_KEY not configured — add it to backend/.env",
            )
        try:
            import anthropic
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="anthropic package not installed — run: pip install anthropic",
            )

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            message = client.messages.create(
                model=model,
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return message.content[0].text
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Anthropic API error: {exc}",
            )

    async def _call_google(self, model: str, system: str, user: str) -> str:
        if not GEMINI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="GEMINI_API_KEY not configured — add it to backend/.env",
            )
        # Reuse existing gemini helper for consistency
        from backend.gemini import call_gemini
        combined_prompt = f"{system}\n\n---\n\n{user}"
        return call_gemini(combined_prompt)

    async def _call_openai(self, model: str, system: str, user: str) -> str:
        if not OPENAI_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="OPENAI_API_KEY not configured — add it to backend/.env",
            )
        try:
            import openai
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="openai package not installed — run: pip install openai",
            )

        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=2048,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"OpenAI API error: {exc}",
            )


# Module-level singleton
macro_ai_service = MacroAIService()
