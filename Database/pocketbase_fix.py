"""
Diagnose and fix the 'documents' collection in PocketBase.
Usage:
  python pocketbase_fix.py <pb_url> <admin_email> <admin_password>
Example:
  python pocketbase_fix.py http://127.0.0.1:8090 'admin@example.com' 'yourpassword'
"""
import sys
import requests
import json


def main():
    if len(sys.argv) != 4:
        print("Usage: python pocketbase_fix.py <pb_url> <admin_email> <admin_password>")
        sys.exit(1)

    pb_url = sys.argv[1].rstrip("/")
    admin_email = sys.argv[2]
    admin_password = sys.argv[3]

    # ── Auth ──────────────────────────────────────────────────────────────
    print("[1] Authenticating as superuser...")
    r = requests.post(
        f"{pb_url}/api/collections/_superusers/auth-with-password",
        json={"identity": admin_email, "password": admin_password},
    )
    if not r.ok:
        print(f"    FAILED ({r.status_code}): {r.text}")
        sys.exit(1)
    token = r.json()["token"]
    headers = {"Authorization": token}
    print("    OK")

    # ── Fetch current documents schema ────────────────────────────────────
    print("\n[2] Fetching current 'documents' collection schema...")
    r = requests.get(f"{pb_url}/api/collections/documents", headers=headers)
    if not r.ok:
        print(f"    Collection not found or error ({r.status_code}): {r.text}")
    else:
        schema = r.json()
        print("    Current schema fields:")
        for f in schema.get("fields", schema.get("schema", [])):
            print(f"      {f}")

    # ── Test records endpoint ─────────────────────────────────────────────
    print("\n[3] Testing GET /api/collections/documents/records...")
    r = requests.get(
        f"{pb_url}/api/collections/documents/records",
        params={"page": 1, "perPage": 5, "sort": "-created"},
        headers=headers,
    )
    print(f"    Status: {r.status_code}")
    print(f"    Body: {r.text[:300]}")

    if r.ok:
        print("\n    Records endpoint works! No fix needed.")
        return

    # ── Delete broken collection ──────────────────────────────────────────
    print("\n[4] Deleting broken 'documents' collection...")
    r = requests.delete(f"{pb_url}/api/collections/documents", headers=headers)
    if not r.ok:
        print(f"    FAILED ({r.status_code}): {r.text}")
        sys.exit(1)
    print("    Deleted OK")

    # ── Recreate with corrected schema ────────────────────────────────────
    print("\n[5] Recreating 'documents' collection with fixed schema...")

    # Try PocketBase v0.23+ inlined options format first
    docs_payload = {
        "name": "documents",
        "type": "base",
        "fields": [
            {"name": "filename",        "type": "text",   "required": True},
            {"name": "file",            "type": "file",   "required": True,
             "options": {"maxSelect": 1, "maxSize": 104857600}},
            {"name": "title",           "type": "text",   "required": False},
            {"name": "notes",           "type": "text",   "required": False},
            {"name": "file_type",       "type": "select", "required": True,
             "options": {"maxSelect": 1, "values": ["pdf", "docx", "csv", "xlsx", "txt", "md"]}},
            {"name": "file_size_bytes", "type": "number", "required": True},
            {"name": "tags",            "type": "json",   "required": False,
             "options": {"maxSize": 2000000}},
            {"name": "tagging_status",  "type": "select", "required": True,
             "options": {"maxSelect": 1, "values": ["untagged", "pending_review", "tagged"]}},
            {"name": "gemini_raw_response", "type": "text", "required": False},
        ],
        "listRule":   "@request.auth.id != ''",
        "viewRule":   "@request.auth.id != ''",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id != ''",
        "deleteRule": "@request.auth.id != ''",
    }

    r = requests.post(f"{pb_url}/api/collections", json=docs_payload, headers=headers)
    if not r.ok:
        print(f"    nested options FAILED ({r.status_code}): {r.text[:300]}")
        print("    Trying inlined options format...")

        docs_payload2 = {
            "name": "documents",
            "type": "base",
            "fields": [
                {"name": "filename",        "type": "text",   "required": True},
                {"name": "file",            "type": "file",   "required": True,
                 "maxSelect": 1, "maxSize": 104857600},
                {"name": "title",           "type": "text",   "required": False},
                {"name": "notes",           "type": "text",   "required": False},
                {"name": "file_type",       "type": "select", "required": True,
                 "maxSelect": 1, "values": ["pdf", "docx", "csv", "xlsx", "txt", "md"]},
                {"name": "file_size_bytes", "type": "number", "required": True},
                {"name": "tags",            "type": "json",   "required": False},
                {"name": "tagging_status",  "type": "select", "required": True,
                 "maxSelect": 1, "values": ["untagged", "pending_review", "tagged"]},
                {"name": "gemini_raw_response", "type": "text", "required": False},
            ],
            "listRule":   "@request.auth.id != ''",
            "viewRule":   "@request.auth.id != ''",
            "createRule": "@request.auth.id != ''",
            "updateRule": "@request.auth.id != ''",
            "deleteRule": "@request.auth.id != ''",
        }
        r = requests.post(f"{pb_url}/api/collections", json=docs_payload2, headers=headers)
        if not r.ok:
            print(f"    inlined FAILED ({r.status_code}): {r.text[:300]}")
            sys.exit(1)

    print("    Created OK")

    # ── Verify ────────────────────────────────────────────────────────────
    print("\n[6] Verifying records endpoint...")
    r = requests.get(
        f"{pb_url}/api/collections/documents/records",
        params={"page": 1, "perPage": 5, "sort": "-created"},
        headers=headers,
    )
    print(f"    Status: {r.status_code}")
    print(f"    Body: {r.text[:200]}")
    if r.ok:
        print("\n    SUCCESS — documents collection is working correctly.")
    else:
        print("\n    Still broken. Check PocketBase logs for more details.")


if __name__ == "__main__":
    main()
