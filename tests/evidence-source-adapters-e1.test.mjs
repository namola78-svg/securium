import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { computeConceptMappingSetHash, stableJson } from "../lib/services/learning-event-contracts.ts";

let miniflare;
let database;
let resolver;
let initialHash;
let correctedHash;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "evidence-e1-adapters" },
  });
  database = await miniflare.getD1Database("DB");
  initialHash = await mappingHash(["a", "b"]);
  correctedHash = await mappingHash(["a"]);
  await exec(`CREATE TABLE question_versions (id text PRIMARY KEY, semantic_hash text NOT NULL);
    CREATE TABLE question_attempts (id text PRIMARY KEY, user_id text NOT NULL,
      question_version_id text, concept_mapping_set_hash text, is_correct integer,
      score real, attempted_at text);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_concepts (id text PRIMARY KEY, question_version_id text NOT NULL,
      concept_id text NOT NULL, mapping_version integer NOT NULL, qualification_json text,
      provenance_json text, mapping_status text NOT NULL);
    CREATE TABLE learning_event_revisions (id text PRIMARY KEY, source_type text NOT NULL,
      source_event_id text NOT NULL, sequence integer NOT NULL, action text NOT NULL,
      semantic_hash text NOT NULL, correction_payload_json text NOT NULL);
    INSERT INTO question_versions VALUES ('version-1', '${"d".repeat(64)}');
    INSERT INTO question_attempts VALUES ('attempt-1', 'user-1', 'version-1', '${initialHash}', 1, 100, '2026-08-21T00:00:00.000Z');
    INSERT INTO ontology_concepts VALUES ('concept-a', 'concept:a', 'ACTIVE'), ('concept-b', 'concept:b', 'ACTIVE');
    INSERT INTO question_concepts VALUES
      ('mapping-a', 'version-1', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-b', 'version-1', 'concept-b', 1, NULL, NULL, 'APPROVED')`);
  resolver = new DatabaseEvidenceSourceResolver(new D1DatabaseProvider(database));
});

after(async () => miniflare?.dispose());

test("E1 F10 original event-time mapping resolves exactly while unchanged", async () => {
  const source = await resolve();
  assert.ok(source);
  assert.equal(source.conceptMappingSetHash, initialHash);
  assert.deepEqual(source.conceptIds, ["concept-a", "concept-b"]);
  assert.equal(source.mappingTransition, "PRESERVE_EVENT_TIME");
});

test("E1 F18 ontology evolution without governed correction fails closed", async () => {
  await exec("UPDATE question_concepts SET mapping_status = 'SUPERSEDED' WHERE id = 'mapping-b'");
  await assert.rejects(resolve(), hasCode("EVIDENCE_MAPPING_SET_MISMATCH"));
});

test("E1 F08 governed mapping correction resolves the exact corrected set", async () => {
  await exec(`INSERT INTO learning_event_revisions VALUES
    ('revision-1', 'QUESTION_ATTEMPT', 'attempt-1', 1, 'CORRECT_CONCEPT_MAPPING',
     '${"e".repeat(64)}', '${stableJson({ kind: "CONCEPT_MAPPING", conceptMappingSetHash: correctedHash })}')`);
  const source = await resolve();
  assert.ok(source);
  assert.equal(source.sourceRevisionIdentity, "e".repeat(64));
  assert.equal(source.conceptMappingSetHash, correctedHash);
  assert.deepEqual(source.conceptIds, ["concept-a"]);
  assert.equal(source.mappingTransition, "GOVERNED_CORRECTION");
});

function resolve() {
  return resolver.resolveEvent({
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: "attempt-1",
    sourceRevisionIdentity: "base-revision",
  });
}

async function mappingHash(concepts) {
  return computeConceptMappingSetHash(concepts.map((concept) => ({
    conceptIdentity: `concept:${concept}`,
    mappingVersion: 1,
    qualification: null,
    provenance: null,
    status: "APPROVED",
  })));
}

async function exec(sql) {
  return database.prepare(sql).run();
}

function hasCode(code) {
  return (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
