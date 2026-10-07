import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMiniflareD1Fixture } from "./helpers/miniflare-d1-fixture.mjs";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { PracticalGovernanceRepository } from "../db/practical-governance-repositories.ts";
import { PracticalRepository } from "../db/practical-repositories.ts";
import { PracticalAttemptService } from "../lib/services/practical-attempt-service.ts";
import { digestPracticalJson } from "../lib/practical/practical-attempt.ts";
import { registerGovernedPracticalVersion } from "../lib/practical/practical-registration.ts";
import { PRACTICAL_SERVER_AUTHORITY_REQUIRED } from "../lib/policy/practical-registration-authority.ts";
import { cleanupOwnedPostgresContainer, createOwnedPostgresContainer, getPublishedPostgresPort } from "../scripts/owned-postgres-container.mjs";
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
CREATE TABLE practical_definition_versions (id TEXT PRIMARY KEY, practical_id TEXT NOT NULL, version INTEGER NOT NULL, rubric_version_id TEXT NOT NULL, snapshot_format_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL, snapshot_digest TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, effective_from TEXT, withdrawn_at TEXT);
CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY, concept_key TEXT NOT NULL, status TEXT NOT NULL);
`;

async function makeD1RoundTripProvider() {
  const miniflare = createMiniflareD1Fixture({ databaseId: "evaluation-provider-roundtrip" });
  const database = await miniflare.getD1Database("DB");
  await database.exec(providerSchema);
  return { provider: new D1DatabaseProvider(database), close: () => miniflare.dispose() };
}

async function makePostgresRoundTripProvider() {
  const ownerToken = randomUUID();
  const password = "evaluation-provider-roundtrip";
  let client;
  const container = await createOwnedPostgresContainer({ name: `securium-provider-roundtrip-${ownerToken}`, ownerToken, password });
  try {
    const port = await getPublishedPostgresPort(container);
    const postgres = (await import("postgres")).default;
    client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false, connect_timeout: 1 });
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      try {
        await client`SELECT 1`;
        ready = true;
      } catch {}
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "disposable PostgreSQL did not become ready");
    await client.unsafe(providerSchema);
    const executor = {
      query: async (sql, parameters) => { const rows = await client.unsafe(sql, parameters); return { rows: rows.map((row) => ({ ...row })), rowCount: rows.count ?? rows.length }; },
      transaction: async (callback) => client.begin(async (transaction) => callback({ query: async (sql, parameters) => { const rows = await transaction.unsafe(sql, parameters); return { rows: rows.map((row) => ({ ...row })), rowCount: rows.count ?? rows.length }; } })),
      close: async () => { await client.end({ timeout: 1 }).catch(() => {}); },
    };
    return { provider: new PostgresDatabaseProvider(executor), close: async () => {
      try { await executor.close(); } finally { await cleanupOwnedPostgresContainer(container); }
    } };
  } catch (error) {
    await client?.end({ timeout: 1 }).catch(() => {});
    await cleanupOwnedPostgresContainer(container);
    throw error;
  }
}

async function roundTripProvider(provider) {
  await seedSyntheticReadFixture(provider);
  const freshRepository = new PracticalGovernanceRepository(provider);
  const replayed = await freshRepository.replayEvaluationVersion(providerInput.practicalVersionId);
  return { payload: canonicalPersistedEvaluationPayloadV1(replayed), semanticHash: evaluationSemanticHashV1(replayed), snapshotDigest: snapshotDigestV1(replayed) };
}

// Disposable synthetic rows exercise existing reads and replay. Fixture setup
// is not a server authorization adapter and is never used by application code.
async function seedSyntheticReadFixture(provider) {
  const p = providerInput;
  const definition = await digestPracticalJson({ responseSpec: [] });
  const statements = [
    { sql: "INSERT INTO canonical_practicals (id, semantic_key, lifecycle, created_by) VALUES (?, ?, ?, ?)", parameters: [p.practicalId, p.semanticKey, p.lifecycle, p.createdBy] },
    { sql: `INSERT INTO practical_rubric_versions
        (id, rubric_id, version, evaluation_semantic_hash, evaluation_method, human_review_hash, evidence_classification, snapshot_format_version, snapshot_json, snapshot_digest, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
      parameters: [p.rubricVersionId, p.rubricId, p.rubricVersion, providerHash, p.evaluationMethod, p.humanReviewHash, p.evidenceClassification, canonicalPersistedEvaluationPayloadV1(providerModel), snapshotDigestV1(providerModel)] },
    { sql: "INSERT INTO practical_definition_versions (id, practical_id, version, rubric_version_id, snapshot_format_version, snapshot_json, snapshot_digest) VALUES (?, ?, 1, ?, 1, ?, ?)", parameters: ["pv-definition-synthetic", p.practicalId, p.rubricVersionId, definition.canonicalJson, definition.digest] },
    { sql: "INSERT INTO practical_reviewer_material_versions (id, practical_version_id, rubric_version_id, payload_json, payload_digest, visibility) VALUES (?, ?, ?, ?, ?, 'REVIEWER_ONLY')", parameters: [p.reviewerMaterialId, p.practicalVersionId, p.rubricVersionId, p.reviewerMaterialJson, p.reviewerMaterialDigest] },
    { sql: "INSERT INTO practical_version_concept_bindings (id, practical_version_id, concept_key, concept_id, mapping_semantic_hash, qualification_json, mapping_status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", parameters: [p.conceptBindings[0].id, p.practicalVersionId, p.conceptBindings[0].conceptKey, null, p.conceptBindings[0].mappingSemanticHash, p.conceptBindings[0].qualificationJson] },
  ];
  // Separate existing rows make promotion and supersession predicates match.
  for (const [id, version, lifecycle] of [
    [p.practicalVersionId, 1, "DRAFT"],
    ["pv-synthetic-approved", 2, "HUMAN_APPROVED"],
    ["pv-synthetic-canonical", 3, "CANONICAL_UNPUBLISHED"],
  ]) {
    statements.splice(statements.length - 2, 0, {
      sql: `INSERT INTO practical_governance_versions
        (id, practical_id, version, semantic_hash, human_review_hash, safety_review_hash, rights_binding, provenance_binding, concept_mapping_hash, theory_dependency_json, currentness_reference, lifecycle, superseded_by_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: [id, p.practicalId, version, p.semanticHash, p.humanReviewHash, p.safetyReviewHash, p.rightsBinding, p.provenanceBinding, p.conceptMappingHash, p.theoryDependencyJson, p.currentnessReference, lifecycle, null, p.createdBy],
    });
  }
  await provider.transaction(statements);
}

const canonicalTables = ["canonical_practicals", "practical_governance_versions", "practical_rubric_versions", "practical_reviewer_material_versions", "practical_version_concept_bindings", "practical_definition_versions"];

async function canonicalSnapshot(provider) {
  return Promise.all(canonicalTables.map(async (table) => (await provider.query({ sql: `SELECT * FROM ${table} ORDER BY id` })).rows));
}

async function assertProviderDenials(provider, existing = false) {
  const mutations = [];
  const guarded = new Proxy(provider, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return (...args) => {
        if (["execute", "transaction", "transactional"].includes(key)) mutations.push(key);
        return value.apply(target, args);
      };
    },
  });
  const repository = new PracticalGovernanceRepository(guarded);
  const legacyRepository = new PracticalRepository(guarded);
  const legacyService = new PracticalAttemptService(legacyRepository);
  const legacyInput = { id: "pv-definition-synthetic", practicalId: providerInput.practicalId, rubricId: providerInput.rubricId, rubricVersionId: providerInput.rubricVersionId, version: 1, snapshotFormatVersion: 1, snapshotJson: "{}", snapshotDigest: "a".repeat(64), effectiveFrom: null, snapshot: { responseSpec: [] } };
  const intent = {
    courseId: "course-synthetic", memberIdentity: "synthetic-practical", memberType: "PRACTICAL",
    namespace: "synthetic", intentKey: "provider-roundtrip", semanticKey: providerInput.semanticKey,
    governance: { ...providerInput, lifecycle: "CANONICAL_UNPUBLISHED" },
    conceptCandidates: [{ reference: { conceptKey: "synthetic:provider" }, mappingSource: "synthetic:test", mappingStatus: "APPROVED" }],
    mutationLabel: "CANONICAL_CONTENT_REGISTRATION", replay: { accepted: true }, capability: { authorized: true },
  };
  const operations = [
    () => legacyRepository.insertRubricVersion({ ...legacyInput, id: providerInput.rubricVersionId }),
    () => legacyRepository.insertDefinitionVersion(legacyInput),
    () => legacyService.storeRubricVersion({ ...legacyInput, id: providerInput.rubricVersionId }),
    () => registerGovernedPracticalVersion(guarded, intent),
    () => registerGovernedPracticalVersion(guarded, JSON.parse(JSON.stringify(intent))),
    () => repository.createGovernedPractical(providerInput),
    () => repository.createGovernedPractical(JSON.parse(JSON.stringify(providerInput))),
    () => repository.createGovernedPractical({ ...providerInput, version: 4, practicalVersionId: "pv-synthetic-new" }),
    () => repository.createGovernedPractical({ ...providerInput, lifecycle: "CANONICAL_UNPUBLISHED", conceptBindings: providerInput.conceptBindings.map((binding) => ({ ...binding, mappingStatus: "APPROVED" })), mutationLabel: "APPROVED", capability: { authorized: true } }),
    () => repository.transitionLifecycle(providerInput.practicalVersionId, "DRAFT", "HUMAN_APPROVED"),
    () => repository.transitionLifecycle("pv-synthetic-approved", "HUMAN_APPROVED", "CANONICAL_UNPUBLISHED"),
    () => repository.transitionLifecycle("pv-synthetic-canonical", "CANONICAL_UNPUBLISHED", "SUPERSEDED"),
    () => repository.supersedeVersion("pv-synthetic-canonical", providerInput.practicalVersionId),
  ];
  if (existing) {
    const evaluationModel = await repository.replayEvaluationVersion(providerInput.practicalVersionId);
    operations.push(() => repository.createGovernedPractical({ ...providerInput, evaluationModel }));
    operations.push(() => legacyService.storeDefinitionVersion(legacyInput));
  }
  const before = await canonicalSnapshot(provider);
  if (!existing) assert.deepEqual(before.map((rows) => rows.length), [0, 0, 0, 0, 0, 0]);
  for (const operation of operations) {
    await assert.rejects(operation, { name: "AppError", code: PRACTICAL_SERVER_AUTHORITY_REQUIRED, status: 503 });
    assert.deepEqual(mutations, [], "denials must call no provider mutation method");
    assert.deepEqual(await canonicalSnapshot(provider), before, "all six canonical tables must remain unchanged");
  }
  if (existing) {
    const learner = await repository.getLearnerVisibleVersion(providerInput.practicalVersionId);
    assert.equal(learner.lifecycle, "DRAFT");
    assert.equal("payload_json" in learner, false);
    const reviewer = await repository.getReviewerMaterial(providerInput.practicalVersionId, { actorRole: "CONTENT_REVIEWER" });
    assert.equal(reviewer.visibility, "REVIEWER_ONLY");
    const definition = await legacyRepository.getDefinitionVersion(legacyInput.id);
    assert.deepEqual(JSON.parse(definition.snapshotJson), { responseSpec: [] });
    await assert.rejects(() => repository.getReviewerMaterial(providerInput.practicalVersionId, { actorRole: "LEARNER" }), /PRACTICAL_REVIEWER_MATERIAL_FORBIDDEN/);
    assert.deepEqual(mutations, []);
  }
}

test("true disposable PostgreSQL and D1 deny all write paths with zero mutations in empty and existing state", async () => {
  const d1 = await makeD1RoundTripProvider();
  let postgres;
  try {
    postgres = await makePostgresRoundTripProvider();
    for (const { provider } of [d1, postgres]) {
      await provider.execute({ sql: "INSERT INTO ontology_concepts (id, concept_key, status) VALUES (?, ?, ?)", parameters: ["oc-synthetic", "synthetic:provider", "ACTIVE"] });
      await assertProviderDenials(provider);
      await seedSyntheticReadFixture(provider);
      await assertProviderDenials(provider, true);
    }
  } finally {
    await d1.close();
    await postgres?.close();
  }
});

test("true disposable PostgreSQL and D1 read-only V1 replay preserves exact semantics", async () => {
  const d1 = await makeD1RoundTripProvider();
  let postgres;
  try {
    postgres = await makePostgresRoundTripProvider();
    const [d1Result, postgresResult] = await Promise.all([roundTripProvider(d1.provider), roundTripProvider(postgres.provider)]);
    assert.deepEqual(d1Result, postgresResult);
    assert.equal(d1Result.payload, canonicalPersistedEvaluationPayloadV1(providerModel));
    assert.equal(d1Result.semanticHash, providerHash);
    assert.equal(d1Result.snapshotDigest, snapshotDigestV1(providerModel));
    assert.match(d1Result.payload, /"requiredOutputs":\[\]/);
    assert.match(d1Result.payload, /"reviewerRules":\[\]/);
  } finally {
    await d1.close();
    await postgres?.close();
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
  let postgres;
  try {
    postgres = await makePostgresRoundTripProvider();
    await Promise.all([assertProviderCorruption(d1.provider), assertProviderCorruption(postgres.provider)]);
  } finally {
    await d1.close();
    await postgres?.close();
  }
});
