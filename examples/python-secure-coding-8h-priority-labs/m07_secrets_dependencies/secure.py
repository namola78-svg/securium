"""Reference repairs for the M07 local-only teaching fixtures.

The secret-provider and dependency records are deliberately small in-memory
models.  They model the control decisions needed in a real service without
installing packages, contacting a secret manager, or querying a scanner.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Protocol


SECRET_NAME = "service/api-token"


class SecretConfigurationError(ValueError):
    """Raised when required configuration is absent or malformed."""


class SecretProvider(Protocol):
    def get(self, name: str) -> str:
        """Return a secret from an approved provider boundary."""


@dataclass(frozen=True)
class LocalSecretProvider:
    """An in-memory stand-in for an approved secret provider in this lab."""

    values: Mapping[str, str]

    def get(self, name: str) -> str:
        value = self.values.get(name)
        if not isinstance(value, str) or not value:
            raise SecretConfigurationError("required configuration unavailable")
        return value


class SecretRedactor:
    """Redact known secret values before they reach operator-facing sinks."""

    def __init__(self, secrets: Iterable[str]) -> None:
        self._secrets = tuple(
            sorted(
                {secret for secret in secrets if isinstance(secret, str) and len(secret) >= 4},
                key=len,
                reverse=True,
            )
        )

    def redact(self, value: object) -> str:
        rendered = str(value)
        for secret in self._secrets:
            rendered = rendered.replace(secret, "[REDACTED]")
        return rendered


class LocalServiceClient:
    """A fake credential sink: it records only whether a credential was used."""

    def __init__(self) -> None:
        self.last_prompt: str | None = None
        self.credential_was_supplied = False

    def execute(self, prompt: str, *, credential: str, fail: bool = False) -> str:
        self.last_prompt = prompt
        self.credential_was_supplied = bool(credential)
        if fail:
            raise RuntimeError(f"synthetic upstream failure credential={credential}")
        return f"completed:{prompt.removeprefix('Process this task as data: ')}"


def build_prompt_secure(task: str, redactor: SecretRedactor) -> str:
    """Validate the normal task shape and keep known secrets out of prompts."""

    if not isinstance(task, str) or not task.strip():
        raise ValueError("task is required")
    if len(task) > 200:
        raise ValueError("task is too long")
    return redactor.redact(f"Process this task as data: {task}")


class SecureService:
    """A service with narrow secret use and separate public/operator channels."""

    def __init__(self, provider: SecretProvider, client: LocalServiceClient | None = None) -> None:
        self.provider = provider
        self.client = client or LocalServiceClient()
        self.operator_logs: list[str] = []

    def process(self, task: str, *, fail: bool = False) -> dict[str, str]:
        redactor = SecretRedactor(())
        try:
            secret = self.provider.get(SECRET_NAME)
            redactor = SecretRedactor((secret,))
            prompt = build_prompt_secure(task, redactor)
            result = self.client.execute(prompt, credential=secret, fail=fail)
        except SecretConfigurationError:
            self.operator_logs.append("operation=process failure=configuration_unavailable")
            return {"status": "error", "message": "Request could not be completed.", "reference": "m07-config"}
        except (RuntimeError, ValueError) as exc:
            safe_diagnostic = redactor.redact(f"operation=process failure={type(exc).__name__}:{exc}")
            self.operator_logs.append(safe_diagnostic)
            return {"status": "error", "message": "Request could not be completed.", "reference": "m07-process"}

        self.operator_logs.append("operation=process status=ok")
        return {"status": "ok", "result": result}

    def support_export(self, details: Mapping[str, object]) -> dict[str, str]:
        """Export only approved fields, redacting known values in each field."""

        secret = self.provider.get(SECRET_NAME)
        redactor = SecretRedactor((secret,))
        allowed_fields = {"reference", "status", "message", "trace", "error_type"}
        return {
            key: redactor.redact(value)
            for key, value in details.items()
            if key in allowed_fields
        }


@dataclass(frozen=True)
class DependencyFinding:
    """Synthetic scanner output; no package is installed by this lab."""

    package: str
    installed_version: str
    advisory_id: str
    severity: str
    dependency_path: tuple[str, ...]
    reachable: bool
    affected_path: str
    owner: str | None
    fixed_version: str | None
    reachability_evidence: str
    upgrade_evidence: str


@dataclass(frozen=True)
class DependencyDecision:
    disposition: str
    rationale: tuple[str, ...]


def triage_dependency(finding: DependencyFinding) -> DependencyDecision:
    """Make scanner output a review input, then require bounded evidence."""

    missing: list[str] = []
    if not finding.owner:
        missing.append("owner")
    if not finding.dependency_path:
        missing.append("dependency path")
    if not finding.affected_path:
        missing.append("affected path")
    if not finding.reachability_evidence:
        missing.append("reachability evidence")
    if not finding.upgrade_evidence:
        missing.append("upgrade evidence")
    if missing:
        return DependencyDecision(
            "REVIEW",
            ("scanner output is a triage signal", f"missing: {', '.join(missing)}"),
        )

    context = (
        f"owner={finding.owner}",
        f"path={' -> '.join(finding.dependency_path)}",
        f"affected_path={finding.affected_path}",
        f"reachable={finding.reachable}",
        f"upgrade_evidence={finding.upgrade_evidence}",
    )
    if finding.reachable and finding.fixed_version:
        return DependencyDecision(
            "UPGRADE",
            ("reachable affected code needs a reviewed fix", f"fixed_version={finding.fixed_version}", *context),
        )
    if not finding.reachable:
        return DependencyDecision(
            "NOT_AFFECTED_REVIEWED",
            ("reachability evidence supports a bounded non-affected decision", *context),
        )
    return DependencyDecision("REVIEW", ("scanner output is not a verdict", *context))


@dataclass(frozen=True)
class PackageProposal:
    """Synthetic model-suggested package metadata for provenance review."""

    package: str
    version: str
    source: str
    integrity_digest: str | None
    owner: str | None
    build_context: str | None
    ci_credentials_exposed: bool
    scanner_result: str
    human_reviewed: bool


@dataclass(frozen=True)
class ProvenanceDecision:
    status: str
    missing_or_risky_controls: tuple[str, ...]


def review_package_provenance(proposal: PackageProposal) -> ProvenanceDecision:
    """Review source, integrity, ownership, build context, and CI exposure."""

    risks: list[str] = []
    if not proposal.source:
        risks.append("source")
    if not proposal.integrity_digest:
        risks.append("integrity evidence")
    if not proposal.owner:
        risks.append("owner")
    if not proposal.build_context:
        risks.append("build context")
    if proposal.ci_credentials_exposed:
        risks.append("CI credential exposure")
    if proposal.source == "model-suggestion" and not proposal.human_reviewed:
        risks.append("human review of model-suggested package")
    if proposal.scanner_result != "clean":
        risks.append("scanner result requires triage")
    return ProvenanceDecision("APPROVED" if not risks else "REVIEW", tuple(risks))
