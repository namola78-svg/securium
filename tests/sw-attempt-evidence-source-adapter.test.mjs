import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";
import {
  getSwFoundationQuestionBindingSeed,
} from "../lib/services/securium-sw-security-weakness-foundation-binding.ts";
import {
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  buildSwSecurityWeaknessRuntimeProjection,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";
import { sha256, stableJson } from "../lib/services/learning-event-contracts.ts";
import foundation from "../content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json" with { type: "json" };

let miniflare;
let database;
let provider;
let writes;
let resolver;
let seed;
let questionId;
let mappingHash;

const userId = "sw-evidence-user";
const attemptId = "sw-attempt-1";

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "sw-evidence-adapter" },
  });
  database = await miniflare.getD1Database("DB");

  const runtimeCourse = runtimeCourseIdentity();
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  questionId = projection.questions[0].id;
  seed = getSwFoundationQuestionBindingSeed(runtimeCourse, questionId);
  mappingHash = await sha256(stableJson([{ edgeKey: "edge-sw-1", conceptId: "concept-sw-1" }]));

  await exec(`
    CREATE TABLE courses (
      id text PRIMARY KEY, code text NOT NULL, slug text NOT NULL, name text NOT NULL,
      active integer NOT NULL, published integer NOT NULL, is_sample integer NOT NULL,
      deleted_at text
    );
    CREATE TABLE foundation_question_bindings (
      id text PRIMARY KEY, course_id text NOT NULL, foundation_binding_key text NOT NULL,
      foundation_version text NOT NULL, foundation_question_id text NOT NULL,
      semantic_hash text NOT NULL, lifecycle_state text NOT NULL, retired_at text
    );
    CREATE TABLE question_attempts (
      id text PRIMARY KEY, user_id text NOT NULL, course_id text NOT NULL,
      question_id text, foundation_question_binding_id text,
      question_version_id text, concept_mapping_set_hash text,
      is_correct integer, score integer, attempted_at text NOT NULL,
      selected_answer text NOT NULL
    );
    CREATE TABLE question_versions (id text PRIMARY KEY, semantic_hash text);
    CREATE TABLE learning_event_revisions (
      source_type text NOT NULL, source_event_id text NOT NULL, sequence integer NOT NULL,
      action text NOT NULL, semantic_hash text NOT NULL, correction_payload_json text NOT NULL
    );
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, status text NOT NULL);
    CREATE TABLE ontology_edges (
      edge_key text PRIMARY KEY, from_type text NOT NULL, from_id text NOT NULL,
      to_type text NOT NULL, to_id text NOT NULL, relation text NOT NULL,
      status text NOT NULL
    );
    INSERT INTO courses VALUES (
      '${runtimeCourse.id}', '${runtimeCourse.code}', '${runtimeCourse.slug}',
      '${runtimeCourse.name.replaceAll("'", "''")}', 1, 1, 0, NULL
    );
    INSERT INTO foundation_question_bindings VALUES (
      '${seed.id}', '${seed.courseId}', '${seed.foundationBindingKey}',
      '${seed.foundationVersion}', '${seed.foundationQuestionId}',
      '${seed.semanticHash}', 'ACTIVE', NULL
    );
    INSERT INTO ontology_concepts VALUES ('concept-sw-1', 'ACTIVE');
    INSERT INTO ontology_edges VALUES (
      'edge-sw-1', 'QUESTION', '${questionId}', 'CONCEPT', 'concept-sw-1', 'TESTS', 'ACTIVE'
    );
    INSERT INTO question_attempts VALUES (
      '${attemptId}', '${userId}', '${runtimeCourse.id}', NULL, '${seed.id}',
      NULL, NULL, 1, 87, '2026-09-11T00:00:00.000Z', 'VULNERABLE'
    );
    INSERT INTO learning_event_revisions VALUES (
      'QUESTION_ATTEMPT', '${attemptId}', 1, 'CORRECT_CONCEPT_MAPPING',
      '${"a".repeat(64)}', '${JSON.stringify({ kind: "CONCEPT_MAPPING", conceptMappingSetHash: mappingHash }).replaceAll("'", "''")}'
    );
  `);

  const baseProvider = new D1DatabaseProvider(database);
  writes = { execute: 0, transaction: 0 };
  provider = {
    kind: baseProvider.kind,
    query: baseProvider.query.bind(baseProvider),
    queryOne: baseProvider.queryOne.bind(baseProvider),
    healthCheck: baseProvider.healthCheck.bind(baseProvider),
    async execute(statement) {
      writes.execute += 1;
      throw new Error(`unexpected write: ${statement.sql}`);
    },
    async transaction(statements) {
      writes.transaction += 1;
      throw new Error(`unexpected transaction: ${statements.length}`);
    },
  };
  resolver = new DatabaseEvidenceSourceResolver(provider);
});

after(async () => miniflare?.dispose());

