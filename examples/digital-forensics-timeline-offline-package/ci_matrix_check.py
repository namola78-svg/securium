"""Run the timeline offline-package contract in a disposable CI workspace.

The harness is deliberately outside the package allowlist.  It binds source
verification to the exact checkout selected by the workflow, runs the package
boundary tests, and then exercises the extracted timeline lab from its own
working directory without repository import paths.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_ROOT = Path(__file__).resolve().parent
BUILDER = PACKAGE_ROOT / "build_offline_package.py"
LAB_ARCHIVE_ROOT = "examples/digital-forensics-timeline-local-lab"
ZIP_NAME = "securium-forensics-timeline-offline-package.zip"
MANIFEST_NAME = "securium-forensics-timeline-offline-package.manifest.json"
CI_ROOT_ENV = "SECURIUM_OFFLINE_CI_ROOT"


def _clean_environment() -> dict[str, str]:
    environment = os.environ.copy()
    for key in list(environment):
        if key.upper() in {"PYTHONPATH", "PYTHONHOME"}:
            environment.pop(key, None)
    return environment


def _test_environment(ci_root: Path) -> dict[str, str]:
    environment = _clean_environment()
    for key in ("TMPDIR", "TEMP", "TMP"):
        environment[key] = str(ci_root)
    return environment


def _run(
    command: list[str],
    *,
    cwd: Path,
    expected_code: int | None = None,
    environment: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=environment or _clean_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if expected_code is not None and result.returncode != expected_code:
        detail = result.stderr.strip() or result.stdout.strip() or "no command output"
        raise RuntimeError(
            f"unexpected exit code {result.returncode}; expected {expected_code}; "
            f"output={detail[-2000:]}"
        )
    return result


def _json_output(result: subprocess.CompletedProcess[str]) -> dict[str, object]:
    for output in (result.stdout, result.stderr):
        if output.strip():
            try:
                value = json.loads(output)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                return value
    raise RuntimeError("command did not return a JSON object")


def _sha256_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            size += len(block)
            digest.update(block)
    return size, digest.hexdigest()


def _run_package_regressions(ci_root: Path) -> dict[str, object]:
    """Run all package tests and reject zero, skipped, failed, or errored runs."""

    suite_code = (
        "import json, sys, unittest; "
        f"root={str(PACKAGE_ROOT)!r}; sys.path.insert(0, root); "
        "suite=unittest.defaultTestLoader.discover(root, pattern='test_*.py', top_level_dir=root); "
        "discovered=suite.countTestCases(); result=unittest.TextTestRunner(verbosity=1).run(suite); "
        "summary={'discovered': discovered, 'executed': result.testsRun, "
        "'failed': len(result.failures), 'errors': len(result.errors), "
        "'skipped': len(result.skipped), 'expected_failures': len(result.expectedFailures), "
        "'unexpected_successes': len(result.unexpectedSuccesses)}; "
        "print(json.dumps(summary, sort_keys=True)); "
        "raise SystemExit(0 if discovered > 0 and result.testsRun == discovered "
        "and not result.failures and not result.errors and not result.skipped "
        "and not result.expectedFailures and not result.unexpectedSuccesses else 1)"
    )
    result = _run(
        [sys.executable, "-B", "-c", suite_code],
        cwd=REPOSITORY_ROOT,
        environment=_test_environment(ci_root),
    )
    summary = _json_output(result)
    summary["process_exit"] = result.returncode
    print("package_regressions=" + json.dumps(summary, sort_keys=True))
    if (
        result.returncode != 0
        or not isinstance(summary.get("discovered"), int)
        or summary["discovered"] <= 0
        or summary.get("executed") != summary.get("discovered")
        or summary.get("failed")
        or summary.get("errors")
        or summary.get("skipped")
        or summary.get("expected_failures")
        or summary.get("unexpected_successes")
    ):
        raise RuntimeError("package regression accounting did not pass")
    return summary


def _assert_cli_json(
    result: subprocess.CompletedProcess[str], expected_code: int, expected_status: str
) -> dict[str, object]:
    if result.returncode != expected_code:
        raise RuntimeError(f"CLI returned {result.returncode}; expected {expected_code}")
    payload = _json_output(result)
    if payload.get("status") != expected_status:
        raise RuntimeError(f"CLI returned unexpected status: {payload.get('status')!r}")
    return payload


def _runner_summary(result: subprocess.CompletedProcess[str]) -> dict[str, object]:
    combined = result.stdout + result.stderr
    for line in reversed(combined.splitlines()):
        if line.startswith("timeline_lab_test_summary="):
            value = json.loads(line.split("=", 1)[1])
            if isinstance(value, dict):
                return value
    raise RuntimeError("extracted strict runner did not emit a summary")


def _remove_owned_child(path: Path, parent: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    resolved = path.resolve()
    if resolved.parent != parent.resolve():
        raise RuntimeError(f"refusing cleanup outside CI-owned parent: {path}")
    if path.is_symlink() or not path.is_dir():
        raise RuntimeError(f"refusing cleanup of replaced CI workspace: {path}")
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    try:
        if path.stat(follow_symlinks=False).st_file_attributes & reparse_flag:
            raise RuntimeError(f"refusing cleanup of reparse CI workspace: {path}")
    except AttributeError:
        pass
    shutil.rmtree(path)


def _run_extracted_lab(extraction: Path, ci_root: Path) -> dict[str, object]:
    environment = _test_environment(ci_root)
    lab_root = extraction.joinpath(*LAB_ARCHIVE_ROOT.split("/"))
    cli_path = lab_root / "cli.py"
    runner = lab_root / "run_tests.py"
    if not lab_root.is_dir() or not cli_path.is_file() or not runner.is_file():
        raise RuntimeError("extracted timeline lab is incomplete")

    strict_runner = _run(
        [sys.executable, "-B", str(runner)],
        cwd=extraction,
        environment=environment,
    )
    if strict_runner.returncode != 0:
        raise RuntimeError(
            "extracted strict runner failed: "
            + (strict_runner.stderr.strip() or strict_runner.stdout.strip())[-2000:]
        )
    runner_summary = _runner_summary(strict_runner)
    if (
        not isinstance(runner_summary.get("discovered"), int)
        or runner_summary["discovered"] <= 0
        or runner_summary.get("executed") != runner_summary.get("discovered")
        or runner_summary.get("failed")
        or runner_summary.get("errors")
        or runner_summary.get("skipped")
        or runner_summary.get("expected_failures")
        or runner_summary.get("unexpected_successes")
    ):
        raise RuntimeError("extracted strict runner accounting did not pass")
    print("extracted_runner=" + json.dumps(runner_summary, sort_keys=True))

    workspace = ci_root / "timeline CLI workspace 한글 space"
    workspace.mkdir()
    fixed_created = "2026-09-11T09:15:00+09:00"
    fixed_run = "2026-09-11T09:30:00+09:00"
    fixture = workspace / "synthetic fixture.json"
    report_one = workspace / "timeline report one.json"
    report_two = workspace / "timeline report two.json"
    csv_fixture = workspace / "synthetic fixture.csv"
    csv_report = workspace / "CSV timeline report.json"

    def cli(*arguments: str, expected_code: int | None = None) -> subprocess.CompletedProcess[str]:
        return _run(
            [sys.executable, "-B", str(cli_path), *arguments],
            cwd=extraction,
            expected_code=expected_code,
            environment=environment,
        )

    try:
        generated = _assert_cli_json(
            cli("generate", "--output", str(fixture), "--fixture-created-at", fixed_created),
            0,
            "GENERATED",
        )
        if generated.get("fixture_created_at") != fixed_created:
            raise RuntimeError("fixture creation time was not preserved")
        before_size, before_hash = _sha256_file(fixture)

        first_result = _assert_cli_json(
            cli(
                "analyze",
                "--input",
                str(fixture),
                "--output",
                str(report_one),
                "--analysis-run-at",
                fixed_run,
            ),
            0,
            "ANALYZED",
        )
        first_report_bytes = report_one.read_bytes()
        first_report_size, first_report_hash = _sha256_file(report_one)
        if first_report_hash != first_result.get("report_bytes_sha256"):
            raise RuntimeError("JSON report byte hash does not match CLI output")

        second_result = _assert_cli_json(
            cli(
                "analyze",
                "--input",
                str(fixture),
                "--output",
                str(report_two),
                "--analysis-run-at",
                fixed_run,
            ),
            0,
            "ANALYZED",
        )
        second_report_size, second_report_hash = _sha256_file(report_two)
        if report_two.read_bytes() != first_report_bytes or (
            first_report_size,
            first_report_hash,
        ) != (second_report_size, second_report_hash):
            raise RuntimeError("fixed analysis time did not reproduce report bytes")

        _assert_cli_json(
            cli(
                "generate",
                "--format",
                "csv",
                "--output",
                str(csv_fixture),
                "--fixture-created-at",
                fixed_created,
            ),
            0,
            "GENERATED",
        )
        csv_result = _assert_cli_json(
            cli(
                "analyze",
                "--input",
                str(csv_fixture),
                "--output",
                str(csv_report),
                "--analysis-run-at",
                fixed_run,
            ),
            0,
            "ANALYZED",
        )
        if csv_result.get("deterministic_result_sha256") != first_result.get(
            "deterministic_result_sha256"
        ):
            raise RuntimeError("JSON and CSV normalized results differ")
        if csv_result.get("input_sha256") == first_result.get("input_sha256"):
            raise RuntimeError("JSON and CSV raw input hashes unexpectedly match")

        overwrite_before = report_one.read_bytes()
        overwrite = cli(
            "analyze",
            "--input",
            str(fixture),
            "--output",
            str(report_one),
            "--analysis-run-at",
            fixed_run,
        )
        if overwrite.returncode != 2 or report_one.read_bytes() != overwrite_before:
            raise RuntimeError("existing report overwrite contract failed")
        if "overwrite" not in overwrite.stderr.lower():
            raise RuntimeError("overwrite rejection did not explain the boundary")

        malformed = workspace / "malformed.json"
        malformed_report = workspace / "malformed report.json"
        malformed.write_text("{", encoding="utf-8")
        malformed_result = cli(
            "analyze",
            "--input",
            str(malformed),
            "--output",
            str(malformed_report),
            "--analysis-run-at",
            fixed_run,
        )
        if malformed_result.returncode != 2 or malformed_report.exists():
            raise RuntimeError("malformed input partial-output contract failed")

        after_size, after_hash = _sha256_file(fixture)
        if (before_size, before_hash) != (after_size, after_hash):
            raise RuntimeError("input fixture changed during CLI scenarios")

        # These are expectations for the current synthetic fixture, not general
        # forensic rules or findings about a real incident.
        if (
            first_result.get("record_count") != 6
            or first_result.get("tie_group_count") != 2
            or first_result.get("potential_conflict_count") != 1
        ):
            raise RuntimeError("current synthetic fixture expectation mismatch")
        scenarios = {
            "json_generate_exit": 0,
            "json_analyze_exit": 0,
            "csv_generate_exit": 0,
            "csv_analyze_exit": 0,
            "overwrite_exit": overwrite.returncode,
            "malformed_exit": malformed_result.returncode,
            "input_size_preserved": True,
            "input_hash_preserved": True,
            "fixed_report_bytes_equal": True,
            "csv_raw_hash_differs": True,
            "record_count": first_result["record_count"],
            "tie_group_count": first_result["tie_group_count"],
            "potential_conflict_count": first_result["potential_conflict_count"],
            "input_size": before_size,
            "input_sha256": first_result["input_sha256"],
            "deterministic_result_sha256": first_result["deterministic_result_sha256"],
            "report_bytes_sha256": first_result["report_bytes_sha256"],
        }
        print("extracted_cli=" + json.dumps(scenarios, sort_keys=True))
        return {"runner": runner_summary, "cli": scenarios}
    finally:
        _remove_owned_child(workspace, ci_root)
        print("lab_owned_workspace_cleanup=" + str(not workspace.exists()).upper())


def _run_package_flow(ci_root: Path, expected_source_sha: str) -> None:
    first_dir = ci_root / "build one"
    second_dir = ci_root / "build two"
    build_args = [
        sys.executable,
        "-B",
        str(BUILDER),
        "build",
        "--repository-root",
        str(REPOSITORY_ROOT),
        "--output-dir",
        "PLACEHOLDER",
        "--source-commit",
        expected_source_sha,
    ]
    first = _json_output(
        _run(
            [*build_args[:7], str(first_dir), *build_args[8:]],
            cwd=REPOSITORY_ROOT,
            expected_code=0,
        )
    )
    second = _json_output(
        _run(
            [*build_args[:7], str(second_dir), *build_args[8:]],
            cwd=REPOSITORY_ROOT,
            expected_code=0,
        )
    )
    for result in (first, second):
        if result.get("status") != "BUILT" or result.get("source_commit") != expected_source_sha:
            raise RuntimeError("package build did not bind to the checked-out source commit")
    first_zip = first_dir / ZIP_NAME
    second_zip = second_dir / ZIP_NAME
    first_size, first_hash = _sha256_file(first_zip)
    second_size, second_hash = _sha256_file(second_zip)
    if first_zip.read_bytes() != second_zip.read_bytes() or (first_size, first_hash) != (
        second_size,
        second_hash,
    ):
        raise RuntimeError("same-job package builds produced different ZIP bytes or hashes")
    first_manifest = json.loads((first_dir / MANIFEST_NAME).read_text(encoding="utf-8"))
    source_entry_count = first_manifest.get("entry_count_including_internal_manifest", 0) - 1
    zip_entry_count = first_manifest.get("entry_count_including_internal_manifest", 0)
    if not isinstance(source_entry_count, int) or source_entry_count <= 0 or zip_entry_count != source_entry_count + 1:
        raise RuntimeError("package entry accounting is invalid")
    print(
        "package_reproducibility="
        + json.dumps(
            {
                "source_commit": expected_source_sha,
                "source_entry_count": source_entry_count,
                "zip_entry_count": zip_entry_count,
                "same_bytes": True,
                "same_hash": True,
                "zip_size": first_size,
                "zip_sha256": first_hash,
            },
            sort_keys=True,
        )
    )

    extraction = ci_root / "검증 extraction package"
    report = ci_root / "source-bound verification report.json"
    verification = _json_output(
        _run(
            [
                sys.executable,
                "-B",
                str(BUILDER),
                "verify",
                "--zip",
                str(first_zip),
                "--manifest",
                str(first_dir / MANIFEST_NAME),
                "--repository-root",
                str(REPOSITORY_ROOT),
                "--source-commit",
                expected_source_sha,
                "--extract-dir",
                str(extraction),
                "--report",
                str(report),
            ],
            cwd=REPOSITORY_ROOT,
            expected_code=0,
        )
    )
    links = verification.get("markdown_links", {})
    if (
        verification.get("status") != "PASS"
        or verification.get("source_verification") != "PASS"
        or verification.get("source_commit") != expected_source_sha
        or verification.get("entry_count") != zip_entry_count
        or not isinstance(links, dict)
        or not links.get("internal")
        or not links.get("external")
        or verification.get("extraction", {}).get("status") != "PASS"
    ):
        raise RuntimeError("source-bound package verification did not pass")
    print(
        "package_verification="
        + json.dumps(
            {
                "status": verification["status"],
                "source_verification": verification["source_verification"],
                "source_commit": verification["source_commit"],
                "entries": verification["entry_count"],
                "internal_links": len(links["internal"]),
                "external_links": len(links["external"]),
            },
            sort_keys=True,
        )
    )

    # No extracted code is run before the source-bound verification above.  The
    # package regression suite already exercises self-consistent payload/manifest
    # tampering, source-record replacement, unsafe entries, and owned cleanup.
    _run_extracted_lab(extraction, ci_root)


def _remove_ci_root(path: Path) -> None:
    if not path.exists():
        return
    if path.is_symlink() or not path.is_dir():
        raise RuntimeError("refusing cleanup of a replaced CI root")
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    try:
        if path.stat(follow_symlinks=False).st_file_attributes & reparse_flag:
            raise RuntimeError("refusing cleanup of a reparse CI root")
    except AttributeError:
        pass
    shutil.rmtree(path)


def _run_in_root(ci_root: Path, expected_source_sha: str) -> None:
    if ci_root.exists() or ci_root.is_symlink():
        raise RuntimeError(f"CI root must be new and empty: {ci_root}")
    ci_root.mkdir(parents=True, exist_ok=False)
    try:
        _run_package_regressions(ci_root)
        _run_package_flow(ci_root, expected_source_sha)
    finally:
        _remove_ci_root(ci_root)
        print("ci_owned_workspace_cleanup=" + str(not ci_root.exists()).upper())


def main() -> int:
    expected_source_sha = os.environ.get("EXPECTED_SOURCE_SHA", "").strip()
    if not expected_source_sha:
        raise RuntimeError("EXPECTED_SOURCE_SHA is required")
    actual_source_sha = subprocess.check_output(
        ["git", "-C", str(REPOSITORY_ROOT), "rev-parse", "HEAD"],
        text=True,
        encoding="utf-8",
    ).strip()
    if actual_source_sha != expected_source_sha:
        raise RuntimeError(
            f"checked-out source SHA {actual_source_sha} does not match expected {expected_source_sha}"
        )
    print(
        "source_provenance="
        + json.dumps(
            {
                "event": os.environ.get("GITHUB_EVENT_NAME", "local"),
                "workflow_run_head_sha": os.environ.get("RUN_HEAD_SHA", "unknown"),
                "expected_source_sha": expected_source_sha,
                "checked_out_source_sha": actual_source_sha,
                "matrix_os": os.environ.get("MATRIX_OS", "unknown"),
                "matrix_python": os.environ.get("MATRIX_PYTHON", "unknown"),
                "python": platform.python_version(),
                "platform": platform.platform(),
                "executable": sys.executable,
                "source_selection": "explicit expected checkout SHA; workflow run head is not trusted source",
            },
            sort_keys=True,
        )
    )
    requested_root = os.environ.get(CI_ROOT_ENV, "").strip()
    if requested_root:
        _run_in_root(Path(requested_root), expected_source_sha)
    else:
        with tempfile.TemporaryDirectory(prefix="securium-forensics-timeline-offline-ci-") as temporary:
            _run_in_root(Path(temporary) / "owned", expected_source_sha)
    print("offline_package_ci=PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"offline_package_ci=FAIL reason={error}", file=sys.stderr)
        raise SystemExit(1)
