"""Synthetic, local-only forensic timeline reasoning lab.

This module processes only an explicitly marked synthetic JSON or CSV record
set. It never searches a disk, reads operating-system file timestamps, opens
archives, executes commands, or connects to a service.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import stat
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


class LabError(ValueError):
    """An actionable input, output, or analysis error."""


LAB_FORMAT = "securium-digital-forensics-timeline-local-lab-v1"
REPORT_FORMAT = f"{LAB_FORMAT}-analysis"
SYNTHETIC_SCOPE = "synthetic-local-only"
MAX_INPUT_BYTES = 1024 * 1024
MAX_RECORDS = 100
MAX_FIELD_CHARS = 512
MAX_NOTES_CHARS = 2_000

REQUIRED_FIELDS = (
    "event_id",
    "source_id",
    "synthetic_file_id",
    "event_type",
    "timestamp_original",
    "timestamp_meaning",
)
CSV_FIELDS = ("fixture_id", "scope", "fixture_created_at", *REQUIRED_FIELDS, "notes")
ALLOWED_ROOT_FIELDS = {
    "format",
    "scope",
    "fixture_id",
    "fixture_created_at",
    "records",
    "limitations",
}
ALLOWED_RECORD_FIELDS = set(REQUIRED_FIELDS) | {"notes"}

# The fixture timestamps are deliberately fixed. The caller supplies the
# fixture creation time so it cannot be confused with an event observation.
DEFAULT_RECORDS: tuple[dict[str, str], ...] = (
    {
        "event_id": "evt-001",
        "source_id": "synthetic-filesystem-alpha",
        "synthetic_file_id": "synth-file-alpha",
        "event_type": "created",
        "timestamp_original": "2026-09-11T09:00:00+09:00",
        "timestamp_meaning": "source-reported file creation observation",
        "notes": "Synthetic filesystem record; clock accuracy is not established.",
    },
    {
        "event_id": "evt-002",
        "source_id": "synthetic-application-alpha",
        "synthetic_file_id": "synth-file-alpha",
        "event_type": "modified",
        "timestamp_original": "2026-09-11T02:00:00+01:00",
        "timestamp_meaning": "source-reported application modification observation",
        "notes": "Synthetic application record; it is not a user-action proof.",
    },
    {
        "event_id": "evt-003",
        "source_id": "synthetic-filesystem-alpha",
        "synthetic_file_id": "synth-file-alpha",
        "event_type": "accessed",
        "timestamp_original": "2026-09-11T00:00:00Z",
        "timestamp_meaning": "source-reported access observation",
        "notes": "Same normalized instant as evt-001; display order is not causality.",
    },
    {
        "event_id": "evt-004",
        "source_id": "synthetic-filesystem-beta",
        "synthetic_file_id": "synth-file-beta",
        "event_type": "created",
        "timestamp_original": "2026-09-11T10:00:00+09:00",
        "timestamp_meaning": "second source-reported creation observation",
        "notes": "Different synthetic file, same normalized instant as evt-002.",
    },
    {
        "event_id": "evt-005",
        "source_id": "synthetic-filesystem-alpha",
        "synthetic_file_id": "synth-file-alpha",
        "event_type": "metadata-observed",
        "timestamp_original": "2026-09-11T00:00:00Z",
        "timestamp_meaning": "source-reported metadata observation",
        "notes": "Same source/file/instant as evt-003 with a different event label.",
    },
    {
        "event_id": "evt-006",
        "source_id": "synthetic-authentication-log",
        "synthetic_file_id": "synth-file-alpha",
        "event_type": "log-observed",
        "timestamp_original": "2026-09-11T03:30:00+00:00",
        "timestamp_meaning": "source-reported log observation",
        "notes": "A log observation is not proof of the person who caused it.",
    },
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _sha256_json(value: Any) -> str:
    return _sha256_bytes(_canonical_json(value))


def parse_aware_timestamp(value: Any, field: str) -> datetime:
    """Parse an ISO-8601 timestamp without guessing a missing timezone."""

    if not isinstance(value, str) or not value or value != value.strip():
        raise LabError(f"{field} must be a non-empty ISO-8601 string without surrounding whitespace")
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as error:
        raise LabError(f"{field} is not a valid ISO-8601 timestamp: {value}") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise LabError(f"{field} must include an explicit timezone offset")
    return parsed


def _timestamp_utc(parsed: datetime) -> str:
    try:
        return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    except (OverflowError, ValueError) as error:
        raise LabError("timestamp cannot be represented after UTC normalization") from error


def _validate_identifier(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise LabError(f"{field} must be a non-empty string")
    if len(value) > MAX_FIELD_CHARS:
        raise LabError(f"{field} exceeds the {MAX_FIELD_CHARS}-character limit")
    if "/" in value or "\\" in value or value in {".", ".."}:
        raise LabError(f"{field} must be an identifier, not a path: {value}")
    return value


def _validate_text(value: Any, field: str, limit: int = MAX_FIELD_CHARS) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise LabError(f"{field} must be a non-empty string")
    if len(value) > limit:
        raise LabError(f"{field} exceeds the {limit}-character limit")
    return value


def _validate_scope(root: dict[str, Any]) -> tuple[str, str, str]:
    unexpected = sorted(set(root) - ALLOWED_ROOT_FIELDS)
    if unexpected:
        raise LabError(f"unexpected fixture fields: {', '.join(unexpected)}")
    if root.get("format") != LAB_FORMAT:
        raise LabError(f"format must be {LAB_FORMAT}")
    scope = root.get("scope")
    if scope != SYNTHETIC_SCOPE:
        raise LabError(f"scope must be explicitly marked {SYNTHETIC_SCOPE}")
    fixture_id = _validate_identifier(root.get("fixture_id"), "fixture_id")
    created_at = _validate_text(root.get("fixture_created_at"), "fixture_created_at")
    parse_aware_timestamp(created_at, "fixture_created_at")
    return fixture_id, scope, created_at


def _normalize_records(raw_records: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_records, list):
        raise LabError("records must be a JSON array")
    if not raw_records:
        raise LabError("records must contain at least one event")
    if len(raw_records) > MAX_RECORDS:
        raise LabError(f"records exceed the {MAX_RECORDS}-record limit")

    seen_event_ids: set[str] = set()
    normalized: list[dict[str, Any]] = []
    for index, raw in enumerate(raw_records, start=1):
        if not isinstance(raw, dict):
            raise LabError(f"record {index} must be an object")
        unexpected = sorted(set(raw) - ALLOWED_RECORD_FIELDS)
        if unexpected:
            raise LabError(f"record {index} has unexpected fields: {', '.join(unexpected)}")
        missing = [field for field in REQUIRED_FIELDS if field not in raw]
        if missing:
            raise LabError(f"record {index} is missing required fields: {', '.join(missing)}")
        event_id = _validate_identifier(raw["event_id"], f"record {index}.event_id")
        if event_id in seen_event_ids:
            raise LabError(f"duplicate event identity: {event_id}")
        seen_event_ids.add(event_id)
        source_id = _validate_identifier(raw["source_id"], f"record {index}.source_id")
        file_id = _validate_identifier(
            raw["synthetic_file_id"], f"record {index}.synthetic_file_id"
        )
        event_type = _validate_text(raw["event_type"], f"record {index}.event_type")
        timestamp_original = _validate_text(
            raw["timestamp_original"], f"record {index}.timestamp_original"
        )
        parsed = parse_aware_timestamp(timestamp_original, f"record {index}.timestamp_original")
        timestamp_meaning = _validate_text(
            raw["timestamp_meaning"], f"record {index}.timestamp_meaning"
        )
        notes = raw.get("notes", "")
        if not isinstance(notes, str) or len(notes) > MAX_NOTES_CHARS:
            raise LabError(f"record {index}.notes exceeds the {MAX_NOTES_CHARS}-character limit")
        normalized.append(
            {
                "event_id": event_id,
                "source_id": source_id,
                "synthetic_file_id": file_id,
                "event_type": event_type,
                "timestamp_original": timestamp_original,
                "timestamp_utc": _timestamp_utc(parsed),
                "utc_offset_seconds": int(parsed.utcoffset().total_seconds()),
                "timestamp_meaning": timestamp_meaning,
                "notes": notes,
            }
        )
    return normalized


def build_synthetic_fixture(fixture_created_at: str | None = None) -> dict[str, Any]:
    """Build the fixed synthetic case without reading the operating system."""

    created_at = fixture_created_at or utc_now_iso()
    _validate_text(created_at, "fixture_created_at")
    parse_aware_timestamp(created_at, "fixture_created_at")
    return {
        "format": LAB_FORMAT,
        "scope": SYNTHETIC_SCOPE,
        "fixture_id": "synthetic-timeline-offset-tie-v1",
        "fixture_created_at": created_at,
        "records": [dict(record) for record in DEFAULT_RECORDS],
        "limitations": [
            "All records are invented training observations.",
            "The fixture does not contain real disk, user, network, or incident data.",
        ],
    }


def _prepare_fixture(root: Any) -> tuple[str, str, str, list[dict[str, Any]]]:
    if not isinstance(root, dict):
        raise LabError("fixture root must be a JSON object")
    fixture_id, scope, created_at = _validate_scope(root)
    records = _normalize_records(root.get("records"))
    return fixture_id, scope, created_at, records


def _is_reparse_point(path: Path) -> bool:
    """Reject symlinks and Windows reparse points without following them."""

    if path.is_symlink():
        return True
    try:
        attributes = getattr(path.lstat(), "st_file_attributes", 0)
    except OSError:
        return False
    return bool(attributes & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def _check_path_components(path: Path, role: str) -> None:
    """Check existing path components before any read or write."""

    path = Path(path)
    current = Path(path.anchor) if path.is_absolute() else Path.cwd()
    for part in path.parts:
        if path.is_absolute() and part == path.anchor:
            continue
        current = current / part
        if _is_reparse_point(current):
            raise LabError(f"{role} symlink or reparse path is not allowed: {path}")


def _validate_input_path(path: Path) -> Path:
    path = Path(path)
    _check_path_components(path, "input")
    if _is_reparse_point(path) or not path.is_file():
        raise LabError(f"input must be a regular non-link file: {path}")
    return path


def _validate_output_path(path: Path) -> Path:
    path = Path(path)
    _check_path_components(path, "output")
    if _is_reparse_point(path):
        raise LabError(f"output symlink or reparse path is not allowed: {path}")
    if path.exists():
        raise LabError(f"refusing to overwrite existing output: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    _check_path_components(path, "output")
    if _is_reparse_point(path.parent) or path.exists():
        raise LabError(f"refusing to use an unsafe or existing output path: {path}")
    return path


def ensure_distinct_paths(input_path: Path, output_path: Path) -> None:
    input_path = _validate_input_path(Path(input_path))
    output_path = Path(output_path)
    _check_path_components(output_path, "output")
    try:
        if input_path.resolve(strict=True) == output_path.resolve(strict=False):
            raise LabError("input and output must be different files")
    except OSError as error:
        raise LabError("could not compare input and output paths") from error


def _write_new_text(path: Path, content: str) -> bytes:
    path = Path(path)
    data = content.encode("utf-8")
    _validate_output_path(path)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0)
    try:
        descriptor = os.open(str(path), flags, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
    except FileExistsError as error:
        raise LabError(f"refusing to overwrite existing output: {path}") from error
    except OSError as error:
        try:
            path.unlink()
        except OSError:
            pass
        raise LabError(f"could not create output: {path}") from error
    return data


def write_fixture(path: Path, fixture: dict[str, Any], file_format: str = "json") -> bytes:
    """Write a marked fixture once; return the exact written bytes."""

    fixture_id, scope, created_at, records = _prepare_fixture(fixture)
    if file_format not in {"json", "csv"}:
        raise LabError("fixture format must be json or csv")
    if file_format == "json":
        content = json.dumps(fixture, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    else:
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "fixture_id": fixture_id,
                    "scope": scope,
                    "fixture_created_at": created_at,
                    **{field: record[field] for field in REQUIRED_FIELDS},
                    "notes": record.get("notes", ""),
                }
            )
        content = output.getvalue()
    return _write_new_text(Path(path), content)


def _read_input(path: Path) -> tuple[dict[str, Any], bytes]:
    path = Path(path)
    _validate_input_path(path)
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise LabError(f"could not read input: {path}") from error
    if len(raw) > MAX_INPUT_BYTES:
        raise LabError(f"input exceeds the {MAX_INPUT_BYTES}-byte limit")
    suffix = path.suffix.lower()
    if suffix not in {".json", ".csv"}:
        raise LabError("input must have a .json or .csv extension")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise LabError("input must be UTF-8 text") from error

    if suffix == ".json":
        try:
            root = json.loads(text)
        except json.JSONDecodeError as error:
            raise LabError(f"malformed JSON input: {error.msg}") from error
        return root, raw

    reader = csv.DictReader(io.StringIO(text, newline=""))
    if (
        reader.fieldnames is None
        or len(reader.fieldnames) != len(set(reader.fieldnames))
        or set(reader.fieldnames) != set(CSV_FIELDS)
    ):
        raise LabError("CSV header must contain exactly the documented fixture fields")
    rows = list(reader)
    if not rows:
        raise LabError("CSV input must contain at least one record")
    metadata = {key: rows[0].get(key, "") for key in ("fixture_id", "scope", "fixture_created_at")}
    for row_number, row in enumerate(rows, start=2):
        if None in row or set(row) != set(CSV_FIELDS):
            raise LabError(f"CSV row {row_number} has unexpected or missing columns")
        for key, value in metadata.items():
            if row.get(key, "") != value:
                raise LabError(f"CSV metadata differs at row {row_number}: {key}")
    return {
        "format": LAB_FORMAT,
        "scope": metadata["scope"],
        "fixture_id": metadata["fixture_id"],
        "fixture_created_at": metadata["fixture_created_at"],
        "records": [
            {field: row.get(field, "") for field in (*REQUIRED_FIELDS, "notes")}
            for row in rows
        ],
    }, raw


def _tie_groups(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for record in records:
        grouped[record["timestamp_utc"]].append(record["event_id"])
    return [
        {
            "timestamp_utc": timestamp,
            "event_ids": sorted(event_ids),
            "interpretation": (
                "Lexical event_id order is display-only; equal UTC timestamps do not "
                "establish event precedence or causality."
            ),
        }
        for timestamp, event_ids in sorted(grouped.items())
        if len(event_ids) > 1
    ]


def _potential_conflicts(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[
            (
                record["source_id"],
                record["synthetic_file_id"],
                record["timestamp_utc"],
            )
        ].append(record)
    conflicts: list[dict[str, Any]] = []
    for (source_id, file_id, timestamp), group in sorted(grouped.items()):
        event_types = sorted({record["event_type"] for record in group})
        meanings = sorted({record["timestamp_meaning"] for record in group})
        if len(group) > 1 and (len(event_types) > 1 or len(meanings) > 1):
            conflicts.append(
                {
                    "source_id": source_id,
                    "synthetic_file_id": file_id,
                    "timestamp_utc": timestamp,
                    "event_ids": sorted(record["event_id"] for record in group),
                    "event_types": event_types,
                    "timestamp_meanings": meanings,
                    "interpretation": (
                        "Potential source conflict; do not choose a winning record "
                        "without source documentation or corroboration."
                    ),
                }
            )
    return conflicts


def analyze_fixture(root: dict[str, Any], input_sha256: str, analysis_run_at: str | None = None) -> dict[str, Any]:
    if (
        not isinstance(input_sha256, str)
        or len(input_sha256) != 64
        or any(character not in "0123456789abcdef" for character in input_sha256)
    ):
        raise LabError("input_sha256 must be a lowercase SHA-256 hex digest")
    fixture_id, scope, fixture_created_at, records = _prepare_fixture(root)
    run_at = analysis_run_at or utc_now_iso()
    _validate_text(run_at, "analysis_run_at")
    parse_aware_timestamp(run_at, "analysis_run_at")
    ordered = sorted(
        records,
        key=lambda record: (
            record["timestamp_utc"],
            record["event_id"],
            record["source_id"],
            record["synthetic_file_id"],
            record["event_type"],
        ),
    )
    ties = _tie_groups(records)
    conflicts = _potential_conflicts(records)
    facts = [
        {
            "event_id": record["event_id"],
            "source_id": record["source_id"],
            "synthetic_file_id": record["synthetic_file_id"],
            "event_type": record["event_type"],
            "timestamp_original": record["timestamp_original"],
            "timestamp_utc": record["timestamp_utc"],
            "timestamp_meaning": record["timestamp_meaning"],
            "fact": (
                f"{record['source_id']} reports {record['event_type']} for "
                f"{record['synthetic_file_id']} at {record['timestamp_original']}; "
                f"normalized display time is {record['timestamp_utc']}."
            ),
        }
        for record in ordered
    ]
    deterministic = {
        "format": REPORT_FORMAT,
        "fixture_id": fixture_id,
        "scope": scope,
        "fixture_created_at": fixture_created_at,
        "ordering": {
            "sort_keys": ["timestamp_utc", "event_id", "source_id", "synthetic_file_id", "event_type"],
            "tie_groups": ties,
            "tie_order_is_not_causality": True,
        },
        "records": ordered,
        "observed_facts": facts,
        "potential_conflicts": conflicts,
        "interpretation_limits": [
            "Timestamp normalization does not prove that any source clock was accurate.",
            "A deterministic order for equal UTC timestamps is not a proven event sequence.",
            "A file timestamp does not establish a user, intent, causality, or authorship.",
            "This lab does not establish provenance, authenticity, legal admissibility, or chain of custody.",
        ],
        "additional_evidence_needed": [
            "source clock configuration and synchronization evidence",
            "independent corroborating logs or artifact sources",
            "parser/tool version and collection context",
            "retention, visibility, and known-gap documentation",
        ],
    }
    report = {
        **deterministic,
        "input_sha256": input_sha256,
        "analysis_run_at": run_at,
        "deterministic_result_sha256": _sha256_json(deterministic),
    }
    return report


def analyze_file(path: Path, analysis_run_at: str | None = None) -> dict[str, Any]:
    root, raw = _read_input(Path(path))
    return analyze_fixture(root, _sha256_bytes(raw), analysis_run_at)


def write_report(path: Path, report: dict[str, Any]) -> bytes:
    content = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    return _write_new_text(Path(path), content)
