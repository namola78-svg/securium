#!/usr/bin/env python3
"""Standalone preflight for the synthetic digital-forensics learner labs."""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import importlib
import os
from pathlib import Path
import platform
import stat
import sys
import tempfile
import uuid
from typing import Any, Callable, Sequence
import json


PASS = "PASS"
FAIL = "FAIL"
UNVERIFIED_ENVIRONMENT = "UNVERIFIED_ENVIRONMENT"
NOT_RUN = "NOT_RUN"

EXIT_PASS = 0
EXIT_FAIL = 1
EXIT_USAGE_OR_OUTPUT = 2
EXIT_UNVERIFIED = 3

MINIMUM_PYTHON = (3, 11)
CONFIGURED_MATRIX = {
    "Windows": (3, 11, 3, 14),
    "Linux": (3, 11, 3, 14),
}
LAB_STDLIB_MODULES = (
    "argparse",
    "csv",
    "datetime",
    "hashlib",
    "json",
    "os",
    "pathlib",
    "shutil",
    "stat",
    "tempfile",
    "zoneinfo",
)
REPARSE_POINT_ATTRIBUTE = 0x0400
TOOL_NAME = "securium-forensics-learner-preflight"


class PreflightUsageError(Exception):
    """A user-controlled option or report target cannot be used safely."""


class CleanupError(Exception):
    """The run-owned directory cannot be removed within its safe boundary."""


@dataclass
class ProbeResult:
    name: str
    status: str
    message: str
    required: bool = True
    details: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
            "required": self.required,
            "details": dict(self.details),
        }


def safe_exception_name(error: BaseException) -> str:
    """Return a non-sensitive error description without embedding a path."""

    return type(error).__name__


def version_tuple(version_info: Any) -> tuple[int, int]:
    return int(version_info[0]), int(version_info[1])


def format_python_version(version_info: Any = sys.version_info) -> str:
    major = int(version_info[0])
    minor = int(version_info[1])
    try:
        micro = int(version_info.micro)
    except AttributeError:
        micro = int(version_info[2]) if len(version_info) > 2 else 0
    return f"{major}.{minor}.{micro}"


def configured_matrix_text() -> str:
    return "CPython on Windows/Linux with Python 3.11 or 3.14"


def probe_python_runtime(version_info: Any = sys.version_info) -> ProbeResult:
    observed = version_tuple(version_info)
    if observed < MINIMUM_PYTHON:
        return ProbeResult(
            "python_runtime",
            FAIL,
            "The running Python is below the minimum required version 3.11.",
            details={
                "observed_version": format_python_version(version_info),
                "minimum_version": "3.11",
            },
        )
    return ProbeResult(
        "python_runtime",
        PASS,
        "The running Python meets the minimum required version 3.11.",
        details={
            "observed_version": format_python_version(version_info),
            "minimum_version": "3.11",
        },
    )


def probe_environment_scope(
    version_info: Any = sys.version_info,
    system: str | None = None,
    implementation: str | None = None,
) -> ProbeResult:
    system_name = system or platform.system()
    implementation_name = implementation or platform.python_implementation()
    major, minor = version_tuple(version_info)
    matches = (
        implementation_name == "CPython"
        and major == 3
        and minor in CONFIGURED_MATRIX.get(system_name, ())
    )
    details = {
        "observed_os": system_name,
        "observed_implementation": implementation_name,
        "observed_python_minor": minor,
        "configured_matrix": configured_matrix_text(),
        "ci_success_evidence": NOT_RUN,
    }
    if matches:
        return ProbeResult(
            "environment_scope",
            PASS,
            "The observed implementation, OS, and Python minor match the configured lab matrix; this is not CI success evidence.",
            required=False,
            details=details,
        )
    return ProbeResult(
        "environment_scope",
        UNVERIFIED_ENVIRONMENT,
        "The local probes may run, but this implementation/OS/Python combination is outside the configured matrix.",
        required=False,
        details=details,
    )


def probe_lab_stdlib_imports(
    importer: Callable[[str], Any] | None = None,
) -> ProbeResult:
    load = importer or importlib.import_module
    failures: list[dict[str, str]] = []
    for module_name in LAB_STDLIB_MODULES:
        try:
            load(module_name)
        except Exception as error:
            failures.append(
                {"module": module_name, "error_type": safe_exception_name(error)}
            )
    if failures:
        return ProbeResult(
            "lab_stdlib_imports",
            FAIL,
            "One or more standard-library modules required by the two labs failed to import.",
            details={"checked_count": len(LAB_STDLIB_MODULES), "failures": failures},
        )
    return ProbeResult(
        "lab_stdlib_imports",
        PASS,
        "All standard-library modules needed for the synthetic integrity and timeline labs imported successfully.",
        details={"checked_count": len(LAB_STDLIB_MODULES)},
    )


