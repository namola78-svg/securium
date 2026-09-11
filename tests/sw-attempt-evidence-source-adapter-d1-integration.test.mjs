import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { LearningEventGovernanceRepository } from "../db/learning-event-governance-repository.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { LearningEventGovernanceService } from "../lib/services/learning-event-governance.ts";
import { sha256, stableJson } from "../lib/services/learning-event-contracts.ts";
import {
  getSwFoundationQuestionBindingSeed,
} from "../lib/services/securium-sw-security-weakness-foundation-binding.ts";
import {
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  buildSwSecurityWeaknessRuntimeProjection,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";
import foundation from "../content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json" with { type: "json" };

const userId = "sw-d1-evidence-user";
const actorId = "sw-d1-evidence-actor";
const courseId = SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId;
const attemptId = "sw-d1-attempt-1";
const secondAttemptId = "sw-d1-attempt-2";
const revisionId = "sw-d1-revision-1";
const secondRevisionId = "sw-d1-revision-2";

let miniflare;
let database;
let provider;
let resolver;
let governance;
let seed;
let questionId;
let mappingAHash;
let mappingBHash;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "sw-evidence-adapter-d1" },
  });
  database = await miniflare.getD1Database("DB");
  await applyMigrations();

  const runtimeCourse = {
    id: courseId,
    code: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code,
    slug: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug,
    name: foundation.course.name,
    bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
    active: true,
    published: true,
    isSample: false,
    deletedAt: null,
  };
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  questionId = projection.questions[0].id;
  seed = getSwFoundationQuestionBindingSeed(runtimeCourse, questionId);
  mappingAHash = await mappingHash("edge-sw-d1-a", "concept-sw-d1-a");
  mappingBHash = await mappingHash("edge-sw-d1-b", "concept-sw-d1-b");

  await database.batch([
    database.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?), (?, ?, ?)")
      .bind(userId, "sw-d1-user@example.invalid", "SW D1 User", actorId, "sw-d1-actor@example.invalid", "SW D1 Actor"),
    database.prepare("INSERT INTO course_groups (id, code, name, description) VALUES (?, ?, ?, ?)")
      .bind("sw-d1-group", "SW-D1", "SW D1", "SW D1"),
    database.prepare(`INSERT INTO courses
      (id, course_group_id, code, slug, name, short_name, description, active, published, is_sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 0)`)
      .bind(courseId, "sw-d1-group", runtimeCourse.code, runtimeCourse.slug, runtimeCourse.name, runtimeCourse.code, runtimeCourse.name),
    database.prepare(`INSERT INTO foundation_question_bindings
      (id, course_id, foundation_binding_key, foundation_version, foundation_question_id, semantic_hash, lifecycle_state)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`)
      .bind(seed.id, seed.courseId, seed.foundationBindingKey, seed.foundationVersion, seed.foundationQuestionId, seed.semanticHash),
    database.prepare(`INSERT INTO ontology_concepts
      (id, concept_key, namespace, label, normalized_label, category, description, status, metadata_json)
      VALUES (?, ?, 'securium', ?, ?, 'test', '', 'ACTIVE', '{}'),
             (?, ?, 'securium', ?, ?, 'test', '', 'ACTIVE', '{}')`)
      .bind("concept-sw-d1-a", "sw.d1.a", "SW D1 A", "sw d1 a", "concept-sw-d1-b", "sw.d1.b", "SW D1 B", "sw d1 b"),
    database.prepare(`INSERT INTO ontology_edges
      (id, edge_key, course_id, from_type, from_id, to_type, to_id, relation, status)
      VALUES (?, ?, ?, 'QUESTION', ?, 'CONCEPT', ?, 'TESTS', 'ACTIVE')`)
      .bind("edge-id-sw-d1-a", "edge-sw-d1-a", courseId, questionId, "concept-sw-d1-a"),
    database.prepare(`INSERT INTO question_attempts
      (id, idempotency_key, user_id, question_id, foundation_question_binding_id,
       question_version_id, concept_mapping_set_hash, course_id, mode, selected_answer,
       is_correct, score, response_time, attempted_at)
      VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, 'LEARNING', 'VULNERABLE', 1, 87, 1200, ?),
             (?, ?, ?, NULL, ?, NULL, NULL, ?, 'LEARNING', 'SECURE', 0, 20, 900, ?)`)
      .bind(attemptId, "sw-d1-key-1", userId, seed.id, courseId, "2026-09-11T00:00:00.000Z", secondAttemptId, "sw-d1-key-2", userId, seed.id, courseId, "2026-09-11T00:01:00.000Z"),
  ]);

  provider = new D1DatabaseProvider(database);
  resolver = new DatabaseEvidenceSourceResolver(provider);
  governance = new LearningEventGovernanceService(new LearningEventGovernanceRepository(provider));
});

