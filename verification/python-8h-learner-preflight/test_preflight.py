#!/usr/bin/env python3
"""Regression tests for the learner environment preflight tool."""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


TOOL_DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOL_DIRECTORY))
import preflight  # noqa: E402


class LearnerPreflightTests(unittest.TestCase):
    def test_actual_cli_runs_without_external_dependencies(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(TOOL_DIRECTORY / "preflight.py"), "--json"],
            cwd=TOOL_DIRECTORY,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            timeout=15,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertIn(result["overall_status"], {preflight.PASS, preflight.UNVERIFIED_ENVIRONMENT})
        statuses = {probe["name"]: probe["status"] for probe in result["probes"]}
        for name in (
            "python_version",
            "lab_stdlib_imports",
            "sqlite_memory",
            "temporary_file_io",
            "owned_subprocess",
            "loopback_ephemeral_bind",
        ):
            self.assertEqual(statuses[name], preflight.PASS)
        self.assertEqual(statuses["full_lab_test_suite"], preflight.NOT_CHECKED)
        self.assertEqual(statuses["browser_harness"], preflight.NOT_CHECKED)

    def test_matrix_scope_does_not_turn_unverified_environment_into_failure(self) -> None:
        result = preflight.probe_matrix_scope(
            (3, 13, 0),
            "Darwin",
        )
        self.assertEqual(result.status, preflight.UNVERIFIED_ENVIRONMENT)
        self.assertFalse(result.required)

    def test_owned_subprocess_timeout_is_a_failure(self) -> None:
        def timeout_runner(*args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
            raise subprocess.TimeoutExpired(cmd="controlled-fixture", timeout=kwargs["timeout"])

        with mock.patch.object(preflight.subprocess, "run", side_effect=timeout_runner):
            result = preflight.run_owned_subprocess()
        self.assertEqual(result.status, preflight.FAIL)
        self.assertIn("timeout", result.message)

    def test_temporary_write_failure_is_reported_and_owned_directory_is_cleaned(self) -> None:
        owner = Path(tempfile.mkdtemp(prefix="securium-preflight-regression-"))
        owned = owner / "owned"
        owned.mkdir()
        try:
            with mock.patch.object(preflight.tempfile, "mkdtemp", return_value=str(owned)):
                with mock.patch.object(Path, "write_text", side_effect=OSError("controlled storage failure")):
                    result = preflight.probe_temporary_file()
            self.assertEqual(result.status, preflight.FAIL)
            self.assertEqual(result.details["cleanup"], preflight.PASS)
            self.assertFalse(owned.exists())
        finally:
            shutil.rmtree(owner, ignore_errors=True)

    def test_cleanup_failure_is_explicit(self) -> None:
        owner = Path(tempfile.mkdtemp(prefix="securium-preflight-regression-"))
        owned = owner / "owned"
        owned.mkdir()
        try:
            with mock.patch.object(preflight.tempfile, "mkdtemp", return_value=str(owned)):
                with mock.patch.object(preflight.shutil, "rmtree", side_effect=OSError("controlled cleanup failure")):
                    result = preflight.probe_temporary_file()
            self.assertEqual(result.status, preflight.FAIL)
            self.assertEqual(result.details["cleanup"], "FAIL")
            self.assertIn("cleanup", result.message)
        finally:
            shutil.rmtree(owner, ignore_errors=True)

    def test_loopback_cleanup_failure_is_explicit(self) -> None:
        class CloseFailureSocket:
            def settimeout(self, value: float) -> None:
                return None

            def bind(self, address: tuple[str, int]) -> None:
                return None

            def listen(self, backlog: int) -> None:
                return None

            def getsockname(self) -> tuple[str, int]:
                return ("127.0.0.1", 49152)

            def close(self) -> None:
                raise OSError("controlled listener cleanup failure")

        with mock.patch.object(preflight.socket, "socket", return_value=CloseFailureSocket()):
            result = preflight.probe_loopback_ephemeral_port()
        self.assertEqual(result.status, preflight.FAIL)
        self.assertEqual(result.details["cleanup"], "FAIL")
        self.assertIn("closed", result.message)

    def test_existing_report_is_preserved_and_non_ascii_output_path_works(self) -> None:
        with tempfile.TemporaryDirectory(prefix="securium-preflight-regression-") as temporary:
            output_dir = Path(temporary) / "space and 한글"
            output_dir.mkdir()
            report = output_dir / "diagnostic result.json"
            report.write_text("sentinel\n", encoding="utf-8")
            with self.assertRaises(preflight.PreflightUsageError):
                preflight.validate_report_target(report)
            self.assertEqual(report.read_text(encoding="utf-8"), "sentinel\n")

            new_report = output_dir / "new result.json"
            result = preflight.build_result()
            preflight.write_report(new_report, result)
            parsed = json.loads(new_report.read_text(encoding="utf-8"))
            self.assertEqual(parsed["tool"], "securium-python-8h-learner-preflight")
            self.assertNotIn(str(output_dir), new_report.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