def probe_sha256(
    hasher: Callable[[bytes], Any] | None = None,
) -> ProbeResult:
    try:
        payload = b"abc"
        digest = (hasher or hashlib.sha256)(payload).hexdigest()
        expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        if digest != expected:
            return ProbeResult(
                "sha256_synthetic_bytes",
                FAIL,
                "The SHA-256 result for the synthetic bytes did not match the known digest.",
                details={"algorithm": "SHA-256", "byte_count": len(payload)},
            )
        return ProbeResult(
            "sha256_synthetic_bytes",
            PASS,
            "SHA-256 was calculated for a small synthetic byte sequence and matched the known digest.",
            details={"algorithm": "SHA-256", "byte_count": len(payload)},
        )
    except Exception as error:
        return ProbeResult(
            "sha256_synthetic_bytes",
            FAIL,
            "The synthetic SHA-256 probe failed.",
            details={"error_type": safe_exception_name(error)},
        )


def probe_json_csv() -> ProbeResult:
    try:
        source = {"event": "login", "sequence": 1, "synthetic": True}
        decoded = json.loads(json.dumps(source, sort_keys=True))
        if decoded != source:
            raise ValueError("JSON round trip mismatch")

        rows = list(csv.DictReader(["name,offset\n", "alpha,0\n", "beta,60\n"]))
        if rows != [{"name": "alpha", "offset": "0"}, {"name": "beta", "offset": "60"}]:
            raise ValueError("CSV round trip mismatch")
        return ProbeResult(
            "json_csv_synthetic_data",
            PASS,
            "Synthetic JSON and CSV records were serialized or parsed successfully.",
            details={"json_records": 1, "csv_rows": len(rows)},
        )
    except Exception as error:
        return ProbeResult(
            "json_csv_synthetic_data",
            FAIL,
            "Synthetic JSON or CSV processing failed.",
            details={"error_type": safe_exception_name(error)},
        )


def probe_timezone_utc() -> ProbeResult:
    try:
        observed = datetime.fromisoformat("2026-09-12T09:00:00+09:00")
        if observed.tzinfo is None or observed.utcoffset() is None:
            raise ValueError("timestamp is not timezone-aware")
        converted = observed.astimezone(timezone.utc)
        expected = "2026-09-12T00:00:00+00:00"
        if converted.isoformat() != expected:
            raise ValueError("UTC conversion mismatch")
        return ProbeResult(
            "timezone_aware_utc",
            PASS,
            "A timezone-aware timestamp was converted to UTC without dropping its offset.",
            details={"source_offset": "+09:00", "utc_offset": "+00:00"},
        )
    except Exception as error:
        return ProbeResult(
            "timezone_aware_utc",
            FAIL,
            "Timezone-aware timestamp conversion to UTC failed.",
            details={"error_type": safe_exception_name(error)},
        )


def _is_link_or_reparse_stat(file_stat: os.stat_result) -> bool:
    return stat.S_ISLNK(file_stat.st_mode) or bool(
        getattr(file_stat, "st_file_attributes", 0) & REPARSE_POINT_ATTRIBUTE
    )


def _validate_temp_parent(parent: Path) -> None:
    try:
        parent_stat = os.lstat(parent)
    except OSError as error:
        raise OSError("temporary parent could not be inspected") from error
    if _is_link_or_reparse_stat(parent_stat):
        raise OSError("temporary parent is a symbolic link or reparse point")
    if not stat.S_ISDIR(parent_stat.st_mode):
        raise NotADirectoryError("temporary parent is not a directory")


def create_owned_directory(temp_root: Path | None = None) -> Path:
    parent = Path(temp_root) if temp_root is not None else Path(tempfile.gettempdir())
    _validate_temp_parent(parent)
    for _ in range(20):
        candidate = parent / f"securium-forensics-preflight-{uuid.uuid4().hex}"
        try:
            os.mkdir(candidate)
        except FileExistsError:
            continue
        candidate_stat = os.lstat(candidate)
        if _is_link_or_reparse_stat(candidate_stat) or not stat.S_ISDIR(candidate_stat.st_mode):
            raise OSError("new temporary directory did not remain a normal directory")
        return candidate
    raise FileExistsError("could not allocate a unique temporary directory")


