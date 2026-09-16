#!/usr/bin/env python3
"""Regression tests for the standalone forensics learner preflight."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


TOOL_DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOL_DIRECTORY))
import preflight  # noqa: E402


class ForensicsLearnerPreflightTests(unittest.TestCase):
    def test_actual_cli_runs_from_outside_cwd_without_python_path_dependencies(self) -> None:
        environment = dict(__import__("os").environ)
        environment.pop("PYTHONPATH", None)
        environment.pop("PYTHONHOME", None)
        completed = subprocess.run(
            [sys.executable, str(TOOL_DIRECTORY / "preflight.py"), "--json"],
            cwd=tempfile.gettempdir(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=environment,
            timeout=15,
            check=False,
        )
        self.assertEqual(completed.returncode, preflight.EXIT_PASS, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertEqual(result["overall_status"], preflight.PASS)

    def test_normal_result_has_expected_success_and_not_run_states(self) -> None:
        result = preflight.run_preflight()
        statuses = {probe["name"]: probe["status"] for probe in result["probes"]}
        for name in (
            "python_runtime",
            "environment_scope",
            "lab_stdlib_imports",
            "sha256_synthetic_bytes",
            "json_csv_synthetic_data",
            "timezone_aware_utc",
            "owned_temp_file_io",
            "cleanup",
        ):
            self.assertEqual(statuses[name], preflight.PASS)
        self.assertEqual(statuses["ci_success_evidence"], preflight.NOT_RUN)
        self.assertEqual(statuses["full_lab_execution"], preflight.NOT_RUN)

    def test_minimum_version_failure_is_distinct(self) -> None:
        result = preflight.probe_python_runtime((3, 10, 9))
        self.assertEqual(result.status, preflight.FAIL)
        self.assertIn("3.11", result.message)

    def test_unknown_environment_is_unverified_not_supported_or_failed(self) -> None:
        result = preflight.probe_environment_scope((3, 13, 0), "Darwin", "CPython")
        self.assertEqual(result.status, preflight.UNVERIFIED_ENVIRONMENT)
        self.assertFalse(result.required)

    def test_import_failure_is_reported(self) -> None:
        def failing_importer(name: str) -> object:
            if name == "typing":
                raise ImportError("controlled import failure")
            return object()

        result = preflight.probe_lab_stdlib_imports(failing_importer)
        self.assertEqual(result.status, preflight.FAIL)
        self.assertEqual(result.details["failures"][0]["module"], "typing")

    def test_core_sha256_failure_is_reported(self) -> None:
        def failing_hasher(payload: bytes) -> object:
            raise RuntimeError("controlled hash failure")

        result = preflight.probe_sha256(failing_hasher)
        self.assertEqual(result.status, preflight.FAIL)
        self.assertEqual(result.details["error_type"], "RuntimeError")

    def test_space_and_korean_path_is_written_read_and_cleaned(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight- ") as parent:
            result, owned = preflight.probe_owned_filesystem(Path(parent))
            self.assertEqual(result.status, preflight.PASS)
            self.assertIsNotNone(owned)
            cleanup = preflight.cleanup_owned_directory(owned)
            self.assertEqual(cleanup.status, preflight.PASS)
            self.assertFalse(owned.exists())

    def test_temp_directory_creation_failure_is_not_silently_passed(self) -> None:
        def failing_factory(_: Path | None) -> Path:
            raise PermissionError("controlled creation failure")

        result, owned = preflight.probe_owned_filesystem(
            Path(tempfile.gettempdir()), failing_factory
        )
        self.assertEqual(result.status, preflight.FAIL)
        self.assertIsNone(owned)
        self.assertEqual(result.details["cleanup"], preflight.NOT_RUN)

    def test_temp_file_write_failure_is_reported_and_owned_root_is_cleaned(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight-") as parent:
            with mock.patch.object(Path, "write_bytes", side_effect=OSError("controlled write failure")):
                result, owned = preflight.probe_owned_filesystem(Path(parent))
            self.assertEqual(result.status, preflight.FAIL)
            cleanup = preflight.cleanup_owned_directory(owned)
            self.assertEqual(cleanup.status, preflight.PASS)

    def test_cleanup_failure_is_explicit(self) -> None:
        owned = Path(tempfile.mkdtemp(prefix="securium-preflight-"))
        try:
            with mock.patch.object(preflight, "_remove_owned_tree", side_effect=OSError("controlled cleanup failure")):
                result = preflight.cleanup_owned_directory(owned)
            self.assertEqual(result.status, preflight.FAIL)
            self.assertEqual(result.details["scope"], "this execution's unique directory only")
            self.assertTrue(owned.exists())
        finally:
            owned.rmdir()

    def test_external_sentinel_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight-") as parent:
            parent_path = Path(parent)
            sentinel = parent_path / "external-sentinel.txt"
            sentinel.write_text("must remain", encoding="ascii")
            result = preflight.run_preflight(parent_path)
            self.assertEqual(result["overall_status"], preflight.PASS)
            self.assertEqual(sentinel.read_text(encoding="ascii"), "must remain")

    def test_existing_report_is_preserved_and_new_report_is_exclusive(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight-") as parent:
            directory = Path(parent) / "space and 한글"
            directory.mkdir()
            existing = directory / "existing.json"
            existing.write_text("sentinel\n", encoding="ascii")
            with self.assertRaises(preflight.PreflightUsageError):
                preflight.write_report(existing, preflight.run_preflight())
            self.assertEqual(existing.read_text(encoding="ascii"), "sentinel\n")

            new_report = directory / "new.json"
            preflight.write_report(new_report, preflight.run_preflight())
            parsed = json.loads(new_report.read_text(encoding="ascii"))
            self.assertEqual(parsed["tool"], preflight.TOOL_NAME)

    def test_report_output_failure_returns_non_pass_exit(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight-") as parent:
            missing_parent = Path(parent) / "missing" / "report.json"
            exit_code = preflight.main(["--report", str(missing_parent)])
            self.assertEqual(exit_code, preflight.EXIT_USAGE_OR_OUTPUT)


if __name__ == "__main__":
    unittest.main(verbosity=2)
