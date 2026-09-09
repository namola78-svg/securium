import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);

test("disposable PostgreSQL applies PG0038 and reads back ledger and Skill schema", async () => {
  const container = `securium-skill-pg-${randomUUID()}`;
  const password = "skill-foundation-test-password-2026";
  let sql;
  let started = false;
  try {
    await execFile("docker", ["run", "--detach", "--rm", "--name", container, "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
    started = true;
    await waitForPostgres(container);
    const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/:(\d+)$/)?.[1];
    sql = (await import("postgres")).default(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, { max: 1, prepare: false, ssl: false, onnotice: false });
    await waitForClient(sql);
    await sql.unsafe("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.users (id text PRIMARY KEY); CREATE TABLE public.app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());");
    for (const path of ["db/postgres/migrations/0034_occupational_role_foundation.sql", "db/postgres/migrations/0035_occupational_role_identity_hardening.sql", "db/postgres/migrations/0036_occupational_role_alias_hardening.sql", "db/postgres/migrations/0038_skill_foundation.sql"]) await sql.unsafe(await readFile(path, "utf8"));
    const ledger = await sql.unsafe("SELECT id, checksum, count(*) OVER (PARTITION BY id)::int AS duplicate_count FROM app_schema_migrations WHERE id = '0038_skill_foundation'");
    assert.equal(ledger.length, 1);
    assert.deepEqual({ id: ledger[0].id, checksum: ledger[0].checksum, duplicate_count: ledger[0].duplicate_count }, { id: "0038_skill_foundation", checksum: "skill-foundation-v1", duplicate_count: 1 });
    const schema = await sql.unsafe("SELECT to_regclass('public.skills') AS skills, to_regclass('public.skill_aliases') AS aliases");
    assert.equal(schema[0].skills, "skills"); assert.equal(schema[0].aliases, "skill_aliases");
    const constraints = await sql.unsafe("SELECT count(*)::int AS count FROM pg_constraint WHERE conrelid IN ('public.skills'::regclass, 'public.skill_aliases'::regclass)");
    assert.ok(constraints[0].count >= 5);
    await sql.unsafe("INSERT INTO public.skills (id, skill_key, label, source_type, provenance_json) VALUES ('s1', 'skill:security:secure-code-review', 'Secure Code Review', 'TEST', '{\"fixture\":true}')");
    await assert.rejects(sql.unsafe("INSERT INTO public.skills (id, skill_key, label, source_type, provenance_json) VALUES ('s2', 'skill:security:secure-code-review', 'Duplicate', 'TEST', '{\"fixture\":true}')"));
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (started) await execFile("docker", ["rm", "--force", container]);
  }
});

async function waitForPostgres(container) {
  for (let i = 0; i < 60; i += 1) { try { await execFile("docker", ["exec", container, "pg_isready", "--username", "postgres"]); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } }
  throw new Error("Disposable PostgreSQL did not become ready");
}
async function waitForClient(sql) {
  for (let i = 0; i < 60; i += 1) { try { await sql.unsafe("SELECT 1"); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } }
  throw new Error("Disposable PostgreSQL client did not become ready");
}
