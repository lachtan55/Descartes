"""
/api/db  — document text extraction and AI tagging endpoints.

POST /api/db/extract-text   { file_url, filename }  →  { text, char_count, extraction_method }
POST /api/db/suggest-tags   { text, filename }       →  { tags, suggested_title, summary }
"""

from __future__ import annotations

import io
import json
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.gemini import call_gemini_json

router = APIRouter(prefix="/api/db", tags=["db-tagging"])

# ── Taxonomy (mirrors frontend taxonomy.ts) ───────────────────────────────────

FIXED_VALUES = {
    "market":     ["comdty_market", "financial_market", "stock_market", "crypto_market",
                   "energy_market", "realestate_market"],
    "instrument": ["stock", "ETF", "index", "futures", "spot", "options"],
    "comdty":     ["comdty_rare-metals", "comdty_colored-metals", "comdty_energy",
                   "comdty_soft", "comdty_grain", "comdty_hardware", "comdty_special"],
    "exchange":   ["HL_EXCHANGE", "IB_GETTEX", "IB_NASDAQ", "IB_NYSE", "IB_XETR"],
    "data_type":  ["price_data", "thesis", "research_report", "macro_data", "earnings",
                   "transcript", "news", "regulatory", "technical_analysis", "notes"],
    "special":    ["war_geopolitics", "short_squeeze", "insider_buy", "insider_sell",
                   "activist", "m_and_a", "earnings_beat", "earnings_miss", "bankruptcy",
                   "ipo", "spinoff", "supply_disruption"],
    "timeframe":  ["daily", "weekly", "monthly", "quarterly", "annual", "intraday"],
}

FREE_FORM_CATEGORIES = {"ticker", "currency", "macro"}

ALL_CATEGORIES = list(FIXED_VALUES.keys()) + list(FREE_FORM_CATEGORIES)

# ── Pydantic models ───────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    file_url: str
    filename: str


class ExtractResponse(BaseModel):
    text: str
    char_count: int
    extraction_method: str


class SuggestRequest(BaseModel):
    text: str
    filename: str


class TagSuggestion(BaseModel):
    category: str
    value: str
    confidence: float


class SuggestResponse(BaseModel):
    tags: list[TagSuggestion]
    suggested_title: str
    summary: str


# ── Text extraction ───────────────────────────────────────────────────────────

async def _download_file(url: str) -> bytes:
    """Download a file via HTTP and return raw bytes."""
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to download file (HTTP {resp.status_code}): {url}",
            )
        return resp.content


def _extract_pdf(data: bytes) -> tuple[str, str]:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages), "pypdf"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {e}")


def _extract_docx(data: bytes) -> tuple[str, str]:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs), "python-docx"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"DOCX extraction failed: {e}")


def _extract_xlsx(data: bytes) -> tuple[str, str]:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        lines: list[str] = []
        for sheet in wb.worksheets:
            lines.append(f"[Sheet: {sheet.title}]")
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                if any(c.strip() for c in cells):
                    lines.append("\t".join(cells))
        return "\n".join(lines), "openpyxl"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"XLSX extraction failed: {e}")


def _extract_csv(data: bytes) -> tuple[str, str]:
    try:
        text = data.decode("utf-8", errors="replace")
        return text, "csv-plain"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"CSV extraction failed: {e}")


def _extract_text_bytes(data: bytes) -> tuple[str, str]:
    return data.decode("utf-8", errors="replace"), "plaintext"


def extract_text_from_bytes(filename: str, data: bytes) -> tuple[str, str]:
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext == "pdf":
        return _extract_pdf(data)
    elif ext in ("docx", "doc"):
        return _extract_docx(data)
    elif ext == "xlsx":
        return _extract_xlsx(data)
    elif ext == "csv":
        return _extract_csv(data)
    else:
        # txt, md, or anything else → plain text
        return _extract_text_bytes(data)


# ── Gemini tagging ────────────────────────────────────────────────────────────

TAXONOMY_DESCRIPTION = f"""
You are a document tagger for a commodities / financial research database.

Tag categories and their allowed values:

FIXED CATEGORIES (use only the listed values):
{json.dumps(FIXED_VALUES, indent=2)}

FREE-FORM CATEGORIES (invent appropriate values):
- ticker:    Stock/commodity tickers mentioned (e.g. "AAPL", "GC", "BTC-USD")
- currency:  Currencies referenced (e.g. "USD", "EUR", "CNY")
- macro:     Macroeconomic themes (e.g. "inflation", "rate_hike", "supply_chain")

Apply as many relevant tags as appropriate. For each tag assign a confidence score 0.0–1.0.
"""

TAGGING_PROMPT_TEMPLATE = """
{taxonomy}

Document filename: {filename}

Document text (first 8000 characters):
\"\"\"
{text}
\"\"\"

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{{
  "suggested_title": "<concise document title, max 80 chars>",
  "summary": "<2-3 sentence summary of the document>",
  "tags": [
    {{"category": "<category>", "value": "<value>", "confidence": <0.0-1.0>}},
    ...
  ]
}}
"""




# ── Route handlers ────────────────────────────────────────────────────────────

@router.post("/extract-text", response_model=ExtractResponse)
async def extract_text(req: ExtractRequest):
    """Download the file from PocketBase and extract its text content."""
    data = await _download_file(req.file_url)
    text, method = extract_text_from_bytes(req.filename, data)

    # Trim excessively long text to keep downstream calls manageable
    MAX_CHARS = 50_000
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]

    return ExtractResponse(
        text=text,
        char_count=len(text),
        extraction_method=method,
    )


@router.post("/suggest-tags", response_model=SuggestResponse)
async def suggest_tags(req: SuggestRequest):
    """Call Gemini to suggest tags, title, and summary for a document."""
    prompt = TAGGING_PROMPT_TEMPLATE.format(
        taxonomy=TAXONOMY_DESCRIPTION,
        filename=req.filename,
        text=req.text[:8000],  # keep prompt size reasonable
    )

    result = call_gemini_json(prompt)

    # Normalise and validate the response
    suggested_title = str(result.get("suggested_title", req.filename))[:80]
    summary = str(result.get("summary", ""))
    raw_tags = result.get("tags", [])

    tags: list[TagSuggestion] = []
    for t in raw_tags:
        if not isinstance(t, dict):
            continue
        category = str(t.get("category", "")).strip()
        value = str(t.get("value", "")).strip()
        try:
            confidence = float(t.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5

        # Skip tags with unknown categories
        if category not in ALL_CATEGORIES:
            continue

        # For fixed categories, skip values not in the allowed list
        if category in FIXED_VALUES and value not in FIXED_VALUES[category]:
            continue

        # Skip empty values
        if not value:
            continue

        tags.append(TagSuggestion(
            category=category,
            value=value,
            confidence=min(1.0, max(0.0, confidence)),
        ))

    return SuggestResponse(
        tags=tags,
        suggested_title=suggested_title,
        summary=summary,
    )
