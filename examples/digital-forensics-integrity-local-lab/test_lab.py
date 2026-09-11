from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

from lab import (
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
            self.skipTest(f"current OS cannot create test symlink: {error}")
        report = verify_workspace(self.workspace, verified_at=VERIFIED_AT)
        self.assertEqual(report["status"], "REJECTED")
        self.assertIn("working-copy/host-alpha/events/unapproved-link.txt", report["symlink_paths"])

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

    def test_cleanup_removes_only_marked_workspace(self) -> None:
        workspace_text = str(self.workspace)
        cleanup_workspace(self.workspace)
        self.assertFalse(self.workspace.exists(), workspace_text)


if __name__ == "__main__":
    unittest.main()
