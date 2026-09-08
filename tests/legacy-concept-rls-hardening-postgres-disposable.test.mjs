import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import postgres from "postgres";

const exec = promisify(execFile);
const password = "legacy-concept-rls-disposable-password";
const container = `securium-legacy-concept-rls-${Date.now()}`;
const targetTables = ["concept_labels", "concept_versions", "concepts"];

test("legacy Concept tables are server-only before and after the RLS hardening migration", async () => {
  let client;
  try {
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--publish",
      "127.0.0.1::5432",
      "postgres:17.6",
    ]);

    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        port = (await exec("docker", ["port", container, "5432/tcp"]))
          .stdout.trim()
          .match(/:(\d+)$/)?.[1];
        if (port) {
          client = postgres(
            `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
            { max: 1, prepare: false, ssl: false, onnotice: false },
          );
          await client`SELECT 1`;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(client, "disposable PostgreSQL must become ready");

    await client.unsafe(
      "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;",
    );
    const baseline = JSON.parse(
      await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json", "utf8"),
    );
    await client.unsafe(`SET securium.baseline_artifact_sha256 = '${baseline.artifactDigest}'`);
    await client.unsafe(`SET securium.baseline_schema_sha256 = '${baseline.schemaDigest}'`);
    await client.unsafe(`SET securium.baseline_security_sha256 = '${baseline.securityDigest}'`);
    await client.unsafe(
      await readFile("db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql", "utf8"),
    );
    await client.unsafe(
      await readFile("db/postgres/migrations/0020_concept_persistence_cp_a.sql", "utf8"),
    );

    const before = await securityState(client);
    assert.deepEqual(
      before.map((row) => [row.relname, row.rls_enabled, row.rls_forced]),
      targetTables.map((name) => [name, false, false]),
    );
    assert.ok(before.every((row) => !row.anon_select && !row.auth_select));
    assert.equal(Number((await scalar(client, "SELECT count(*) FROM ontology_concepts"))[0].count), 0);
    assert.equal(Number((await scalar(client, "SELECT count(*) FROM ontology_aliases"))[0].count), 0);

    await client.unsafe(
      await readFile(
        "db/postgres/migrations/0041_legacy_concept_rls_hardening.sql",
        "utf8",
      ),
    );

    const after = await securityState(client);
    assert.deepEqual(
      after.map((row) => [row.relname, row.rls_enabled, row.rls_forced]),
      targetTables.map((name) => [name, true, false]),
    );
    assert.ok(after.every((row) => !row.anon_select && !row.anon_insert && !row.anon_update && !row.anon_delete));
    assert.ok(after.every((row) => !row.auth_select && !row.auth_insert && !row.auth_update && !row.auth_delete));
    assert.ok(after.every((row) => row.service_select && row.service_insert && row.service_update && row.service_delete));

    const policies = await client.unsafe(
      "SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('concepts', 'concept_versions', 'concept_labels')",
    );
    assert.equal(policies.length, 0, "server-only legacy tables must have no client policies");

    for (const role of ["anon", "authenticated"]) {
      for (const table of targetTables) {
        for (const statement of clientProbes(table)) {
          await assertDenied(client, role, statement);
        }
      }
    }

    await withRole(client, "service_role", async (connection) => {
      await connection.unsafe(
        "INSERT INTO concepts (id, stable_key, status) VALUES ('rls-c-1', 'legacy.security.access-control', 'ACTIVE')",
      );
      await connection.unsafe(
        `INSERT INTO concept_versions (id, concept_id, version, semantic_hash, definition, scope, status) VALUES ('rls-v-1', 'rls-c-1', 1, '${"a".repeat(64)}', 'compatibility definition', 'course', 'ACTIVE')`,
      );
      await connection.unsafe(
        "INSERT INTO concept_labels (id, concept_id, language, label, normalized_label, label_type, status) VALUES ('rls-l-1', 'rls-c-1', 'en', 'Access Control', 'access control', 'PREF', 'ACTIVE')",
      );
      await connection.unsafe(
        "UPDATE concepts SET status = 'RETIRED' WHERE id = 'rls-c-1'",
      );
      const rows = await connection.unsafe(
        "SELECT c.id, c.status, cv.version, cl.normalized_label FROM concepts c JOIN concept_versions cv ON cv.concept_id = c.id JOIN concept_labels cl ON cl.concept_id = c.id WHERE c.id = 'rls-c-1'",
      );
      assert.deepEqual(Array.from(rows), [
        { id: "rls-c-1", status: "RETIRED", version: 1, normalized_label: "access control" },
      ]);
      await connection.unsafe("DELETE FROM concept_labels WHERE id = 'rls-l-1'");
      await connection.unsafe("DELETE FROM concept_versions WHERE id = 'rls-v-1'");
      await connection.unsafe("DELETE FROM concepts WHERE id = 'rls-c-1'");
    });

    assert.equal(Number((await scalar(client, "SELECT count(*) FROM ontology_concepts"))[0].count), 0);
    assert.equal(Number((await scalar(client, "SELECT count(*) FROM ontology_aliases"))[0].count), 0);
    assert.equal(Number((await scalar(client, "SELECT count(*) FROM ontology_edges"))[0].count), 0);
  } finally {
    await client?.end({ timeout: 5 }).catch(() => {});
    await exec("docker", ["rm", "--force", container]).catch(() => {});
  }
});

function clientProbes(table) {
  if (table === "concept_versions") {
    return [
      "SELECT * FROM concept_versions",
      "INSERT INTO concept_versions (id, concept_id, version, semantic_hash, definition, scope, status) VALUES ('blocked-v-1', 'rls-c-1', 1, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'blocked', 'course', 'DRAFT')",
      "UPDATE concept_versions SET status = 'ACTIVE' WHERE id = 'rls-v-1'",
      "DELETE FROM concept_versions WHERE id = 'rls-v-1'",
    ];
  }
  if (table === "concept_labels") {
    return [
      "SELECT * FROM concept_labels",
      "INSERT INTO concept_labels (id, concept_id, language, label, normalized_label, label_type, status) VALUES ('blocked-l-1', 'rls-c-1', 'en', 'blocked', 'blocked', 'PREF', 'DRAFT')",
      "UPDATE concept_labels SET status = 'ACTIVE' WHERE id = 'rls-l-1'",
      "DELETE FROM concept_labels WHERE id = 'rls-l-1'",
    ];
  }
  return [
    "SELECT * FROM concepts",
    "INSERT INTO concepts (id, stable_key, status) VALUES ('blocked-c-1', 'blocked', 'DRAFT')",
    "UPDATE concepts SET status = 'ACTIVE' WHERE id = 'rls-c-1'",
    "DELETE FROM concepts WHERE id = 'rls-c-1'",
  ];
}

async function assertDenied(client, role, statement) {
  await withRole(client, role, async (connection) => {
    await assert.rejects(
      connection.unsafe(statement),
      (error) => error?.code === "42501",
    );
  });
}

async function withRole(client, role, callback) {
  const connection = await client.reserve();
  try {
    await connection.unsafe(`SET ROLE ${role}`);
    return await callback(connection);
  } finally {
    await connection.unsafe("RESET ROLE").catch(() => {});
    await connection.release();
  }
}

async function securityState(client) {
  return client.unsafe(`
    SELECT c.relname,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced,
      has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'SELECT') AS anon_select,
      has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'INSERT') AS anon_insert,
      has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'UPDATE') AS anon_update,
      has_table_privilege('anon', 'public.' || quote_ident(c.relname), 'DELETE') AS anon_delete,
      has_table_privilege('authenticated', 'public.' || quote_ident(c.relname), 'SELECT') AS auth_select,
      has_table_privilege('authenticated', 'public.' || quote_ident(c.relname), 'INSERT') AS auth_insert,
      has_table_privilege('authenticated', 'public.' || quote_ident(c.relname), 'UPDATE') AS auth_update,
      has_table_privilege('authenticated', 'public.' || quote_ident(c.relname), 'DELETE') AS auth_delete,
      has_table_privilege('service_role', 'public.' || quote_ident(c.relname), 'SELECT') AS service_select,
      has_table_privilege('service_role', 'public.' || quote_ident(c.relname), 'INSERT') AS service_insert,
      has_table_privilege('service_role', 'public.' || quote_ident(c.relname), 'UPDATE') AS service_update,
      has_table_privilege('service_role', 'public.' || quote_ident(c.relname), 'DELETE') AS service_delete
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('concepts', 'concept_versions', 'concept_labels')
    ORDER BY c.relname
  `);
}

async function scalar(client, query) {
  return client.unsafe(query);
}
