from __future__ import annotations

import copy
import csv
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
LAB_DIRECTORY = REPOSITORY_ROOT / "examples" / "digital-forensics-timeline-local-lab"
CLI_PATH = LAB_DIRECTORY / "cli.py"
sys.path.insert(0, str(LAB_DIRECTORY))

from timeline_lab import (  # noqa: E402
    CSV_FIELDS,
    LabError,
    MAX_FIELD_CHARS,
    MAX_INPUT_BYTES,
    MAX_NOTES_CHARS,
    MAX_RECORDS,
    REQUIRED_FIELDS,
    analyze_file,
    build_synthetic_fixture,
    write_report,
)


class TimelineInputLimitTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory(prefix="securium-timeline-input-limits-")
        self.root = Path(self.tempdir.name)

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def _records_fixture(self, count: int) -> dict:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")
        template = fixture["records"][0]
        records = []
        for index in range(count):
            record = dict(template)
            record["event_id"] = f"limit-{index:03d}"
            record["timestamp_original"] = f"2026-09-11T00:{index // 60:02d}:{index % 60:02d}Z"
            records.append(record)
        return dict(fixture, records=records)

    def _write_json(self, name: str, fixture: dict) -> Path:
        path = self.root / name
        path.write_text(json.dumps(fixture, ensure_ascii=False), encoding="utf-8")
        return path

    def _write_raw_csv(self, name: str, fixture: dict) -> Path:
        path = self.root / name
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
            writer.writeheader()
            for record in fixture["records"]:
                writer.writerow(
                    {
                        "fixture_id": fixture["fixture_id"],
                        "scope": fixture["scope"],
                        "fixture_created_at": fixture["fixture_created_at"],
                        **{field: record[field] for field in REQUIRED_FIELDS},
                        "notes": record.get("notes", ""),
                    }
                )
        return path

    def _write_json_with_exact_size(self, name: str, size: int) -> Path:
        fixture = build_synthetic_fixture("2026-09-11T09:15:00Z")

        def encode(padding: int) -> bytes:
            fixture["limitations"] = ["x" * padding]
            return json.dumps(
                fixture,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")

        padding = size - len(encode(0))
        self.assertGreaterEqual(padding, 0)
        data = encode(padding)
        self.assertEqual(len(data), size)
        path = self.root / name
        path.write_bytes(data)
        return path

    def _run_cli(self, input_path: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(CLI_PATH),
                "analyze",
                "--input",
                str(input_path),
                "--output",
                str(output_path),
                "--analysis-run-at",
                "2026-09-11T09:30:00Z",
            ],
            cwd=REPOSITORY_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
            timeout=30,
        )

    def test_json_record_limit_accepts_exact_and_rejects_over_limit(self) -> None:
        exact_path = self._write_json("records-100.json", self._records_fixture(MAX_RECORDS))
        exact_bytes = exact_path.read_bytes()
        report = analyze_file(exact_path, "2026-09-11T09:30:00Z")
        report_path = self.root / "records-100-report.json"
        report_bytes = write_report(report_path, report)

        self.assertEqual(len(report["records"]), MAX_RECORDS)
        self.assertEqual(report["input_sha256"], hashlib.sha256(exact_bytes).hexdigest())
        self.assertGreater(len(report_bytes), 0)
        self.assertEqual(exact_bytes, exact_path.read_bytes())

        over_path = self._write_json("records-101.json", self._records_fixture(MAX_RECORDS + 1))
        over_bytes = over_path.read_bytes()
        with self.assertRaisesRegex(LabError, "records exceed the 100-record limit"):
            analyze_file(over_path, "2026-09-11T09:30:00Z")
        self.assertEqual(over_bytes, over_path.read_bytes())

    def test_csv_record_limit_accepts_exact_and_rejects_over_limit(self) -> None:
        exact_path = self._write_raw_csv("records-100.csv", self._records_fixture(MAX_RECORDS))
        exact_bytes = exact_path.read_bytes()
        report = analyze_file(exact_path, "2026-09-11T09:30:00Z")

        self.assertEqual(len(report["records"]), MAX_RECORDS)
        self.assertEqual(report["input_sha256"], hashlib.sha256(exact_bytes).hexdigest())
        self.assertLess(len(exact_bytes), MAX_INPUT_BYTES)

        over_path = self._write_raw_csv("records-101.csv", self._records_fixture(MAX_RECORDS + 1))
        over_bytes = over_path.read_bytes()
        with self.assertRaisesRegex(LabError, "records exceed the 100-record limit"):
            analyze_file(over_path, "2026-09-11T09:30:00Z")
        self.assertEqual(over_bytes, over_path.read_bytes())

    def test_json_and_csv_field_limits_accept_exact_and_reject_over_limit(self) -> None:
        exact_fixture = self._records_fixture(1)
        exact_fixture["records"][0]["event_type"] = "E" * MAX_FIELD_CHARS
        exact_fixture["records"][0]["notes"] = "N" * MAX_NOTES_CHARS

        exact_json = self._write_json("field-exact.json", exact_fixture)
        exact_csv = self._write_raw_csv("field-exact.csv", exact_fixture)
        for path in (exact_json, exact_csv):
            with self.subTest(path=path.name):
                report = analyze_file(path, "2026-09-11T09:30:00Z")
                self.assertEqual(report["records"][0]["event_type"], "E" * MAX_FIELD_CHARS)
                self.assertEqual(report["records"][0]["notes"], "N" * MAX_NOTES_CHARS)

        over_fixture = copy.deepcopy(exact_fixture)
        over_fixture["records"][0]["event_type"] = "E" * (MAX_FIELD_CHARS + 1)
        over_json = self._write_json("field-over.json", over_fixture)
        over_csv = self._write_raw_csv("field-over.csv", over_fixture)
        for path in (over_json, over_csv):
            before = path.read_bytes()
            with self.subTest(path=path.name):
                with self.assertRaisesRegex(LabError, "512-character limit"):
                    analyze_file(path, "2026-09-11T09:30:00Z")
            self.assertEqual(before, path.read_bytes())

    def test_input_byte_limit_accepts_exact_and_cli_rejects_over_limit(self) -> None:
        exact_path = self._write_json_with_exact_size("input-exact.json", MAX_INPUT_BYTES)
        exact_bytes = exact_path.read_bytes()
        report = analyze_file(exact_path, "2026-09-11T09:30:00Z")
        self.assertEqual(len(exact_bytes), MAX_INPUT_BYTES)
        self.assertEqual(report["input_sha256"], hashlib.sha256(exact_bytes).hexdigest())

        over_path = self._write_json_with_exact_size("input-over.json", MAX_INPUT_BYTES + 1)
        over_bytes = over_path.read_bytes()
        output_path = self.root / "input-over-report.json"
        sentinel = self.root / "external-sentinel.txt"
        sentinel.write_text("must remain\n", encoding="utf-8")

        result = self._run_cli(over_path, output_path)

        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("input exceeds", result.stderr)
        self.assertFalse(output_path.exists())
        self.assertEqual(over_bytes, over_path.read_bytes())
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "must remain\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
