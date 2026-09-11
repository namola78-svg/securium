"""Intentionally vulnerable M03 deserialization and data-access examples.

These functions are teaching fixtures only. Request bytes and client-provided
artifact paths must never reach these sinks in a product runtime.
"""

from __future__ import annotations

import json
import pickle
import sqlite3
from pathlib import Path
from typing import Any


def make_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT, role TEXT)"
    )
    connection.executemany(
        "INSERT INTO records (name, role) VALUES (?, ?)",
        [("alice", "user"), ("bob", "admin")],
    )
    connection.commit()
    return connection


def parse_request_vulnerable(payload: bytes) -> Any:
    """Vulnerable: parses JSON without a shape, size, or resource policy."""

    return json.loads(payload.decode("utf-8"))


def load_pickle_request_vulnerable(payload: bytes) -> Any:
    """Vulnerable: request-controlled bytes reach pickle object construction."""

    return pickle.loads(payload)


def load_legacy_artifact_vulnerable(path: Path) -> Any:
    """Vulnerable: a caller-controlled path is treated as trusted pickle."""

    return pickle.loads(Path(path).read_bytes())


def mark_untrusted_execution(marker_path: str) -> dict[str, bool]:
    """Harmless marker sink used only by the local pickle attack fixture."""

    Path(marker_path).write_text("pickle-untrusted-executed\n", encoding="utf-8")
    return {"executed": True}


def insert_records_vulnerable(
    connection: sqlite3.Connection,
    decoded_payload: dict[str, Any],
) -> None:
    """Vulnerable: no record schema and values are interpolated into SQL."""

    for record in decoded_payload["records"]:
        query = (
            "INSERT INTO records (name, role) VALUES "
            f"('{record['name']}', '{record['role']}')"
        )
        connection.execute(query)
    connection.commit()


def search_records_vulnerable(
    connection: sqlite3.Connection,
    name_filter: str,
) -> list[tuple[int, str, str]]:
    """Vulnerable: a search value is concatenated into the SQL predicate."""

    query = (
        "SELECT id, name, role FROM records "
        f"WHERE name LIKE '%{name_filter}%' ORDER BY id"
    )
    return list(connection.execute(query))
