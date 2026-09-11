import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";
import { stableJson } from "../lib/services/learning-event-contracts.ts";

let miniflare;
let database;
let resolver;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "course-lesson-revision-evidence" },
  });
  database = await miniflare.getD1Database("DB");
  const snapshotA = snapshot("content-a", "v1", "A");
  const snapshotB = snapshot("content-b", "v1", "B");
  await exec(`
    CREATE TABLE user_course_lesson_progress (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, course_lesson_id TEXT NOT NULL,
      content_id TEXT, content_version TEXT, status TEXT NOT NULL,
      last_studied_at TEXT
    );
    CREATE TABLE content_revisions (
      id TEXT PRIMARY KEY, content_type TEXT NOT NULL, content_id TEXT NOT NULL,
      version TEXT NOT NULL, revision_status TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, semantic_hash TEXT
    );
    CREATE TABLE ontology_concepts (id TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE ontology_edges (
      edge_key TEXT PRIMARY KEY, from_type TEXT NOT NULL, from_id TEXT NOT NULL,
      to_type TEXT NOT NULL, to_id TEXT NOT NULL, status TEXT NOT NULL,
      relation TEXT NOT NULL
    );
    CREATE TABLE learning_event_revisions (
      id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_event_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, action TEXT NOT NULL, semantic_hash TEXT NOT NULL,
      correction_payload_json TEXT NOT NULL
    );
    INSERT INTO ontology_concepts VALUES ('concept-a', 'ACTIVE'), ('concept-b', 'ACTIVE');
    INSERT INTO ontology_edges VALUES
      ('edge-a', 'COURSE_LESSON', 'lesson-a', 'CONCEPT', 'concept-a', 'ACTIVE', 'COVERS'),
      ('edge-b', 'COURSE_LESSON', 'lesson-b', 'CONCEPT', 'concept-b', 'ACTIVE', 'COVERS');
    INSERT INTO content_revisions VALUES
      ('revision-a', 'LEARNING_UNIT', 'content-a', 'v1', 'published', '${escape(snapshotA)}', '${hash(snapshotA)}'),
      ('revision-b', 'LEARNING_UNIT', 'content-b', 'v1', 'published', '${escape(snapshotB)}', '${hash(snapshotB)}');
    INSERT INTO user_course_lesson_progress VALUES
      ('progress-a', 'user', 'lesson-a', 'content-a', 'v1', 'COMPLETED', '2026-09-11T00:00:00Z'),
      ('progress-b', 'user', 'lesson-b', 'content-b', 'v1', 'COMPLETED', '2026-09-11T00:00:00Z'),
      ('progress-missing', 'user', 'lesson-a', 'content-a', 'v2', 'COMPLETED', '2026-09-11T00:00:00Z'),
      ('progress-legacy', 'user', 'lesson-a', NULL, NULL, 'COMPLETED', '2026-09-11T00:00:00Z');
  `);
  resolver = new DatabaseEvidenceSourceResolver(new D1DatabaseProvider(database));
});

after(async () => miniflare?.dispose());

test("CourseLesson Evidence binds content identity and immutable snapshot revision", async () => {
  const sourceA = await resolve("progress-a");
  const sourceB = await resolve("progress-b");
  assert.equal(sourceA?.validity, "ELIGIBLE");
  assert.equal(sourceB?.validity, "ELIGIBLE");
  assert.equal(sourceA?.contentVersionIdentity, "v1");
  assert.equal(sourceB?.contentVersionIdentity, "v1");
  assert.equal(sourceA?.contentRevisionBinding?.contentId, "content-a");
  assert.equal(sourceB?.contentRevisionBinding?.contentId, "content-b");
  assert.notEqual(sourceA?.contentRevisionBinding?.revisionId, sourceB?.contentRevisionBinding?.revisionId);
  const [candidateA] = await buildEvidenceCandidates(sourceA);
  const [candidateB] = await buildEvidenceCandidates(sourceB);
  assert.notEqual(candidateA.id, candidateB.id);
  assert.notEqual(candidateA.semanticHash, candidateB.semanticHash);
});

test("Missing snapshot and legacy identity remain unresolved and ineligible", async () => {
  const missing = await resolve("progress-missing");
  assert.equal(missing?.validity, "LEGACY_INELIGIBLE");
  assert.equal(missing?.resolutionStatus, "UNRESOLVED");
  assert.equal(missing?.contentVersionIdentity, "UNKNOWN");
  assert.equal(missing?.contentRevisionBinding, undefined);

  const legacy = await resolve("progress-legacy");
  assert.equal(legacy?.validity, "LEGACY_INELIGIBLE");
  assert.equal(legacy?.contentVersionIdentity, "LEGACY_UNKNOWN");
  assert.equal(legacy?.contentRevisionBinding, undefined);
});

test("Snapshot hash corruption fails closed instead of attaching current content", async () => {
  await exec("UPDATE content_revisions SET semantic_hash = 'f' || substr(semantic_hash, 2) WHERE id = 'revision-a'");
  const corrupted = await resolve("progress-a");
  assert.equal(corrupted?.validity, "LEGACY_INELIGIBLE");
  assert.equal(corrupted?.resolutionStatus, "UNRESOLVED");
});

function resolve(sourceEventId) {
  return resolver.resolveEvent({
    sourceType: "COURSE_LESSON_PROGRESS",
    sourceEventId,
    sourceRevisionIdentity: "caller-supplied-value-must-not-be-authority",
  });
}

function snapshot(contentId, version, body) {
  return {
    kind: "SHARED_CONTENT_REVISION_V1",
    contentId,
    version,
    payload: { title: contentId, summary: "", body, bodyFormat: "MARKDOWN" },
  };
}

function hash(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function escape(value) {
  return stableJson(value).replaceAll("'", "''");
}

async function exec(sql) {
  return database.prepare(sql).run();
}
