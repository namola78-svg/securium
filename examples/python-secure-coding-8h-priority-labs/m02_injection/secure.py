"""Reference repairs for the M02 teaching fixtures."""

from __future__ import annotations

import ast
import sqlite3
import subprocess
import sys
from typing import Any


SORT_COLUMNS = {"name": "name", "id": "id"}


def search_users_secure(
    connection: sqlite3.Connection,
    name_filter: str,
    sort_key: str = "name",
) -> list[tuple[int, str, str]]:
    """Bind values and choose SQL structure only from a server-owned map."""

    try:
        sort_column = SORT_COLUMNS[sort_key]
    except KeyError as error:
        raise ValueError("unsupported sort key") from error

    query = (
        "SELECT id, name, role FROM users "
        f"WHERE name LIKE ? ORDER BY {sort_column}"
    )
    return list(connection.execute(query, (f"%{name_filter}%",)))


def run_sort_secure(sort_argument: str) -> str:
    """Pass the value as one argument to a fixed interpreter invocation."""

    completed = subprocess.run(
        [sys.executable, "-c", "import sys; print(sys.argv[1])", sort_argument],
        shell=False,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout


def evaluate_filter_secure(expression: str, row: dict[str, Any]) -> bool:
    """Evaluate only ``field == literal`` data, never arbitrary Python code."""

    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as error:
        raise ValueError("invalid filter grammar") from error

    comparison = tree.body
    if not isinstance(comparison, ast.Compare):
        raise ValueError("only equality filters are allowed")
    if (
        not isinstance(comparison.left, ast.Name)
        or len(comparison.ops) != 1
        or not isinstance(comparison.ops[0], ast.Eq)
        or len(comparison.comparators) != 1
        or not isinstance(comparison.comparators[0], ast.Constant)
        or not isinstance(comparison.comparators[0].value, (str, int, bool))
    ):
        raise ValueError("filter is outside the allowed grammar")

    field = comparison.left.id
    if field not in row:
        raise ValueError("unknown field")
    return row[field] == comparison.comparators[0].value
