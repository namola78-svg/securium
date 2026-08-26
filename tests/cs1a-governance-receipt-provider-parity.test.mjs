import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { computeCs1aReceiptIdentity } from "../lib/policy/cs1a-receipt.ts";

const [pg, d1] = await Promise.all([
  readFile(new URL("../db/postgres/migrations/0021_cs1a_governance_receipts.sql", import.meta.url), "utf8"),
  readFile(new URL("../drizzle/0033_cs1a_governance_receipts.sql", import.meta.url), "utf8"),
]);

const candidate = {
  resourceType: "CONTENT_REVISION",
  resourceId: "parity-resource",
  resourceRevisionId: "parity-revision",
  parentRevisionId: null,
  sourceSetHash: "a".repeat(64),
  revisionHash: "b".repeat(64),
  policyVersion: "CS1A_POLICY_V1",
  humanDecisionHash: "c".repeat(64),
  humanDecisionRef: "parity-human-decision",
  humanDecisionAt: "2026-08-26T00:00:00.000Z",
  decision: "ALLOW_CANONICAL",
  reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL",
  rightsDisposition: "ORIGINAL_INTERNAL",
  currentnessDisposition: "CURRENT",
  publicationAuthority: "NOT_GRANTED",
  contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
  authoringOrigin: "SECURIUM_ADMIN_CMS",
  sourceOrigin: "NONE_NOT_APPLICABLE",
  sourceManifestRef: null,
  sourceAuthority: null,
  actorAuditLogId: "parity-audit",
};

test("PostgreSQL R2 and D1 R3 contain equivalent semantic columns and six decisions", () => {
  for (const field of ["resource_type", "resource_id", "resource_revision_id", "parent_revision_id", "revision_hash", "source_set_hash", "policy_version", "rights_disposition", "currentness_disposition", "content_class", "authoring_origin", "source_origin", "publication_authority", "decision", "reason_code", "human_decision_hash", "semantic_decision_hash", "idempotency_key", "supersedes_receipt_id"]) {
    assert.match(pg, new RegExp(field));
    assert.match(d1, new RegExp(field));
  }
  for (const decision of ["ALLOW_DRAFT", "ALLOW_CANONICAL", "ALLOW_PUBLICATION", "DENY", "DEFER_RIGHTS", "DEFER_CURRENTNESS"]) {
    assert.match(pg, new RegExp(decision));
    assert.match(d1, new RegExp(decision));
  }
});

test("provider parity compares semantic identity only, excluding physical timestamps", () => {
  const identity = computeCs1aReceiptIdentity(candidate);
  assert.match(identity.semanticDecisionHash, /^[0-9a-f]{64}$/);
  assert.match(identity.idempotencyKey, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(identity), /createdAt|created_at|receiptId/);
});

test("provider migrations preserve canonical PostgreSQL and compatibility D1 authority", () => {
  assert.match(pg, /CS1A R2 canonical/);
  assert.doesNotMatch(d1, /CANONICAL_PROVIDER|PRODUCTION/);
  assert.match(pg, /REVOKE ALL PRIVILEGES/);
  assert.match(pg, /FORCE ROW LEVEL SECURITY/);
});
