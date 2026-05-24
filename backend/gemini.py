"""
Shared Gemini helper.

Features:
- Tries each model in GEMINI_MODELS in order.
- On 429 RESOURCE_EXHAUSTED: reads the retryDelay from the error body and
  waits exactly that long before retrying the *same* model once, then falls
  through to the next model if it still fails.
- On 404 / model-not-found: immediately falls through to the next model.
- All other errors are re-raised immediately.
"""

from __future__ import annotations

import json
import re
import time

from fastapi import HTTPException

from backend.config import GEMINI_API_KEY, GEMINI_MODELS


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that some models add despite instructions."""
    text = text.strip()
    if text.startswith("```"):
        # ``` or ```json ... ```
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _retry_delay_seconds(exc: Exception) -> float | None:
    """
    Parse the retryDelay value from a Gemini 429 error string.
    Returns seconds as float, or None if not parseable.
    """
    msg = str(exc)
    # The SDK embeds the full JSON body in the exception message.
    # Look for  'retryDelay': '41s'  or  "retryDelay": "41.26s"
    m = re.search(r"retryDelay['\"]?\s*:\s*['\"](\d+(?:\.\d+)?)s", msg)
    if m:
        return float(m.group(1))
    return None


def _is_quota_error(exc: Exception) -> bool:
    return "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)


def _is_not_found_error(exc: Exception) -> bool:
    return "404" in str(exc) or "not found" in str(exc).lower()


def call_gemini(prompt: str) -> str:
    """
    Send *prompt* to Gemini and return the raw response text.

    Raises HTTPException on permanent failure.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured — add it to backend/.env",
        )

    from google import genai  # deferred so startup doesn't fail without key

    client = genai.Client(api_key=GEMINI_API_KEY)
    last_exc: Exception | None = None

    for model in GEMINI_MODELS:
        for attempt in range(2):  # 0 = first try, 1 = retry after rate-limit wait
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                return response.text
            except Exception as exc:
                last_exc = exc

                if _is_quota_error(exc):
                    if attempt == 0:
                        # Wait the time the API tells us, then retry once
                        delay = _retry_delay_seconds(exc) or 60.0
                        # Cap at 90 s so we don't hang a web request too long
                        time.sleep(min(delay, 90.0))
                        continue  # retry same model
                    else:
                        # Second attempt also rate-limited → try next model
                        break

                if _is_not_found_error(exc):
                    break  # model doesn't exist, try next immediately

                # Any other error (auth, network, …) → fail fast
                raise HTTPException(
                    status_code=500,
                    detail=f"Gemini error ({model}): {exc}",
                )

    raise HTTPException(
        status_code=503,
        detail=(
            f"All Gemini models exhausted their quota or are unavailable. "
            f"Last error: {last_exc}"
        ),
    )


def call_gemini_json(prompt: str) -> dict:
    """
    Like call_gemini() but parses the response as JSON.
    Raises HTTPException(422) if the model returns non-JSON.
    """
    text = call_gemini(prompt)
    clean = _strip_fences(text)
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Gemini returned non-JSON: {e}\n\nRaw response:\n{text[:500]}",
        )
