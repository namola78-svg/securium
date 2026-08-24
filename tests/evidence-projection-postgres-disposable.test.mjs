import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { promisify } from "node:util";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { EvidenceProjectionRepository } from "../db/evidence-projection-repository.ts";
import { buildEvidenceCandidates } from "../lib/services/evidence-projection.ts";

const execFile = promisify(execFileCallback);
let container;
let client;
let client2;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  await client2?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("disposable PostgreSQL proves E1 complete-set atomicity, replay, rollback, and one-active lineage", async () => {
  container = `securium-evidence-e1-${randomUUID()}`;
  const password = "evidence-e1-disposable-password";
  await execFile("docker", ["run", "--detach", "--rm", "--name", container,
    "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const postgres = (await import("postgres")).default;
  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  client = postgres(connectionString, {
    max: 1, prepare: false, ssl: false, onnotice: false,
  });
  client2 = postgres(connectionString, {
    max: 1, prepare: false, ssl: false, onnotice: false,
  });
  await waitForConnection();
  await client.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_attempts (id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id));
    CREATE TABLE learning_event_revisions (id text PRIMARY KEY, source_type text NOT NULL, source_event_id text NOT NULL, sequence integer NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_concepts (id text PRIMARY KEY, question_version_id text NOT NULL, concept_id text NOT NULL, mapping_version integer NOT NULL, qualification_json text, provenance_json text, mapping_status text NOT NULL);
    CREATE TABLE practical_attempts (id text PRIMARY KEY, user_id text NOT NULL, state text NOT NULL);
    CREATE TABLE practical_evaluations (id text PRIMARY KEY, attempt_id text NOT NULL, sequence integer NOT NULL, evaluation_payload_digest text NOT NULL);
    CREATE TABLE ontology_edges (edge_key text PRIMARY KEY, from_type text NOT NULL, from_id text NOT NULL, to_type text NOT NULL, to_id text NOT NULL, relation text NOT NULL, status text NOT NULL);
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO ontology_concepts VALUES ('concept-a', 'concept:a', 'ACTIVE'), ('concept-b', 'concept:b', 'ACTIVE');
    INSERT INTO question_attempts VALUES ('attempt-1', 'user-1'), ('attempt-rollback', 'user-1'), ('attempt-concurrent', 'user-1');
    INSERT INTO question_concepts VALUES
      ('mapping-a', 'question-version-1', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-b', 'question-version-1', 'concept-b', 1, NULL, NULL, 'APPROVED'),
      ('mapping-ca', 'question-version-concurrent', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-cb', 'question-version-concurrent', 'concept-b', 1, NULL, NULL, 'APPROVED'),
      ('mapping-ra', 'question-version-rollback', 'concept-a', 1, NULL, NULL, 'APPROVED'),
      ('mapping-rb', 'question-version-rollback', 'concept-b', 1, NULL, NULL, 'APPROVED');
    INSERT INTO practical_attempts VALUES ('practical-attempt-1', 'user-1', 'EVALUATED');
    INSERT INTO practical_evaluations VALUES ('evaluation-1', 'practical-attempt-1', 1, '${"b".repeat(64)}');
    INSERT INTO ontology_edges VALUES ('edge-practical-a', 'PRACTICAL', 'practical-1', 'CONCEPT', 'concept-a', 'ASSESSED_BY', 'ACTIVE');`);
  await client.unsafe(await readFile("db/postgres/migrations/0015_evidence_projection_foundation.sql", "utf8"));
  await client.unsafe(`ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text;
    ALTER TABLE evidence_projections ALTER COLUMN source_lineage_identity SET NOT NULL;
    CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
      ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
      WHERE lifecycle = 'ACTIVE';`);

  const repository = new EvidenceProjectionRepository(makeProvider(client));
  const current = source();
  const candidates = await buildEvidenceCandidates(current);
  assert.equal(await repository.reconcileEventProjectionSet(current, candidates), "NEW_SUCCESS");
  assert.equal(await repository.reconcileEventProjectionSet(current, candidates), "EXACT_REPLAY");
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 2);

  await client.unsafe("UPDATE question_concepts SET mapping_status = 'SUPERSEDED' WHERE id = 'mapping-b'");
  await client.unsafe("INSERT INTO learning_event_revisions VALUES ('revision-map', 'QUESTION_ATTEMPT', 'attempt-1', 1, 'revision-map-2')");
  const corrected = source({
    sourceRevisionIdentity: "revision-map-2",
    conceptIds: ["concept-a"],
    conceptMappingSetHash: "c".repeat(64),
    mappingTransition: "GOVERNED_CORRECTION",
    mappingGuard: {
      kind: "QUESTION_VERSION",
      parentIdentity: "question-version-1",
      members: [mapping("mapping-a", "concept-a", "concept:a")],
    },
  });
  assert.equal(await repository.reconcileEventProjectionSet(corrected, await buildEvidenceCandidates(corrected)), "NEW_SUCCESS");
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE lifecycle = 'ACTIVE'"), 1);
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE concept_id = 'concept-b' AND lifecycle = 'INVALIDATED'"), 1);

  const practical = practicalSource();
  assert.equal(await repository.reconcileEventProjectionSet(practical, await buildEvidenceCandidates(practical)), "NEW_SUCCESS");
  await client.unsafe(`INSERT INTO practical_evaluations VALUES ('evaluation-2', 'practical-attempt-1', 2, '${"c".repeat(64)}')`);
  const successor = practicalSource({
    sourceEventId: "evaluation-2",
    sourceRevisionIdentity: "c".repeat(64),
    sourceSemanticHash: "c".repeat(64),
  });
  assert.equal(await repository.reconcileEventProjectionSet(successor, await buildEvidenceCandidates(successor)), "NEW_SUCCESS");
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE source_lineage_identity = 'practical-attempt-1' AND lifecycle = 'ACTIVE'"), 1);
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE source_event_id = 'evaluation-1' AND lifecycle = 'SUPERSEDED'"), 1);
  await client.unsafe("UPDATE practical_attempts SET state = 'VOIDED' WHERE id = 'practical-attempt-1'");
  assert.equal(await repository.invalidateLineage({
    sourceType: "PRACTICAL_EVALUATION",
    sourceLineageIdentity: "practical-attempt-1",
    sourceRevisionIdentity: "void-revision",
    userId: "user-1",
    reasonCode: "PRACTICAL_ATTEMPT_VOIDED",
    guard: { kind: "PRACTICAL_ATTEMPT_VOIDED", attemptId: "practical-attempt-1" },
  }), "NEW_SUCCESS");
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE source_lineage_identity = 'practical-attempt-1' AND lifecycle = 'ACTIVE'"), 0);

  const rollback = source({
    sourceEventId: "attempt-rollback",
    sourceLineageIdentity: "attempt-rollback",
    sourceRevisionIdentity: "rollback",
    contentVersionIdentity: "question-version-rollback",
    mappingGuard: {
      kind: "QUESTION_VERSION",
      parentIdentity: "question-version-rollback",
      members: [
        mapping("mapping-ra", "concept-a", "concept:a"),
        mapping("mapping-rb", "concept-b", "concept:b"),
      ],
    },
  });
  await assert.rejects(new EvidenceProjectionRepository(makeProvider(client, true)).reconcileEventProjectionSet(
    rollback,
    await buildEvidenceCandidates(rollback),
  ));
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE source_lineage_identity = 'attempt-rollback'"), 0);

  const concurrent = source({ sourceEventId: "attempt-concurrent", sourceLineageIdentity: "attempt-concurrent", sourceRevisionIdentity: "concurrent" });
  concurrent.contentVersionIdentity = "question-version-concurrent";
  concurrent.mappingGuard = {
    kind: "QUESTION_VERSION",
    parentIdentity: "question-version-concurrent",
    members: [
      mapping("mapping-ca", "concept-a", "concept:a"),
      mapping("mapping-cb", "concept-b", "concept:b"),
    ],
  };
  const concurrentCandidates = await buildEvidenceCandidates(concurrent);
  const outcomes = await Promise.all([
    repository.reconcileEventProjectionSet(concurrent, concurrentCandidates),
    new EvidenceProjectionRepository(makeProvider(client2)).reconcileEventProjectionSet(
      concurrent,
      concurrentCandidates,
    ),
  ]);
  assert.equal(outcomes.includes("NEW_SUCCESS"), true);
  assert.equal(outcomes.every((value) => value === "NEW_SUCCESS" || value === "EXACT_REPLAY"), true);
  assert.equal(await count("SELECT count(*) FROM evidence_projections WHERE source_lineage_identity = 'attempt-concurrent' AND lifecycle = 'ACTIVE'"), 2);

  const policies = await client.unsafe("SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c WHERE c.relname IN ('evidence_projections', 'evidence_recompute_requests')");
  assert.equal(policies.length, 2);
  assert.equal(policies.every((row) => row.relrowsecurity && row.relforcerowsecurity), true);
});

function makeProvider(databaseClient, fail = false) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => {
      const rows = await databaseClient.unsafe(query, parameters);
      return { rows, rowCount: rows.count ?? rows.length };
    },
    transaction: async (callback) => databaseClient.begin(async (tx) => callback({
      query: async (query, parameters) => {
        if (fail && /INSERT INTO evidence_recompute_requests/i.test(query)) {
          throw new Error("injected rollback");
        }
        const rows = await tx.unsafe(query, parameters);
        return { rows, rowCount: rows.count ?? rows.length };
      },
    })),
  });
}

function source(overrides = {}) {
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
    conceptMappingSetHash: "a".repeat(64),
    conceptIds: ["concept-a", "concept-b"],
    occurredAt: "2026-08-21T00:00:00.000Z",
    validity: "ELIGIBLE",
    evidenceType: "PERFORMANCE_RESULT",
    quality: "DIRECT_PERFORMANCE",
    resultSummary: { correct: true, score: 100 },
    sourceSemanticHash: "b".repeat(64),
    mappingTransition: "PRESERVE_EVENT_TIME",
    mappingGuard: { kind: "QUESTION_VERSION", parentIdentity: "question-version-1", members },
    ...overrides,
  };
}

function practicalSource(overrides = {}) {
  return {
    sourceType: "PRACTICAL_EVALUATION",
    sourceEventId: "evaluation-1",
    sourceLineageIdentity: "practical-attempt-1",
    sourceRevisionIdentity: "b".repeat(64),
    userId: "user-1",
    contentVersionIdentity: "practical-version-1:rubric-version-1",
    conceptMappingSetHash: "a".repeat(64),
    conceptIds: ["concept-a"],
    occurredAt: "2026-08-21T00:00:00.000Z",
    validity: "ELIGIBLE",
    evidenceType: "PRACTICAL_PERFORMANCE",
    quality: "HUMAN_EVALUATED",
    resultSummary: { rawScore: 80, maximumScore: 100, qualification: "QUALIFIED" },
    sourceSemanticHash: "b".repeat(64),
    mappingTransition: "PRESERVE_EVENT_TIME",
    mappingGuard: {
      kind: "ONTOLOGY_EDGES",
      parentIdentity: "practical-1",
      parentType: "PRACTICAL",
      members: [{ edgeKey: "edge-practical-a", conceptId: "concept-a" }],
    },
    ...overrides,
  };
}

function mapping(mappingId, conceptId, conceptIdentity) {
  return { mappingId, conceptId, conceptIdentity, mappingVersion: 1, qualificationJson: null, provenanceJson: null };
}

async function count(sql) {
  const rows = await client.unsafe(sql);
  return Number(rows[0].count);
}

async function waitForConnection() {
  for (let index = 0; index < 40; index += 1) {
    try {
      await client`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("PostgreSQL unavailable");
}
