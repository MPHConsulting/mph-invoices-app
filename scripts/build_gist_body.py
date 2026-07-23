"""
Build a GitHub Gist API request body from the migrated invoice history so it can
be seeded into the user's private cloud-sync Gist (invoices-backup.json).

The migrated records are marked origin "app" so the (now empty) app seed never
deletes them. Writes the request body to a temp file and prints its path.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
FULL = os.path.join(PROJECT, "migration", "invoices-full.json")
FALLBACK = os.path.join(PROJECT, "src", "data", "invoices-data.json")

FILENAME = "invoices-backup.json"


def main() -> None:
    source = FULL if os.path.exists(FULL) else FALLBACK
    with open(source, encoding="utf-8") as f:
        data = json.load(f)

    now = datetime.now(timezone.utc).isoformat()

    invoices = []
    for inv in data["invoices"]:
        inv = dict(inv)
        inv["origin"] = "app"
        inv.setdefault("status", "sent")
        inv.setdefault("createdAt", 0)
        invoices.append(inv)

    customers = []
    for c in data["customers"]:
        c = dict(c)
        c["origin"] = "app"
        customers.append(c)

    bundle = {
        "app": "mph-invoices",
        "version": 1,
        "exportedAt": now,
        "invoices": invoices,
        "customers": customers,
        "meta": {
            "companyProfile": data["companyProfile"],
            "sourceMeta": data["meta"],
        },
    }

    body = {
        "description": "MPH Invoices automatic backup",
        "public": False,
        "files": {FILENAME: {"content": json.dumps(bundle, indent=2, ensure_ascii=False)}},
    }

    fd, path = tempfile.mkstemp(suffix=".json", prefix="mph-gist-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False)

    print(path)
    print(f"invoices={len(invoices)} customers={len(customers)}")


if __name__ == "__main__":
    main()
