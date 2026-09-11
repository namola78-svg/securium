#!/usr/bin/env python3
"""Run the offline-package contract in a clean, disposable CI workspace."""

from __future__ import annotations

import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BUILDER = Path(__file__).with_name("build_offline_package.py")
GUARD_TEST = Path(__file__).with_name("test_builder_guards.py")
EXPECTED_FOCUSED = {
    "M01": 5,
    "M02": 5,
    "M03": 6,
    "M04": 6,
    "M05": 7,
    "M06": 5,
    "M07": 10,
    "M08": 6,
}


def run(command: list[str], *, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONHOME", None)
    result = subprocess.run(
        command,
        cwd=REPOSITORY_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if expect_success and result.returncode:
        detail = result.stderr.strip()[-500:] or result.stdout.strip()[-500:]
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(command)}: {detail}")
    return result


def build(output_dir: Path) -> dict[str, object]:
    result = run([sys.executable, str(BUILDER), "build", "--output-dir", str(output_dir)])
    return json.loads(result.stdout)


def verify(archive: Path, manifest: Path, extraction: Path, report: Path) -> dict[str, object]:
    result = run(
        [
            sys.executable,
            str(BUILDER),
            "verify",
            "--archive",
            str(archive),
            "--manifest",
            str(manifest),
            "--extract-dir",
            str(extraction),
            "--report",
            str(report),
        ]
    )
    return json.loads(result.stdout)


def assert_normal_verification(report: dict[str, object]) -> None:
    if report.get("status") != "PASS":
        raise RuntimeError(f"normal package verification did not pass: {report}")
    if report.get("manifest_validation", {}).get("source_tree_comparison") != "PASS":
        raise RuntimeError("manifest was not compared with the current source bytes")
    if report.get("links", {}).get("status") != "PASS":
        raise RuntimeError(f"package-relative link verification failed: {report.get('links')}")
    if report.get("cleanup", {}).get("extraction_removed") is not True:
        raise RuntimeError("verification extraction directory was not removed")

    command_results = {entry["label"]: entry for entry in report["commands"]}
    expected = {**EXPECTED_FOCUSED, "ALL": 50}
    if set(command_results) != set(expected):
        raise RuntimeError(f"unexpected package command set: {sorted(command_results)}")
    for label, count in expected.items():
        entry = command_results[label]
        if entry.get("status") != "PASS" or entry.get("actual_tests") != count:
            raise RuntimeError(f"unexpected {label} result: {entry}")
        if entry.get("skipped") != 0 or entry.get("failures") != 0 or entry.get("errors") != 0:
            raise RuntimeError(f"non-pass test accounting for {label}: {entry}")


def main() -> int:
    run([sys.executable, str(GUARD_TEST)])
    with tempfile.TemporaryDirectory(prefix="securium-python-8h-offline-ci-") as temporary:
        root = Path(temporary)
        first_dir = root / "build one"
        second_dir = root / "build two"
        first = build(first_dir)
        second = build(second_dir)
        first_archive = Path(first["archive"]["path"])
        second_archive = Path(second["archive"]["path"])
        if first["source_commit"] != second["source_commit"]:
            raise RuntimeError("two builds used different source commits")
        if first["archive"]["sha256"] != second["archive"]["sha256"]:
            raise RuntimeError("two builds from identical input did not produce the same ZIP SHA-256")
        if first_archive.read_bytes() != second_archive.read_bytes():
            raise RuntimeError("two builds reported the same hash but had different bytes")

        extraction = root / "오프라인 Python package verify path"
        report_path = root / "verification report.json"
        report = verify(
            first_archive,
            Path(first["manifest"]),
            extraction,
            report_path,
        )
        assert_normal_verification(report)

        # Verify that an archive mutation is rejected before extraction.
        tampered_archive = root / "tampered.zip"
        tampered_archive.write_bytes(first_archive.read_bytes())
        tampered_data = bytearray(tampered_archive.read_bytes())
        tampered_data[100] ^= 1
        tampered_archive.write_bytes(tampered_data)
        tampered_extraction = root / "tampered extraction"
        tampered_report = root / "tampered report.json"
        tampered_result = run(
            [
                sys.executable,
                str(BUILDER),
                "verify",
                "--archive",
                str(tampered_archive),
                "--manifest",
                str(first["manifest"]),
                "--extract-dir",
                str(tampered_extraction),
                "--report",
                str(tampered_report),
            ],
            expect_success=False,
        )
        if tampered_result.returncode == 0 or tampered_extraction.exists() or not tampered_report.exists():
            raise RuntimeError("tampered archive was not rejected and cleaned up")

        # Verify that an existing result is never overwritten.
        existing_result = run(
            [sys.executable, str(BUILDER), "build", "--output-dir", str(first_dir)],
            expect_success=False,
        )
        if existing_result.returncode == 0:
            raise RuntimeError("existing build output was overwritten")

        # Verify that output cannot be placed under the checkout.
        forbidden_output = REPOSITORY_ROOT / ".offline-package-ci-forbidden-output"
        if forbidden_output.exists():
            raise RuntimeError(f"unexpected pre-existing test path: {forbidden_output}")
        forbidden_result = run(
            [sys.executable, str(BUILDER), "build", "--output-dir", str(forbidden_output)],
            expect_success=False,
        )
        if forbidden_result.returncode == 0 or forbidden_output.exists():
            raise RuntimeError("repository-internal output path was accepted")

        print(
            "offline_package_ci=PASS "
            f"python={platform.python_version()} "
            f"platform={platform.platform()} "
            f"source_commit={first['source_commit']} "
            f"zip_sha256={first['archive']['sha256']} "
            f"zip_bytes={first['archive']['bytes']} "
            "focused=M01:5,M02:5,M03:6,M04:6,M05:7,M06:5,M07:10,M08:6 "
            "aggregate=50 "
            "dependencies=python-standard-library-only "
            "guards=PASS tamper=REJECTED path=REJECTED overwrite=REJECTED cleanup=PASS"
        )
    print("ci_temp_workspace_cleanup=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
