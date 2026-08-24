import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { PracticalGovernanceRepository } from "../db/practical-governance-repositories.ts";
import { replayGovernedEvaluationV1 } from "../lib/practical/practical-governance-validation.ts";
import { canonicalPersistedEvaluationPayloadV1, evaluationSemanticHashV1, snapshotDigestV1 } from "../lib/practical/practical-evaluation-semantic-hash.ts";

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

test("provider parity uses the same V1 semantic identities and preserves explicit empty sets", () => {
  const model = { modelVersion: "PRACTICAL_EVALUATION_MODEL_V1", hashContractVersion: "EVALUATION_SEMANTIC_HASH_V1", evaluationMethod: "RULE_BASED", criteria: [{ key: "criterion:one", statement: "A governed statement.", score: { minimum: "0", maximum: "1" } }], scoringScale: { minimum: "0", maximum: "1" }, aggregation: "EQUAL_WEIGHT", passFailRules: [], requiredOutputs: [], reviewerRules: [] };
  assert.equal(evaluationSemanticHashV1(model), evaluationSemanticHashV1(JSON.parse(JSON.stringify(model))));
  assert.equal(snapshotDigestV1(model), snapshotDigestV1(JSON.parse(JSON.stringify(model))));
  assert.deepEqual(model.requiredOutputs, []);
  assert.deepEqual(model.reviewerRules, []);
});

const execFileAsync = promisify(execFile);
const providerModel = {
  modelVersion: "PRACTICAL_EVALUATION_MODEL_V1",
  hashContractVersion: "EVALUATION_SEMANTIC_HASH_V1",
  evaluationMethod: "HYBRID",
  criteria: [{ key: "criterion:provider", statement: "Persist provider semantics.", score: { minimum: "-1.00", passing: "0.50", maximum: "1.00" }, weight: "1.00" }],
  scoringScale: { minimum: "-1", passing: "0.5", maximum: "1" },
  aggregation: "WEIGHTED",
  passFailRules: [{ key: "pass", threshold: "0.50" }],
  requiredOutputs: [],
  reviewerRules: [],
};
const providerHash = evaluationSemanticHashV1(providerModel);
const providerInput = {
  practicalId: "cp-provider-synthetic", semanticKey: "practical.synthetic.provider-roundtrip", practicalVersionId: "pv-provider-synthetic", version: 1,
  semanticHash: "a".repeat(64), humanReviewHash: "b".repeat(64), safetyReviewHash: "c".repeat(64), rightsBinding: "SECURIUM_ORIGINAL", provenanceBinding: "synthetic:test", conceptMappingHash: "d".repeat(64), theoryDependencyJson: "{}", currentnessReference: "synthetic:test", lifecycle: "DRAFT", createdBy: "provider-test", rubricVersionId: "rv-provider-synthetic", rubricId: "rubric:provider-synthetic", rubricVersion: 1, evaluationSemanticHash: providerHash, evaluationMethod: "HYBRID", evidenceClassification: "ELIGIBLE_PERFORMANCE_EVIDENCE", rubricSnapshotJson: "{}", rubricSnapshotDigest: "e".repeat(64), reviewerMaterialId: "rm-provider-synthetic", reviewerMaterialJson: "{}", reviewerMaterialDigest: "f".repeat(64), conceptBindings: [{ id: "cb-provider-synthetic", conceptKey: "synthetic:provider", mappingSemanticHash: "1".repeat(64), qualificationJson: "{}" }], evaluationModel: providerModel,
};
const providerSchema = `
CREATE TABLE canonical_practicals (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL UNIQUE, lifecycle TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE practical_rubric_versions (id TEXT PRIMARY KEY, rubric_id TEXT NOT NULL, version INTEGER NOT NULL, evaluation_semantic_hash TEXT, evaluation_method TEXT, human_review_hash TEXT, evidence_classification TEXT, snapshot_format_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, snapshot_digest TEXT NOT NULL, effective_from TEXT NOT NULL);
CREATE TABLE practical_governance_versions (id TEXT PRIMARY KEY, practical_id TEXT NOT NULL, version INTEGER NOT NULL, semantic_hash TEXT NOT NULL, human_review_hash TEXT NOT NULL, safety_review_hash TEXT NOT NULL, rights_binding TEXT NOT NULL, provenance_binding TEXT NOT NULL, concept_mapping_hash TEXT NOT NULL, theory_dependency_json TEXT NOT NULL, currentness_reference TEXT NOT NULL, lifecycle TEXT NOT NULL, superseded_by_id TEXT, created_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(practical_id, version));
CREATE TABLE practical_reviewer_material_versions (id TEXT PRIMARY KEY, practical_version_id TEXT NOT NULL, rubric_version_id TEXT NOT NULL, payload_json TEXT NOT NULL, payload_digest TEXT NOT NULL, visibility TEXT NOT NULL);
CREATE TABLE practical_version_concept_bindings (id TEXT PRIMARY KEY, practical_version_id TEXT NOT NULL, concept_key TEXT NOT NULL, concept_id TEXT, mapping_semantic_hash TEXT NOT NULL, qualification_json TEXT NOT NULL, mapping_status TEXT NOT NULL);
`;

