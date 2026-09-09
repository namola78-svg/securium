import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);

test("disposable PostgreSQL enforces typed endpoints, relation vocabulary, uniqueness, and RLS", async () => {
  const container = `securium-typed-relations-${randomUUID()}`;
  const password = "typed-relations-test-password-2026";
  let sql;
  let started = false;
  try {
    await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
    started = true;
    await waitForPostgres(container);
    const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/:(\d+)$/)?.[1];
    assert.ok(port);
    const postgres = (await import("postgres")).default;
    sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
    await waitForClient(sql);
    await sql.unsafe("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
    await sql.unsafe("CREATE TABLE public.users (id text PRIMARY KEY NOT NULL); CREATE TABLE public.courses (id text PRIMARY KEY NOT NULL); CREATE TABLE public.app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());");
    for (const path of ["db/postgres/migrations/0008_ontology_graph_storage.sql", "db/postgres/migrations/0034_occupational_role_foundation.sql", "db/postgres/migrations/0035_occupational_role_identity_hardening.sql", "db/postgres/migrations/0036_occupational_role_alias_hardening.sql", "db/postgres/migrations/0038_skill_foundation.sql", "db/postgres/migrations/0042_typed_role_skill_concept_relations.sql"]) {
      await sql.unsafe(await readFile(path, "utf8"));
    }
    await sql.unsafe("INSERT INTO public.occupational_roles (id, role_key, label) VALUES ('role-1', 'role:security:appsec-engineer', 'Application Security Engineer');");
    await sql.unsafe("INSERT INTO public.skills (id, skill_key, label, source_type, provenance_json) VALUES ('skill-1', 'skill:security:secure-code-review', 'Secure Code Review', 'TEST', '{\"fixture\":true}');");
    await sql.unsafe("INSERT INTO public.ontology_concepts (id, concept_key, label, normalized_label) VALUES ('concept-1', 'ontology:security:secure-code-review', 'Secure Code Review', 'secure code review');");
    await sql.unsafe("INSERT INTO public.role_skill_relations (id, role_id, skill_id, provenance_json) VALUES ('rs-1', 'role-1', 'skill-1', '{\"review\":\"wave-b\"}');");
    await sql.unsafe("INSERT INTO public.skill_concept_relations (id, skill_id, concept_id, provenance_json) VALUES ('sc-1', 'skill-1', 'concept-1', '{\"review\":\"wave-b\"}');");
    assert.deepEqual({ ...((await sql.unsafe("SELECT relation_type, status FROM public.role_skill_relations"))[0]) }, { relation_type: "ROLE_REQUIRES_SKILL", status: "DRAFT" });
    assert.deepEqual({ ...((await sql.unsafe("SELECT relation_type, status FROM public.skill_concept_relations"))[0]) }, { relation_type: "SKILL_REQUIRES_CONCEPT", status: "DRAFT" });
    await assert.rejects(() => sql.unsafe("INSERT INTO public.role_skill_relations (id, role_id, skill_id, relation_type, provenance_json) VALUES ('rs-bad', 'role-1', 'skill-1', 'RELATED_TO', '{}')"), (error) => error?.code === "23514");
    await assert.rejects(() => sql.unsafe("INSERT INTO public.role_skill_relations (id, role_id, skill_id, provenance_json) VALUES ('rs-duplicate', 'role-1', 'skill-1', '{\"fixture\":true}')"), (error) => error?.code === "23505");
    const privileges = await sql.unsafe("SELECT has_table_privilege('anon', 'public.role_skill_relations', 'SELECT') AS role_select, has_table_privilege('authenticated', 'public.skill_concept_relations', 'INSERT') AS concept_insert, (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.role_skill_relations'::regclass) AS role_rls, (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.skill_concept_relations'::regclass) AS concept_force_rls");
    assert.deepEqual({ ...privileges[0] }, { role_select: false, concept_insert: false, role_rls: true, concept_force_rls: true });
    await assert.rejects(() => sql.unsafe("DELETE FROM public.occupational_roles WHERE id = 'role-1'"), (error) => error?.code === "23503");
    await assert.rejects(() => sql.unsafe("DELETE FROM public.skills WHERE id = 'skill-1'"), (error) => error?.code === "23503");
    await sql.unsafe("DELETE FROM public.role_skill_relations WHERE id = 'rs-1'");
    assert.equal((await sql.unsafe("SELECT count(*)::int AS count FROM public.role_skill_relations"))[0].count, 0);
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (started) await execFile("docker", ["rm", "--force", container]);
  }
});

async function waitForPostgres(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await execFile("docker", ["exec", container, "pg_isready", "--username", "postgres"]); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

async function waitForClient(sql) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await sql.unsafe("SELECT 1"); return; } catch (error) { if (!["57P03", "ECONNREFUSED", "ECONNRESET"].includes(error?.code)) throw error; await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("Disposable PostgreSQL client connection was not ready.");
}
