"""
TagMappingService — bridges database TAG_TAXONOMY → TAG_TAXONOMY_MACRO.

Starring a document in the Database tab has zero effect on automated macro
data ingestion. It is purely a display curation tool for the
Highlighted Documents panel in the Macroeconomics / By Region tab.

A document appears in the "Highlighted Docs" panel if and only if:
  1. It has been explicitly STARRED (starred=True in PocketBase)
  2. It has a MACRO free-form tag containing the active region
     (e.g., tag value contains "US", "Eurozone", "Germany", etc.)
  3. DATA TYPE is one of: research_report | thesis | macro_data | notes | news

The frontend queries PocketBase directly for starred docs (no backend roundtrip
needed for the basic feature). This service provides the backend endpoint for
future server-side filtering and aggregation.

Phase 7: wire this to query PocketBase via PocketBase Admin SDK or HTTP API.
"""

from __future__ import annotations

from backend.models.macro_models import HighlightedDocument

MACRO_ELIGIBLE_DATA_TYPES = {
    "research_report", "thesis", "macro_data", "notes", "news"
}


class TagMappingService:

    async def get_highlighted_docs(self, region: str) -> list[HighlightedDocument]:
        """
        Query: documents WHERE starred=True AND MACRO tag contains region.
        Returns documents for HighlightedDocsPanel.

        Phase 7 TODO: connect to PocketBase HTTP Admin API.
        For now returns empty list — the frontend queries PocketBase directly.
        """
        return []

    async def map_record_to_macro_tags(self, record: dict) -> dict:
        """
        Use AI agent to parse MACRO free-form tags → structured MacroTagSet.
        Phase 7 TODO: implement AI tagging pipeline.
        """
        return {}

    def get_region_from_tags(self, tags: list[dict]) -> str | None:
        """
        Extract region from MACRO tag values.
        Looks for tags with category='macro' and value matching a known region.
        """
        known_regions = {"US", "China", "Eurozone", "Germany", "Japan", "Czechia", "World"}
        for tag in tags:
            if tag.get("category") == "macro":
                val = tag.get("value", "")
                for region in known_regions:
                    if region.lower() in val.lower():
                        return region
        return None


tag_mapping_service = TagMappingService()
