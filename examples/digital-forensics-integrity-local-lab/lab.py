"""Safe, local-only synthetic evidence integrity lab.

The module deliberately models a bounded byte-comparison exercise.  It is not
a forensic acquisition tool and has no Securium runtime dependencies.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import shutil
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class LabError(Exception):
    """A learner-actionable lab validation error."""


MARKER_FILE = ".forensics-integrity-lab-workspace.json"
OWNER_FILE = ".forensics-integrity-lab-owner"
MANIFEST_FILE = "evidence-manifest.json"
CUSTODY_FILE = "chain-of-custody.json"
REPORTS_DIR = Path("reports")
ORIGINAL_DIR = Path("original")
WORKING_COPY_DIR = Path("working-copy")
ALGORITHM = "sha256"
LAB_FORMAT = "securium-local-forensics-integrity-lab-v1"
MAX_FILE_BYTES = 4 * 1024 * 1024
MAX_RECORD_BYTES = 1024 * 1024

SYNTHETIC_FILES: tuple[tuple[str, bytes], ...] = (
    (
        "host-alpha/events/authentication.log",
        b"SYNTHETIC TRAINING RECORD\n"
        b"case=local-integrity-demo\n"
        b"host=synthetic-host-alpha\n"
        b"observation=training-only authentication event\n",
    ),
    (
        "host-alpha/notes/collection-note.txt",
        b"SYNTHETIC TRAINING RECORD\n"
        b"case=local-integrity-demo\n"
        b"note=working-copy comparison exercise\n",
    ),
    (
        "host-beta/network/network-summary.txt",
        b"SYNTHETIC TRAINING RECORD\n"
        b"case=local-integrity-demo\n"
        b"observation=no real network target or packet capture\n",
    ),
)

REQUIRED_CUSTODY_FIELDS = ("event", "recorded_at", "from", "to", "reason", "location")


def utc_now_iso() -> str:
    """Return an actual UTC verification timestamp."""

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def validate_recorded_at(value: str) -> str:
    """Validate a caller-supplied timestamp without replacing it."""

    if not isinstance(value, str) or not value.strip():
        raise LabError("recorded_at must be a non-empty caller-provided ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError as error:
        raise LabError("recorded_at must be an ISO-8601 timestamp") from error
    if parsed.tzinfo is None:
        raise LabError("recorded_at must include a timezone offset")
    return value.strip()


def _validate_root(root: Path) -> Path:
    root = Path(root)
    if _is_reparse_point(root):
        raise LabError("workspace root symlinks and reparse points are not allowed")
    if not root.exists() or not root.is_dir():
        raise LabError(f"workspace is not a directory: {root}")
    return root


def _is_reparse_point(path: Path) -> bool:
    """Detect symlinks and Windows reparse points without following them."""

    if path.is_symlink():
        return True
    try:
        attributes = getattr(path.lstat(), "st_file_attributes", 0)
    except OSError:
        return False
    return bool(attributes & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def _is_under(relative: str | Path, prefix: str | Path) -> bool:
    rel = Path(relative)
    base = Path(prefix)
    try:
        rel.relative_to(base)
    except ValueError:
        return False
    return True


def safe_relative_path(root: Path, relative: str) -> Path:
    """Resolve a relative path while rejecting traversal and symlinks."""

    root = _validate_root(root)
    if not isinstance(relative, str) or not relative.strip():
        raise LabError("manifest path must be a non-empty relative path")
    rel = Path(relative)
    if rel.is_absolute() or rel.anchor:
        raise LabError(f"absolute path is not allowed: {relative}")

    current = root
    for part in rel.parts:
        if part in ("", "."):
            continue
        if part == "..":
            raise LabError(f"path escapes fixture root: {relative}")
        current = current / part
        if _is_reparse_point(current):
            raise LabError(f"symlink or reparse-point path is not allowed: {relative}")

    candidate = root / rel
    root_resolved = root.resolve()
    resolved = candidate.resolve(strict=False)
    try:
        resolved.relative_to(root_resolved)
    except ValueError as error:
        raise LabError(f"path escapes fixture root: {relative}") from error
    return candidate


def streaming_sha256(path: Path, chunk_size: int = 1024 * 1024) -> dict[str, int | str]:
    """Compute byte length and SHA-256 using bounded streaming reads."""

    if not isinstance(chunk_size, int) or isinstance(chunk_size, bool) or chunk_size <= 0:
        raise LabError("hash chunk_size must be a positive integer")
    if _is_reparse_point(path) or not path.is_file():
        raise LabError(f"regular file required for hashing: {path}")
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise LabError(f"input file exceeds the {MAX_FILE_BYTES}-byte lab limit: {path}")
            digest.update(chunk)
    return {"size": size, "sha256": digest.hexdigest()}


def _write_bytes_no_overwrite(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(data)


def _copy_no_overwrite(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with source.open("rb") as source_handle, destination.open("xb") as destination_handle:
        shutil.copyfileobj(source_handle, destination_handle, length=1024 * 1024)


def _write_json_no_overwrite(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")


def _write_text_no_overwrite(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(value)


def _read_json(path: Path) -> Any:
    try:
        if path.stat().st_size > MAX_RECORD_BYTES:
            raise LabError(f"JSON record exceeds the {MAX_RECORD_BYTES}-byte lab limit: {path}")
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except LabError:
        raise
    except (OSError, json.JSONDecodeError) as error:
        raise LabError(f"could not read JSON record: {path}") from error


def _manifest_file_entry(relative: str) -> dict[str, Any]:
    return {
        "original": {"path": (ORIGINAL_DIR / relative).as_posix()},
        "working_copy": {"path": (WORKING_COPY_DIR / relative).as_posix()},
    }


def prepare_workspace(workspace: Path | None, recorded_at: str) -> dict[str, Any]:
    """Create a new temporary or explicitly named lab workspace."""

    recorded_at = validate_recorded_at(recorded_at)
    auto_workspace = workspace is None
    root = Path(tempfile.mkdtemp(prefix="securium-forensics-integrity-")) if auto_workspace else Path(workspace)
    created_root = auto_workspace
    ownership_token = secrets.token_hex(32)
    try:
        if not auto_workspace and root.exists():
            raise LabError(f"refusing to overwrite existing workspace: {root}")
        if not auto_workspace:
            root.parent.mkdir(parents=True, exist_ok=True)
            root.mkdir()
            created_root = True

        manifest_entries: list[dict[str, Any]] = []
        for relative, contents in SYNTHETIC_FILES:
            original = root / ORIGINAL_DIR / relative
            working_copy = root / WORKING_COPY_DIR / relative
            _write_bytes_no_overwrite(original, contents)
            _copy_no_overwrite(original, working_copy)
            original_digest = streaming_sha256(original)
            working_digest = streaming_sha256(working_copy)
            manifest_entries.append(
                {
                    "original": {
                        "path": (ORIGINAL_DIR / relative).as_posix(),
                        **original_digest,
                    },
                    "working_copy": {
                        "path": (WORKING_COPY_DIR / relative).as_posix(),
                        **working_digest,
                    },
                }
            )

        manifest = {
            "format": LAB_FORMAT,
            "algorithm": ALGORITHM,
            "scope": "synthetic local-only training fixture",
            "workspace_token": ownership_token,
            "recorded_at": recorded_at,
            "file_count": len(manifest_entries),
            "files": manifest_entries,
            "limitations": [
                "hash equality compares the observed bytes under this algorithm and scope only",
                "this record does not prove provenance, lawful collection, authorship, or interpretation",
            ],
        }
        custody = {
            "format": f"{LAB_FORMAT}-custody",
            "scope": "synthetic local-only training fixture",
            "workspace_token": ownership_token,
            "recorded_at": recorded_at,
            "entries": [
                {
                    "event": "synthetic fixture created",
                    "recorded_at": recorded_at,
                    "from": "lab-generator",
                    "to": "original",
                    "reason": "create bounded training bytes",
                    "location": "local temporary workspace",
                },
                {
                    "event": "working copy created",
                    "recorded_at": recorded_at,
                    "from": "original",
                    "to": "working-copy",
                    "reason": "perform analysis without editing original",
                    "location": "local temporary workspace",
                },
            ],
            "limitations": [
                "this is an educational handoff format, not identity authentication or a legal chain of custody",
            ],
        }
        _write_json_no_overwrite(root / MANIFEST_FILE, manifest)
        _write_json_no_overwrite(root / CUSTODY_FILE, custody)
        _write_json_no_overwrite(
            root / MARKER_FILE,
            {
                "format": LAB_FORMAT,
                "workspace_path": str(root.resolve()),
                "workspace_token": ownership_token,
                "version": 1,
            },
        )
        _write_text_no_overwrite(root / OWNER_FILE, ownership_token + "\n")
        return {
            "status": "PREPARED",
            "workspace": str(root),
            "manifest": str(root / MANIFEST_FILE),
            "custody": str(root / CUSTODY_FILE),
            "file_count": len(manifest_entries),
            "recorded_at": recorded_at,
            "temporary_workspace": auto_workspace,
        }
    except Exception:
        if created_root and root.exists():
            shutil.rmtree(root)
        raise


def _assert_generated_workspace(workspace: Path) -> tuple[Path, dict[str, Any]]:
    root = _validate_root(Path(workspace))
    marker = safe_relative_path(root, MARKER_FILE)
    if _is_reparse_point(marker) or not marker.is_file():
        raise LabError("workspace marker is missing or unsafe")
    marker_data = _read_json(marker)
    if not isinstance(marker_data, dict) or marker_data.get("format") != LAB_FORMAT:
        raise LabError("workspace marker does not belong to this lab")
    marker_path = marker_data.get("workspace_path")
    token = marker_data.get("workspace_token")
    if not isinstance(marker_path, str) or not isinstance(token, str) or len(token) != 64:
        raise LabError("workspace marker ownership fields are invalid")
    if os.path.normcase(str(Path(marker_path).resolve())) != os.path.normcase(str(root.resolve())):
        raise LabError("workspace marker is bound to a different root")
    owner = safe_relative_path(root, OWNER_FILE)
    if _is_reparse_point(owner) or not owner.is_file():
        raise LabError("workspace owner record is missing or unsafe")
    try:
        owner_token = owner.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise LabError("workspace owner record could not be read") from error
    if owner_token != token:
        raise LabError("workspace owner record does not match the marker")
    return root, marker_data


def _find_symlinks(root: Path) -> list[str]:
    found: list[str] = []
    for directory, directory_names, file_names in os.walk(root, topdown=True, followlinks=False):
        directory_path = Path(directory)
        for name in list(directory_names):
            candidate = directory_path / name
            if _is_reparse_point(candidate):
                found.append(candidate.relative_to(root).as_posix())
                directory_names.remove(name)
        for name in file_names:
            candidate = directory_path / name
            if _is_reparse_point(candidate):
                found.append(candidate.relative_to(root).as_posix())
    return sorted(found)


def _check_timestamp(value: Any, label: str, errors: list[str]) -> bool:
    if not isinstance(value, str):
        errors.append(f"{label} is missing")
        return False
    try:
        validate_recorded_at(value)
    except LabError:
        errors.append(f"{label} is not a timezone-qualified ISO-8601 timestamp")
        return False
    return True


def _check_file_record(root: Path, record: Any, role: str, errors: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {"role": role, "status": "REJECTED"}
    if not isinstance(record, dict):
        result["error"] = f"{role} record is missing"
        errors.append(result["error"])
        return result

    relative = record.get("path")
    result["path"] = relative
    try:
        path = safe_relative_path(root, relative)
        expected_root = ORIGINAL_DIR if role == "original" else WORKING_COPY_DIR
        if not _is_under(relative, expected_root):
            raise LabError(f"{role} path is outside its allowed fixture root: {relative}")
    except LabError as error:
        result["error"] = str(error)
        errors.append(str(error))
        return result

    expected_size = record.get("size")
    expected_hash = record.get("sha256")
    valid_expected = isinstance(expected_size, int) and not isinstance(expected_size, bool)
    valid_expected = valid_expected and 0 <= expected_size <= MAX_FILE_BYTES
    valid_expected = valid_expected and isinstance(expected_hash, str) and len(expected_hash) == 64
    valid_expected = valid_expected and all(character in "0123456789abcdef" for character in expected_hash)
    if not valid_expected:
        result["error"] = f"{role} expected size/sha256 is invalid: {relative}"
        errors.append(result["error"])
        return result

    result["expected_size"] = expected_size
    result["expected_sha256"] = expected_hash
    if _is_reparse_point(path):
        result["error"] = f"symlink or reparse-point file is not allowed: {relative}"
        errors.append(result["error"])
        return result
    if not path.exists() or not path.is_file():
        result["status"] = "MISSING"
        result["error"] = f"regular file is missing: {relative}"
        errors.append(result["error"])
        return result

    try:
        actual = streaming_sha256(path)
    except LabError as error:
        result["error"] = str(error)
        errors.append(str(error))
        return result
    result.update({"actual_size": actual["size"], "actual_sha256": actual["sha256"]})
    size_matches = actual["size"] == expected_size
    hash_matches = actual["sha256"] == expected_hash
    result["status"] = "PASS" if size_matches and hash_matches else "MISMATCH"
    if not size_matches:
        errors.append(f"size mismatch for {relative}: expected {expected_size}, observed {actual['size']}")
    if not hash_matches:
        errors.append(f"hash mismatch for {relative}")
    return result


def _check_custody(root: Path, custody: Any, errors: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {"status": "REJECTED", "entries": 0}
    if not isinstance(custody, dict):
        errors.append("chain-of-custody record is not an object")
        return result
    result["recorded_at"] = custody.get("recorded_at")
    _check_timestamp(custody.get("recorded_at"), "chain-of-custody recorded_at", errors)
    entries = custody.get("entries")
    if not isinstance(entries, list) or not entries:
        errors.append("chain-of-custody entries are missing")
        return result
    result["entries"] = len(entries)
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"chain-of-custody entry {index} is not an object")
            continue
        for field in REQUIRED_CUSTODY_FIELDS:
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                errors.append(f"chain-of-custody entry {index} missing required field: {field}")
        _check_timestamp(entry.get("recorded_at"), f"chain-of-custody entry {index} recorded_at", errors)
    result["status"] = "PASS" if not any("chain-of-custody" in error for error in errors) else "REJECTED"
    return result


def verify_workspace(workspace: Path, verified_at: str | None = None) -> dict[str, Any]:
    """Verify the generated records and return a report without modifying them."""

    root, marker_data = _assert_generated_workspace(Path(workspace))
    verification_time = verified_at or utc_now_iso()
    validate_recorded_at(verification_time)
    errors: list[str] = []
    report: dict[str, Any] = {
        "format": f"{LAB_FORMAT}-verification",
        "status": "REJECTED",
        "recorded_at": None,
        "verified_at": verification_time,
        "time_note": "recorded_at is caller-supplied; verified_at is the verifier observation time",
        "symlink_paths": _find_symlinks(root),
        "file_checks": [],
        "pair_checks": [],
        "custody": {"status": "REJECTED", "entries": 0},
        "errors": errors,
    }
    for symlink_path in report["symlink_paths"]:
        errors.append(f"unapproved symlink found: {symlink_path}")

    try:
        manifest_path = safe_relative_path(root, MANIFEST_FILE)
        custody_path = safe_relative_path(root, CUSTODY_FILE)
        manifest = _read_json(manifest_path)
        custody = _read_json(custody_path)
    except LabError as error:
        errors.append(str(error))
        return report

    if not isinstance(manifest, dict):
        errors.append("evidence manifest is not an object")
        return report
    report["recorded_at"] = manifest.get("recorded_at")
    _check_timestamp(manifest.get("recorded_at"), "manifest recorded_at", errors)
    if manifest.get("algorithm") != ALGORITHM:
        errors.append("evidence manifest algorithm is not sha256")
    if manifest.get("scope") != "synthetic local-only training fixture":
        errors.append("evidence manifest scope is not local-only synthetic training")
    if manifest.get("workspace_token") != marker_data.get("workspace_token"):
        errors.append("evidence manifest is not bound to this workspace")
    if isinstance(custody, dict) and custody.get("workspace_token") != marker_data.get("workspace_token"):
        errors.append("chain-of-custody record is not bound to this workspace")
    custody_recorded_at = custody.get("recorded_at") if isinstance(custody, dict) else None
    if manifest.get("recorded_at") != custody_recorded_at:
        errors.append("manifest and chain-of-custody recorded_at values differ")

    entries = manifest.get("files")
    expected_count = manifest.get("file_count")
    if not isinstance(entries, list) or not entries:
        errors.append("evidence manifest file entries are missing")
        entries = []
    if not isinstance(expected_count, int) or expected_count != len(entries):
        errors.append("evidence manifest file_count does not match its entries")

    expected_pairs = {
        (
            (ORIGINAL_DIR / relative).as_posix(),
            (WORKING_COPY_DIR / relative).as_posix(),
        )
        for relative, _contents in SYNTHETIC_FILES
    }
    seen_manifest_paths: set[str] = set()
    seen_manifest_pairs: set[tuple[str, str]] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        original_record = entry.get("original")
        working_record = entry.get("working_copy")
        original_path = original_record.get("path") if isinstance(original_record, dict) else None
        working_path = working_record.get("path") if isinstance(working_record, dict) else None
        for path_value in (original_path, working_path):
            if isinstance(path_value, str):
                if path_value in seen_manifest_paths:
                    errors.append(f"duplicate manifest path: {path_value}")
                seen_manifest_paths.add(path_value)
        if isinstance(original_path, str) and isinstance(working_path, str):
            pair = (original_path, working_path)
            if pair in seen_manifest_pairs:
                errors.append(f"duplicate manifest pair: {original_path} / {working_path}")
            seen_manifest_pairs.add(pair)
    for missing_pair in sorted(expected_pairs - seen_manifest_pairs):
        errors.append(f"missing manifest pair: {missing_pair[0]} / {missing_pair[1]}")
    for extra_pair in sorted(seen_manifest_pairs - expected_pairs):
        errors.append(f"additional manifest pair: {extra_pair[0]} / {extra_pair[1]}")

    for index, entry in enumerate(entries):
        original_result = _check_file_record(root, entry.get("original") if isinstance(entry, dict) else None, "original", errors)
        working_result = _check_file_record(root, entry.get("working_copy") if isinstance(entry, dict) else None, "working_copy", errors)
        report["file_checks"].extend([original_result, working_result])
        pair: dict[str, Any] = {"index": index, "status": "REJECTED"}
        if "actual_size" in original_result and "actual_size" in working_result:
            pair["status"] = (
                "PASS"
                if original_result.get("actual_size") == working_result.get("actual_size")
                and original_result.get("actual_sha256") == working_result.get("actual_sha256")
                else "MISMATCH"
            )
            if pair["status"] != "PASS":
                errors.append(f"original and working-copy bytes differ for manifest entry {index}")
        elif original_result.get("status") == "MISSING" or working_result.get("status") == "MISSING":
            pair["status"] = "MISSING"
            errors.append(f"original/working-copy pair is incomplete for manifest entry {index}")
        report["pair_checks"].append(pair)

    report["custody"] = _check_custody(root, custody, errors)
    if errors:
        report["status"] = "REJECTED"
    else:
        report["status"] = "PASS"
    report["counts"] = {
        "manifest_entries": len(entries),
        "file_checks": len(report["file_checks"]),
        "pair_checks": len(report["pair_checks"]),
        "errors": len(errors),
    }
    return report


def write_verification_report(workspace: Path, report: dict[str, Any], relative_report: str) -> Path:
    """Write a report only to a new reports path; never overwrite."""

    root, _marker_data = _assert_generated_workspace(Path(workspace))
    target = safe_relative_path(root, relative_report)
    if not _is_under(relative_report, REPORTS_DIR):
        raise LabError("verification reports must stay under the reports directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() or _is_reparse_point(target):
        raise FileExistsError(f"refusing to overwrite existing report: {target}")
    _write_json_no_overwrite(target, report)
    return target


def tamper_working_copy(workspace: Path, relative_path: str) -> Path:
    """Append a synthetic marker to a working-copy file only."""

    root, _marker_data = _assert_generated_workspace(Path(workspace))
    path = safe_relative_path(root, relative_path)
    if not _is_under(relative_path, WORKING_COPY_DIR):
        raise LabError("tamper operation is restricted to working-copy files")
    if _is_reparse_point(path) or not path.is_file():
        raise LabError("tamper operation requires a regular working-copy file")
    with path.open("ab") as handle:
        handle.write(b"\nSYNTHETIC TRAINING MUTATION\n")
    return path


def remove_working_copy(workspace: Path, relative_path: str) -> Path:
    """Remove one explicitly named working-copy file for the missing-file case."""

    root, _marker_data = _assert_generated_workspace(Path(workspace))
    path = safe_relative_path(root, relative_path)
    if not _is_under(relative_path, WORKING_COPY_DIR):
        raise LabError("remove operation is restricted to working-copy files")
    if _is_reparse_point(path) or not path.is_file():
        raise LabError("remove operation requires an existing regular working-copy file")
    path.unlink()
    return path


def cleanup_workspace(workspace: Path) -> None:
    """Delete only a workspace carrying this lab's marker."""

    root, _marker_data = _assert_generated_workspace(Path(workspace))
    shutil.rmtree(root)