def probe_owned_filesystem(
    temp_root: Path | None = None,
    directory_factory: Callable[[Path | None], Path] | None = None,
) -> tuple[ProbeResult, Path | None]:
    owned: Path | None = None
    factory = directory_factory or create_owned_directory
    try:
        owned = factory(temp_root)
    except Exception as error:
        return (
            ProbeResult(
                "owned_temp_file_io",
                FAIL,
                "The run-owned temporary directory could not be created.",
                details={
                    "error_type": safe_exception_name(error),
                    "cleanup": NOT_RUN,
                    "scope": "only the requested temporary parent was inspected",
                },
            ),
            None,
        )

    try:
        fixture = owned / "space and 한글.bin"
        expected = b"synthetic-forensics-bytes\x00\xff"
        fixture.write_bytes(expected)
        observed = fixture.read_bytes()
        if observed != expected:
            return (
                ProbeResult(
                    "owned_temp_file_io",
                    FAIL,
                    "Synthetic file bytes changed between write and read.",
                    details={
                        "filename_has_space": True,
                        "filename_has_non_ascii": True,
                        "cleanup": "PENDING",
                    },
                ),
                owned,
            )
        return (
            ProbeResult(
                "owned_temp_file_io",
                PASS,
                "A unique owned temporary directory and a space/non-ASCII filename were written and read with identical bytes.",
                details={
                    "filename_has_space": True,
                    "filename_has_non_ascii": True,
                    "byte_count": len(expected),
                    "cleanup": "PENDING",
                },
            ),
            owned,
        )
    except Exception as error:
        return (
            ProbeResult(
                "owned_temp_file_io",
                FAIL,
                "Synthetic file creation or byte read-back failed.",
                details={"error_type": safe_exception_name(error), "cleanup": "PENDING"},
            ),
            owned,
        )


def _remove_owned_tree(root: Path) -> None:
    try:
        root_stat = os.lstat(root)
    except OSError as error:
        raise CleanupError("the run-owned directory could not be inspected") from error
    if _is_link_or_reparse_stat(root_stat):
        raise CleanupError("the run-owned directory became a symbolic link or reparse point")
    if not stat.S_ISDIR(root_stat.st_mode):
        raise CleanupError("the run-owned path is no longer a directory")

    try:
        entries = list(os.scandir(root))
    except OSError as error:
        raise CleanupError("the run-owned directory could not be enumerated") from error
    for entry in entries:
        entry_path = Path(entry.path)
        try:
            entry_stat = os.lstat(entry_path)
        except OSError as error:
            raise CleanupError("a run-owned entry could not be inspected") from error
        if _is_link_or_reparse_stat(entry_stat):
            raise CleanupError("cleanup refused a symbolic link or reparse point")
        if stat.S_ISDIR(entry_stat.st_mode):
            _remove_owned_tree(entry_path)
        elif stat.S_ISREG(entry_stat.st_mode):
            try:
                os.unlink(entry_path)
            except OSError as error:
                raise CleanupError("a run-owned file could not be removed") from error
        else:
            raise CleanupError("cleanup refused a non-regular run-owned entry")
    try:
        os.rmdir(root)
    except OSError as error:
        raise CleanupError("the run-owned directory could not be removed") from error


def cleanup_owned_directory(owned: Path | None) -> ProbeResult:
    if owned is None:
        return ProbeResult(
            "cleanup",
            NOT_RUN,
            "Cleanup was not run because this execution created no owned directory.",
            details={"scope": "no directory was available for cleanup"},
        )
    try:
        _remove_owned_tree(owned)
    except Exception as error:
        return ProbeResult(
            "cleanup",
            FAIL,
            "Cleanup failed within the run-owned directory boundary; no parent or outside path was targeted.",
            details={
                "error_type": safe_exception_name(error),
                "scope": "this execution's unique directory only",
                "manual_action": "inspect only the reported run-owned directory; do not use broad deletion",
            },
        )
    return ProbeResult(
        "cleanup",
        PASS,
        "The unique directory created by this execution and its own regular files were removed.",
        details={"scope": "this execution's unique directory only", "removed": True},
    )


def not_run_scopes() -> list[ProbeResult]:
    return [
        ProbeResult(
            "ci_success_evidence",
            NOT_RUN,
            "CI was not run; configured matrix membership is not CI success evidence.",
            required=False,
        ),
        ProbeResult(
            "full_lab_execution",
            NOT_RUN,
            "The complete integrity and timeline lab suites were not run by this preflight.",
            required=False,
        ),
        ProbeResult(
            "filesystem_policy_matrix",
            NOT_RUN,
            "Other OS, Python, symlink, junction, and filesystem-policy combinations were not run.",
            required=False,
        ),
        ProbeResult(
            "actual_evidence_handling",
            NOT_RUN,
            "No disk image, OS evidence, MFT/USN data, or user original was read.",
            required=False,
        ),
        ProbeResult(
            "learner_or_instructor_rehearsal",
            NOT_RUN,
            "No classroom rehearsal or learner task completion was performed.",
            required=False,
        ),
        ProbeResult(
            "publication_or_delivery_readiness",
            NOT_RUN,
            "Canonical registration, publication, package delivery, and deployment were not performed.",
            required=False,
        ),
    ]


