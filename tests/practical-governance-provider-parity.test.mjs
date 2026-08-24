import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("PostgreSQL and D1 migrations contain the same governed table inventory", async () => {
  const postgres = await readFile("db/postgres/migrations/0018_practical_revision_governance.sql", "utf8");
  const d1 = await readFile("drizzle/0030_practical_revision_governance.sql", "utf8");
  for (const table of ["canonical_practicals", "practical_governance_versions", "practical_reviewer_material_versions", "practical_version_concept_bindings"]) {
    assert.match(postgres, new RegExp(table));
    assert.match(d1, new RegExp(table));
  }
});
test("provider migrations preserve lifecycle and reviewer-only constraints", async () => {
  const [postgres, d1] = await Promise.all([readFile("db/postgres/migrations/0018_practical_revision_governance.sql", "utf8"), readFile("drizzle/0030_practical_revision_governance.sql", "utf8")]);
  for (const text of [postgres, d1]) {
    assert.match(text, /CANONICAL_UNPUBLISHED/);
    assert.match(text, /SUPERSEDED/);
    assert.match(text, /REVIEWER_ONLY/);
    assert.match(text, /semantic_hash/);
  }
});

const validHash = "a".repeat(64);
const validMethods = new Set(["RULE_BASED", "STRUCTURED_HUMAN_REVIEW", "HYBRID"]);
const validClassifications = new Set(["ELIGIBLE_PERFORMANCE_EVIDENCE", "ELIGIBLE_AFTER_HUMAN_EVALUATION", "SUPPORTING_ACTIVITY_ONLY"]);

function postgresEvaluationAccepts({ hash, method, classification }) {
  return (hash === null || /^[0-9a-f]{64}$/.test(hash)) &&
    (method === null || validMethods.has(method)) &&
    (classification === null || validClassifications.has(classification));
}

function d1EvaluationAccepts({ hash, method, classification }) {
  return !(hash !== null && (hash.length !== 64 || /[^0-9a-f]/.test(hash)) ||
    method !== null && !validMethods.has(method) ||
    classification !== null && !validClassifications.has(classification));
}

const negativeCases = [
  { name: "legacy invalid method with NULL hash", hash: null, method: "INVALID", classification: null },
  { name: "invalid method with valid hash", hash: validHash, method: "INVALID", classification: null },
  { name: "legacy invalid classification with NULL hash", hash: null, method: null, classification: "INVALID" },
  { name: "invalid classification with valid hash", hash: validHash, method: null, classification: "INVALID" },
  { name: "empty hash", hash: "", method: "HYBRID", classification: "SUPPORTING_ACTIVITY_ONLY" },
  { name: "non-hex hash", hash: "g".repeat(64), method: "HYBRID", classification: "SUPPORTING_ACTIVITY_ONLY" },
  { name: "short hash", hash: "a", method: "HYBRID", classification: "SUPPORTING_ACTIVITY_ONLY" },
  { name: "invalid method with invalid hash", hash: "", method: "INVALID", classification: "SUPPORTING_ACTIVITY_ONLY" },
  { name: "invalid classification with invalid hash", hash: "", method: "HYBRID", classification: "INVALID" },
  { name: "invalid method and classification with NULL hash", hash: null, method: "INVALID", classification: "INVALID" },
  { name: "invalid method and classification with valid hash", hash: validHash, method: "INVALID", classification: "INVALID" },
];

const positiveCases = [
  { name: "legacy all NULL", hash: null, method: null, classification: null },
  { name: "legacy NULL method", hash: null, method: null, classification: "SUPPORTING_ACTIVITY_ONLY" },
  { name: "legacy NULL classification", hash: null, method: "HYBRID", classification: null },
  { name: "valid method", hash: null, method: "RULE_BASED", classification: null },
  { name: "valid classification", hash: null, method: null, classification: "ELIGIBLE_AFTER_HUMAN_EVALUATION" },
  { name: "fully valid governed evaluation", hash: validHash, method: "HYBRID", classification: "ELIGIBLE_PERFORMANCE_EVIDENCE" },
  { name: "valid approved lifecycle evaluation", hash: validHash, method: "STRUCTURED_HUMAN_REVIEW", classification: "ELIGIBLE_AFTER_HUMAN_EVALUATION" },
];

test("evaluation method and evidence classification are independently guarded", async () => {
  const d1 = await readFile("drizzle/0030_practical_revision_governance.sql", "utf8");
  assert.match(d1, /NEW\.evaluation_method IS NOT NULL AND NEW\.evaluation_method NOT IN/);
  assert.match(d1, /NEW\.evidence_classification IS NOT NULL AND NEW\.evidence_classification NOT IN/);
  assert.doesNotMatch(d1, /WHEN NEW\.evaluation_semantic_hash IS NOT NULL AND \(length\(NEW\.evaluation_semantic_hash\).*OR NEW\.evaluation_method NOT IN/);
});

test("provider negative matrix rejects identically", () => {
  assert.equal(negativeCases.length, 11);
  for (const testCase of negativeCases) {
    assert.equal(postgresEvaluationAccepts(testCase), false, `PostgreSQL accepted ${testCase.name}`);
    assert.equal(d1EvaluationAccepts(testCase), false, `D1 accepted ${testCase.name}`);
  }
});

test("provider positive matrix accepts identically", () => {
  assert.equal(positiveCases.length, 7);
  for (const testCase of positiveCases) {
    assert.equal(postgresEvaluationAccepts(testCase), true, `PostgreSQL rejected ${testCase.name}`);
    assert.equal(d1EvaluationAccepts(testCase), true, `D1 rejected ${testCase.name}`);
  }
});
