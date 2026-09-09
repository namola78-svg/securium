import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import test from "node:test";

const execFile = promisify(execFileCallback);

test("disposable PostgreSQL enforces Role identity, alias, and key immutability", async () => {
  const container = `securium-role-identity-${randomUUID()}`;
  const password = "role-identity-test-password-2026";
  let sql;
  let containerStarted = false;
  try {
    await execFile("docker", [
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
    containerStarted = true;
    await waitForPostgres(container);
    const { stdout: portOutput } = await execFile("docker", ["port", container, "5432/tcp"]);
    const port = portOutput.trim().match(/:(\d+)$/)?.[1];
    assert.ok(port);

    const postgres = (await import("postgres")).default;
    sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
      max: 1,
      prepare: false,
      ssl: false,
      onnotice: false,
    });
    await waitForClientConnection(sql);
    await sql.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
    await sql.unsafe(`CREATE TABLE public."users" ("id" text PRIMARY KEY NOT NULL);`);
    await sql.unsafe(`CREATE TABLE public.app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());`);
    await sql.unsafe(await readFile("db/postgres/migrations/0034_occupational_role_foundation.sql", "utf8"));
    await sql.unsafe(await readFile("db/postgres/migrations/0035_occupational_role_identity_hardening.sql", "utf8"));
    await sql.unsafe(await readFile("db/postgres/migrations/0036_occupational_role_alias_hardening.sql", "utf8"));

    await sql.unsafe(`INSERT INTO public."occupational_roles" (id, role_key, label) VALUES ('pg-role-1', 'role:security:appsec-engineer', 'Application Security Engineer')`);
    await sql.unsafe(`INSERT INTO public."occupational_roles" (id, role_key, label) VALUES ('pg-role-2', 'role:security:soc-analyst', 'SOC Analyst')`);
    await sql.unsafe(`UPDATE public."occupational_roles" SET label = 'Application Security Specialist' WHERE id = 'pg-role-1'`);
    const row = await sql.unsafe(`SELECT role_key, label FROM public."occupational_roles" WHERE id = 'pg-role-1'`);
    assert.deepEqual({ ...row[0] }, { role_key: "role:security:appsec-engineer", label: "Application Security Specialist" });

    for (const roleKey of [
      "security:appsec",
      "role::appsec",
      "role:security:",
      "role:Security:appsec",
      "role:security:appsec engineer",
      "role:security:appsec/engineer",
      "role:security:appsec:extra",
      " role:security:appsec ",
    ]) {
      await assert.rejects(
        sql.unsafe(`INSERT INTO public."occupational_roles" (id, role_key, label) VALUES ('${randomUUID()}', '${roleKey.replaceAll("'", "''")}', 'Invalid')`),
        (error) => error?.code === "23514",
        roleKey,
      );
    }

    await sql.unsafe(`INSERT INTO public."occupational_role_aliases" (id, role_id, alias, normalized_alias) VALUES ('pg-alias-1', 'pg-role-1', 'application security engineer', 'application security engineer')`);
    await sql.unsafe(`INSERT INTO public."occupational_role_aliases" (id, role_id, alias, normalized_alias) VALUES ('pg-alias-2', 'pg-role-2', 'soc analyst', 'soc analyst')`);
    for (const [alias, normalizedAlias] of [
      ["Application Security Engineer", "Application Security Engineer"],
      ["application  security engineer", "application  security engineer"],
      [" application security engineer", "application security engineer"],
      ["application security engineer", "different"],
      [`application${String.fromCodePoint(0xa0)}security engineer`, `application${String.fromCodePoint(0xa0)}security engineer`],
      [`${String.fromCodePoint(0xff21)}pplication security engineer`, `${String.fromCodePoint(0xff21)}pplication security engineer`],
    ]) {
      await assert.rejects(
        sql.unsafe(`INSERT INTO public."occupational_role_aliases" (id, role_id, alias, normalized_alias) VALUES ('${randomUUID()}', 'pg-role-1', '${alias}', '${normalizedAlias}')`),
        (error) => error?.code === "23514",
        alias,
      );
    }
    await assert.rejects(
      sql.unsafe(`INSERT INTO public."occupational_role_aliases" (id, role_id, alias, normalized_alias) VALUES ('pg-alias-duplicate', 'pg-role-1', 'application security engineer', 'application security engineer')`),
      (error) => error?.code === "23505",
    );
    await assert.rejects(
      sql.unsafe(`INSERT INTO public."occupational_role_aliases" (id, role_id, alias, normalized_alias) VALUES ('pg-alias-cross-role', 'pg-role-2', 'application security engineer', 'application security engineer')`),
      (error) => error?.code === "23505",
    );
    await assert.rejects(
      sql.unsafe(`UPDATE public."occupational_role_aliases" SET alias = 'soc analyst', normalized_alias = 'soc analyst' WHERE id = 'pg-alias-1'`),
      (error) => error?.code === "23505",
    );
    await assert.rejects(
      sql.unsafe(`UPDATE public."occupational_roles" SET role_key = 'role:security:renamed-appsec' WHERE id = 'pg-role-1'`),
      (error) => error?.code === "23514",
    );
    await assert.rejects(
      sql.unsafe(`INSERT INTO public."occupational_roles" (id, role_key, label, status) VALUES ('pg-active-invalid', 'role:security:active-invalid', 'Invalid Active', 'ACTIVE')`),
      (error) => error?.code === "23514",
    );
  } finally {
    if (sql) await sql.end({ timeout: 5 });
    if (containerStarted) await execFile("docker", ["rm", "--force", container]);
  }
});

async function waitForPostgres(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await execFile("docker", ["exec", container, "pg_isready", "--username", "postgres"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

async function waitForClientConnection(sql) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await sql.unsafe("SELECT 1");
      return;
    } catch (error) {
      const code = error && typeof error === "object" ? error.code : undefined;
      if (!["57P03", "ECONNREFUSED", "ECONNRESET"].includes(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL client connection was not ready.");
}