def run_preflight(
    temp_root: Path | None = None,
    *,
    version_info: Any = sys.version_info,
    system: str | None = None,
    implementation: str | None = None,
) -> dict[str, Any]:
    probes = [
        probe_python_runtime(version_info),
        probe_environment_scope(version_info, system, implementation),
        probe_lab_stdlib_imports(),
        probe_sha256(),
        probe_json_csv(),
        probe_timezone_utc(),
    ]
    filesystem_probe, owned = probe_owned_filesystem(temp_root)
    probes.append(filesystem_probe)
    probes.append(cleanup_owned_directory(owned))
    probes.extend(not_run_scopes())

    has_failure = any(probe.status == FAIL for probe in probes)
    has_unverified = any(probe.status == UNVERIFIED_ENVIRONMENT for probe in probes)
    if has_failure:
        overall_status = FAIL
    elif has_unverified:
        overall_status = UNVERIFIED_ENVIRONMENT
    else:
        overall_status = PASS

    return {
        "tool": TOOL_NAME,
        "schema_version": 1,
        "overall_status": overall_status,
        "environment": {
            "python_version": format_python_version(version_info),
            "implementation": implementation or platform.python_implementation(),
            "os": system or platform.system(),
            "minimum_python": "3.11",
            "configured_matrix": configured_matrix_text(),
        },
        "probes": [probe.as_dict() for probe in probes],
        "boundaries": {
            "network": NOT_RUN,
            "loopback": NOT_RUN,
            "sqlite": NOT_RUN,
            "subprocess": NOT_RUN,
            "real_evidence": NOT_RUN,
            "user_files": NOT_RUN,
            "external_services": NOT_RUN,
        },
    }


def validate_report_target(path: Path) -> None:
    if path.exists():
        raise PreflightUsageError("the requested report already exists; choose a new output path")
    if not path.parent.exists():
        raise PreflightUsageError("the report parent directory does not exist; create it and retry")
    if not path.parent.is_dir():
        raise PreflightUsageError("the report parent is not a directory")


def write_report(path: Path, result: dict[str, Any]) -> None:
    validate_report_target(path)
    payload = json.dumps(result, ensure_ascii=True, indent=2, sort_keys=True) + "\n"
    try:
        with path.open("x", encoding="ascii", newline="\n") as stream:
            stream.write(payload)
    except FileExistsError as error:
        raise PreflightUsageError("the requested report already exists; choose a new output path") from error
    except OSError as error:
        raise PreflightUsageError(
            f"the report could not be written ({safe_exception_name(error)}); no existing file was replaced"
        ) from error


def exit_code_for(result: dict[str, Any]) -> int:
    if result["overall_status"] == FAIL:
        return EXIT_FAIL
    if result["overall_status"] == UNVERIFIED_ENVIRONMENT:
        return EXIT_UNVERIFIED
    return EXIT_PASS


def print_human(result: dict[str, Any]) -> None:
    environment = result["environment"]
    print(f"{TOOL_NAME}")
    print(f"Overall: {result['overall_status']}")
    print(
        "Environment: "
        f"Python {environment['python_version']} / "
        f"{environment['implementation']} / {environment['os']}"
    )
    print(f"Minimum Python: {environment['minimum_python']}")
    print(f"Configured matrix: {environment['configured_matrix']}")
    for probe in result["probes"]:
        print(f"- {probe['name']}: {probe['status']} - {probe['message']}")
    print("No network, loopback, SQLite, subprocess, administrator, credential, or user-file probe was performed.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        action="store_true",
        help="print the structured result instead of the human-readable summary",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="write JSON to a new path; an existing file is never overwritten",
    )
    parser.add_argument(
        "--temp-root",
        type=Path,
        help="use this existing directory only as the parent of a new owned temporary directory",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        result = run_preflight(args.temp_root)
        if args.report is not None:
            write_report(args.report, result)
        if args.json:
            print(json.dumps(result, ensure_ascii=True, indent=2, sort_keys=True))
        else:
            print_human(result)
        return exit_code_for(result)
    except PreflightUsageError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return EXIT_USAGE_OR_OUTPUT


if __name__ == "__main__":
    raise SystemExit(main())
