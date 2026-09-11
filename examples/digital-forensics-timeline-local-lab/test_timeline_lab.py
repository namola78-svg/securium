from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from timeline_lab import (
    LAB_FORMAT,
    LabError,
    analyze_file,
    analyze_fixture,
    build_synthetic_fixture,
    write_fixture,
    write_report,
)


class TimelineLabTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory(prefix="securium-타임라인-")
        self.root = Path(self.tempdir.name)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def _write_json(self, name: str, value: dict) -> Path:
        path = self.root / name
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return path

    def test_fixture_offsets_ties_conflicts_and_facts(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00+09:00")
        input_path = self.root / "합성-입력.json"
        write_fixture(input_path, fixture)
        original_bytes = input_path.read_bytes()

        report = analyze_file(input_path, "2026-09-11T09:30:00+09:00")

        self.assertEqual(original_bytes, input_path.read_bytes())
        self.assertEqual(report["fixture_created_at"], "2026-09-11T09:15:00+09:00")
        self.assertEqual(report["analysis_run_at"], "2026-09-11T09:30:00+09:00")
        self.assertEqual(report["records"][0]["timestamp_utc"], "2026-09-11T00:00:00Z")
        self.assertEqual([record["event_id"] for record in report["records"][:2]], ["evt-001", "evt-003"])
        self.assertEqual(len(report["ordering"]["tie_groups"]), 2)
        self.assertTrue(report["ordering"]["tie_order_is_not_causality"])
        self.assertEqual(
            report["potential_conflicts"][0]["event_ids"],
            ["evt-001", "evt-003", "evt-005"],
        )
        self.assertIn("timestamp_original", report["observed_facts"][0])
        self.assertIn("user, intent, causality", " ".join(report["interpretation_limits"]))

    def test_input_order_does_not_change_deterministic_result(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00+09:00")
        first = dict(fixture, records=list(fixture["records"]))
        second = dict(fixture, records=list(reversed(fixture["records"])))
        first_report = analyze_fixture(first, "input-hash", "2026-09-11T09:30:00Z")
        second_report = analyze_fixture(second, "input-hash", "2026-09-11T09:30:00Z")
        self.assertEqual(first_report["records"], second_report["records"])
        self.assertEqual(
            first_report["deterministic_result_sha256"],
            second_report["deterministic_result_sha256"],
        )

    def test_csv_input_is_supported_and_original_timestamp_survives(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00+09:00")
        path = self.root / "fixture.csv"
        write_fixture(path, fixture, "csv")
        report = analyze_file(path, "2026-09-11T09:30:00Z")
        self.assertEqual(len(report["records"]), 6)
        self.assertEqual(report["records"][0]["timestamp_original"], "2026-09-11T09:00:00+09:00")

    def test_missing_or_invalid_timezone_is_rejected(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")
        fixture["records"][0]["timestamp_original"] = "2026-09-11T09:00:00"
        path = self._write_json("missing-zone.json", fixture)
        with self.assertRaisesRegex(LabError, "explicit timezone"):
            analyze_file(path, "2026-09-11T09:30:00Z")

        fixture["records"][0]["timestamp_original"] = "not-a-time"
        path = self._write_json("invalid-time.json", fixture)
        with self.assertRaisesRegex(LabError, "valid ISO-8601"):
            analyze_file(path, "2026-09-11T09:30:00Z")

    def test_duplicate_identity_and_unmarked_or_malformed_input_are_rejected(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")
        fixture["records"][1]["event_id"] = fixture["records"][0]["event_id"]
        duplicate = self._write_json("duplicate.json", fixture)
        with self.assertRaisesRegex(LabError, "duplicate event identity"):
            analyze_file(duplicate, "2026-09-11T09:30:00Z")

        unmarked = self._write_json("unmarked.json", {"records": []})
        with self.assertRaisesRegex(LabError, "format must be"):
            analyze_file(unmarked, "2026-09-11T09:30:00Z")

        malformed = self.root / "malformed.json"
        malformed.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(LabError, "malformed JSON"):
            analyze_file(malformed, "2026-09-11T09:30:00Z")

    def test_oversized_field_is_rejected(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")
        fixture["records"][0]["notes"] = "x" * 2_001
        path = self._write_json("oversized.json", fixture)
        with self.assertRaisesRegex(LabError, "2000-character"):
            analyze_file(path, "2026-09-11T09:30:00Z")

    def test_cli_success_failure_unicode_path_and_no_overwrite(self) -> None:
        lab_dir = Path(__file__).resolve().parent
        cli = lab_dir / "cli.py"
        input_path = self.root / "한글 입력.json"
        report_path = self.root / "한글 보고서.json"
        command = [
            sys.executable,
            str(cli),
            "generate",
            "--output",
            str(input_path),
            "--fixture-created-at",
            "2026-09-11T09:15:00+09:00",
        ]
        generated = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(generated.returncode, 0, generated.stderr)
        input_bytes = input_path.read_bytes()

        analyzed = subprocess.run(
            [
                sys.executable,
                str(cli),
                "analyze",
                "--input",
                str(input_path),
                "--output",
                str(report_path),
                "--analysis-run-at",
                "2026-09-11T09:30:00+09:00",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(analyzed.returncode, 0, analyzed.stderr)
        self.assertEqual(input_bytes, input_path.read_bytes())
        report = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(report["format"], f"{LAB_FORMAT}-analysis")

        overwrite = subprocess.run(
            [
                sys.executable,
                str(cli),
                "analyze",
                "--input",
                str(input_path),
                "--output",
                str(report_path),
                "--analysis-run-at",
                "2026-09-11T09:30:00+09:00",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(overwrite.returncode, 2)
        self.assertIn("overwrite", overwrite.stderr)

    def test_report_bytes_and_deterministic_result_are_distinct(self) -> None:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")
        input_path = self.root / "fixture.json"
        write_fixture(input_path, fixture)
        first = analyze_file(input_path, "2026-09-11T09:30:00Z")
        second = analyze_file(input_path, "2026-09-11T09:31:00Z")
        first_path = self.root / "first.json"
        second_path = self.root / "second.json"
        first_bytes = write_report(first_path, first)
        second_bytes = write_report(second_path, second)
        self.assertEqual(first["deterministic_result_sha256"], second["deterministic_result_sha256"])
        self.assertNotEqual(first_bytes, second_bytes)
        self.assertNotEqual(hashlib.sha256(first_bytes).hexdigest(), hashlib.sha256(second_bytes).hexdigest())


if __name__ == "__main__":
    unittest.main()