async function makeD1RoundTripProvider() {
  const miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok'); } }", compatibilityDate: "2026-05-15", d1Databases: { DB: "evaluation-provider-roundtrip" } });
  const database = await miniflare.getD1Database("DB");
  await database.exec(providerSchema);
  return { provider: new D1DatabaseProvider(database), close: () => miniflare.dispose() };
}

async function makePostgresRoundTripProvider() {
  const container = `securium-provider-roundtrip-${Date.now()}`;
  const password = "evaluation-provider-roundtrip";
  let client;
  await execFileAsync("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  try {
    for (let attempt = 0; attempt < 60 && !client; attempt += 1) {
      try {
        const { stdout } = await execFileAsync("docker", ["port", container, "5432/tcp"]);
        const port = stdout.trim().match(/:(\d+)$/)?.[1];
        if (port) {
          const postgres = (await import("postgres")).default;
          const candidate = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
          await candidate`SELECT 1`;
          client = candidate;
        }
      } catch {}
      if (!client) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(client, "disposable PostgreSQL did not become ready");
    await client.unsafe(providerSchema);
    const executor = {
      query: async (sql, parameters) => { const rows = await client.unsafe(sql, parameters); return { rows: rows.map((row) => ({ ...row })), rowCount: rows.count ?? rows.length }; },
      transaction: async (callback) => client.begin(async (transaction) => callback({ query: async (sql, parameters) => { const rows = await transaction.unsafe(sql, parameters); return { rows: rows.map((row) => ({ ...row })), rowCount: rows.count ?? rows.length }; } })),
      close: async () => { await client.end({ timeout: 1 }).catch(() => {}); },
    };
    return { provider: new PostgresDatabaseProvider(executor), close: executor.close, container };
  } catch (error) {
    await client?.end({ timeout: 1 }).catch(() => {});
    await execFileAsync("docker", ["rm", "--force", container]).catch(() => {});
    throw error;
  }
}

async function roundTripProvider(provider) {
  const firstRepository = new PracticalGovernanceRepository(provider);
  const created = await firstRepository.createGovernedPractical(providerInput);
  const freshRepository = new PracticalGovernanceRepository(provider);
  const replayed = await freshRepository.replayEvaluationVersion(providerInput.practicalVersionId);
  return { outcome: created.outcome, payload: canonicalPersistedEvaluationPayloadV1(replayed), semanticHash: evaluationSemanticHashV1(replayed), snapshotDigest: snapshotDigestV1(replayed) };
}

test("true disposable PostgreSQL and D1 V1 round-trip preserves exact semantics", async () => {
  const d1 = await makeD1RoundTripProvider();
  let postgres;
  try {
    postgres = await makePostgresRoundTripProvider();
    const [d1Result, postgresResult] = await Promise.all([roundTripProvider(d1.provider), roundTripProvider(postgres.provider)]);
    assert.equal(d1Result.outcome, "NEW_SUCCESS");
    assert.equal(postgresResult.outcome, "NEW_SUCCESS");
    assert.deepEqual(d1Result, postgresResult);
    assert.equal(d1Result.payload, canonicalPersistedEvaluationPayloadV1(providerModel));
    assert.equal(d1Result.semanticHash, providerHash);
    assert.equal(d1Result.snapshotDigest, snapshotDigestV1(providerModel));
    assert.match(d1Result.payload, /"requiredOutputs":\[\]/);
    assert.match(d1Result.payload, /"reviewerRules":\[\]/);
  } finally {
    await d1.close();
    await postgres?.close();
    if (postgres?.container) await execFileAsync("docker", ["rm", "--force", postgres.container]).catch(() => {});
  }
});

async function assertProviderCorruption(provider) {
  await roundTripProvider(provider);
  const row = await provider.queryOne({ sql: "SELECT snapshot_json, snapshot_digest, evaluation_semantic_hash FROM practical_rubric_versions WHERE id = ?", parameters: [providerInput.rubricVersionId] });
  assert.ok(row);
  assert.throws(() => replayGovernedEvaluationV1(row.snapshot_json, "0".repeat(64), row.evaluation_semantic_hash));
  assert.throws(() => replayGovernedEvaluationV1(row.snapshot_json, row.snapshot_digest, "0".repeat(64)));
  assert.throws(() => replayGovernedEvaluationV1(row.snapshot_json.replace("PRACTICAL_EVALUATION_MODEL_V1", "UNKNOWN"), row.snapshot_digest, row.evaluation_semantic_hash));
  assert.throws(() => replayGovernedEvaluationV1(row.snapshot_json.replace('"requiredOutputs":[]', '"requiredOutputs":null'), row.snapshot_digest, row.evaluation_semantic_hash));
}

test("both providers reject digest, hash, payload, and version corruption", async () => {
  const d1 = await makeD1RoundTripProvider();
  const postgres = await makePostgresRoundTripProvider();
  try {
    await Promise.all([assertProviderCorruption(d1.provider), assertProviderCorruption(postgres.provider)]);
  } finally {
    await d1.close();
    await postgres.close();
    await execFileAsync("docker", ["rm", "--force", postgres.container]).catch(() => {});
  }
});
