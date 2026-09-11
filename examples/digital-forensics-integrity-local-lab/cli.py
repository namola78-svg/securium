"""Command-line entry point for the local-only integrity lab."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from lab import (
    LabError,
    cleanup_workspace,
    prepare_workspace,
    remove_working_copy,
    tamper_working_copy,
    verify_workspace,
    write_verification_report,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Synthetic local-only evidence integrity lab")
    commands = parser.add_subparsers(dest="command", required=True)

    prepare = commands.add_parser("prepare", help="create a fresh temporary fixture workspace")
    prepare.add_argument("--recorded-at", required=True, help="caller-provided ISO-8601 record time")
    prepare.add_argument("--workspace", type=Path, help="new path; it must not already exist")

    verify = commands.add_parser("verify", help="verify manifest, custody, paths, sizes, and hashes")
    verify.add_argument("--workspace", required=True, type=Path)
    verify.add_argument("--report", help="optional new path under reports/; existing files are rejected")

    tamper = commands.add_parser("tamper", help="append a synthetic marker to one working-copy file")
    tamper.add_argument("--workspace", required=True, type=Path)
    tamper.add_argument("--path", required=True, help="working-copy relative path")

    remove = commands.add_parser("remove", help="remove one working-copy file for the missing case")
    remove.add_argument("--workspace", required=True, type=Path)
    remove.add_argument("--path", required=True, help="working-copy relative path")

    cleanup = commands.add_parser("cleanup", help="remove a marked lab workspace")
    cleanup.add_argument("--workspace", required=True, type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "prepare":
            result = prepare_workspace(args.workspace, args.recorded_at)
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0
        if args.command == "verify":
            result = verify_workspace(args.workspace)
            report_path = None
            if args.report:
                report_path = write_verification_report(args.workspace, result, args.report)
            if report_path:
                result["report_path"] = str(report_path)
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0 if result["status"] == "PASS" else 1
        if args.command == "tamper":
            path = tamper_working_copy(args.workspace, args.path)
            print(json.dumps({"status": "MUTATED_WORKING_COPY", "path": str(path)}, sort_keys=True))
            return 0
        if args.command == "remove":
            path = remove_working_copy(args.workspace, args.path)
            print(json.dumps({"status": "REMOVED_WORKING_COPY", "path": str(path)}, sort_keys=True))
            return 0
        if args.command == "cleanup":
            cleanup_workspace(args.workspace)
            print(json.dumps({"status": "CLEANED"}, sort_keys=True))
            return 0
    except (LabError, OSError) as error:
        print(json.dumps({"status": "REJECTED", "error": str(error)}, sort_keys=True), file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
