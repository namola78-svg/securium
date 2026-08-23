import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { computeConceptMappingSetHash } from "../lib/services/learning-event-contracts.ts";
import type { DatabaseProvider, DatabaseStatement } from "../db/provider/database-provider.ts";

test("Question adapter binds exact QuestionVersion and governed event-time mapping", async () => {
  const mapping = { conceptIdentity: "concept.one", mappingVersion: 1, qualification: { role: "primary" }, provenance: { source: "review" }, status: "APPROVED" as const };
  const mappingHash = await computeConceptMappingSetHash([mapping]);
  const provider = fakeProvider((statement) => {
    if (statement.sql.includes("FROM question_attempts")) return [{ id: "attempt", user_id: "user", question_version_id: "version", concept_mapping_set_hash: mappingHash, is_correct: 1, score: 100, occurred_at: "2026-08-21T00:00:00Z", version_hash: "b".repeat(64) }];
    if (statement.sql.includes("FROM question_concepts")) return [{ concept_id: "concept-id", concept_key: mapping.conceptIdentity, mapping_version: 1, qualification_json: JSON.stringify(mapping.qualification), provenance_json: JSON.stringify(mapping.provenance) }];
    return [];
  });
  const source = await new DatabaseEvidenceSourceResolver(provider).resolveEvent({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "attempt", sourceRevisionIdentity: "original" });
  assert.equal(source?.contentVersionIdentity, "version");
  assert.equal(source?.conceptMappingSetHash, mappingHash);
  assert.deepEqual(source?.resultSummary, { correct: true, score: 100 });
});

test("Question adapter preserves legacy unversioned attempts as formally ineligible", async () => {
  const provider = fakeProvider((statement) => statement.sql.includes("FROM question_attempts") ? [{ id: "legacy", user_id: "user", question_version_id: null, concept_mapping_set_hash: null, occurred_at: "2026-08-21T00:00:00Z", version_hash: null }] : []);
  const source = await new DatabaseEvidenceSourceResolver(provider).resolveEvent({ sourceType: "QUESTION_ATTEMPT", sourceEventId: "legacy", sourceRevisionIdentity: "legacy" });
  assert.equal(source?.validity, "LEGACY_INELIGIBLE");
});

function fakeProvider(resolve: (statement: DatabaseStatement) => Record<string, unknown>[]): DatabaseProvider {
  return {
    kind: "d1",
    async query(statement) { const rows = resolve(statement); return { rows, rowCount: rows.length, metadata: { provider: "d1" } }; },
    async queryOne(statement) { return resolve(statement)[0] ?? null; },
    async execute() { throw new Error("read-only fake"); },
    async transaction() { throw new Error("read-only fake"); },
    async healthCheck() { return true; },
  } as DatabaseProvider;
}
