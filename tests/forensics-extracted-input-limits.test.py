"""Focused proof that the source-bound extracted timeline lab enforces byte limits."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
RUNNER = REPOSITORY_ROOT / "verification" / "forensics-extracted-input-limits" / "run.py"
HISTORICAL_TRUSTED_SOURCE_COMMIT = "200e3db5a191eae2db82e8f4a426f0fcbf24f69e"
TRUSTED_SOURCE_COMMIT = os.environ.get(
    "SECURIUM_TRUSTED_SOURCE_COMMIT", HISTORICAL_TRUSTED_SOURCE_COMMIT
)


class ExtractedTimelineInputLimitTests(unittest.TestCase):
    def test_source_bound_extraction_runs_real_boundary_evaluation(self) -> None:
        environment = {
            key: value
            for key, value in __import__("os").environ.items()
            if key.upper() not in {"PYTHONPATH", "PYTHONHOME"}
        }
        result = subprocess.run(
            [sys.executable, "-B", str(RUNNER), "--source-commit", TRUSTED_SOURCE_COMMIT],
            cwd=REPOSITORY_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            shell=False,
            timeout=180,
        )
        summary = None
        for line in reversed(result.stdout.splitlines()):
            if line.startswith("extracted_input_limit_validation="):
                summary = json.loads(line.split("=", 1)[1])
                break
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIsInstance(summary, dict)
        assert summary is not None
        self.assertEqual(summary.get("status"), "PASS")
        self.assertEqual(summary.get("trusted_source_commit"), TRUSTED_SOURCE_COMMIT)
        self.assertEqual(summary.get("package_source_entry_count"), 13)
        self.assertEqual(summary.get("package_zip_entry_count"), 14)
        self.assertTrue(summary.get("extraction_source_bytes_match"))
        self.assertEqual(
            summary.get("stages"),
            {
                "source_verification": "PASS",
                "extraction": "PASS",
                "preflight": "PASS",
                "extracted_input_limits": "PASS",
                "strict_lab_execution": "NOT_RUN",
                "cleanup": "PASS",
            },
        )

        binding = summary["source_binding"]
        self.assertEqual(binding["trusted_source_commit"], TRUSTED_SOURCE_COMMIT)
        self.assertEqual(
            binding["source_path"],
            "examples/digital-forensics-timeline-local-lab/timeline_lab.py",
        )
        self.assertEqual(
            binding["trusted_git_blob_sha1"], binding["zip_entry"]["git_blob_sha1"]
        )
        self.assertEqual(
            binding["trusted_source_sha256"], binding["zip_entry"]["sha256"]
        )
        self.assertEqual(binding["extracted_sha256"], binding["trusted_source_sha256"])
        self.assertTrue(binding["extracted_bytes_match"])

        preflight = summary["preflight"]
        self.assertEqual(preflight["overall_status"], "PASS")
        self.assertEqual(preflight["exit_code"], 0)
        self.assertEqual(preflight["probe_counts"], {"NOT_RUN": 6, "PASS": 8})
        self.assertEqual(preflight["lab_execution"], "PENDING")

        limits = summary["input_limit"]
        self.assertEqual(limits["normal"]["exit_code"], 0)
        self.assertTrue(limits["normal"]["report_created"])
        self.assertEqual(limits["normal"]["record_count"], 1)
        self.assertEqual(limits["exact_limit"]["input_bytes"], 1_048_576)
        self.assertEqual(limits["exact_limit"]["exit_code"], 0)
        self.assertTrue(limits["exact_limit"]["report_created"])
        self.assertEqual(limits["overflow"]["input_bytes"], 1_048_577)
        self.assertEqual(limits["overflow"]["exit_code"], 2)
        self.assertFalse(limits["overflow"]["report_created"])
        self.assertTrue(limits["overflow"]["input_preserved"])
        self.assertTrue(limits["overflow"]["external_sentinel_preserved"])

        probe = summary["read_budget_test_double"]
        self.assertFalse(probe["repository_source_imported"])
        self.assertEqual(probe["success"]["read_sizes"], [1_048_577])
        self.assertTrue(probe["success"]["closed"])
        self.assertEqual(probe["overflow"]["read_sizes"], [1_048_577])
        self.assertEqual(probe["overflow"]["parser_calls"], 0)
        self.assertEqual(probe["overflow"]["decode_calls"], 0)
        self.assertTrue(probe["overflow"]["closed"])
        self.assertTrue(probe["read_error"]["closed"])
        print(
            "extracted_input_limit_test_summary="
            + json.dumps(summary, ensure_ascii=True, sort_keys=True)
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