test("canonical SW attempt resolves through the binding and mapping revision", async () => {
  const source = await resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    sourceRevisionIdentity: "caller-forged-revision",
    expectedUserId: userId,
  });

  assert.ok(source);
  assert.equal(source.validity, "ELIGIBLE");
  assert.equal(source.userId, userId);
  assert.equal(source.contentVersionIdentity, seed.id);
  assert.equal(source.sourceSemanticHash, seed.semanticHash);
  assert.equal(source.sourceRevisionIdentity, "a".repeat(64));
  assert.deepEqual(source.conceptIds, ["concept-sw-1"]);
  assert.deepEqual(source.resultSummary, { correct: true, score: 87 });
  assert.equal(source.mappingGuard.kind, "ONTOLOGY_EDGES");
  assert.equal(source.mappingGuard.parentIdentity, questionId);
  const candidates = await buildEvidenceCandidates(source);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].conceptId, "concept-sw-1");
});

test("wrong owner is rejected while the stored owner remains authoritative", async () => {
  await assert.rejects(
    resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: attemptId,
      sourceRevisionIdentity: "forged",
      expectedUserId: "other-user",
    }),
    (error) => error?.code === "EVIDENCE_SOURCE_OWNER_MISMATCH",
  );
});

test("missing attempt resolves to no source", async () => {
  assert.equal(
    await resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: "does-not-exist",
      sourceRevisionIdentity: "forged",
    }),
    null,
  );
});

test("missing mapping revision is explicit unresolved, not latest-mapping evidence", async () => {
  await exec(`DELETE FROM learning_event_revisions WHERE source_event_id = '${attemptId}'`);
  try {
    const source = await resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: attemptId,
      sourceRevisionIdentity: "forged",
    });
    assert.ok(source);
    assert.equal(source.validity, "LEGACY_INELIGIBLE");
    assert.equal(source.resolutionStatus, "UNRESOLVED");
    assert.equal(source.unresolvedReason, "SW_MAPPING_REVISION_MISSING");
    assert.deepEqual(source.conceptIds, ["SW_MAPPING_UNRESOLVED"]);
    assert.deepEqual(source.resultSummary, { correct: true, score: 87 });
    await assert.rejects(
      buildEvidenceCandidates(source),
      (error) => error?.code === "EVIDENCE_SOURCE_INELIGIBLE",
    );
  } finally {
    await restoreMappingRevision();
  }
});

test("incomplete evaluation is rejected", async () => {
  await exec(`INSERT INTO question_attempts VALUES (
    'sw-attempt-incomplete', '${userId}', '${seed.courseId}', NULL, '${seed.id}',
    NULL, NULL, NULL, NULL, '2026-09-11T00:00:00.000Z', 'UNKNOWN'
  )`);
  await assert.rejects(
    resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: "sw-attempt-incomplete",
      sourceRevisionIdentity: "forged",
    }),
    (error) => error?.code === "EVIDENCE_SW_EVALUATION_INCOMPLETE",
  );
});

test("mapping revision mismatch fails closed", async () => {
  await exec(`UPDATE learning_event_revisions
    SET correction_payload_json = '${JSON.stringify({ kind: "CONCEPT_MAPPING", conceptMappingSetHash: "f".repeat(64) })}'
    WHERE source_event_id = '${attemptId}'`);
  try {
    await assert.rejects(
      resolver.resolveEvent({
        sourceType: "QUESTION_ATTEMPT",
        sourceEventId: attemptId,
        sourceRevisionIdentity: "forged",
      }),
      (error) => error?.code === "EVIDENCE_MAPPING_SET_MISMATCH",
    );
  } finally {
    await restoreMappingRevision();
  }
});

test("repeated canonical snapshot lookup is stable and read-only", async () => {
  const first = await resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    sourceRevisionIdentity: "one",
  });
  const second = await resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    sourceRevisionIdentity: "two",
  });
  assert.deepEqual(second, first);
  assert.deepEqual(writes, { execute: 0, transaction: 0 });
});

function runtimeCourseIdentity() {
  return {
    id: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId,
    code: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code,
    slug: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug,
    name: foundation.course.name,
    bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
    active: true,
    published: true,
    isSample: false,
    deletedAt: null,
  };
}

async function restoreMappingRevision() {
  await exec(`DELETE FROM learning_event_revisions WHERE source_event_id = '${attemptId}'`);
  await exec(`INSERT INTO learning_event_revisions VALUES (
    'QUESTION_ATTEMPT', '${attemptId}', 1, 'CORRECT_CONCEPT_MAPPING',
    '${"a".repeat(64)}', '${JSON.stringify({ kind: "CONCEPT_MAPPING", conceptMappingSetHash: mappingHash }).replaceAll("'", "''")}'
  )`);
}

async function exec(sql) {
  return database.prepare(sql).run();
}
