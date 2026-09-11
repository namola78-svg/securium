"""Focused regression tests for the offline package boundary."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path

from build_offline_package import (
    DEFAULT_EXTERNAL_MANIFEST_NAME,
    DEFAULT_ZIP_NAME,
    PackageError,
    _collect_entries,
    _remove_owned_directory,
    _source_commit,
    _validate_allowlist,
    build_package,
    verify_package,
)


class OfflinePackageBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.repository_root = Path(__file__).resolve().parents[2]
        cls.source_commit = _source_commit(cls.repository_root, None, False)[0]

    def setUp(self) -> None:
        self.temp_root = Path(tempfile.mkdtemp(prefix="securium-offline-package-"))
        self.addCleanup(shutil.rmtree, self.temp_root, ignore_errors=True)

    def _build(self, name: str = "output") -> tuple[Path, Path, dict[str, object]]:
        output = self.temp_root / name
        result = build_package(
            self.repository_root,
            output,
            source_commit=self.source_commit,
            require_clean=False,
        )
        return output / DEFAULT_ZIP_NAME, output / DEFAULT_EXTERNAL_MANIFEST_NAME, result

    def test_same_source_build_is_byte_reproducible(self) -> None:
        first_zip, _, first = self._build("first")
        second_zip, _, second = self._build("second")
        self.assertEqual(first_zip.read_bytes(), second_zip.read_bytes())
        self.assertEqual(first["zip_sha256"], second["zip_sha256"])
        self.assertEqual(first["entry_count"], 12)

    def test_verify_extracts_and_checks_package_relative_links(self) -> None:
        package, manifest, _ = self._build()
        extract_dir = self.temp_root / "offline package 한글 space"
        report = self.temp_root / "reports" / "normal.json"
        result = verify_package(package, manifest, extract_dir=extract_dir, report_path=report)
        self.assertEqual(result["status"], "PASS")
        self.assertTrue((extract_dir / "README.md").is_file())
        self.assertTrue(report.is_file())
        self.assertGreater(len(result["markdown_links"]["internal"]), 0)
        self.assertGreater(len(result["markdown_links"]["external"]), 0)

    def test_tampered_zip_is_rejected_by_external_hash(self) -> None:
        package, manifest, _ = self._build()
        tampered = self.temp_root / "tampered.zip"
        data = bytearray(package.read_bytes())
        data[len(data) // 2] ^= 0x01
        tampered.write_bytes(data)
        result = verify_package(tampered, manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("external manifest", result["errors"][0])

    def test_additional_entry_is_rejected_after_archive_hash_is_updated(self) -> None:
        package, manifest, _ = self._build()
        expanded = self.temp_root / "expanded.zip"
        with zipfile.ZipFile(package, "r") as source, zipfile.ZipFile(expanded, "w") as target:
            for info in source.infolist():
                target.writestr(info, source.read(info.filename))
            target.writestr("unexpected.txt", b"not in the internal manifest")
        external = json.loads(manifest.read_text(encoding="utf-8"))
        external["zip_file"] = expanded.name
        external["zip_size"] = expanded.stat().st_size
        external["entry_count_including_internal_manifest"] += 1
        import hashlib

        external["zip_sha256"] = hashlib.sha256(expanded.read_bytes()).hexdigest()
        updated_manifest = self.temp_root / "expanded.manifest.json"
        updated_manifest.write_text(json.dumps(external), encoding="utf-8")
        result = verify_package(expanded, updated_manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("entry set mismatch", result["errors"][0])

    def test_missing_entry_is_rejected_after_archive_hash_is_updated(self) -> None:
        package, manifest, _ = self._build()
        reduced = self.temp_root / "reduced.zip"
        omitted = "examples/digital-forensics-integrity-local-lab/lab.py"
        with zipfile.ZipFile(package, "r") as source, zipfile.ZipFile(reduced, "w") as target:
            for info in source.infolist():
                if info.filename != omitted:
                    target.writestr(info, source.read(info.filename))
        external = json.loads(manifest.read_text(encoding="utf-8"))
        external["zip_file"] = reduced.name
        external["zip_size"] = reduced.stat().st_size
        external["entry_count_including_internal_manifest"] -= 1
        import hashlib

        external["zip_sha256"] = hashlib.sha256(reduced.read_bytes()).hexdigest()
        reduced_manifest = self.temp_root / "reduced.manifest.json"
        reduced_manifest.write_text(json.dumps(external), encoding="utf-8")
        result = verify_package(reduced, reduced_manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("entry set mismatch", result["errors"][0])

    def test_overwrite_of_package_and_report_is_refused(self) -> None:
        package, manifest, _ = self._build()
        with self.assertRaises(PackageError):
            build_package(
                self.repository_root,
                package.parent,
                source_commit=self.source_commit,
                require_clean=False,
            )
        report = self.temp_root / "existing-report.json"
        report.write_text("{}", encoding="utf-8")
        with self.assertRaises(PackageError):
            verify_package(package, manifest, report_path=report)

    def test_unsafe_allowlist_and_source_reparse_path_are_refused(self) -> None:
        with self.assertRaises(PackageError):
            _validate_allowlist([("a.txt", "A.txt"), ("b.txt", "a.TXT")])
        with self.assertRaises(PackageError):
            _validate_allowlist([("a.txt", "é.txt"), ("b.txt", "e\u0301.txt")])
        with self.assertRaises(PackageError):
            _validate_allowlist([("a.txt", "CON.txt")])
        fixture = self.temp_root / "fixture"
        fixture.mkdir()
        link = fixture / "linked.txt"
        target = Path(__file__).resolve()
        try:
            os.symlink(str(target), str(link))
        except (OSError, NotImplementedError) as error:
            self.fail(f"symlink boundary could not be exercised: {error}")
        with self.assertRaises(PackageError):
            _collect_entries(fixture, self.source_commit, [("linked.txt", "linked.txt")])

    def test_external_manifest_source_mismatch_is_rejected(self) -> None:
        package, manifest, _ = self._build()
        external = json.loads(manifest.read_text(encoding="utf-8"))
        external["source_commit"] = "0" * 40
        mismatched = self.temp_root / "mismatched-source.manifest.json"
        mismatched.write_text(json.dumps(external), encoding="utf-8")
        result = verify_package(package, mismatched)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("source commit differs", result["errors"][0])

    def test_cleanup_removes_only_owned_workspace(self) -> None:
        owned = self.temp_root / "owned workspace"
        sentinel = self.temp_root / "external sentinel.txt"
        owned.mkdir()
        sentinel.write_text("keep", encoding="utf-8")
        _remove_owned_directory(owned)
        self.assertFalse(owned.exists())
        self.assertTrue(sentinel.exists())


if __name__ == "__main__":
    unittest.main()
