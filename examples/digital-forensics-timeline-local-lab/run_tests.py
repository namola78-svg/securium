"""CI runner that refuses zero-test, skipped, failed, or errored lab runs."""

from __future__ import annotations

import json
from pathlib import Path
import unittest


def main() -> int:
    root = Path(__file__).resolve().parent
    suite = unittest.defaultTestLoader.discover(str(root), pattern="test_*.py")
    discovered = suite.countTestCases()
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    summary = {
        "discovered": discovered,
        "executed": result.testsRun,
        "failed": len(result.failures),
        "errors": len(result.errors),
        "skipped": len(result.skipped),
        "expected_failures": len(result.expectedFailures),
        "unexpected_successes": len(result.unexpectedSuccesses),
    }
    print(f"timeline_lab_test_summary={json.dumps(summary, sort_keys=True)}")
    if discovered == 0 or result.testsRun != discovered:
        return 1
    if (
        result.failures
        or result.errors
        or result.skipped
        or result.expectedFailures
        or result.unexpectedSuccesses
    ):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
