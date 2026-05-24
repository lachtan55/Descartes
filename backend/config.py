import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

PRICE_DATA_PROVIDER = "yfinance"  # swap to "fmp" to use FMP service
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Model preference order — first available / non-rate-limited model wins.
# gemini-2.0-flash-lite has a separate (larger) free-tier quota.
GEMINI_MODELS = [
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
    "gemini-flash-lite-latest",   # alias, follows latest lite release
    "gemini-2.5-flash",
    "gemini-flash-latest",
]
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

# ── Macro Data Sources ────────────────────────────────────────────────────────
# Free key at: fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")

# ── AI Report Generation ──────────────────────────────────────────────────────
# GEMINI_API_KEY already configured above.
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# Full versioned model string — must match Anthropic's model ID exactly.
# Format: claude-<name>-<version>-YYYYMMDD  (see docs.anthropic.com/models/overview)
# Override in backend/.env with AI_REPORT_DEFAULT_MODEL=<versioned-id>
AI_REPORT_DEFAULT_MODEL: str = os.getenv(
    "AI_REPORT_DEFAULT_MODEL", "claude-sonnet-4-5-20251022"
)

# ── Macro caching ─────────────────────────────────────────────────────────────
MACRO_DATA_CACHE_TTL_HOURS: int = int(os.getenv("MACRO_DATA_CACHE_TTL_HOURS", "24"))
