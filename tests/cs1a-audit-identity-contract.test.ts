import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { persistCs1aGovernanceDecision } from "../db/cs1a-governance-identity-repository.ts";
import { DatabaseProviderError } from "../db/provider/database-error.ts";

const postgresMigration = readFileSync("db/postgres/migrations/0022_cs1a_audit_identity.sql", "utf8");
const d1Migration = readFileSync("drizzle/0034_cs1a_audit_identity.sql", "utf8");
const schema = readFileSync("db/schema.ts", "utf8");

test("G1 schema and provider contracts enforce global identity rules", () => {
  for (const source of [schema, postgresMigration, d1Migration]) {
    assert.match(source, /cs1a_governance_decisions/);
    assert.match(source, /human_decision_hash/);
    assert.match(source, /cs1a_governance_decision_subjects/);
    assert.match(source, /canonical_subject_identity/);
    assert.match(source, /publication_authority/);
    assert.match(source, /decision_id[\s\S]*canonical_subject_identity/);
    assert.match(source, /cs1a_governance_decision_audits/);
    assert.match(source, /audit_log_id/);
  }
  assert.match(postgresMigration, /UNIQUE \("contract_version", "human_decision_hash"\)/);
  assert.match(postgresMigration, /UNIQUE \("decision_id", "canonical_subject_identity"\)/);
  assert.match(postgresMigration, /PRIMARY KEY REFERENCES public\."cs1a_governance_decisions"/);
  assert.doesNotMatch(postgresMigration, /decision_id[\s\S]*actor_user_id/);
  assert.doesNotMatch(postgresMigration, /INSERT INTO public\."cs1a_governance_decisions"/);
});

test("duplicate subject identities fail before any provider transaction", async () => {
  let transactionCalls = 0;
  const database = { transaction: async () => { transactionCalls += 1; return []; }, query: async () => ({ rows: [], rowCount: 0, metadata: { provider: "supabase" as const } }), queryOne: async () => null, execute: async () => ({ affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" as const } }), healthCheck: async () => true, kind: "supabase" as const };
  const subject = { governanceScope: "PIA", resourceType: "CONTENT_REVISION", resourceId: "r", resourceRevisionId: "revision", contentHash: "a".repeat(64), revisionHash: "b".repeat(64), policyVersion: "CS1A_POLICY_V1", decision: "ALLOW_CANONICAL", reasonCode: "REVIEW_REQUIRED", rightsDisposition: "REVIEW_REQUIRED", currentnessDisposition: "CURRENT", authoringOrigin: "LEGACY", contentClass: "LEGACY_REVIEW_REQUIRED", sourceOrigin: "NONE_NOT_APPLICABLE", publicationAuthority: "NOT_GRANTED" } as const;
  await assert.rejects(persistCs1aGovernanceDecision({ database, actor: { id: "actor", roles: ["ADMIN"] }, contractVersion: "CS1A_HUMAN_DECISION_HASH_V1", humanDecisionHash: "c".repeat(64), subjects: [subject, subject], decision: subject.decision, reasonCode: subject.reasonCode, publicationAuthority: "NOT_GRANTED" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "CS1A_DUPLICATE_SUBJECT");
  assert.equal(transactionCalls, 0);
});

function integrityConflictDatabase() {
  return {
    transaction: async () => { throw new DatabaseProviderError("unique_violation"); },
    query: async () => ({ rows: [], rowCount: 0, metadata: { provider: "supabase" as const } }),
    queryOne: async () => null,
    execute: async () => ({ affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" as const } }),
    healthCheck: async () => true,
    kind: "supabase" as const,
  };
}

test("unique conflicts without a complete exact decision fail as integrity errors", async () => {
  const database = integrityConflictDatabase();
  const subject = { governanceScope: "PIA", resourceType: "CONTENT_REVISION", resourceId: "r", resourceRevisionId: "revision", contentHash: "a".repeat(64), revisionHash: "b".repeat(64), policyVersion: "CS1A_POLICY_V1", decision: "ALLOW_CANONICAL", reasonCode: "REVIEW_REQUIRED", rightsDisposition: "REVIEW_REQUIRED", currentnessDisposition: "CURRENT", authoringOrigin: "LEGACY", contentClass: "LEGACY_REVIEW_REQUIRED", sourceOrigin: "NONE_NOT_APPLICABLE", publicationAuthority: "NOT_GRANTED" } as const;
  await assert.rejects(
    persistCs1aGovernanceDecision({ database, actor: { id: "actor", roles: ["ADMIN"] }, contractVersion: "CS1A_HUMAN_DECISION_HASH_V1", humanDecisionHash: "d".repeat(64), subjects: [subject], decision: subject.decision, reasonCode: subject.reasonCode, publicationAuthority: "NOT_GRANTED" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CS1A_GOVERNANCE_INTEGRITY_FAILURE",
  );
});
