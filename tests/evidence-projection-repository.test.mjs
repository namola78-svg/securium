import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { createRecomputeRequest, EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";
import { EvidenceRecomputeService } from "../lib/services/evidence-recompute.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
let miniflare;
let database;
let provider;
let repository;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "evidence-e1" },
  });
  database = await miniflare.getD1Database("DB");
  await exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_attempts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
    CREATE TABLE learning_event_revisions (id text PRIMARY KEY, source_type text NOT NULL, source_event_id text NOT NULL, sequence integer NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_concepts (id text PRIMARY KEY, question_version_id text NOT NULL, concept_id text NOT NULL, mapping_version integer NOT NULL, qualification_json text, provenance_json text, mapping_status text NOT NULL);
    CREATE TABLE practical_attempts (id text PRIMARY KEY, user_id text NOT NULL, state text NOT NULL, practical_id text NOT NULL);
    CREATE TABLE practical_evaluations (id text PRIMARY KEY, attempt_id text NOT NULL, sequence integer NOT NULL,
      practical_definition_version_id text NOT NULL, rubric_version_id text NOT NULL,
      method text NOT NULL, raw_score real, maximum_score real, qualification text NOT NULL,
      review_status text NOT NULL, evaluation_payload_digest text NOT NULL, evaluated_at text NOT NULL);
    CREATE TABLE ontology_edges (edge_key text PRIMARY KEY, from_type text NOT NULL, from_id text NOT NULL, to_type text NOT NULL, to_id text NOT NULL, relation text NOT NULL, status text NOT NULL);
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES ('concept-a', 'concept:a', 'ACTIVE'), ('concept-b', 'concept:b', 'ACTIVE');
    INSERT INTO question_attempts VALUES ('attempt-1', 'user-1'), ('attempt-rollback', 'user-1'), ('attempt-concurrent', 'user-1');
    INSERT INTO question_concepts VALUES
      ('mapping-a', 'question-version-1', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-b', 'question-version-1', 'concept-b', 1, NULL, NULL, 'APPROVED'),
      ('mapping-ca', 'question-version-concurrent', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-cb', 'question-version-concurrent', 'concept-b', 1, NULL, NULL, 'APPROVED');
    INSERT INTO practical_attempts VALUES ('practical-attempt-1', 'user-1', 'EVALUATED', 'practical-1');
    INSERT INTO practical_evaluations VALUES ('evaluation-1', 'practical-attempt-1', 1,
      'practical-version-1', 'rubric-version-1', 'HUMAN_REVIEWED', 80, 100,
      'QUALIFIED', 'COMPLETED', '${B}', '2026-08-21T00:00:00.000Z');
    INSERT INTO ontology_edges VALUES ('edge-practical-a', 'PRACTICAL', 'practical-1', 'CONCEPT', 'concept-a', 'ASSESSED_BY', 'ACTIVE');`);
  await applyMigration(await readFile("drizzle/0027_evidence_projection_foundation.sql", "utf8"));
  await exec("ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text");
  await exec(`CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
    ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
    WHERE lifecycle = 'ACTIVE'`);
  provider = new D1DatabaseProvider(database);
  repository = new EvidenceProjectionRepository(provider);
});

after(async () => miniflare?.dispose());

test("E1 F01/F07 complete multi-Concept set is NEW_SUCCESS then exact replay", async () => {
  const current = questionSource();
  const candidates = await buildEvidenceCandidates(current);
  assert.equal(await repository.reconcileEventProjectionSet(current, candidates), "NEW_SUCCESS");
  assert.equal(await repository.reconcileEventProjectionSet(current, candidates), "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 2);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_recompute_requests WHERE request_type = 'MASTERY_RECOMPUTE_REQUIRED'"), 2);
});

test("E1 F06 incompatible deterministic candidate fails closed", async () => {
  const conflictSource = questionSource({ resultSummary: { correct: false, score: 0 } });
  const candidates = await buildEvidenceCandidates(conflictSource);
  assert.equal(await repository.reconcileEventProjectionSet(conflictSource, candidates), "CONFLICT");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 2);
});

test("E1 F15 cross-user projection mutation fails closed with zero delta", async () => {
  const forged = questionSource({ userId: "user-2", sourceRevisionIdentity: "forged-owner" });
  assert.equal(await repository.reconcileEventProjectionSet(forged, await buildEvidenceCandidates(forged)), "CONFLICT");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE user_id = 'user-2'"), 0);
});

test("E1 F17 projection-version mismatch is rejected before mutation", async () => {
  const current = questionSource();
  const incompatible = (await buildEvidenceCandidates(current)).map((candidate) => ({
    ...candidate,
    projectionVersion: "EVIDENCE_V2",
  }));
  await assert.rejects(
    repository.reconcileEventProjectionSet(current, incompatible),
    hasCode("EVIDENCE_EVENT_SET_MISMATCH"),
  );
});

test("E1 F19 duplicate recompute request is deterministic exact replay", async () => {
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: "attempt-1",
    sourceRevisionIdentity: "duplicate-request",
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "DUPLICATE_TEST",
  });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");
  assert.equal(await repository.enqueue(request), "EXACT_REPLAY");
});

test("E1 F03/F05 transaction interruption rolls back the complete set and handoffs", async () => {
  const rollbackSource = questionSource({
    sourceEventId: "attempt-rollback",
    sourceLineageIdentity: "attempt-rollback",
    sourceRevisionIdentity: "rollback",
  });
  const failing = new EvidenceProjectionRepository({
    ...provider,
    kind: provider.kind,
    query: provider.query.bind(provider),
    queryOne: provider.queryOne.bind(provider),
    execute: provider.execute.bind(provider),
    healthCheck: provider.healthCheck.bind(provider),
    transaction: async (statements) => provider.transaction([
      ...statements.slice(0, Math.max(1, statements.length - 1)),
      { sql: "INSERT INTO missing_table VALUES (?)", parameters: ["fail"] },
      ...statements.slice(Math.max(1, statements.length - 1)),
    ]),
  });
  await assert.rejects(failing.reconcileEventProjectionSet(
    rollbackSource,
    await buildEvidenceCandidates(rollbackSource),
  ));
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-rollback'"), 0);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_recompute_requests WHERE source_event_id = 'attempt-rollback'"), 0);
});

test("E1 F08/F09 governed mapping removal invalidates stale Concept and creates exact new set", async () => {
  await exec("UPDATE question_concepts SET mapping_status = 'SUPERSEDED' WHERE id = 'mapping-b'");
  await exec("INSERT INTO learning_event_revisions VALUES ('revision-map', 'QUESTION_ATTEMPT', 'attempt-1', 1, 'revision-map-2')");
  const corrected = questionSource({
    sourceRevisionIdentity: "revision-map-2",
    conceptIds: ["concept-a"],
    conceptMappingSetHash: C,
    mappingTransition: "GOVERNED_CORRECTION",
    mappingGuard: questionGuard([mapping("mapping-a", "concept-a", "concept:a")]),
  });
  const outcome = await repository.reconcileEventProjectionSet(corrected, await buildEvidenceCandidates(corrected));
  assert.equal(outcome, "NEW_SUCCESS");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE concept_id = 'concept-b' AND lifecycle = 'INVALIDATED'"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_recompute_requests WHERE concept_id = 'concept-b' AND reason_code = 'EVIDENCE_MAPPING_REMOVED'"), 1);
});

test("E1 F11 Practical successor atomically supersedes predecessor by attempt lineage", async () => {
  const resolver = new DatabaseEvidenceSourceResolver(provider);
  const first = await resolver.resolveEvent({
    sourceType: "PRACTICAL_EVALUATION",
    sourceEventId: "evaluation-1",
    sourceRevisionIdentity: B,
  });
  assert.ok(first);
  assert.equal(await repository.reconcileEventProjectionSet(first, await buildEvidenceCandidates(first)), "NEW_SUCCESS");
  await exec(`INSERT INTO practical_evaluations VALUES ('evaluation-2', 'practical-attempt-1', 2,
    'practical-version-1', 'rubric-version-1', 'HUMAN_REVIEWED', 90, 100,
    'QUALIFIED', 'COMPLETED', '${C}', '2026-08-22T00:00:00.000Z')`);
  const successor = await resolver.resolveEvent({
    sourceType: "PRACTICAL_EVALUATION",
    sourceEventId: "evaluation-1",
    sourceRevisionIdentity: B,
  });
  assert.ok(successor);
  assert.equal(successor.sourceEventId, "evaluation-2");
  assert.equal(successor.sourceLineageIdentity, "practical-attempt-1");
  assert.equal(await repository.reconcileEventProjectionSet(successor, await buildEvidenceCandidates(successor)), "NEW_SUCCESS");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'practical-attempt-1' AND lifecycle = 'ACTIVE'"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_event_id = 'evaluation-1' AND lifecycle = 'SUPERSEDED'"), 1);
});

test("E1 F12/F13 Practical attempt invalidation routes to the evaluation lineage", async () => {
  await exec("UPDATE practical_attempts SET state = 'VOIDED' WHERE id = 'practical-attempt-1'");
  const service = new EvidenceRecomputeService(
    repository,
    new DatabaseEvidenceSourceResolver(provider),
  );
  const input = {
    sourceType: "PRACTICAL_ATTEMPT",
    sourceEventId: "practical-attempt-1",
    sourceRevisionIdentity: "void-revision",
  };
  assert.equal((await service.recomputeEvent(input)).outcome, "NEW_SUCCESS");
  assert.equal((await service.recomputeEvent(input)).outcome, "EXACT_REPLAY");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'practical-attempt-1' AND lifecycle = 'ACTIVE'"), 0);
});

test("E1 C01 concurrent identical event sets leave one active set", async () => {
  const concurrent = questionSource({
    sourceEventId: "attempt-concurrent",
    sourceLineageIdentity: "attempt-concurrent",
    sourceRevisionIdentity: "concurrent",
    contentVersionIdentity: "question-version-concurrent",
    mappingGuard: {
      kind: "QUESTION_VERSION",
      parentIdentity: "question-version-concurrent",
      members: [
        mapping("mapping-ca", "concept-a", "concept:a"),
        mapping("mapping-cb", "concept-b", "concept:b"),
      ],
    },
  });
  const candidates = await buildEvidenceCandidates(concurrent);
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(concurrent, candidates),
    repository.reconcileEventProjectionSet(concurrent, candidates),
  ]);
  assert.equal(outcomes.includes("NEW_SUCCESS"), true);
  assert.equal(outcomes.every((value) => value === "NEW_SUCCESS" || value === "EXACT_REPLAY"), true);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-concurrent' AND lifecycle = 'ACTIVE'"), 2);
});

test("E1 one-active index rejects a second incompatible active revision", async () => {
  await assert.rejects(exec(`INSERT INTO evidence_projections
    (id, user_id, source_type, source_event_id, source_lineage_identity,
     source_revision_identity, evidence_type, concept_id, concept_mapping_set_hash,
     projection_version, source_semantic_hash, semantic_hash, result_summary_json,
     quality, lifecycle, occurred_at)
    SELECT 'forced-conflict', user_id, source_type, source_event_id,
      source_lineage_identity, 'forced-revision', evidence_type, concept_id,
      concept_mapping_set_hash, projection_version, source_semantic_hash,
      '${A}', '{}', quality, 'ACTIVE', occurred_at
    FROM evidence_projections WHERE source_lineage_identity = 'attempt-concurrent'
      AND concept_id = 'concept-a' AND lifecycle = 'ACTIVE' LIMIT 1`));
});

test("E1 C02 stale correction racing current recompute cannot displace the latest revision", async () => {
  await seedQuestionScenario("correction");
  await exec("INSERT INTO learning_event_revisions VALUES ('revision-correction', 'QUESTION_ATTEMPT', 'attempt-correction', 1, 'revision-current')");
  const current = scenarioSource("correction", "revision-current");
  const stale = scenarioSource("correction", "revision-stale", {
    resultSummary: { correct: false, score: 0 },
  });
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(current, await buildEvidenceCandidates(current)),
    repository.reconcileEventProjectionSet(stale, await buildEvidenceCandidates(stale)),
  ]);
  assert.deepEqual([...outcomes].sort(), ["CONFLICT", "NEW_SUCCESS"]);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-correction' AND lifecycle = 'ACTIVE'"), 2);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-correction' AND source_revision_identity = 'revision-stale'"), 0);
});

test("E1 F14 source invalidated after resolution cannot create an active replacement", async () => {
  await seedQuestionScenario("invalidated");
  const stale = scenarioSource("invalidated", "before-invalidation");
  const candidates = await buildEvidenceCandidates(stale);
  await exec("INSERT INTO learning_event_revisions VALUES ('revision-invalidated', 'QUESTION_ATTEMPT', 'attempt-invalidated', 1, 'invalidation-revision')");
  assert.equal(await repository.reconcileEventProjectionSet(stale, candidates), "CONFLICT");
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-invalidated'"), 0);
});

test("E1 C03 incompatible concurrent semantics accept one set and fail the other closed", async () => {
  await seedQuestionScenario("incompatible");
  const left = scenarioSource("incompatible", "same-revision");
  const right = scenarioSource("incompatible", "same-revision", {
    resultSummary: { correct: false, score: 0 },
  });
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(left, await buildEvidenceCandidates(left)),
    repository.reconcileEventProjectionSet(right, await buildEvidenceCandidates(right)),
  ]);
  assert.equal(outcomes.filter((value) => value === "NEW_SUCCESS").length, 1);
  assert.equal(outcomes.filter((value) => value === "CONFLICT").length, 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-incompatible' AND lifecycle = 'ACTIVE'"), 2);
});

test("E1 C05 mapping removal racing stale replay converges to the corrected set", async () => {
  await seedQuestionScenario("mapping-race");
  const original = scenarioSource("mapping-race", "mapping-original");
  assert.equal(await repository.reconcileEventProjectionSet(original, await buildEvidenceCandidates(original)), "NEW_SUCCESS");
  await exec("UPDATE question_concepts SET mapping_status = 'SUPERSEDED' WHERE id = 'mapping-mapping-race-b'");
  await exec("INSERT INTO learning_event_revisions VALUES ('revision-mapping-race', 'QUESTION_ATTEMPT', 'attempt-mapping-race', 1, 'mapping-corrected')");
  const corrected = scenarioSource("mapping-race", "mapping-corrected", {
    conceptIds: ["concept-a"],
    conceptMappingSetHash: C,
    mappingTransition: "GOVERNED_CORRECTION",
    mappingGuard: questionGuardForScenario("mapping-race", ["a"]),
  });
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(original, await buildEvidenceCandidates(original)),
    repository.reconcileEventProjectionSet(corrected, await buildEvidenceCandidates(corrected)),
  ]);
  assert.equal(outcomes.includes("NEW_SUCCESS"), true);
  assert.equal(outcomes.includes("CONFLICT"), true);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-mapping-race' AND lifecycle = 'ACTIVE'"), 1);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'attempt-mapping-race' AND concept_id = 'concept-b' AND lifecycle = 'INVALIDATED'"), 1);
});

test("E1 C06 Practical invalidation racing projection leaves zero ACTIVE Evidence", async () => {
  await exec(`INSERT INTO practical_attempts VALUES ('practical-attempt-race', 'user-1', 'EVALUATED', 'practical-race');
    INSERT INTO practical_evaluations VALUES ('evaluation-race', 'practical-attempt-race', 1,
      'practical-version-1', 'rubric-version-1', 'HUMAN_REVIEWED', 80, 100,
      'QUALIFIED', 'COMPLETED', '${B}', '2026-08-21T00:00:00.000Z');
    INSERT INTO ontology_edges VALUES ('edge-practical-race', 'PRACTICAL', 'practical-race', 'CONCEPT', 'concept-a', 'ASSESSED_BY', 'ACTIVE')`);
  const resolver = new DatabaseEvidenceSourceResolver(provider);
  const current = await resolver.resolveEvent({
    sourceType: "PRACTICAL_EVALUATION",
    sourceEventId: "evaluation-race",
    sourceRevisionIdentity: B,
  });
  assert.ok(current);
  const candidates = await buildEvidenceCandidates(current);
  assert.equal(await repository.reconcileEventProjectionSet(current, candidates), "NEW_SUCCESS");
  await exec("UPDATE practical_attempts SET state = 'VOIDED' WHERE id = 'practical-attempt-race'");
  const service = new EvidenceRecomputeService(repository, resolver);
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(current, candidates),
    service.recomputeEvent({
      sourceType: "PRACTICAL_ATTEMPT",
      sourceEventId: "practical-attempt-race",
      sourceRevisionIdentity: "void-race",
    }).then((result) => result.outcome),
  ]);
  assert.equal(outcomes.includes("NEW_SUCCESS"), true);
  assert.equal(outcomes.every((value) => value === "NEW_SUCCESS" || value === "CONFLICT" || value === "EXACT_REPLAY"), true);
  assert.equal(await scalar("SELECT count(*) value FROM evidence_projections WHERE source_lineage_identity = 'practical-attempt-race' AND lifecycle = 'ACTIVE'"), 0);
});

function questionSource(overrides = {}) {
  const members = [
    mapping("mapping-a", "concept-a", "concept:a"),
    mapping("mapping-b", "concept-b", "concept:b"),
  ];
  return {
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: "attempt-1",
    sourceLineageIdentity: "attempt-1",
    sourceRevisionIdentity: "revision-1",
    userId: "user-1",
    contentVersionIdentity: "question-version-1",
    conceptMappingSetHash: A,
    conceptIds: ["concept-a", "concept-b"],
    occurredAt: "2026-08-21T00:00:00.000Z",
    validity: "ELIGIBLE",
    evidenceType: "PERFORMANCE_RESULT",
    quality: "DIRECT_PERFORMANCE",
    resultSummary: { correct: true, score: 100 },
    sourceSemanticHash: B,
    mappingTransition: "PRESERVE_EVENT_TIME",
    mappingGuard: questionGuard(members),
    ...overrides,
  };
}

function mapping(mappingId, conceptId, conceptIdentity) {
  return { mappingId, conceptId, conceptIdentity, mappingVersion: 1, qualificationJson: null, provenanceJson: null };
}

function questionGuard(members) {
  return { kind: "QUESTION_VERSION", parentIdentity: "question-version-1", members };
}

async function seedQuestionScenario(suffix) {
  await exec(`INSERT INTO question_attempts VALUES ('attempt-${suffix}', 'user-1');
    INSERT INTO question_concepts VALUES
      ('mapping-${suffix}-a', 'question-version-${suffix}', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-${suffix}-b', 'question-version-${suffix}', 'concept-b', 1, NULL, NULL, 'APPROVED')`);
}

function scenarioSource(suffix, revision, overrides = {}) {
  return questionSource({
    sourceEventId: `attempt-${suffix}`,
    sourceLineageIdentity: `attempt-${suffix}`,
    sourceRevisionIdentity: revision,
    contentVersionIdentity: `question-version-${suffix}`,
    mappingGuard: questionGuardForScenario(suffix, ["a", "b"]),
    ...overrides,
  });
}

function questionGuardForScenario(suffix, concepts) {
  return {
    kind: "QUESTION_VERSION",
    parentIdentity: `question-version-${suffix}`,
    members: concepts.map((concept) => mapping(
      `mapping-${suffix}-${concept}`,
      `concept-${concept}`,
      `concept:${concept}`,
    )),
  };
}

async function applyMigration(sql) {
  for (const statement of sql.split(/--> statement-breakpoint\s*/).map((item) => item.trim()).filter(Boolean)) {
    await exec(statement);
  }
}

async function exec(sql) {
  return database.prepare(sql).run();
}

async function scalar(sql) {
  const row = await database.prepare(sql).first();
  return Number(row.value);
}

function hasCode(code) {
  return (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
