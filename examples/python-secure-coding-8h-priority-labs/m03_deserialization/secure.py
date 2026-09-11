"""Reference repairs for the M03 local-only teaching fixtures."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
import pickle
from pathlib import Path
import sqlite3
from typing import Any


class DeserializationPolicyError(ValueError):
    """The input violates the parser, schema, resource, or integrity policy."""


class IntegrityBoundaryError(DeserializationPolicyError):
    """An application-owned maintenance artifact failed its trust check."""


@dataclass(frozen=True)
class ImportRecord:
    name: str
    role: str


MAX_REQUEST_BYTES = 4096
MAX_RECORDS = 8
MAX_STRING_LENGTH = 32
MAX_JSON_DEPTH = 4
ALLOWED_ROLES = frozenset({"user", "admin"})


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


def _reject_json_constant(value: str) -> None:
    raise DeserializationPolicyError(f"non-standard JSON constant is forbidden: {value}")


def _object_pairs_without_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DeserializationPolicyError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _check_depth(value: Any, depth: int = 0) -> None:
    if depth > MAX_JSON_DEPTH:
        raise DeserializationPolicyError("JSON nesting is too deep")
    if isinstance(value, dict):
        for child in value.values():
            _check_depth(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _check_depth(child, depth + 1)


def _records_from_object(value: Any) -> list[ImportRecord]:
    if not isinstance(value, dict) or set(value) != {"records"}:
        raise DeserializationPolicyError("payload must contain only records")
    records = value["records"]
    if not isinstance(records, list) or len(records) > MAX_RECORDS:
        raise DeserializationPolicyError("record count is outside the allowed range")

    result: list[ImportRecord] = []
    for record in records:
        if not isinstance(record, dict) or set(record) != {"name", "role"}:
            raise DeserializationPolicyError("record fields are not allowlisted")
        name = record["name"]
        role = record["role"]
        if (
            type(name) is not str
            or type(role) is not str
            or not 1 <= len(name) <= MAX_STRING_LENGTH
            or not 1 <= len(role) <= MAX_STRING_LENGTH
            or "\x00" in name
            or not name.isprintable()
            or role not in ALLOWED_ROLES
        ):
            raise DeserializationPolicyError("record value violates type or value policy")
        result.append(ImportRecord(name=name, role=role))
    return result


def parse_request_secure(payload: bytes) -> list[ImportRecord]:
    """Parse request JSON as bounded data, never as executable objects."""

    if not isinstance(payload, bytes) or len(payload) > MAX_REQUEST_BYTES:
        raise DeserializationPolicyError("request payload is too large or not bytes")
    try:
        decoded = json.loads(
            payload.decode("utf-8"),
            object_pairs_hook=_object_pairs_without_duplicates,
            parse_constant=_reject_json_constant,
        )
        _check_depth(decoded)
        return _records_from_object(decoded)
    except DeserializationPolicyError:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError) as error:
        raise DeserializationPolicyError("request is not valid bounded JSON") from error


def insert_records_secure(
    connection: sqlite3.Connection,
    records: list[ImportRecord],
) -> None:
    """Write validated values with DB-API parameter binding."""

    connection.executemany(
        "INSERT INTO records (name, role) VALUES (?, ?)",
        [(record.name, record.role) for record in records],
    )
    connection.commit()


def search_records_secure(
    connection: sqlite3.Connection,
    name_filter: str,
) -> list[tuple[int, str, str]]:
    return list(
        connection.execute(
            "SELECT id, name, role FROM records WHERE name LIKE ? ORDER BY id",
            (f"%{name_filter}%",),
        )
    )


def load_trusted_migration_artifact(
    path: Path,
    application_dir: Path,
    expected_sha256: str,
) -> list[ImportRecord]:
    """Load a narrowly trusted maintenance artifact, never request bytes.

    The expected digest is server-owned configuration and the path must resolve
    beneath an application-owned maintenance directory. This is a teaching
    example of a documented false-positive boundary, not a general pickle
    recommendation or a substitute for a signed artifact workflow.
    """

    if len(expected_sha256) != 64 or any(
        character not in "0123456789abcdefABCDEF" for character in expected_sha256
    ):
        raise IntegrityBoundaryError("expected digest is not a SHA-256 value")

    base = Path(application_dir).resolve()
    candidate = Path(path).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as error:
        raise IntegrityBoundaryError("artifact is outside the application directory") from error

    actual_digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
    if not hmac.compare_digest(actual_digest, expected_sha256.lower()):
        raise IntegrityBoundaryError("artifact integrity check failed")

    try:
        decoded = pickle.loads(candidate.read_bytes())
        _check_depth(decoded)
        return _records_from_object(decoded)
    except IntegrityBoundaryError:
        raise
    except (EOFError, pickle.PickleError, RecursionError, TypeError, ValueError) as error:
        raise IntegrityBoundaryError("trusted artifact has an invalid data shape") from error
