"""Intentionally unsafe M07 teaching fixtures.

All values in this module are synthetic.  The hard-coded token is deliberately
not a credential and must never be copied into a real environment.
"""

from __future__ import annotations

from dataclasses import dataclass


DEMO_SECRET = "m07-local-demo-secret-123"


class VulnerableService:
    """A generated-style service that lets a secret cross several sinks."""

    def __init__(self) -> None:
        self.logs: list[str] = []

    def process(self, task: str, *, fail: bool = False) -> dict[str, str]:
        prompt = f"Process this task: {task}; api_token={DEMO_SECRET}"
        self.logs.append(f"prompt={prompt}")
        try:
            if fail:
                raise RuntimeError(f"synthetic upstream failure token={DEMO_SECRET}")
            return {"status": "ok", "result": f"processed:{task}", "prompt": prompt}
        except Exception as exc:  # noqa: BLE001 - the unsafe behavior is intentional
            message = f"request failed: {exc}; prompt={prompt}"
            self.logs.append(message)
            return {"status": "error", "message": message}


def scanner_only_dependency_decision(finding: object) -> str:
    """Unsafe: treats severity or reachability as the complete decision."""

    severity = str(getattr(finding, "severity", "unknown")).lower()
    if severity in {"critical", "high"}:
        return "upgrade"
    if getattr(finding, "reachable", False) is False:
        return "ignore"
    return "approved"


def scanner_only_package_approval(proposal: object) -> bool:
    """Unsafe: a clean scanner result is treated as provenance proof."""

    return str(getattr(proposal, "scanner_result", "unknown")).lower() == "clean"
