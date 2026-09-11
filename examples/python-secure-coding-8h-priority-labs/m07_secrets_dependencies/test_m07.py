from __future__ import annotations

import unittest

from .secure import (
    SECRET_NAME,
    DependencyFinding,
    LocalSecretProvider,
    LocalServiceClient,
    PackageProposal,
    SecureService,
    SecretRedactor,
    review_package_provenance,
    triage_dependency,
)
from .vulnerable import (
    DEMO_SECRET,
    VulnerableService,
    scanner_only_dependency_decision,
    scanner_only_package_approval,
)


def provider() -> LocalSecretProvider:
    return LocalSecretProvider({SECRET_NAME: DEMO_SECRET})


def reachable_finding(**overrides: object) -> DependencyFinding:
    values: dict[str, object] = {
        "package": "local-parser",
        "installed_version": "1.2.0",
        "advisory_id": "SYN-2026-007",
        "severity": "high",
        "dependency_path": ("demo-service", "local-client", "local-parser"),
        "reachable": True,
        "affected_path": "parse_request -> local-parser.decode",
        "owner": "platform-security",
        "fixed_version": "1.2.1",
        "reachability_evidence": "test-call-graph: parse_request reaches decode",
        "upgrade_evidence": "synthetic vendor note: 1.2.1 contains the bounded fix",
    }
    values.update(overrides)
    return DependencyFinding(**values)  # type: ignore[arg-type]


def approved_proposal(**overrides: object) -> PackageProposal:
    values: dict[str, object] = {
        "package": "local-parser",
        "version": "1.2.1",
        "source": "internal-artifact://local-parser",
        "integrity_digest": "sha256:synthetic-digest",
        "owner": "platform-security",
        "build_context": "isolated-review-build",
        "ci_credentials_exposed": False,
        "scanner_result": "clean",
        "human_reviewed": True,
    }
    values.update(overrides)
    return PackageProposal(**values)  # type: ignore[arg-type]


class M07SecretsDependenciesTests(unittest.TestCase):
    def test_secure_normal_operation_uses_provider_and_preserves_behavior(self) -> None:
        client = LocalServiceClient()
        service = SecureService(provider(), client)

        response = service.process("summarize the local report")

        self.assertEqual(response["status"], "ok")
        self.assertIn("summarize the local report", response["result"])
        self.assertTrue(client.credential_was_supplied)
        self.assertNotIn(DEMO_SECRET, client.last_prompt or "")

    def test_secret_leak_is_reproduced_then_removed_from_prompt_response_and_logs(self) -> None:
        vulnerable = VulnerableService()
        vulnerable_response = vulnerable.process("summarize", fail=True)
        self.assertIn(DEMO_SECRET, vulnerable_response["message"])
        self.assertTrue(any(DEMO_SECRET in line for line in vulnerable.logs))

        secure = SecureService(provider(), LocalServiceClient())
        secure_response = secure.process("summarize", fail=True)
        self.assertEqual(secure_response["message"], "Request could not be completed.")
        self.assertNotIn(DEMO_SECRET, str(secure_response))
        self.assertTrue(secure.operator_logs)
        self.assertTrue(all(DEMO_SECRET not in line for line in secure.operator_logs))
        self.assertTrue(any("[REDACTED]" in line for line in secure.operator_logs))

    def test_support_export_is_allowlisted_and_redacted(self) -> None:
        secure = SecureService(provider())
        exported = secure.support_export(
            {
                "reference": "m07-process",
                "status": "error",
                "message": f"failure token={DEMO_SECRET}",
                "request_body": f"discarded token={DEMO_SECRET}",
            }
        )

        self.assertEqual(set(exported), {"reference", "status", "message"})
        self.assertEqual(exported["message"], "failure token=[REDACTED]")
        self.assertNotIn(DEMO_SECRET, str(exported))

    def test_non_secret_placeholder_is_a_bounded_false_positive(self) -> None:
        redactor = SecretRedactor((DEMO_SECRET,))
        documentation = "TOKEN=NOT_A_REAL_SECRET documentation placeholder"
        self.assertEqual(redactor.redact(documentation), documentation)

    def test_scanner_finding_is_not_an_automatic_ignore_decision(self) -> None:
        finding = reachable_finding(
            severity="low",
            reachable=False,
            owner=None,
            affected_path="",
            reachability_evidence="",
            upgrade_evidence="",
        )

        self.assertEqual(scanner_only_dependency_decision(finding), "ignore")
        decision = triage_dependency(finding)
        self.assertEqual(decision.disposition, "REVIEW")
        self.assertIn("owner", decision.rationale[1])

    def test_reachable_dependency_upgrade_requires_reviewable_evidence(self) -> None:
        decision = triage_dependency(reachable_finding())
        self.assertEqual(decision.disposition, "UPGRADE")
        self.assertIn("fixed_version=1.2.1", decision.rationale)

        missing_upgrade = triage_dependency(reachable_finding(upgrade_evidence=""))
        self.assertEqual(missing_upgrade.disposition, "REVIEW")

    def test_reviewed_unreachable_dependency_can_be_bounded_as_not_affected(self) -> None:
        finding = reachable_finding(
            reachable=False,
            fixed_version=None,
            affected_path="optional path not imported by demo-service",
            reachability_evidence="call graph and negative test do not reach optional decoder",
            upgrade_evidence="owner recorded monitor decision for future use",
        )
        decision = triage_dependency(finding)
        self.assertEqual(decision.disposition, "NOT_AFFECTED_REVIEWED")

    def test_clean_scanner_result_does_not_approve_model_suggested_package(self) -> None:
        proposal = approved_proposal(
            source="model-suggestion",
            integrity_digest=None,
            owner=None,
            human_reviewed=False,
        )
        self.assertTrue(scanner_only_package_approval(proposal))
        decision = review_package_provenance(proposal)
        self.assertEqual(decision.status, "REVIEW")
        self.assertIn("integrity evidence", decision.missing_or_risky_controls)
        self.assertIn("human review of model-suggested package", decision.missing_or_risky_controls)

    def test_provenance_review_preserves_a_bounded_approved_case(self) -> None:
        decision = review_package_provenance(approved_proposal())
        self.assertEqual(decision.status, "APPROVED")
        self.assertEqual(decision.missing_or_risky_controls, ())

    def test_ci_credential_exposure_blocks_provenance_approval(self) -> None:
        decision = review_package_provenance(approved_proposal(ci_credentials_exposed=True))
        self.assertEqual(decision.status, "REVIEW")
        self.assertIn("CI credential exposure", decision.missing_or_risky_controls)


if __name__ == "__main__":
    unittest.main()
