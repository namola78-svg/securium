"""Run the offline package contract in a disposable matrix-job workspace.

This harness is intentionally outside the package allowlist.  It proves that
the committed builder can create and verify a package, then runs the copied
lab from its extracted working directory without repository import paths.
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


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_ROOT = Path(__file__).resolve().parent
LAB_ROOT = REPOSITORY_ROOT / "examples" / "digital-forensics-integrity-local-lab"
BUILDER = PACKAGE_ROOT / "build_offline_package.py"
EXPECTED_PACKAGE_TESTS = 14
EXPECTED_LAB_TESTS = 25
WINDOWS_REPARSE_TEST = "test_windows_reparse_point_is_rejected_when_supported"
CI_ROOT_ENV = "SECURIUM_OFFLINE_CI_ROOT"


def _clean_environment() -> dict[str, str]:
    environment = os.environ.copy()
    for key in list(environment):
        if key.upper() in {"PYTHONPATH", "PYTHONHOME"}:
            environment.pop(key, None)
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


def _test_environment(ci_root: Path) -> dict[str, str]:
    environment = _clean_environment()
    for key in ("TMPDIR", "TEMP", "TMP"):
        environment[key] = str(ci_root)
    return environment


def _run_package_boundary_tests(ci_root: Path) -> dict[str, object]:
    suite_code = (
        "import json, os, sys, unittest; "
        f"package_root={str(PACKAGE_ROOT)!r}; sys.path.insert(0, package_root); "
        "suite=unittest.defaultTestLoader.discover(package_root, pattern='test_*.py', top_level_dir=package_root); "
        "discovered=suite.countTestCases(); result=unittest.TextTestRunner(verbosity=0).run(suite); "
        "skipped_ids=sorted(test.id().rsplit('.', 1)[-1] for test, _reason in result.skipped); "
        "summary={'discovered':discovered,'executed':result.testsRun,'failed':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'skipped_ids':skipped_ids,'todo':0}; "
        "print(json.dumps(summary, sort_keys=True)); "
        f"raise SystemExit(0 if discovered == {EXPECTED_PACKAGE_TESTS} and result.testsRun == {EXPECTED_PACKAGE_TESTS} and not result.failures and not result.errors and not result.skipped else 1)"
    )
    result = _run(
        [sys.executable, "-B", "-c", suite_code],
        cwd=REPOSITORY_ROOT,
        environment=_test_environment(ci_root),
    )
    summary = _json_output(result)
    summary["process_exit"] = result.returncode
    print("packaging_boundary=" + json.dumps(summary, sort_keys=True))
    if (
        result.returncode != 0
        or summary.get("discovered") != EXPECTED_PACKAGE_TESTS
        or summary.get("executed") != EXPECTED_PACKAGE_TESTS
        or summary.get("failed")
        or summary.get("errors")
        or summary.get("skipped")
    ):
        raise RuntimeError("packaging boundary test accounting did not pass")
    return summary


def _assert_payload(result: subprocess.CompletedProcess[str], expected_code: int, expected_status: str) -> dict[str, object]:
    if result.returncode != expected_code:
        raise RuntimeError(f"CLI returned {result.returncode}; expected {expected_code}")
    payload = _json_output(result)
    if payload.get("status") != expected_status:
        raise RuntimeError(f"CLI returned an unexpected status: {payload.get('status')!r}")
    return payload


def _run_extracted_lab(extraction: Path, ci_root: Path) -> dict[str, object]:
    environment = _clean_environment()
    suite_code = (
        "import io, json, os, sys, unittest; "
        "suite=unittest.defaultTestLoader.discover('examples/digital-forensics-integrity-local-lab', pattern='test_*.py'); "
        "discovered=suite.countTestCases(); stream=io.StringIO(); result=unittest.TextTestRunner(stream=stream, verbosity=1).run(suite); "
        "skipped_ids=sorted(test.id().rsplit('.', 1)[-1] for test, _reason in result.skipped); "
        "expected={'test_windows_reparse_point_is_rejected_when_supported'} if os.name != 'nt' else set(); "
        "summary={'discovered':discovered,'executed':result.testsRun,'failed':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'skipped_ids':skipped_ids,'expected_skips':sorted(expected),'todo':0}; "
        "print(json.dumps(summary, sort_keys=True)); "
        "raise SystemExit(0 if discovered == 25 and result.testsRun == 25 and not result.failures and not result.errors and set(skipped_ids) == expected else 1)"
    )
    suite_result = _run(
        [sys.executable, "-B", "-c", suite_code],
        cwd=extraction,
        expected_code=0,
        environment=environment,
    )
    lab_summary = _json_output(suite_result)
    print("extracted_lab=" + json.dumps(lab_summary, sort_keys=True))
    if lab_summary.get("discovered") != EXPECTED_LAB_TESTS:
        raise RuntimeError("extracted lab test discovery changed unexpectedly")
    expected_skips = {WINDOWS_REPARSE_TEST} if os.name != "nt" else set()
    if set(lab_summary.get("skipped_ids", [])) != expected_skips:
        raise RuntimeError("unexpected platform skip in extracted lab tests")

    workspace = ci_root / "lab workspace 한글"
    prepare_result = _run(
        [
            sys.executable,
            "-B",
            "examples/digital-forensics-integrity-local-lab/cli.py",
            "prepare",
            "--recorded-at",
            "2026-09-11T09:00:00+09:00",
            "--workspace",
            str(workspace),
        ],
        cwd=extraction,
        expected_code=0,
        environment=environment,
    )
    prepared = _assert_payload(prepare_result, 0, "PREPARED")
    if Path(prepared.get("workspace", "")).resolve() != workspace.resolve():
        raise RuntimeError("CLI prepared an unexpected workspace")

    original = workspace / "original" / "host-alpha" / "events" / "authentication.log"
    before_size, before_hash = _sha256_file(original)
    try:
        normal_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "verify",
                "--workspace",
                str(workspace),
                "--report",
                "reports/normal.json",
            ],
            cwd=extraction,
            environment=environment,
        )
        normal = _assert_payload(normal_result, 0, "PASS")
        if not (workspace / "reports" / "normal.json").is_file():
            raise RuntimeError("normal report was not created")

        overwrite_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "verify",
                "--workspace",
                str(workspace),
                "--report",
                "reports/normal.json",
            ],
            cwd=extraction,
            environment=environment,
        )
        _assert_payload(overwrite_result, 2, "REJECTED")

        tamper_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "tamper",
                "--workspace",
                str(workspace),
                "--path",
                "working-copy/host-alpha/events/authentication.log",
            ],
            cwd=extraction,
            expected_code=0,
            environment=environment,
        )
        _assert_payload(tamper_result, 0, "MUTATED_WORKING_COPY")
        tampered_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "verify",
                "--workspace",
                str(workspace),
                "--report",
                "reports/tampered.json",
            ],
            cwd=extraction,
            environment=environment,
        )
        tampered = _assert_payload(tampered_result, 1, "REJECTED")

        remove_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "remove",
                "--workspace",
                str(workspace),
                "--path",
                "working-copy/host-beta/network/network-summary.txt",
            ],
            cwd=extraction,
            expected_code=0,
            environment=environment,
        )
        _assert_payload(remove_result, 0, "REMOVED_WORKING_COPY")
        missing_result = _run(
            [
                sys.executable,
                "-B",
                "examples/digital-forensics-integrity-local-lab/cli.py",
                "verify",
                "--workspace",
                str(workspace),
                "--report",
                "reports/missing.json",
            ],
            cwd=extraction,
            environment=environment,
        )
        missing = _assert_payload(missing_result, 1, "REJECTED")

        after_size, after_hash = _sha256_file(original)
        if (before_size, before_hash) != (after_size, after_hash):
            raise RuntimeError("original file changed during CLI negative scenarios")
        print(
            "cli_scenarios="
            + json.dumps(
                {
                    "normal": {"status": normal["status"], "exit": normal_result.returncode},
                    "tampered": {"status": tampered["status"], "exit": tampered_result.returncode},
                    "missing": {"status": missing["status"], "exit": missing_result.returncode},
                    "overwrite_exit": overwrite_result.returncode,
                    "original_hash_preserved": True,
                    "original_size_preserved": True,
                },
                sort_keys=True,
            )
        )
        return {"suite": lab_summary, "normal": normal, "tampered": tampered, "missing": missing}
    finally:
        if workspace.exists():
            cleanup_result = _run(
                [
                    sys.executable,
                    "-B",
                    "examples/digital-forensics-integrity-local-lab/cli.py",
                    "cleanup",
                    "--workspace",
                    str(workspace),
                ],
                cwd=extraction,
                environment=environment,
            )
            if cleanup_result.returncode != 0 or workspace.exists():
                raise RuntimeError("lab-owned workspace cleanup did not complete")


def _run_package_flow(ci_root: Path, expected_source_sha: str) -> None:
    first_dir = ci_root / "build one"
    second_dir = ci_root / "build two"
    build_command = [
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

    first_result = _run(
        [*build_command[:-3], str(first_dir), *build_command[-2:]],
        cwd=REPOSITORY_ROOT,
        expected_code=0,
    )
    second_result = _run(
        [*build_command[:-3], str(second_dir), *build_command[-2:]],
        cwd=REPOSITORY_ROOT,
        expected_code=0,
    )
    first = _json_output(first_result)
    second = _json_output(second_result)
    if first.get("source_commit") != expected_source_sha or second.get("source_commit") != expected_source_sha:
        raise RuntimeError("package build did not use the exact checked-out source commit")
    first_zip = first_dir / "securium-forensics-integrity-offline-package.zip"
    second_zip = second_dir / "securium-forensics-integrity-offline-package.zip"
    if first_zip.read_bytes() != second_zip.read_bytes():
        raise RuntimeError("same-job package builds produced different ZIP bytes")
    first_size, first_hash = _sha256_file(first_zip)
    second_size, second_hash = _sha256_file(second_zip)
    if (first_size, first_hash) != (second_size, second_hash):
        raise RuntimeError("same-job package builds produced different ZIP hashes")
    print(
        "package_reproducibility="
        + json.dumps(
            {
                "same_source_commit": True,
                "same_bytes": True,
                "same_hash": True,
                "zip_bytes": first_size,
                "zip_sha256": first_hash,
            },
            sort_keys=True,
        )
    )

    extraction = ci_root / "extracted package 한글"
    report = ci_root / "package verification report.json"
    verify_result = _run(
        [
            sys.executable,
            "-B",
            str(BUILDER),
            "verify",
            "--zip",
            str(first_zip),
            "--manifest",
            str(first_dir / "securium-forensics-integrity-offline-package.manifest.json"),
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
    verification = _json_output(verify_result)
    if (
        verification.get("status") != "PASS"
        or verification.get("source_verification") != "PASS"
        or verification.get("entry_count") != 12
    ):
        raise RuntimeError("normal package verification did not pass")
    links = verification.get("markdown_links", {})
    if not isinstance(links, dict) or not links.get("internal") or not links.get("external"):
        raise RuntimeError("package-relative/external Markdown links were not classified")
    print(
        "package_verification="
        + json.dumps(
            {
                "status": verification["status"],
                "entries": verification["entry_count"],
                "internal_links": len(links["internal"]),
                "external_links": len(links["external"]),
            },
            sort_keys=True,
        )
    )

    tampered_zip = ci_root / "tampered package.zip"
    tampered_zip.write_bytes(first_zip.read_bytes())
    tampered_data = bytearray(tampered_zip.read_bytes())
    tampered_data[len(tampered_data) // 2] ^= 1
    tampered_zip.write_bytes(tampered_data)
    tampered_extraction = ci_root / "tampered extraction"
    tampered_report = ci_root / "tampered package report.json"
    tampered_result = _run(
        [
            sys.executable,
            "-B",
            str(BUILDER),
            "verify",
            "--zip",
            str(tampered_zip),
            "--manifest",
            str(first_dir / "securium-forensics-integrity-offline-package.manifest.json"),
            "--repository-root",
            str(REPOSITORY_ROOT),
            "--source-commit",
            expected_source_sha,
            "--extract-dir",
            str(tampered_extraction),
            "--report",
            str(tampered_report),
        ],
        cwd=REPOSITORY_ROOT,
    )
    tampered_payload = _assert_payload(tampered_result, 1, "REJECTED")
    if tampered_extraction.exists() or not tampered_report.is_file():
        raise RuntimeError("tampered package extraction cleanup contract failed")
    print("package_tamper=REJECTED cleanup=PASS")
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
    ci_root.mkdir(parents=True, exist_ok=False)
    try:
        _run_package_boundary_tests(ci_root)
        _run_package_flow(ci_root, expected_source_sha)
    finally:
        _remove_ci_root(ci_root)


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
        raise RuntimeError("checked-out revision does not match the expected event source SHA")
    print(
        "runtime="
        + json.dumps(
            {
                "os": os.name,
                "platform": platform.platform(),
                "python": platform.python_version(),
                "matrix_python": os.environ.get("MATRIX_PYTHON", "unknown"),
                "source_commit": actual_source_sha,
            },
            sort_keys=True,
        )
    )
    requested_root = os.environ.get(CI_ROOT_ENV)
    if requested_root:
        _run_in_root(Path(requested_root), expected_source_sha)
    else:
        with tempfile.TemporaryDirectory(prefix="securium-forensics-integrity-offline-ci-") as temporary:
            root = Path(temporary)
            _run_package_boundary_tests(root)
            _run_package_flow(root, expected_source_sha)
    print("ci_temp_workspace_cleanup=PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(f"offline_package_ci=FAIL reason={error}", file=sys.stderr)
        raise SystemExit(1)
