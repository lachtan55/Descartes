"""
Debug which field type causes the 400 on records endpoint.
Usage:
  python pocketbase_debug.py <pb_url> <admin_email> <admin_password>
"""
import sys
import requests


def auth(pb_url, email, password):
    r = requests.post(
        f"{pb_url}/api/collections/_superusers/auth-with-password",
        json={"identity": email, "password": password},
    )
    r.raise_for_status()
    return r.json()["token"]


def create_and_test(pb_url, headers, name, fields):
    # Delete if exists
    requests.delete(f"{pb_url}/api/collections/{name}", headers=headers)

    payload = {
        "name": name,
        "type": "base",
        "fields": fields,
        "listRule": "",   # empty = public access (superuser bypasses anyway)
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
        "deleteRule": "",
    }
    r = requests.post(f"{pb_url}/api/collections", json=payload, headers=headers)
    if not r.ok:
        print(f"  CREATE failed: {r.text[:200]}")
        return False

    r = requests.get(
        f"{pb_url}/api/collections/{name}/records",
        params={"page": 1, "perPage": 5},
        headers=headers,
    )
    print(f"  GET records: {r.status_code} — {r.text[:120]}")

    # Cleanup
    requests.delete(f"{pb_url}/api/collections/{name}", headers=headers)
    return r.ok


def main():
    if len(sys.argv) != 4:
        print("Usage: python pocketbase_debug.py <pb_url> <admin_email> <admin_password>")
        sys.exit(1)

    pb_url = sys.argv[1].rstrip("/")
    token = auth(pb_url, sys.argv[2], sys.argv[3])
    headers = {"Authorization": token}

    print("Testing field types in isolation:\n")

    tests = [
        ("test_text_only", [
            {"name": "title", "type": "text", "required": False},
        ]),
        ("test_with_json", [
            {"name": "title", "type": "text", "required": False},
            {"name": "tags", "type": "json", "required": False},
        ]),
        ("test_with_json_req", [
            {"name": "title", "type": "text", "required": False},
            {"name": "tags", "type": "json", "required": True},
        ]),
        ("test_with_select", [
            {"name": "status", "type": "select", "required": True,
             "maxSelect": 1, "values": ["a", "b"]},
        ]),
        ("test_with_file", [
            {"name": "title", "type": "text", "required": False},
            {"name": "file", "type": "file", "required": False,
             "maxSelect": 1, "maxSize": 10485760},
        ]),
        ("test_with_number", [
            {"name": "size", "type": "number", "required": True},
        ]),
    ]

    for name, fields in tests:
        print(f"{name}:")
        create_and_test(pb_url, headers, name, fields)
        print()

    # Also check current documents
    print("documents (current):")
    r = requests.get(
        f"{pb_url}/api/collections/documents/records",
        params={"page": 1, "perPage": 5},
        headers=headers,
    )
    print(f"  GET records: {r.status_code} — {r.text[:120]}")


if __name__ == "__main__":
    main()
