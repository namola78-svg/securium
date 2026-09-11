import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { promisify } from "node:util";
import postgres from "postgres";
import { computeConceptMappingSetHash } from "../lib/services/learning-event-contracts.ts";
import { EvidenceProjectionRepository, createRecomputeRequest } from "../db/evidence-projection-repository.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";

const execFile = promisify(execFileCallback);
const runnerScript = "scripts/run-question-attempt-evidence-once.mjs";
let container;
let client;

after(async () => {
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container], { windowsHide: true }).catch(() => {});
});

test("PostgreSQL subprocess uses the owned loopback container and processes exactly one request", async () => {
  const owner = `once-owner-${randomUUID()}`;
  const password = "question-attempt-worker-once-disposable-password";
  container = `securium-question-attempt-once-${randomUUID()}`;
  await execFile("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--label", `com.securium.evidence-once.owner=${owner}`,
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--publish", "127.0.0.1::5432", "postgres:17.6",
  ], { windowsHide: true });
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"], { windowsHide: true });
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port);
  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  client = postgres(connectionString, { max: 1, prepare: false, ssl: false, onnotice: false });
  await waitForConnection();
  await client.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE users (id text PRIMARY KEY);
    CREATE TABLE ontology_concepts (id text PRIMARY KEY, concept_key text NOT NULL, status text NOT NULL);
    CREATE TABLE question_versions (id text PRIMARY KEY, question_id text NOT NULL, semantic_hash text NOT NULL);
    CREATE TABLE question_attempts (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id), question_id text,
      foundation_question_binding_id text, question_version_id text,
      concept_mapping_set_hash text, is_correct boolean, score real, attempted_at text
    );
    CREATE TABLE question_concepts (
      id text PRIMARY KEY, question_version_id text NOT NULL, concept_id text NOT NULL,
      mapping_version integer NOT NULL, qualification_json text, provenance_json text, mapping_status text NOT NULL
    );
    CREATE TABLE learning_event_revisions (
      id text PRIMARY KEY, source_type text NOT NULL, source_event_id text NOT NULL,
      sequence integer NOT NULL, action text NOT NULL, semantic_hash text NOT NULL, correction_payload_json text
    );
    INSERT INTO users VALUES ('user-1');
    INSERT INTO ontology_concepts VALUES ('concept-1', 'concept:one', 'ACTIVE'), ('concept-2', 'concept:two', 'ACTIVE');
    INSERT INTO question_versions VALUES ('question-version-1', 'question-1', '${"e".repeat(64)}');
    INSERT INTO question_concepts VALUES
      ('mapping-1', 'question-version-1', 'concept-1', 1, NULL, NULL, 'APPROVED'),
      ('mapping-2', 'question-version-1', 'concept-2', 1, NULL, NULL, 'APPROVED');`);
  await client.unsafe(await readFile("db/postgres/migrations/0015_evidence_projection_foundation.sql", "utf8"));
  await client.unsafe(await readFile("db/postgres/migrations/0019_evidence_e2_a_recompute_operations.sql", "utf8"));
  await client.unsafe(`ALTER TABLE evidence_projections ADD COLUMN source_lineage_identity text;
    ALTER TABLE evidence_projections ALTER COLUMN source_lineage_identity SET NOT NULL;
    CREATE UNIQUE INDEX evidence_projections_active_lineage_unique
      ON evidence_projections (user_id, source_type, source_lineage_identity, evidence_type, concept_id, projection_version)
      WHERE lifecycle = 'ACTIVE';`);

  const mappingHash = await computeConceptMappingSetHash([
    { conceptIdentity: "concept:one", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
    { conceptIdentity: "concept:two", mappingVersion: 1, qualification: null, provenance: null, status: "APPROVED" },
  ]);
  const attemptId = "postgres-once-attempt";
  await client.unsafe(`INSERT INTO question_attempts
    (id, user_id, question_id, foundation_question_binding_id, question_version_id,
     concept_mapping_set_hash, is_correct, score, attempted_at)
    VALUES ('${attemptId}', 'user-1', 'question-1', NULL, 'question-version-1', '${mappingHash}', true, 100, '2026-09-11T00:00:00.000Z')`);
  const provider = makeProvider(client);
  const repository = new EvidenceProjectionRepository(provider);
  const request = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attemptId,
    sourceRevisionIdentity: attemptId,
    userId: "user-1",
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(await repository.enqueue(request), "NEW_SUCCESS");

  const first = await runRunner(["--local-disposable", "--provider=postgres"], {
    SECURIUM_EVIDENCE_ONCE_POSTGRES_URL: connectionString,
    SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER: container,
    SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER: owner,
  });
  assert.equal(first.exitCode, 0);
  assert.equal(first.result.status, "COMPLETED");
  assert.equal(first.result.projectionCount, 2);
  assert.equal(await scalar("SELECT status FROM evidence_recompute_requests WHERE id = $1", [request.id]), "COMPLETED");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${attemptId}' AND lifecycle = 'ACTIVE'`), "2");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${attemptId}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "2");

  const replay = await runRunner(["--local-disposable", "--provider=postgres"], {
    SECURIUM_EVIDENCE_ONCE_POSTGRES_URL: connectionString,
    SECURIUM_EVIDENCE_ONCE_POSTGRES_CONTAINER: container,
    SECURIUM_EVIDENCE_ONCE_POSTGRES_OWNER: owner,
  });
  assert.equal(replay.exitCode, 0);
  assert.equal(replay.result.status, "NO_REQUEST");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_projections WHERE source_event_id = '${attemptId}' AND lifecycle = 'ACTIVE'`), "2");
  assert.equal(await scalar(`SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = '${attemptId}' AND request_type = 'MASTERY_RECOMPUTE_REQUIRED'`), "2");
});

function makeProvider(databaseClient) {
  return new PostgresDatabaseProvider({
    query: async (query, parameters) => {
      const rows = await databaseClient.unsafe(query, parameters);
      return { rows, rowCount: rows.count ?? rows.length };
    },
    transaction: async (callback) => databaseClient.begin(async (tx) => callback({
      query: async (query, parameters) => {
        const rows = await tx.unsafe(query, parameters);
        return { rows, rowCount: rows.count ?? rows.length };
      },
    })),
  });
}

async function runRunner(argumentsToRunner, environment) {
  try {
    const result = await execFile(process.execPath, ["node_modules/tsx/dist/cli.mjs", runnerScript, ...argumentsToRunner], {
      cwd: process.cwd(),
      env: { ...process.env, DB_PROVIDER: "d1", DATABASE_URL: "postgres://managed.invalid/never-used", ...environment },
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return parseRunnerResult(0, result.stdout, result.stderr);
  } catch (error) {
    return parseRunnerResult(Number(error.code ?? 1), error.stdout ?? "", error.stderr ?? "");
  }
}

function parseRunnerResult(exitCode, stdout, stderr) {
  const line = stdout.trim().split(/\r?\n/).reverse().find((value) => value.trim().startsWith("{"));
  return { exitCode, result: line ? JSON.parse(line) : null, stdout, stderr };
}

async function scalar(sql, parameters = []) {
  const rows = await client.unsafe(sql, parameters);
  return String(rows[0] ? Object.values(rows[0])[0] : "");
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
