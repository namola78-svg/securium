#!/usr/bin/env python3
"""Diagnose the local prerequisites for the Securium Python 8H labs.

This tool deliberately performs bounded, local probes only.  It does not
install software, change the environment, contact external services, or run
the complete lab suite.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import importlib
import json
import platform
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
from typing import Any, Callable, Sequence


PASS = "PASS"
FAIL = "FAIL"
NOT_CHECKED = "NOT_CHECKED"
UNVERIFIED_ENVIRONMENT = "UNVERIFIED_ENVIRONMENT"

MINIMUM_PYTHON = (3, 11)
MATRIX_PYTHON_MINORS = {11, 14}
MATRIX_SYSTEMS = {"Windows", "Linux"}
PROBE_TIMEOUT_SECONDS = 5.0

# This is the union of standard-library imports used by the M01-M08 source and
# tests.  The preflight itself imports a few additional modules, but those are
# not presented as lab requirements.
LAB_STDLIB_MODULES = (
    "ast",
    "dataclasses",
    "hashlib",
    "hmac",
    "html",
    "http.server",
    "ipaddress",
    "json",
    "os",
    "pathlib",
    "pickle",
    "secrets",
    "socket",
    "sqlite3",
    "subprocess",
    "sys",
    "tempfile",
    "threading",
    "traceback",
    "typing",
    "unittest",
    "urllib.error",
    "urllib.parse",
    "urllib.request",
    "uuid",
)


class PreflightUsageError(RuntimeError):
    """A safe, user-actionable CLI or report-output error."""


@dataclass(frozen=True)
class ProbeResult:
    name: str
    status: str
    message: str
    required: bool = True
    details: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "name": self.name,
            "status": self.status,
            "required": self.required,
            "message": self.message,
        }
        if self.details:
            value["details"] = self.details
        return value


def safe_exception_name(error: BaseException) -> str:
    """Return an error class without leaking paths or environment values."""

    return type(error).__name__


def python_version_tuple(version_info: Any = sys.version_info) -> tuple[int, int, int]:
    if hasattr(version_info, "major"):
        return (int(version_info.major), int(version_info.minor), int(version_info.micro))
    return (int(version_info[0]), int(version_info[1]), int(version_info[2]))


def format_python_version(version_info: Any = sys.version_info) -> str:
    major, minor, micro = python_version_tuple(version_info)
    return f"{major}.{minor}.{micro}"


def probe_python_version(version_info: Any = sys.version_info) -> ProbeResult:
    version = python_version_tuple(version_info)
    if version < MINIMUM_PYTHON:
        return ProbeResult(
            "python_version",
            FAIL,
            "Python 3.11 or newer is required by the lab project.",
            details={"observed_version": format_python_version(version_info)},
        )
    return ProbeResult(
        "python_version",
        PASS,
        "The running Python meets the lab minimum of 3.11.",
        details={
            "observed_version": format_python_version(version_info),
            "implementation": platform.python_implementation(),
        },
    )


def probe_matrix_scope(
    version_info: Any = sys.version_info,
    system: str | None = None,
) -> ProbeResult:
    system_name = system or platform.system()
    version = python_version_tuple(version_info)
    supported = system_name in MATRIX_SYSTEMS and version[0] == 3 and version[1] in MATRIX_PYTHON_MINORS
    if supported:
        return ProbeResult(
            "recorded_matrix_scope",
            PASS,
            "The OS and Python minor version are in the recorded CI matrix.",
            required=False,
            details={"os": system_name, "python_minor": version[1]},
        )
    return ProbeResult(
        "recorded_matrix_scope",
        UNVERIFIED_ENVIRONMENT,
        "Local probes can run, but this OS/Python pair is outside the recorded Windows/Linux 3.11/3.14 matrix.",
        required=False,
        details={"os": system_name, "python_minor": version[1]},
    )


def probe_lab_stdlib_imports() -> ProbeResult:
    failures: list[dict[str, str]] = []
    for module_name in LAB_STDLIB_MODULES:
        try:
            importlib.import_module(module_name)
        except Exception as error:  # Import errors are the useful result here.
            failures.append({"module": module_name, "error_type": safe_exception_name(error)})
    if failures:
        return ProbeResult(
            "lab_stdlib_imports",
            FAIL,
            "One or more standard-library imports used by M01-M08 failed.",
            details={"checked_count": len(LAB_STDLIB_MODULES), "failures": failures},
        )
    return ProbeResult(
        "lab_stdlib_imports",
        PASS,
        "All standard-library modules used by the M01-M08 source and tests imported successfully.",
        details={"checked_count": len(LAB_STDLIB_MODULES)},
    )


def probe_sqlite_memory() -> ProbeResult:
    connection: sqlite3.Connection | None = None
    try:
        connection = sqlite3.connect(":memory:", timeout=PROBE_TIMEOUT_SECONDS)
        connection.execute("CREATE TABLE preflight_probe (value TEXT NOT NULL)")
        connection.execute("INSERT INTO preflight_probe(value) VALUES (?)", ("ok",))
        row = connection.execute("SELECT value FROM preflight_probe").fetchone()
        if row != ("ok",):
            return ProbeResult(
                "sqlite_memory",
                FAIL,
                "The in-memory SQLite round trip returned an unexpected value.",
            )
        return ProbeResult(
            "sqlite_memory",
            PASS,
            "An in-memory SQLite create/insert/select round trip succeeded.",
            details={"database": ":memory:"},
        )
    except Exception as error:
        return ProbeResult(
            "sqlite_memory",
            FAIL,
            f"The in-memory SQLite probe failed ({safe_exception_name(error)}).",
        )
    finally:
        if connection is not None:
            try:
                connection.close()
            except Exception:
                # The probe already reports the operation result.  Closing a
                # memory-only connection cannot be retried safely here.
                pass


def probe_temporary_file() -> ProbeResult:
    owned_directory: Path | None = None
    cleanup_ok = False
    try:
        owned_directory = Path(tempfile.mkdtemp(prefix="securium-python-8h-preflight-"))
        test_file = owned_directory / "space and 한글.txt"
        expected = "preflight-only fixture\n"
        test_file.write_text(expected, encoding="utf-8", newline="")
        if test_file.read_text(encoding="utf-8") != expected:
            return ProbeResult(
                "temporary_file_io",
                FAIL,
                "The temporary file read did not match the written fixture.",
                details={"cleanup": "pending"},
            )
        return_value = ProbeResult(
            "temporary_file_io",
            PASS,
            "An owned temporary directory and a space/non-ASCII filename were written and read.",
            details={"non_ascii_filename": True, "cleanup": "pending"},
        )
    except Exception as error:
        return_value = ProbeResult(
            "temporary_file_io",
            FAIL,
            f"Temporary file creation or storage failed ({safe_exception_name(error)}).",
            details={"cleanup": "pending"},
        )
    finally:
        if owned_directory is not None:
            try:
                shutil.rmtree(owned_directory)
                cleanup_ok = not owned_directory.exists()
            except Exception as error:
                return_value = ProbeResult(
                    "temporary_file_io",
                    FAIL,
                    f"The owned temporary directory could not be cleaned up ({safe_exception_name(error)}).",
                    details={"cleanup": "FAIL"},
                )
    if owned_directory is None:
        return return_value
    if not cleanup_ok:
        return ProbeResult(
            "temporary_file_io",
            FAIL,
            "The owned temporary directory still exists after cleanup.",
            details={"cleanup": "FAIL"},
        )
    details = dict(return_value.details or {})
    details["cleanup"] = "PASS"
    return ProbeResult(return_value.name, return_value.status, return_value.message, details=details)


def run_owned_subprocess(
    runner: Callable[..., subprocess.CompletedProcess[str]] | None = None,
) -> ProbeResult:
    if runner is None:
        runner = subprocess.run
    command: Sequence[str] = (
        sys.executable,
        "-c",
        "import sys; sys.stdout.write('securium-preflight-child-ok\\n')",
    )
    try:
        completed = runner(
            list(command),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            timeout=PROBE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return ProbeResult(
            "owned_subprocess",
            FAIL,
            f"The self-owned Python subprocess exceeded the {PROBE_TIMEOUT_SECONDS:g}s timeout.",
        )
    except Exception as error:
        return ProbeResult(
            "owned_subprocess",
            FAIL,
            f"The self-owned Python subprocess could not start ({safe_exception_name(error)}).",
        )
    if completed.returncode != 0:
        return ProbeResult(
            "owned_subprocess",
            FAIL,
            "The self-owned Python subprocess returned a non-zero exit code.",
            details={"returncode": completed.returncode},
        )
    if completed.stdout != "securium-preflight-child-ok\n":
        return ProbeResult(
            "owned_subprocess",
            FAIL,
            "The self-owned Python subprocess returned an unexpected marker.",
        )
    return ProbeResult(
        "owned_subprocess",
        PASS,
        "A self-owned Python subprocess completed within the bounded timeout.",
        details={"timeout_seconds": PROBE_TIMEOUT_SECONDS},
    )


def probe_loopback_ephemeral_port() -> ProbeResult:
    listener: socket.socket | None = None
    result: ProbeResult
    try:
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.settimeout(PROBE_TIMEOUT_SECONDS)
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        port = listener.getsockname()[1]
        if not isinstance(port, int) or port <= 0:
            result = ProbeResult(
                "loopback_ephemeral_bind",
                FAIL,
                "The OS did not return a usable ephemeral loopback port.",
            )
        else:
            result = ProbeResult(
                "loopback_ephemeral_bind",
                PASS,
                "127.0.0.1 accepted an OS-assigned ephemeral listener, which this process can close.",
                details={"address": "127.0.0.1", "ephemeral_port_assigned": True},
            )
    except Exception as error:
        result = ProbeResult(
            "loopback_ephemeral_bind",
            FAIL,
            f"The 127.0.0.1 ephemeral bind failed ({safe_exception_name(error)}).",
        )
    if listener is None:
        return result
    try:
        listener.close()
    except Exception as error:
        return ProbeResult(
            "loopback_ephemeral_bind",
            FAIL,
            f"The owned loopback listener could not be closed ({safe_exception_name(error)}).",
            details={"cleanup": "FAIL"},
        )
    details = dict(result.details or {})
    details["cleanup"] = "PASS"
    return ProbeResult(result.name, result.status, result.message, required=result.required, details=details)


def not_checked_scopes() -> list[ProbeResult]:
    return [
        ProbeResult(
            "full_lab_test_suite",
            NOT_CHECKED,
            "The preflight does not run the 50-test lab suite; run focused or aggregate commands separately.",
            required=False,
        ),
        ProbeResult(
            "browser_harness",
            NOT_CHECKED,
            "The M05 browser harness is separate; current recorded scope is HTTP PARTIAL and HTTPS NOT_RUN.",
            required=False,
        ),
        ProbeResult(
            "classroom_rehearsal",
            NOT_CHECKED,
            "No learner or instructor rehearsal is performed by this diagnostic.",
            required=False,
        ),
    ]


def build_result() -> dict[str, Any]:
    environment = {
        "python_version": format_python_version(),
        "implementation": platform.python_implementation(),
        "os": platform.system(),
        "platform": platform.platform(aliased=True, terse=True),
    }
    probes = [
        probe_python_version(),
        probe_matrix_scope(),
        probe_lab_stdlib_imports(),
        probe_sqlite_memory(),
        probe_temporary_file(),
        run_owned_subprocess(),
        probe_loopback_ephemeral_port(),
        *not_checked_scopes(),
    ]
    required_failures = [probe.name for probe in probes if probe.required and probe.status == FAIL]
    has_unverified = any(probe.status == UNVERIFIED_ENVIRONMENT for probe in probes)
    if required_failures:
        overall_status = FAIL
    elif has_unverified:
        overall_status = UNVERIFIED_ENVIRONMENT
    else:
        overall_status = PASS
    return {
        "tool": "securium-python-8h-learner-preflight",
        "schema_version": 1,
        "overall_status": overall_status,
        "environment": environment,
        "probes": [probe.as_dict() for probe in probes],
        "boundaries": {
            "package_execution": "NOT_CHECKED",
            "full_lab_compatibility": "NOT_CERTIFIED",
            "browser_verification": "NOT_CHECKED",
            "classroom_delivery_readiness": "NOT_CHECKED",
            "external_network": "NOT_USED",
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
    payload = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    try:
        with path.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(payload)
    except FileExistsError as error:
        raise PreflightUsageError("the requested report already exists; choose a new output path") from error
    except OSError as error:
        raise PreflightUsageError(
            f"the report could not be written ({safe_exception_name(error)}); no existing file was replaced"
        ) from error


def print_human(result: dict[str, Any]) -> None:
    print("Securium Python 8H learner environment preflight")
    print(f"Overall: {result['overall_status']}")
    print(
        "Environment: "
        f"Python {result['environment']['python_version']} / "
        f"{result['environment']['implementation']} / "
        f"{result['environment']['os']}"
    )
    for probe in result["probes"]:
        print(f"- {probe['name']}: {probe['status']} - {probe['message']}")
    print("No software, environment variable, firewall, host, trust store, browser profile, or external service was changed.")


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
        help="write JSON to a new, explicit path; existing files are never overwritten",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        if args.report is not None:
            validate_report_target(args.report)
        result = build_result()
        if args.report is not None:
            write_report(args.report, result)
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        else:
            print_human(result)
        return 1 if result["overall_status"] == FAIL else 0
    except PreflightUsageError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
