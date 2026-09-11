"""Command-line entry point for the synthetic forensic timeline lab."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

from timeline_lab import (
    LabError,
    analyze_file,
    build_synthetic_fixture,
    ensure_distinct_paths,
    write_fixture,
    write_report,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze explicitly marked synthetic forensic timeline records locally."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    generate = commands.add_parser("generate", help="write a synthetic JSON or CSV fixture")
    generate.add_argument("--output", required=True, type=Path)
    generate.add_argument("--format", choices=("json", "csv"), default="json")
    generate.add_argument("--fixture-created-at", help="timezone-aware fixture creation time")

    analyze = commands.add_parser("analyze", help="read a synthetic JSON or CSV fixture")
    analyze.add_argument("--input", required=True, type=Path)
    analyze.add_argument("--output", required=True, type=Path)
    analyze.add_argument("--analysis-run-at", help="timezone-aware analysis time; defaults to current UTC")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "generate":
            fixture = build_synthetic_fixture(args.fixture_created_at)
            raw = write_fixture(args.output, fixture, args.format)
            print(
                json.dumps(
                    {
                        "status": "GENERATED",
                        "fixture": str(args.output),
                        "fixture_id": fixture["fixture_id"],
                        "fixture_created_at": fixture["fixture_created_at"],
                        "bytes": len(raw),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
            )
            return 0

        ensure_distinct_paths(args.input, args.output)
        report = analyze_file(args.input, args.analysis_run_at)
        raw = write_report(args.output, report)
        print(
            json.dumps(
                {
                    "status": "ANALYZED",
                    "report": str(args.output),
                    "input_sha256": report["input_sha256"],
                    "deterministic_result_sha256": report["deterministic_result_sha256"],
                    "report_bytes_sha256": hashlib.sha256(raw).hexdigest(),
                    "analysis_run_at": report["analysis_run_at"],
                    "record_count": len(report["records"]),
                    "tie_group_count": len(report["ordering"]["tie_groups"]),
                    "potential_conflict_count": len(report["potential_conflicts"]),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0
    except LabError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    except OSError as error:
        print(f"ERROR: filesystem operation failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
