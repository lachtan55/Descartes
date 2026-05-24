"""
Descartes DATABASE — PocketBase Collection Bootstrap (compatible with PocketBase v0.23+)
Requires: pip install requests
Run AFTER creating your admin account via http://127.0.0.1:8090/_/
  python pocketbase_schema.py <pb_url> <admin_email> <admin_password>
Example:
  python pocketbase_schema.py http://127.0.0.1:8090 admin@example.com yourpassword
"""

import sys
import requests


def main():
    if len(sys.argv) != 4:
        print("Usage: python pocketbase_schema.py <pb_url> <admin_email> <admin_password>")
        sys.exit(1)

    pb_url = sys.argv[1].rstrip("/")
    admin_email = sys.argv[2]
    admin_password = sys.argv[3]

    # ── Authenticate (v0.23+: superusers replaced admins) ─────────────────
    print("[1/3] Authenticating...")
    r = requests.post(
        f"{pb_url}/api/collections/_superusers/auth-with-password",
        json={"identity": admin_email, "password": admin_password},
    )
    if not r.ok:
        print(f"     FAILED ({r.status_code}): {r.text}")
        print("")
        print("Tip: wrap credentials in single quotes to avoid PowerShell interpolation:")
        print("  python pocketbase_schema.py http://127.0.0.1:8090 'email' 'password'")
        sys.exit(1)
    token = r.json()["token"]
    headers = {"Authorization": token}
    print("     OK")

    # ── Create 'documents' collection ─────────────────────────────────────
    # v0.23+: 'schema' key renamed to 'fields'; options are inlined (not nested)
    print("[2/3] Creating 'documents' collection...")
    docs_payload = {
        "name": "documents",
        "type": "base",
        "fields": [
            {"name": "filename",            "type": "text",   "required": True},
            {"name": "file",                "type": "file",   "required": True,
             "maxSelect": 1, "maxSize": 104857600},
            {"name": "title",               "type": "text",   "required": False},
            {"name": "notes",               "type": "text",   "required": False},
            {"name": "file_type",           "type": "select", "required": True,
             "maxSelect": 1, "values": ["pdf", "docx", "csv", "xlsx", "txt", "md"]},
            {"name": "file_size_bytes",     "type": "number", "required": True},
            {"name": "tags",                "type": "json",   "required": True},
            {"name": "tagging_status",      "type": "select", "required": True,
             "maxSelect": 1, "values": ["untagged", "pending_review", "tagged"]},
            {"name": "gemini_raw_response", "type": "text",   "required": False},
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }
    r = requests.post(f"{pb_url}/api/collections", json=docs_payload, headers=headers)
    if not r.ok and ("already exists" in r.text or "must be unique" in r.text):
        print("     'documents' already exists — skipping")
    elif not r.ok:
        print(f"     FAILED ({r.status_code}): {r.text}")
        sys.exit(1)
    else:
        print("     OK")

    # ── Create 'tag_taxonomy' collection ──────────────────────────────────
    print("[3/3] Creating 'tag_taxonomy' collection and seeding...")
    tax_payload = {
        "name": "tag_taxonomy",
        "type": "base",
        "fields": [
            {"name": "category", "type": "text", "required": True},
            {"name": "value",    "type": "text", "required": True},
            {"name": "label",    "type": "text", "required": True},
            {"name": "color",    "type": "text", "required": True},
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }
    r = requests.post(f"{pb_url}/api/collections", json=tax_payload, headers=headers)
    if not r.ok and ("already exists" in r.text or "must be unique" in r.text):
        print("     'tag_taxonomy' already exists — skipping seed")
        print("")
        print("Bootstrap complete. Collections already set up.")
        print(f"Admin UI: {pb_url}/_/")
        return
    else:
        r.raise_for_status()

    # ── Seed taxonomy ─────────────────────────────────────────────────────
    TAXONOMY = [
        # market
        *[{"category": "market", "value": v,
           "label": v.replace("_", " ").title(), "color": "#00BCD4"}
          for v in ["comdty_market", "financial_market", "stock_market",
                    "crypto_market", "energy_market", "realestate_market"]],
        # instrument
        *[{"category": "instrument", "value": v,
           "label": v.upper(), "color": "#5C9DFF"}
          for v in ["stock", "ETF", "index", "futures", "spot", "options"]],
        # currency
        *[{"category": "currency", "value": v,
           "label": v, "color": "#26A69A"}
          for v in ["USD", "EUR", "CZK", "CNY", "GBP", "JPY", "CHF", "CAD", "AUD"]],
        # exchange
        *[{"category": "exchange", "value": v,
           "label": v, "color": "#78909C"}
          for v in ["HL_EXCHANGE", "IB_GETTEX", "IB_NASDAQ", "IB_NYSE", "IB_XETR"]],
        # macro
        *[{"category": "macro", "value": v,
           "label": v, "color": "#AB47BC"}
          for v in ["PMI_US", "PMI_EU", "PMI_CN", "PMI_CZ",
                    "CPI_US", "CPI_EU", "CPI_CN", "CPI_CZ",
                    "NON-FARM_US",
                    "INTEREST-RATE_US", "INTEREST-RATE_EU",
                    "INTEREST-RATE_CN", "INTEREST-RATE_CZ",
                    "GDP_US", "GDP_EU", "GDP_CN", "GDP_CZ"]],
        # comdty
        *[{"category": "comdty", "value": v,
           "label": v.replace("comdty_", "").replace("-", " ").title(), "color": "#FFB300"}
          for v in ["comdty_rare-metals", "comdty_colored-metals", "comdty_energy",
                    "comdty_soft", "comdty_grain", "comdty_hardware", "comdty_special"]],
        # data_type
        *[{"category": "data_type", "value": v,
           "label": v.replace("_", " ").title(), "color": "#90A4AE"}
          for v in ["price_data", "thesis", "research_report", "macro_data",
                    "earnings", "transcript", "news", "regulatory",
                    "technical_analysis", "notes"]],
        # special
        *[{"category": "special", "value": v,
           "label": v.replace("_", " ").title(), "color": "#FF7043"}
          for v in ["war_geopolitics", "short_squeeze", "insider_buy", "insider_sell",
                    "activist", "m_and_a", "earnings_beat", "earnings_miss",
                    "bankruptcy", "ipo", "spinoff", "supply_disruption"]],
        # timeframe
        *[{"category": "timeframe", "value": v,
           "label": v.title(), "color": "#B0BEC5"}
          for v in ["daily", "weekly", "monthly", "quarterly", "annual", "intraday"]],
    ]

    for entry in TAXONOMY:
        r = requests.post(
            f"{pb_url}/api/collections/tag_taxonomy/records",
            json=entry, headers=headers,
        )
        r.raise_for_status()

    print(f"     Seeded {len(TAXONOMY)} taxonomy entries — OK")
    print("")
    print("Bootstrap complete. PocketBase collections are ready.")
    print(f"Admin UI: {pb_url}/_/")


if __name__ == "__main__":
    main()
