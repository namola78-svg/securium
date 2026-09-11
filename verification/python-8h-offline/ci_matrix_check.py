#!/usr/bin/env python3
"""Run the offline-package contract in a clean, disposable CI workspace."""

from __future__ import annotations

import json
import hashlib
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import tempfile
from zipfile import ZipFile


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BUILDER = Path(__file__).with_name("build_offline_package.py")
GUARD_TEST = Path(__file__).with_name("test_builder_guards.py")
PREFLIGHT_TEST = REPOSITORY_ROOT / "verification/python-8h-learner-preflight/test_preflight.py"
EXPECTED_PREFLIGHT_TESTS = 7
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
README_ARCHIVE_PATH = "python-secure-coding-8h-offline/README.md"
README_SOURCE_REL = Path("verification/python-8h-offline/package-readme.md")


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


def mutate_readme_payload(
    source_archive: Path,
    source_manifest: Path,
    target_archive: Path,
    target_manifest: Path,
) -> None:
    with ZipFile(source_archive) as source:
        members = [(info, source.read(info)) for info in source.infolist()]
    mutated = {info.filename: data for info, data in members}
    mutated[README_ARCHIVE_PATH] += b"\nDISPOSABLE README PAYLOAD TAMPER\n"
    with ZipFile(target_archive, "w") as target:
        for info, _ in members:
            target.writestr(info, mutated[info.filename])

    manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
    readme_entry = next(
        entry for entry in manifest["archive_entries"] if entry["path"] == README_ARCHIVE_PATH
    )
    readme_data = mutated[README_ARCHIVE_PATH]
    readme_entry["bytes"] = len(readme_data)
    readme_entry["sha256"] = hashlib.sha256(readme_data).hexdigest()
    archive_data = target_archive.read_bytes()
    manifest["archive"]["bytes"] = len(archive_data)
    manifest["archive"]["sha256"] = hashlib.sha256(archive_data).hexdigest()
    target_manifest.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def mutate_readme_source_binding(source_manifest: Path, target_manifest: Path) -> None:
    manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
    record = manifest["source_provenance"]["package_readme"]
    record["source_commit"] = "0" * 40
    record["source_path"] = "verification/other/package-readme.md"
    record["source_sha256"] = "0" * 64
    manifest["package_readme_commit"] = "0" * 40
    target_manifest.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def expect_readme_rejection(
    archive: Path,
    manifest: Path,
    extraction: Path,
    report: Path,
    error_fragment: str,
) -> dict[str, object]:
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
        ],
        expect_success=False,
    )
    if result.returncode == 0 or extraction.exists() or not report.exists():
        raise RuntimeError("README binding regression was not rejected before extraction")
    payload = json.loads(report.read_text(encoding="utf-8"))
    if payload.get("status") != "FAIL":
        raise RuntimeError(f"README binding regression report was not FAIL: {payload}")
    if payload.get("preflight", {}).get("status") != "NOT_RUN":
        raise RuntimeError("README binding rejection started preflight")
    if payload.get("commands"):
        raise RuntimeError("README binding rejection started lab commands")
    if payload.get("cleanup", {}).get("extraction_removed") is not True:
        raise RuntimeError("README binding rejection did not confirm extraction cleanup")
    if error_fragment not in payload.get("error", ""):
        raise RuntimeError(f"unexpected README binding rejection: {payload.get('error')}")
    return payload


def run_dirty_readme_regression(
    archive: Path, manifest: Path, extraction: Path, report: Path
) -> None:
    source_path = REPOSITORY_ROOT / README_SOURCE_REL
    original = source_path.read_bytes()
    clean_before = subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", README_SOURCE_REL.as_posix()],
        cwd=REPOSITORY_ROOT,
        check=False,
    )
    if clean_before.returncode:
        raise RuntimeError("cannot run dirty README regression with a pre-existing README change")
    try:
        source_path.write_bytes(original + b"\nDISPOSABLE DIRTY CHECKOUT PROBE\n")
        expect_readme_rejection(archive, manifest, extraction, report, "uncommitted changes")
    finally:
        source_path.write_bytes(original)
    clean_after = subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", README_SOURCE_REL.as_posix()],
        cwd=REPOSITORY_ROOT,
        check=False,
    )
    if clean_after.returncode or source_path.read_bytes() != original:
        raise RuntimeError("dirty README regression did not restore the original source bytes")


