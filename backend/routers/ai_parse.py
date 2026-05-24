from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from backend.gemini import call_gemini_json

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ParseRequest(BaseModel):
    signals: list[str]


@router.post("/parse")
async def ai_parse_signals(req: ParseRequest):
    prompt = f"""You are a trading signal parser. Extract structured data from each trading signal text.
Return ONLY a valid JSON array, no markdown, no explanation.

For each signal, extract:
- asset (string, ticker symbol like GC, AAPL, BTC-USD)
- direction (LONG or SHORT)
- entry_price (number)
- target_price (number)
- stop_loss (number or null)
- momentum_strength (STRONG or WEAK)
- momentum_direction (UP or DOWN)
- notes (any remaining context, string or null)

Signals to parse:
{json.dumps(req.signals, indent=2)}

Return JSON array with one object per signal, maintaining the same order."""

    result = call_gemini_json(prompt)
    # call_gemini_json returns a dict or list depending on prompt
    parsed = result if isinstance(result, list) else result
    return {"results": parsed}
