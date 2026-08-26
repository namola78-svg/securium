import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import postgres from "postgres";

const exec = promisify(execFile);
const password = "cpa-disposable-password";
const container = `securium-cpa-pg-${Date.now()}`;
let sql;
let started = false;

test.after(async () => {
  if (sql) await sql.end({ timeout: 5 });
  if (started) await exec("docker", ["rm", "--force", container]).catch(() => {});
});

test("PostgreSQL 0019 to 0020 CP-A is additive, constrained, writable, and rollback-safe", async () => {
  await exec("docker", ["run", "--detach", "--name", container, "--publish", "0:5432", "-e", `POSTGRES_PASSWORD=${password}`, "postgres:17.6"]);
  started = true;
  let port;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      port = (await exec("docker", ["port", container, "5432/tcp"])).stdout.trim().match(/:(\d+)$/)?.[1];
      if (port) {
        sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
        await sql`SELECT 1`;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(sql, "disposable PostgreSQL must become ready");
  for (const role of ["anon", "authenticated", "service_role"]) {
    await sql.unsafe(`CREATE ROLE ${role}`);
  }
  const baseline = await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8");
  const digest = JSON.parse(await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"));
  await sql.unsafe(`SET securium.baseline_artifact_sha256 = '${digest.artifactDigest}'`);
  await sql.unsafe(`SET securium.baseline_schema_sha256 = '${digest.schemaDigest}'`);
  await sql.unsafe(`SET securium.baseline_security_sha256 = '${digest.securityDigest}'`);
  await sql.unsafe(baseline);
  const before = await sql`SELECT count(*)::int AS count FROM pg_class WHERE relkind = 'r' AND relname NOT IN ('app_schema_migrations','app_schema_baseline_receipts')`;
  await sql.unsafe(await readFile("db/postgres/migrations/0020_concept_persistence_cp_a.sql", "utf8"));
  const names = await sql`SELECT relname AS name FROM pg_class WHERE relkind = 'r' AND relname IN ('concepts','concept_versions','concept_labels','skills','skill_versions','role_labels') ORDER BY relname`;
  assert.deepEqual(Array.from(names).map((row) => row.name), ["concept_labels", "concept_versions", "concepts"]);
  assert.equal(Number(before[0].count) > 0, true);
  await sql`INSERT INTO concepts (id, stable_key, status) VALUES ('cpa-c-1', 'security.access-control', 'ACTIVE')`;
  await sql`INSERT INTO concept_versions (id, concept_id, version, semantic_hash, definition, scope, status) VALUES ('cpa-v-1', 'cpa-c-1', 1, ${"a".repeat(64)}, 'Access control definition', 'course', 'ACTIVE')`;
  await sql`INSERT INTO concept_labels (id, concept_id, language, label, normalized_label, label_type, status) VALUES ('cpa-l-1', 'cpa-c-1', 'en', 'Access Control', 'access control', 'PREF', 'ACTIVE')`;
  await assert.rejects(sql`INSERT INTO concept_versions (id, concept_id, version, semantic_hash, definition, scope) VALUES ('cpa-v-2', 'cpa-c-1', 1, ${"b".repeat(64)}, 'conflict', 'course')`);
  await assert.rejects(sql.begin(async (tx) => { await tx`CREATE TABLE cpa_rollback_probe (id text)`; throw new Error("rollback probe"); }));
  const rollbackProbe = await sql`SELECT to_regclass('public.cpa_rollback_probe') AS relation`;
  assert.equal(rollbackProbe[0].relation, null);
});
