"""Intentionally vulnerable M02 injection examples.

These fixtures are isolated teaching code. They must not be imported by the
product runtime.
"""

from __future__ import annotations

import sqlite3
import subprocess
from typing import Any


def make_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)"
    )
    connection.executemany(
        "INSERT INTO users (name, role) VALUES (?, ?)",
        [("alice", "admin"), ("bob", "user"), ("carol", "user")],
    )
    connection.commit()
    return connection


def search_users_vulnerable(
    connection: sqlite3.Connection,
    name_filter: str,
    sort_argument: str = "name",
) -> list[tuple[int, str, str]]:
    """Vulnerable: values and SQL structure are both concatenated."""

    query = (
        "SELECT id, name, role FROM users "
        f"WHERE name LIKE '%{name_filter}%' ORDER BY {sort_argument}"
    )
    return list(connection.execute(query))


def run_sort_vulnerable(sort_argument: str) -> str:
    """Vulnerable: untrusted text is interpreted by a shell."""

    completed = subprocess.run(
        f"echo {sort_argument}",
        shell=True,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def evaluate_filter_vulnerable(expression: str, row: dict[str, Any]) -> Any:
    """Vulnerable: arbitrary Python expression evaluation."""

    return eval(expression, {"__builtins__": __builtins__}, {"row": row})
