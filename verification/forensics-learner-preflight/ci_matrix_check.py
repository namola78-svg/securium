#!/usr/bin/env python3
"""Run the standalone preflight contract from an external CI working directory."""

from __future__ import annotations

from collections import Counter
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import Sequence


TOOL_DIRECTORY = Path(__file__).resolve().parent
REPOSITORY_ROOT = TOOL_DIRECTORY.parents[1]
PREFLIGHT = TOOL_DIRECTORY / "preflight.py"
TESTS = TOOL_DIRECTORY / "test_preflight.py"


def clean_child_environment() -> dict[str, str]:
    environment = dict(os.environ)
    for key in list(environment):
        if key.upper() in {"PYTHONPATH", "PYTHONHOME"}:
            environment.pop(key)
    return environment


def run_command(
    label: str,
    command: Sequence[str],
    cwd: Path,
    environment: dict[str, str],
    timeout: float,
) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        list(command),
        cwd=cwd,
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
    )
    print(f"{label}_exit_code={completed.returncode}")
    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="", file=sys.stderr)
    return completed


def record_unittest_counts(output: str) -> None:
    ran_match = re.search(r"Ran (\d+) tests?", output)
    failures_match = re.search(r"failures=(\d+)", output)
    errors_match = re.search(r"errors=(\d+)", output)
    skipped_match = re.search(r"skipped=(\d+)", output)
    discovered = int(ran_match.group(1)) if ran_match else 0
    failures = int(failures_match.group(1)) if failures_match else 0
    errors = int(errors_match.group(1)) if errors_match else 0
    skipped = int(skipped_match.group(1)) if skipped_match else 0
    passed = max(discovered - failures - errors - skipped, 0)
    print(f"unittest_discovered={discovered}")
    print(f"unittest_executed={discovered}")
    print(f"unittest_passed={passed}")
    print(f"unittest_failures={failures}")
    print(f"unittest_errors={errors}")
    print(f"unittest_skipped={skipped}")


def assert_clean_checkout() -> None:
    diff = subprocess.run(
        ["git", "-C", str(REPOSITORY_ROOT), "diff", "--exit-code", "--"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if diff.returncode != 0:
        raise RuntimeError("tracked checkout changed during the preflight contract")
    status = subprocess.check_output(
        ["git", "-C", str(REPOSITORY_ROOT), "status", "--porcelain", "--untracked-files=all"],
        text=True,
        encoding="utf-8",
        errors="replace",
    ).strip()
    if status:
        raise RuntimeError("checkout contains generated or untracked files after the preflight contract")
    print("tracked_worktree_clean=True")


def assert_owned_children_removed(root: Path) -> None:
    remaining = sorted(
        path.name
        for path in root.iterdir()
        if path.name.startswith("securium-forensics-preflight-")
    )
    print(f"owned_preflight_children_after_run={len(remaining)}")
    if remaining:
        raise RuntimeError("the preflight left an owned temporary child behind")


def remove_owned_root(root: Path) -> None:
    root_stat = os.lstat(root)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x0400)
    if stat.S_ISLNK(root_stat.st_mode) or bool(
        getattr(root_stat, "st_file_attributes", 0) & reparse_flag
    ):
        raise RuntimeError("the CI-owned temporary root became a link or reparse point")
    if not stat.S_ISDIR(root_stat.st_mode):
        raise RuntimeError("the CI-owned temporary root is no longer a directory")
    shutil.rmtree(root)
    print("ci_owned_temp_root_removed=True")


def run_contract() -> None:
    environment = clean_child_environment()
    print(f"matrix_os={environment.get('MATRIX_OS', 'unspecified')}")
    print(f"matrix_python={environment.get('MATRIX_PYTHON', 'unspecified')}")
    print(f"runner_os={platform.system()}")
    print(f"python_version={platform.python_version()}")
    print(f"python_implementation={platform.python_implementation()}")
    print(f"python_executable={sys.executable}")
    print("child_pythonpath_absent=" + str(not any(key.upper() == "PYTHONPATH" for key in environment)))
    print("child_pythonhome_absent=" + str(not any(key.upper() == "PYTHONHOME" for key in environment)))

    unittest_root = Path(tempfile.mkdtemp(prefix="securium preflight 한글 "))
    failure: BaseException | None = None
    try:
        tests = run_command(
            "unittest",
            [sys.executable, "-B", str(TESTS), "-v"],
            unittest_root,
            environment,
            timeout=45,
        )
        record_unittest_counts(tests.stdout + tests.stderr)
        if tests.returncode != 0:
            raise RuntimeError("the standalone preflight unittest suite failed")

        sentinel = unittest_root / "external sentinel 한글.txt"
        sentinel.write_text("must remain\n", encoding="utf-8", newline="")
        report = unittest_root / "report with space 한글.json"
        first = run_command(
            "cli",
            [
                sys.executable,
                "-B",
                str(PREFLIGHT),
                "--json",
                "--temp-root",
                str(unittest_root),
                "--report",
                str(report),
            ],
            unittest_root,
            environment,
            timeout=20,
        )
        if first.returncode != 0:
            raise RuntimeError("the standalone CLI did not return PASS")
        result = json.loads(first.stdout)
        print(f"preflight_overall_status={result.get('overall_status')}")
        counts = Counter(probe.get("status") for probe in result.get("probes", []))
        for status in ("PASS", "FAIL", "ERROR", "SKIP", "NOT_RUN", "UNVERIFIED_ENVIRONMENT"):
            print(f"preflight_{status.lower()}={counts.get(status, 0)}")
        if result.get("overall_status") != "PASS":
            raise RuntimeError("the standalone CLI reported a non-PASS result")
        if any(
            probe.get("required") and probe.get("status") in {"NOT_RUN", "FAIL"}
            for probe in result.get("probes", [])
        ):
            raise RuntimeError("a required preflight probe was skipped or failed")
        if not report.is_file():
            raise RuntimeError("the requested report was not created")
        report_before = report.read_bytes()
        print("report_created=True")
        print("sentinel_preserved=" + str(sentinel.read_text(encoding="utf-8") == "must remain\n"))
        if sentinel.read_text(encoding="utf-8") != "must remain\n":
            raise RuntimeError("the external sentinel changed")
        assert_owned_children_removed(unittest_root)

        overwrite = run_command(
            "overwrite_attempt",
            [
                sys.executable,
                "-B",
                str(PREFLIGHT),
                "--json",
                "--temp-root",
                str(unittest_root),
                "--report",
                str(report),
            ],
            unittest_root,
            environment,
            timeout=20,
        )
        print(f"overwrite_rejected={overwrite.returncode == 2}")
        if overwrite.returncode != 2:
            raise RuntimeError("existing report overwrite was not rejected with exit code 2")
        if report.read_bytes() != report_before:
            raise RuntimeError("existing report content changed during overwrite rejection")
        if sentinel.read_text(encoding="utf-8") != "must remain\n":
            raise RuntimeError("the external sentinel changed during overwrite rejection")
        assert_owned_children_removed(unittest_root)
        assert_clean_checkout()
    except BaseException as error:
        failure = error
    finally:
        try:
            remove_owned_root(unittest_root)
        except BaseException as cleanup_error:
            if failure is not None:
                raise RuntimeError(
                    "contract failed and CI-owned temporary-root cleanup failed "
                    f"({type(failure).__name__}; {type(cleanup_error).__name__})"
                ) from failure
            raise
    if failure is not None:
        raise failure


def main() -> int:
    try:
        run_contract()
    except Exception as error:
        print(f"CI_CHECK_FAIL={type(error).__name__}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
