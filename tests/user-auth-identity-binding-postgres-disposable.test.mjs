import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import test from "node:test";

const exec = promisify(execFile);

test("disposable PostgreSQL enforces historical identity and service-role history protections", async () => {
  const container = `securium-auth-binding-${randomUUID()}`;
  const password = "auth-binding-disposable-password";
  let client;
  let containerStarted = false;
  try {
    await exec("docker", ["run", "--detach", "--rm", "--name", container,
      "--env", `POSTGRES_PASSWORD=${password}`, "--publish", "127.0.0.1::5432", "postgres:17.6"]);
    containerStarted = true;

    let port;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        port = (await exec("docker", ["port", container, "5432/tcp"]))
          .stdout.trim().match(/:(\d+)$/)?.[1];
        if (!port) throw new Error("POSTGRES_PORT_UNAVAILABLE");
        const postgres = (await import("postgres")).default;
        const candidate = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
          max: 1, prepare: false, ssl: false, onnotice: false, connect_timeout: 2,
        });
        await candidate`SELECT 1`;
        client = candidate;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(client, "disposable PostgreSQL must become ready");

    await client.unsafe(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE TABLE app_schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE public.users (id text PRIMARY KEY, status text NOT NULL DEFAULT 'ACTIVE');
      INSERT INTO public.users (id) VALUES ('user-1');`);
    await client.unsafe(await readFile("db/postgres/migrations/0059_auth_identity_binding_contract.sql", "utf8"));

    const tuple = { auth_system: "supabase", auth_provider: "google", auth_issuer: "https://issuer.invalid", auth_project_ref: "project-1", environment_class: "nonprod", auth_subject: "subject-1" };
    const insert = async (id, values = {}, status = "ACTIVE", revokedAt = null, revokedBy = null) => client`
      INSERT INTO public.user_auth_identity_bindings
        (id, auth_system, auth_provider, auth_issuer, auth_project_ref, environment_class, auth_subject,
         application_user_id, status, revoked_at, revoked_by, created_by)
      VALUES (${id}, ${values.auth_system ?? tuple.auth_system}, ${values.auth_provider ?? tuple.auth_provider},
        ${values.auth_issuer ?? tuple.auth_issuer}, ${values.auth_project_ref ?? tuple.auth_project_ref},
        ${values.environment_class ?? tuple.environment_class}, ${values.auth_subject ?? tuple.auth_subject},
        'user-1', ${status}, ${revokedAt}, ${revokedBy}, 'operator-1')`;

    await insert("first");
    await assert.rejects(insert("active-duplicate"), { code: "23505" });
    await client`UPDATE public.user_auth_identity_bindings SET status='REVOKED', revoked_at=now(), revoked_by='operator-2' WHERE id='first'`;
    await assert.rejects(insert("revoked-reuse"), { code: "23505" });
    await assert.rejects(insert("terminal-no-time", { auth_subject: "terminal-no-time" }, "REVOKED", null, "operator-2"), { code: "23514" });
    await assert.rejects(insert("terminal-no-actor", { auth_subject: "terminal-no-actor" }, "SUPERSEDED", new Date(), null), { code: "23514" });
    await assert.rejects(insert("pending-reason", { auth_subject: "pending-reason" }, "PENDING", null, null).then(() => client`UPDATE public.user_auth_identity_bindings SET revocation_reason='premature' WHERE id='pending-reason'`), { code: "23514" });
    await insert("different-environment", { environment_class: "prod" });
    await insert("different-subject", { auth_subject: "subject-2" });
    await insert("superseded-history", { auth_subject: "subject-3" }, "SUPERSEDED", new Date(), "operator-2");
    await assert.rejects(insert("superseded-reuse", { auth_subject: "subject-3" }), { code: "23505" });
    await insert("optional-terminal-reason", { auth_subject: "subject-4" }, "REVOKED", new Date(), "operator-2");

    await client.unsafe("SET ROLE service_role");
    await client`DELETE FROM public.user_auth_identity_bindings WHERE id='first'`;
    assert.equal(Number((await client`SELECT count(*) AS count FROM public.user_auth_identity_bindings`)[0].count), 6);
    await assert.rejects(client`TRUNCATE public.user_auth_identity_bindings`, { code: "42501" });
    await assert.rejects(client`UPDATE public.user_auth_identity_bindings SET auth_subject='rewritten' WHERE id='different-subject'`, { code: "P0001" });
    await assert.rejects(client`UPDATE public.user_auth_identity_bindings SET application_user_id='other-user' WHERE id='different-subject'`, { code: "P0001" });
    await assert.rejects(client`UPDATE public.user_auth_identity_bindings SET status='PENDING' WHERE id='different-subject'`, { code: "P0001" });
    await assert.rejects(client`UPDATE public.user_auth_identity_bindings SET status='ACTIVE', revoked_at=NULL, revoked_by=NULL WHERE id='first'`, { code: "P0001" });
    await assert.rejects(client`UPDATE public.user_auth_identity_bindings SET revoked_by='operator-3' WHERE id='first'`, { code: "P0001" });
    await client.unsafe("RESET ROLE");
  } finally {
    await client?.end({ timeout: 1 }).catch(() => {});
    if (containerStarted) await exec("docker", ["stop", container]).catch(() => {});
  }
});
