from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from lab import (
    LAB_FORMAT,
    MARKER_FILE,
    MAX_FILE_BYTES,
    LabError,
    cleanup_workspace,
    prepare_workspace,
    remove_working_copy,
    safe_relative_path,
    streaming_sha256,
    tamper_working_copy,
    verify_workspace,
    write_verification_report,
)


RECORDED_AT = "2026-09-11T09:00:00+09:00"
VERIFIED_AT = "2026-09-11T09:01:00Z"


class IntegrityLabTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix="integrity-lab-test-")
        self.workspace = Path(self.temp_dir.name) / "workspace"
        prepare_workspace(self.workspace, RECORDED_AT)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _manifest(self) -> tuple[Path, dict]:
        path = self.workspace / "evidence-manifest.json"
        return path, json.loads(path.read_text(encoding="utf-8"))

    def _custody(self) -> tuple[Path, dict]:
        path = self.workspace / "chain-of-custody.json"
        return path, json.loads(path.read_text(encoding="utf-8"))

    def test_normal_verification_records_distinct_times(self) -> None:
        original = self.workspace / "original/host-alpha/events/authentication.log"
        before = streaming_sha256(original)
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["recorded_at"], RECORDED_AT)
        self.assertEqual(report["verified_at"], VERIFIED_AT)
        self.assertEqual(report["custody"]["status"], "PASS")
        self.assertTrue(all(item["status"] == "PASS" for item in report["pair_checks"]))
        self.assertEqual(streaming_sha256(original), before)

    def test_tampered_working_copy_is_rejected_and_original_is_unchanged(self) -> None:
        original = self.workspace / "original/host-alpha/events/authentication.log"
        before = streaming_sha256(original)
        tamper_working_copy(self.workspace, "working-copy/host-alpha/events/authentication.log")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any(item["status"] == "MISMATCH" for item in report["pair_checks"]))
        self.assertTrue(any("hash mismatch" in error for error in report["errors"]))
        self.assertEqual(streaming_sha256(original), before)

    def test_missing_working_copy_is_rejected(self) -> None:
        remove_working_copy(self.workspace, "working-copy/host-beta/network/network-summary.txt")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any(item["status"] == "MISSING" for item in report["file_checks"]))
        self.assertTrue(any("missing" in error for error in report["errors"]))

    def test_manifest_size_mismatch_is_rejected(self) -> None:
        path, manifest = self._manifest()
        manifest["files"][0]["original"]["size"] += 1
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("size mismatch" in error for error in report["errors"]))

    def test_manifest_duplicate_path_is_rejected(self) -> None:
        path, manifest = self._manifest()
        manifest["files"][1]["original"]["path"] = manifest["files"][0]["original"]["path"]
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("duplicate manifest path" in error for error in report["errors"]))

    def test_manifest_missing_pair_is_rejected(self) -> None:
        path, manifest = self._manifest()
        manifest["files"].pop()
        manifest["file_count"] = len(manifest["files"])
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("missing manifest pair" in error for error in report["errors"]))

    def test_manifest_additional_pair_is_rejected(self) -> None:
        path, manifest = self._manifest()
        manifest["files"][0]["original"]["path"] = "original/host-gamma/unlisted.txt"
        manifest["files"][0]["working_copy"]["path"] = "working-copy/host-gamma/unlisted.txt"
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("additional manifest pair" in error for error in report["errors"]))

    def test_invalid_json_is_rejected_explicitly(self) -> None:
        path, _manifest = self._manifest()
        path.write_text("{\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("could not read JSON record" in error for error in report["errors"]))

    def test_invalid_manifest_field_is_rejected_explicitly(self) -> None:
        path, manifest = self._manifest()
        manifest["algorithm"] = "md5"
        manifest["files"][0]["original"]["sha256"] = "not-a-digest"
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("algorithm is not sha256" in error for error in report["errors"]))
        self.assertTrue(any("expected size/sha256 is invalid" in error for error in report["errors"]))

    def test_oversized_input_is_rejected_before_unbounded_processing(self) -> None:
        oversized = self.workspace / "working-copy/oversized.bin"
        oversized.write_bytes(b"x" * (MAX_FILE_BYTES + 1))
        with self.assertRaises(LabError):
            streaming_sha256(oversized)

    def test_manifest_duplicate_entries_do_not_pass_as_complete(self) -> None:
        path, manifest = self._manifest()
        manifest["files"].append(manifest["files"][0])
        manifest["file_count"] = len(manifest["files"])
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("duplicate manifest path" in error for error in report["errors"]))

    def test_oversized_json_record_is_rejected_explicitly(self) -> None:
        path, _manifest = self._manifest()
        path.write_text("{\"padding\":\"" + ("x" * (1024 * 1024)) + "\"}\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("JSON record exceeds" in error for error in report["errors"]))

    def test_missing_custody_field_is_rejected(self) -> None:
        path, custody = self._custody()
        del custody["entries"][0]["reason"]
        path.write_text(json.dumps(custody, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("required field: reason" in error for error in report["errors"]))

    def test_manifest_path_escape_is_rejected_without_reading_outside(self) -> None:
        outside = Path(self.temp_dir.name) / "outside.txt"
        outside.write_text("SYNTHETIC OUTSIDE FILE\n", encoding="utf-8")
        path, manifest = self._manifest()
        manifest["files"][0]["original"]["path"] = "../outside.txt"
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertTrue(any("escapes fixture root" in error for error in report["errors"]))
        self.assertEqual(outside.read_text(encoding="utf-8"), "SYNTHETIC OUTSIDE FILE\n")

    def test_symlink_is_rejected_when_supported(self) -> None:
        link = self.workspace / "working-copy/host-alpha/events/unapproved-link.txt"
        target = self.workspace / "original/host-alpha/events/authentication.log"
        try:
            os.symlink(target, link)
        except (OSError, NotImplementedError) as error:
            self.fail(f"symlink creation failed; symlink rejection was not verified: {error}")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertIn("working-copy/host-alpha/events/unapproved-link.txt", report["symlink_paths"])

    def test_windows_reparse_point_is_rejected_when_supported(self) -> None:
        if os.name != "nt":
            self.skipTest("Windows junction/reparse-point check is Windows-specific")
        junction = self.workspace / "working-copy/host-alpha/events/unapproved-junction"
        target = self.workspace / "original/host-alpha/events"
        result = subprocess.run(
            ["cmd.exe", "/c", "mklink", "/J", str(junction), str(target)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            self.fail(f"Windows junction creation failed; reparse validation was not verified: {result.stderr or result.stdout}")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertIn("working-copy/host-alpha/events/unapproved-junction", report["symlink_paths"])

    def test_safe_path_rejects_absolute_and_parent_paths(self) -> None:
        with self.assertRaises(LabError):
            safe_relative_path(self.workspace, "../outside.txt")
        with self.assertRaises(LabError):
            safe_relative_path(self.workspace, str(Path(self.temp_dir.name) / "outside.txt"))

    def test_mutation_and_removal_cannot_target_original(self) -> None:
        with self.assertRaises(LabError):
            tamper_working_copy(self.workspace, "original/host-alpha/events/authentication.log")
        with self.assertRaises(LabError):
            remove_working_copy(self.workspace, "original/host-alpha/events/authentication.log")

    def test_report_and_prepare_refuse_overwrite(self) -> None:
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        report_path = write_verification_report(self.workspace, report, "reports/normal.json")
        self.assertTrue(report_path.is_file())
        with self.assertRaises(FileExistsError):
            write_verification_report(self.workspace, report, "reports/normal.json")
        with self.assertRaises(LabError):
            prepare_workspace(self.workspace, RECORDED_AT)

    def test_forged_marker_cannot_authorize_cleanup_and_sentinel_survives(self) -> None:
        forged = Path(self.temp_dir.name) / "forged"
        forged.mkdir()
        sentinel = forged / "unrelated-sentinel.txt"
        sentinel.write_text("keep this file\n", encoding="utf-8")
        (forged / MARKER_FILE).write_text(
            json.dumps({"format": LAB_FORMAT, "workspace": "generated-by-lab", "version": 1}),
            encoding="utf-8",
        )
        with self.assertRaises(LabError):
            cleanup_workspace(forged)
        self.assertTrue(sentinel.is_file())

    def test_marker_alone_cannot_authorize_cleanup(self) -> None:
        forged = Path(self.temp_dir.name) / "marker-only"
        forged.mkdir()
        sentinel = forged / "unrelated-sentinel.txt"
        sentinel.write_text("keep this file\n", encoding="utf-8")
        (forged / MARKER_FILE).write_text(
            json.dumps(
                {
                    "format": LAB_FORMAT,
                    "workspace_path": str(forged.resolve()),
                    "workspace_token": "a" * 64,
                    "version": 1,
                }
            ),
            encoding="utf-8",
        )
        with self.assertRaises(LabError):
            cleanup_workspace(forged)
        self.assertTrue(sentinel.is_file())

    def test_replaced_workspace_marker_cannot_authorize_cleanup(self) -> None:
        replacement = Path(self.temp_dir.name) / "replacement"
        prepare_workspace(replacement, RECORDED_AT)
        original_file = self.workspace / "original/host-alpha/events/authentication.log"
        marker = self.workspace / MARKER_FILE
        marker.write_text((replacement / MARKER_FILE).read_text(encoding="utf-8"), encoding="utf-8")
        with self.assertRaises(LabError):
            cleanup_workspace(self.workspace)
        self.assertTrue(original_file.is_file())
        cleanup_workspace(replacement)

    def test_root_symlink_cannot_authorize_cleanup(self) -> None:
        link = Path(self.temp_dir.name) / "workspace-link"
        try:
            os.symlink(self.workspace, link, target_is_directory=True)
        except (OSError, NotImplementedError) as error:
            self.fail(f"root symlink creation failed; root-link validation was not verified: {error}")
        with self.assertRaises(LabError):
            cleanup_workspace(link)
        self.assertTrue((self.workspace / "original/host-alpha/events/authentication.log").is_file())

    def test_partial_prepare_failure_removes_only_new_root(self) -> None:
        parent = Path(self.temp_dir.name) / "partial-parent"
        parent.mkdir()
        sentinel = parent / "unrelated-sentinel.txt"
        sentinel.write_text("keep this file\n", encoding="utf-8")
        target = parent / "new-workspace"
        with patch("lab._copy_no_overwrite", side_effect=OSError("synthetic copy failure")):
            with self.assertRaises(OSError):
                prepare_workspace(target, RECORDED_AT)
        self.assertFalse(target.exists())
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep this file\n")

    def test_cleanup_removes_only_marked_workspace(self) -> None:
        workspace_text = str(self.workspace)
        cleanup_workspace(self.workspace)
        self.assertFalse(self.workspace.exists(), workspace_text)


if __name__ == "__main__":
    unittest.main()
