import assert from "node:assert/strict";
import test from "node:test";
import {
  CS1A_CONTENT_CLASSES,
  CS1A_DECISIONS,
  CS1A_RESOURCE_TYPES,
  CS1A_POLICY_VERSION,
} from "../lib/policy/cs1a-contract.ts";
import {
  assertCs1aGovernanceReceiptInput,
  computeCs1aReceiptIdentity,
  computeSemanticDecisionHash,
} from "../lib/policy/cs1a-receipt.ts";
import { readFile } from "node:fs/promises";

const hash = "a".repeat(64);

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    resourceType: "CONTENT_REVISION" as const,
    resourceId: "synthetic-resource",
    resourceRevisionId: "synthetic-revision-1",
    parentRevisionId: null,
    sourceSetHash: hash,
    revisionHash: "b".repeat(64),
    policyVersion: CS1A_POLICY_VERSION,
    humanDecisionHash: "c".repeat(64),
    humanDecisionRef: "synthetic-human-decision",
    humanDecisionAt: "2026-08-26T00:00:00.000Z",
    decision: "ALLOW_CANONICAL" as const,
    reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL" as const,
    rightsDisposition: "ORIGINAL_INTERNAL" as const,
    currentnessDisposition: "CURRENT" as const,
    publicationAuthority: "NOT_GRANTED" as const,
    contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED" as const,
    authoringOrigin: "SECURIUM_ADMIN_CMS" as const,
    sourceOrigin: "NONE_NOT_APPLICABLE" as const,
    sourceManifestRef: null,
    sourceAuthority: null,
    actorAuditLogId: "synthetic-audit-log",
    ...overrides,
  };
}

test("merged R1 closes the CS1A vocabulary at 13 resources and six decisions", () => {
  assert.equal(CS1A_RESOURCE_TYPES.length, 13);
  assert.equal(CS1A_DECISIONS.length, 6);
  assert.deepEqual(CS1A_DECISIONS, ["ALLOW_DRAFT", "ALLOW_CANONICAL", "ALLOW_PUBLICATION", "DENY", "DEFER_RIGHTS", "DEFER_CURRENTNESS"]);
  assert.equal(CS1A_CONTENT_CLASSES.length, 6);
});

test("R1 validation accepts semantic fields and rejects substituted hashes", () => {
  const input = candidate();
  assert.doesNotThrow(() => assertCs1aGovernanceReceiptInput(input));
  assert.throws(() => assertCs1aGovernanceReceiptInput({ ...input, humanDecisionHash: "not-a-hash" }));
  assert.throws(() => assertCs1aGovernanceReceiptInput({ ...input, decision: "ALLOW_PUBLICATION", publicationAuthority: "NOT_GRANTED" }));
});

test("semantic decision hash and idempotency key are deterministic and client-derived identities are not accepted", () => {
  const input = candidate();
  const first = computeCs1aReceiptIdentity(input);
  const second = computeCs1aReceiptIdentity({ ...input });
  assert.deepEqual(first, second);
  assert.match(first.semanticDecisionHash, /^[0-9a-f]{64}$/);
  assert.match(first.idempotencyKey, /^[0-9a-f]{64}$/);
  assert.notEqual(first.semanticDecisionHash, computeSemanticDecisionHash({ ...input, decision: "DENY", reasonCode: "POLICY_DENY" }));
});

test("synthetic ISMS-P compatibility fixture represents 12 canonical decisions without persistence", () => {
  const fixtures = Array.from({ length: 12 }, (_, index) => candidate({
    resourceType: "CONTENT",
    resourceId: `isms-p-synthetic-${index + 1}`,
    resourceRevisionId: `isms-p-revision-${index + 1}`,
    humanDecisionHash: "15b6c189b1ebe819a7d6b184493561237288c8fef3cc69e6d221f35a9709f051",
  }));
  for (const fixture of fixtures) assert.doesNotThrow(() => assertCs1aGovernanceReceiptInput(fixture));
  assert.equal(fixtures.length, 12);
});

test("new migrations contain no stale CS1A 0032 or legacy receipt identity", async () => {
  const [pg, d1] = await Promise.all([
    readFile(new URL("../db/postgres/migrations/0021_cs1a_governance_receipts.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0033_cs1a_governance_receipts.sql", import.meta.url), "utf8"),
  ]);
  for (const source of [pg, d1]) {
    for (const stale of [["0032", "cs1a", "governance", "receipts"].join("_"), ["authority", "hash"].join("_"), ["prior", "receipt", "id"].join("_"), ["review", "status"].join("_")]) assert.equal(source.includes(stale), false, `stale identity ${stale}`);
    for (const field of ["resource_revision_id", "source_set_hash", "human_decision_hash", "semantic_decision_hash", "idempotency_key", "supersedes_receipt_id"]) assert.match(source, new RegExp(field));
  }
});