def assert_normal_verification(report: dict[str, object]) -> None:
    if report.get("status") != "PASS":
        raise RuntimeError(f"normal package verification did not pass: {report}")
    if report.get("manifest_validation", {}).get("source_tree_comparison") != "PASS":
        raise RuntimeError("manifest was not compared with the current source bytes")
    if report.get("links", {}).get("status") != "PASS":
        raise RuntimeError(f"package-relative link verification failed: {report.get('links')}")
    if report.get("cleanup", {}).get("extraction_removed") is not True:
        raise RuntimeError("verification extraction directory was not removed")
    preflight = report.get("preflight", {})
    if preflight.get("status") != "PASS" or preflight.get("overall_status") != "PASS":
        raise RuntimeError(f"extracted preflight did not pass: {preflight}")
    if any(status != "PASS" for status in preflight.get("required_probe_statuses", {}).values()):
        raise RuntimeError(f"extracted preflight has a non-PASS required probe: {preflight}")

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


def run_preflight_regression() -> int:
    result = run([sys.executable, str(PREFLIGHT_TEST)], expect_success=False)
    output = f"{result.stdout}\n{result.stderr}"
    matches = list(re.finditer(r"Ran (\d+) tests?", output))
    actual = int(matches[-1].group(1)) if matches else None
    if result.returncode != 0 or actual != EXPECTED_PREFLIGHT_TESTS:
        raise RuntimeError(
            "preflight regression failed: "
            f"returncode={result.returncode} tests={actual}"
        )
    return actual


def main() -> int:
    run([sys.executable, str(GUARD_TEST)])
    preflight_tests = run_preflight_regression()
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
        if first["support_source_commit"] != second["support_source_commit"]:
            raise RuntimeError("two builds used different learner preflight source commits")
        if first["source_provenance"] != second["source_provenance"]:
            raise RuntimeError("two builds used different source provenance")
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
        readme_binding_tests = 1

        # A README payload mutation remains invalid even when its ZIP entry and
        # outer archive hashes are regenerated consistently.
        payload_archive = root / "README payload tampered.zip"
        payload_manifest = root / "README payload tampered.manifest.json"
        mutate_readme_payload(
            first_archive,
            Path(first["manifest"]),
            payload_archive,
            payload_manifest,
        )
        expect_readme_rejection(
            payload_archive,
            payload_manifest,
            root / "README payload extraction",
            root / "README payload report.json",
            "committed README Git blob",
        )
        readme_binding_tests += 1

        # Caller-provided README commit/path/hash fields cannot select or
        # authorize a different source record.
        record_manifest = root / "README source record tampered.manifest.json"
        mutate_readme_source_binding(Path(first["manifest"]), record_manifest)
        expect_readme_rejection(
            first_archive,
            record_manifest,
            root / "README source record extraction",
            root / "README source record report.json",
            "source commit",
        )
        readme_binding_tests += 1

        # A dirty checkout is rejected before package extraction and execution.
        run_dirty_readme_regression(
            first_archive,
            Path(first["manifest"]),
            root / "README dirty extraction",
            root / "README dirty report.json",
        )
        readme_binding_tests += 1

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
            f"lab_source_files={first['source_file_count']} "
            f"support_files={first['support_file_count']} "
            f"archive_entries={first['archive_file_count']} "
            f"preflight_tests={preflight_tests} extracted_preflight=PASS "
            f"readme_binding_tests={readme_binding_tests} readme_payload=REJECTED "
            "readme_source_record=REJECTED readme_dirty_checkout=REJECTED "
            "focused=M01:5,M02:5,M03:6,M04:6,M05:7,M06:5,M07:10,M08:6 "
            "aggregate=50 "
            "dependencies=python-standard-library-only "
            "guards=PASS tamper=REJECTED path=REJECTED overwrite=REJECTED cleanup=PASS"
        )
    print("ci_temp_workspace_cleanup=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
