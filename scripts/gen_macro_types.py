"""
gen_macro_types.py
------------------
Generates frontend/src/pages/macro/types.ts from backend/models/macro_models.py.

Usage (from project root):
    python scripts/gen_macro_types.py

The generated file is the single source of truth for macro TypeScript types.
Never edit frontend/src/pages/macro/types.ts by hand.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

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

HEADER = """\
// AUTO-GENERATED — do not edit by hand.
// Source of truth: backend/models/macro_models.py
// Regenerate with: python scripts/gen_macro_types.py

"""

# ── JSON-schema → TS type mapper ───────────────────────────────────────────────

def _resolve(schema: dict | bool, defs: dict) -> str:
    """Recursively convert a JSON Schema fragment to a TypeScript type string."""
    if isinstance(schema, bool):
        return "unknown"
    if "$ref" in schema:
        name = schema["$ref"].split("/")[-1]
        return name

    typ = schema.get("type")
    any_of = schema.get("anyOf")
    all_of = schema.get("allOf")

    if any_of:
        parts = [_resolve(s, defs) for s in any_of]
        # Collapse "null" → make the rest optional with " | null"
        non_null = [p for p in parts if p != "null"]
        has_null = len(parts) != len(non_null)
        base = " | ".join(non_null)
        return f"{base} | null" if has_null else base

    if all_of and len(all_of) == 1:
        return _resolve(all_of[0], defs)

    if typ == "string":
        return "string"
    if typ == "integer" or typ == "number":
        return "number"
    if typ == "boolean":
        return "boolean"
    if typ == "null":
        return "null"
    if typ == "array":
        items = schema.get("items", {})
        return f"{_resolve(items, defs)}[]"
    if typ == "object":
        additional = schema.get("additionalProperties")
        if additional:
            return f"Record<string, {_resolve(additional, defs)}>"
        return "Record<string, unknown>"

    return "unknown"


def _interface_for(model_cls, defs: dict) -> str:
    """Render a TypeScript interface for a Pydantic model class."""
    schema = model_cls.model_json_schema()
    # Merge top-level $defs into the shared defs dict (for cross-model refs)
    defs.update(schema.get("$defs", {}))

    props = schema.get("properties", {})
    required_set = set(schema.get("required", []))
    lines = [f"export interface {model_cls.__name__} {{"]

    for prop_name, prop_schema in props.items():
        ts_type = _resolve(prop_schema, defs)
        optional = "?" if prop_name not in required_set else ""
        lines.append(f"  {prop_name}{optional}: {ts_type};")

    lines.append("}")
    return "\n".join(lines)


# ── Extra hand-maintained type aliases ─────────────────────────────────────────

EXTRA = """\
// Convenience aliases
export type BridgeStatusLevel = 'connected' | 'stale' | 'manual' | 'not_built';
export type RegionId = 'US' | 'China' | 'Eurozone' | 'Germany' | 'Japan' | 'Czechia';
"""

# ── Main ───────────────────────────────────────────────────────────────────────

MODELS = [
    MacroSeries,
    MacroDataPoint,
    GDPData,
    CPIData,
    RatesData,
    ForecastEntry,
    OutlookTable,
    BridgeStatus,
    AIReportRequest,
    MacroReport,
    HighlightedDocument,
    UploadResult,
    AIModelInfo,
]

def main() -> None:
    out_path = Path(__file__).parent.parent / "frontend" / "src" / "pages" / "macro" / "types.ts"
    defs: dict = {}

    blocks = [HEADER]
    for m in MODELS:
        blocks.append(_interface_for(m, defs))
        blocks.append("")  # blank line separator

    blocks.append(EXTRA)
    content = "\n".join(blocks)
    out_path.write_text(content, encoding="utf-8")
    print(f"OK Written {out_path} ({len(content)} bytes, {len(MODELS)} interfaces)")


if __name__ == "__main__":
    main()