after(async () => miniflare?.dispose());

test("full D1 schema reads a governed SW correction for its exact attempt", async () => {
  const first = await governance.appendRevision({
    revisionId,
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    ownerUserId: userId,
    actorUserId: actorId,
    action: "CORRECT_CONCEPT_MAPPING",
    reasonCode: "SW_MAPPING_APPROVED_FOR_EVENT",
    payload: { kind: "CONCEPT_MAPPING", conceptMappingSetHash: mappingAHash },
    expectedPreviousRevisionId: null,
  });
  assert.equal(first.outcome, "NEW_SUCCESS");

  const source = await resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    sourceRevisionIdentity: "caller-forged",
    expectedUserId: userId,
  });
  assert.equal(source?.validity, "ELIGIBLE");
  assert.equal(source?.sourceRevisionIdentity, first.revision.semanticHash);
  assert.equal(source?.sourceSemanticHash, seed.semanticHash);
  assert.deepEqual(source?.conceptIds, ["concept-sw-d1-a"]);

  await database.prepare(`UPDATE ontology_edges
    SET edge_key = ?, to_id = ? WHERE edge_key = ?`).bind(
    "edge-sw-d1-b", "concept-sw-d1-b", "edge-sw-d1-a",
  ).run();
  try {
    await assert.rejects(
      resolver.resolveEvent({
        sourceType: "QUESTION_ATTEMPT",
        sourceEventId: attemptId,
        sourceRevisionIdentity: "caller-forged",
      }),
      (error) => error?.code === "EVIDENCE_MAPPING_SET_MISMATCH",
    );

    const second = await governance.appendRevision({
      revisionId: secondRevisionId,
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: attemptId,
      ownerUserId: userId,
      actorUserId: actorId,
      action: "CORRECT_CONCEPT_MAPPING",
      reasonCode: "SW_MAPPING_CHANGE_APPROVED_FOR_EVENT",
      payload: { kind: "CONCEPT_MAPPING", conceptMappingSetHash: mappingBHash },
      expectedPreviousRevisionId: first.revision.id,
    });
    assert.equal(second.outcome, "NEW_SUCCESS");
    const corrected = await resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: attemptId,
      sourceRevisionIdentity: "caller-forged",
    });
    assert.equal(corrected?.validity, "ELIGIBLE");
    assert.equal(corrected?.sourceRevisionIdentity, second.revision.semanticHash);
    assert.deepEqual(corrected?.conceptIds, ["concept-sw-d1-b"]);
  } finally {
    await database.prepare(`UPDATE ontology_edges
      SET edge_key = ?, to_id = ? WHERE edge_key = ?`).bind(
      "edge-sw-d1-a", "concept-sw-d1-a", "edge-sw-d1-b",
    ).run();
  }
});

test("a mapping created after an attempt remains unresolved without an event correction", async () => {
  const source = await resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: secondAttemptId,
    sourceRevisionIdentity: "caller-forged",
  });
  assert.equal(source?.validity, "LEGACY_INELIGIBLE");
  assert.equal(source?.resolutionStatus, "UNRESOLVED");
  assert.equal(source?.unresolvedReason, "SW_MAPPING_REVISION_MISSING");

  await assert.rejects(
    resolver.resolveEvent({
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: secondAttemptId,
      sourceRevisionIdentity: "caller-forged",
      expectedUserId: "another-user",
    }),
    (error) => error?.code === "EVIDENCE_SOURCE_OWNER_MISMATCH",
  );
});

async function applyMigrations() {
  const names = (await readdir("drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const name of names) {
    const statements = (await readFile(`drizzle/${name}`, "utf8"))
      .split("--> statement-breakpoint")
      .map((statement) => statement
        .replace(/BEGIN TRANSACTION;\s*/gi, "")
        .replace(/\s*COMMIT;\s*/gi, "")
        .trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement));
    for (let index = 0; index < statements.length; index += 40) {
      await database.batch(statements.slice(index, index + 40));
    }
  }
}

async function mappingHash(edgeKey, conceptId) {
  return sha256(stableJson([{ edgeKey, conceptId }]));
}
