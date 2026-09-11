"""Focused regression tests for the offline package boundary."""

from __future__ import annotations

import json
import hashlib
import os
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from typing import Callable

from build_offline_package import (
    DEFAULT_EXTERNAL_MANIFEST_NAME,
    DEFAULT_ZIP_NAME,
    PackageError,
    _canonical_json,
    _commit_blob,
    _git_blob_sha1,
    _collect_entries,
    _remove_owned_directory,
    _sha256_bytes,
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
        cls.trusted_parent = Path(
            tempfile.mkdtemp(prefix="sec-pkg-trusted-", dir=cls.repository_root.parent)
        )
        cls.trusted_root = cls.trusted_parent / "source"
        subprocess.run(
            ["git", "worktree", "add", "--detach", "--no-checkout", str(cls.trusted_root), cls.source_commit],
            cwd=cls.repository_root,
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(["git", "-C", str(cls.trusted_root), "config", "core.autocrlf", "false"], check=True)
        subprocess.run(["git", "-C", str(cls.trusted_root), "config", "core.eol", "lf"], check=True)
        subprocess.run(
            ["git", "-C", str(cls.trusted_root), "checkout", "--force", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
        cls.addClassCleanup(cls._cleanup_trusted_root)

    @classmethod
    def _cleanup_trusted_root(cls) -> None:
        subprocess.run(
            ["git", "worktree", "remove", "--force", str(cls.trusted_root)],
            cwd=cls.repository_root,
            check=True,
            capture_output=True,
            text=True,
        )
        shutil.rmtree(cls.trusted_parent, ignore_errors=True)

    def setUp(self) -> None:
        self.temp_root = Path(tempfile.mkdtemp(prefix="securium-offline-package-"))
        self.addCleanup(shutil.rmtree, self.temp_root, ignore_errors=True)

    def _build(self, name: str = "output") -> tuple[Path, Path, dict[str, object]]:
        output = self.temp_root / name
        result = build_package(
            self.trusted_root,
            output,
            source_commit=self.source_commit,
            require_clean=True,
        )
        return output / DEFAULT_ZIP_NAME, output / DEFAULT_EXTERNAL_MANIFEST_NAME, result

    def _verify(
        self,
        package: Path,
        manifest: Path,
        *,
        extract_dir: Path | None = None,
        report_path: Path | None = None,
    ) -> dict[str, object]:
        return verify_package(
            package,
            manifest,
            extract_dir=extract_dir,
            report_path=report_path,
            trusted_repository_root=self.trusted_root,
            trusted_source_commit=self.source_commit,
        )

    def _rewrite_package(
        self,
        package: Path,
        manifest: Path,
        name: str,
        mutate: Callable[[dict[str, object], dict[str, bytes]], None],
    ) -> tuple[Path, Path]:
        output_package = self.temp_root / name
        output_manifest = self.temp_root / f"{name}.manifest.json"
        with zipfile.ZipFile(package, "r") as source:
            infos = source.infolist()
            data = {info.filename: source.read(info.filename) for info in infos}
        internal = json.loads(data["package-manifest.json"].decode("utf-8"))
        mutate(internal, data)
        data["package-manifest.json"] = _canonical_json(internal)
        with zipfile.ZipFile(output_package, "w") as target:
            for info in infos:
                target.writestr(info, data[info.filename])
        external = json.loads(manifest.read_text(encoding="utf-8"))
        external.update(
            {
                "zip_file": output_package.name,
                "zip_size": output_package.stat().st_size,
                "zip_sha256": hashlib.sha256(output_package.read_bytes()).hexdigest(),
                "internal_manifest_sha256": _sha256_bytes(data["package-manifest.json"]),
                "source_commit": internal["source_commit"],
                "source_tree": internal["source_tree"],
            }
        )
        output_manifest.write_text(json.dumps(external), encoding="utf-8")
        return output_package, output_manifest

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
        result = self._verify(package, manifest, extract_dir=extract_dir, report_path=report)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["source_verification"], "PASS")
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
        result = self._verify(tampered, manifest)
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
        result = self._verify(expanded, updated_manifest)
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
        result = self._verify(reduced, reduced_manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("entry set mismatch", result["errors"][0])

    def test_overwrite_of_package_and_report_is_refused(self) -> None:
        package, manifest, _ = self._build()
        with self.assertRaises(PackageError):
            build_package(
                self.trusted_root,
                package.parent,
                source_commit=self.source_commit,
                require_clean=True,
            )
        report = self.temp_root / "existing-report.json"
        report.write_text("{}", encoding="utf-8")
        with self.assertRaises(PackageError):
            self._verify(package, manifest, report_path=report)

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
        result = self._verify(package, mismatched)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("trusted checkout", result["errors"][0])

    def test_readme_and_self_consistent_manifests_are_rejected_by_trusted_source(self) -> None:
        package, manifest, _ = self._build()

        def mutate(internal: dict[str, object], data: dict[str, bytes]) -> None:
            payload = b"# attacker-controlled README\n"
            data["README.md"] = payload
            entry = next(item for item in internal["entries"] if item["archive_path"] == "README.md")
            entry.update(
                {
                    "size": len(payload),
                    "sha256": _sha256_bytes(payload),
                    "git_blob_sha1": _git_blob_sha1(payload),
                }
            )

        tampered, tampered_manifest = self._rewrite_package(
            package,
            manifest,
            "readme-self-consistent-tamper.zip",
            mutate,
        )
        extraction = self.temp_root / "must-not-extract"
        result = self._verify(tampered, tampered_manifest, extract_dir=extraction)
        self.assertEqual(result["status"], "REJECTED")
        self.assertNotEqual(result["source_verification"], "PASS")
        self.assertIn("trusted source", result["errors"][0])
        self.assertFalse(extraction.exists())

    def test_source_path_record_is_rejected_by_trusted_allowlist(self) -> None:
        package, manifest, _ = self._build()

        def mutate(internal: dict[str, object], data: dict[str, bytes]) -> None:
            cli_path = self.repository_root / "examples/digital-forensics-integrity-local-lab/cli.py"
            payload = cli_path.read_bytes()
            data["README.md"] = payload
            entry = next(item for item in internal["entries"] if item["archive_path"] == "README.md")
            entry.update(
                {
                    "source_path": "examples/digital-forensics-integrity-local-lab/cli.py",
                    "size": len(payload),
                    "sha256": _sha256_bytes(payload),
                    "git_blob_sha1": _commit_blob(
                        self.repository_root,
                        self.source_commit,
                        "examples/digital-forensics-integrity-local-lab/cli.py",
                    ),
                }
            )

        tampered, tampered_manifest = self._rewrite_package(
            package,
            manifest,
            "source-path-replacement.zip",
            mutate,
        )
        result = self._verify(tampered, tampered_manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("source_path", result["errors"][0])

    def test_source_commit_record_is_rejected_by_trusted_checkout(self) -> None:
        package, manifest, _ = self._build()

        def mutate(internal: dict[str, object], _data: dict[str, bytes]) -> None:
            internal["source_commit"] = "0" * 40
            internal["source_tree"] = "0" * 40

        tampered, tampered_manifest = self._rewrite_package(
            package,
            manifest,
            "source-commit-replacement.zip",
            mutate,
        )
        result = self._verify(tampered, tampered_manifest)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("trusted checkout", result["errors"][0])

    def test_verify_without_trusted_checkout_is_not_source_pass(self) -> None:
        package, manifest, _ = self._build()
        extraction = self.temp_root / "untrusted-extraction"
        result = verify_package(package, manifest, extract_dir=extraction)
        self.assertEqual(result["status"], "REJECTED")
        self.assertNotEqual(result["source_verification"], "PASS")
        self.assertIn("trusted repository root", result["errors"][0])
        self.assertFalse(extraction.exists())

    def test_dirty_trusted_checkout_is_rejected(self) -> None:
        package, manifest, _ = self._build()
        dirty_parent = Path(
            tempfile.mkdtemp(prefix="sec-pkg-dirty-", dir=self.repository_root.parent)
        )
        dirty_root = dirty_parent / "source"
        subprocess.run(
            ["git", "worktree", "add", "--detach", "--no-checkout", str(dirty_root), self.source_commit],
            cwd=self.repository_root,
            check=True,
            capture_output=True,
            text=True,
        )
        try:
            subprocess.run(["git", "-C", str(dirty_root), "config", "core.autocrlf", "false"], check=True)
            subprocess.run(["git", "-C", str(dirty_root), "config", "core.eol", "lf"], check=True)
            subprocess.run(
                ["git", "-C", str(dirty_root), "checkout", "--force", "HEAD"],
                check=True,
                capture_output=True,
                text=True,
            )
            target = dirty_root / "examples/digital-forensics-integrity-offline-package/README.md"
            target.write_bytes(target.read_bytes() + b"\ndirty trusted checkout\n")
            result = verify_package(
                package,
                manifest,
                trusted_repository_root=dirty_root,
                trusted_source_commit=self.source_commit,
            )
        finally:
            subprocess.run(
                ["git", "worktree", "remove", "--force", str(dirty_root)],
                cwd=self.repository_root,
                check=True,
                capture_output=True,
                text=True,
            )
            shutil.rmtree(dirty_parent, ignore_errors=True)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("worktree must be clean", result["errors"][0])

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
