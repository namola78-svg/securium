import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import type { AuthIdentityTuple } from "../db/user-auth-identity-binding-repository.ts";
import { findVerifiedApplicationActorRows } from "../db/user-auth-identity-binding-repository.ts";
import { resolveAuthIdentityEnvironmentClass, buildSupabaseAuthIdentityTuple } from "../lib/auth-provider.ts";
import { resolveVerifiedApplicationActorFromRows } from "../lib/services/resolve-verified-application-actor.ts";

const identityFacts = {
  projectUrl: "https://project.supabase.co",
  provider: "google",
  subject: "same-subject",
};

function tupleFor(vercelEnvironment: "production" | "preview"): AuthIdentityTuple {
  const environmentClass = resolveAuthIdentityEnvironmentClass({
    VERCEL_ENV: vercelEnvironment,
    NODE_ENV: "production",
  });
  const tuple = buildSupabaseAuthIdentityTuple({ ...identityFacts, environmentClass });
  assert.ok(tuple);
  return tuple;
}

test("same verified identity facts produce distinct Production and Preview tuples", () => {
  const production = tupleFor("production");
  const preview = tupleFor("preview");
  assert.equal(production.environmentClass, "production");
  assert.equal(preview.environmentClass, "preview");
  assert.notDeepEqual(production, preview);
  for (const dimension of Object.keys(production) as (keyof AuthIdentityTuple)[]) {
    if (dimension !== "environmentClass") {
      assert.equal(production[dimension], preview[dimension], `${dimension} should remain identical`);
    }
  }
});

test("identity binding repository enforces environment and all tuple dimensions in SQLite", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE user_auth_identity_bindings (
        id TEXT PRIMARY KEY,
        auth_system TEXT NOT NULL,
        auth_provider TEXT NOT NULL,
        auth_issuer TEXT NOT NULL,
        auth_project_ref TEXT NOT NULL,
        environment_class TEXT NOT NULL,
        auth_subject TEXT NOT NULL,
        application_user_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      INSERT INTO users (id, status) VALUES ('user-production', 'ACTIVE'), ('user-preview', 'ACTIVE');
    `);
    const insertBinding = sqlite.prepare(`
      INSERT INTO user_auth_identity_bindings (
        id, auth_system, auth_provider, auth_issuer, auth_project_ref,
        environment_class, auth_subject, application_user_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const production = tupleFor("production");
    const preview = tupleFor("preview");
    const insert = (id: string, tuple: AuthIdentityTuple, userId: string) =>
      insertBinding.run(
        id,
        tuple.authSystem,
        tuple.authProvider,
        tuple.authIssuer,
        tuple.authProjectRef,
        tuple.environmentClass,
        tuple.authSubject,
        userId,
        "ACTIVE",
      );
    insert("binding-production", production, "user-production");
    insert("binding-preview", preview, "user-preview");

    const database = drizzleProxy(async (sql, params) => {
      const statement = sqlite.prepare(sql);
      statement.setReturnArrays(true);
      return { rows: statement.all(...params) };
    }) as unknown as Parameters<typeof findVerifiedApplicationActorRows>[1];
    assert.ok(database);

    const productionRows = await findVerifiedApplicationActorRows(production, database);
    const previewRows = await findVerifiedApplicationActorRows(preview, database);
    assert.deepEqual(productionRows.map((row) => row.applicationUserId), ["user-production"]);
    assert.deepEqual(previewRows.map((row) => row.applicationUserId), ["user-preview"]);
    assert.deepEqual(resolveVerifiedApplicationActorFromRows(productionRows), { userId: "user-production" });
    assert.deepEqual(resolveVerifiedApplicationActorFromRows(previewRows), { userId: "user-preview" });

    sqlite.exec("DELETE FROM user_auth_identity_bindings WHERE environment_class = 'preview'");
    assert.deepEqual(await findVerifiedApplicationActorRows(preview, database), []);
    sqlite.exec("INSERT INTO user_auth_identity_bindings SELECT 'binding-preview', auth_system, auth_provider, auth_issuer, auth_project_ref, 'preview', auth_subject, 'user-preview', 'ACTIVE' FROM user_auth_identity_bindings WHERE environment_class = 'production'");
    sqlite.exec("DELETE FROM user_auth_identity_bindings WHERE environment_class = 'production'");
    assert.deepEqual(await findVerifiedApplicationActorRows(production, database), []);
    const previewOnlyRows = await findVerifiedApplicationActorRows(preview, database);
    assert.deepEqual(previewOnlyRows.map((row) => row.applicationUserId), ["user-preview"]);
    assert.equal(resolveVerifiedApplicationActorFromRows([]), null);
    assert.equal(resolveVerifiedApplicationActorFromRows([...previewOnlyRows, ...previewOnlyRows]), null);

    for (const dimension of [
      "authSystem",
      "authProvider",
      "authIssuer",
      "authProjectRef",
      "authSubject",
    ] as const) {
      const mismatched = { ...preview, [dimension]: `${preview[dimension]}-other` };
      assert.deepEqual(
        await findVerifiedApplicationActorRows(mismatched, database),
        [],
        `${dimension} must be exact`,
      );
    }
  } finally {
    sqlite.close();
  }
});

test("repository results for inactive bindings or users fail actor resolution", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      CREATE TABLE user_auth_identity_bindings (
        id TEXT PRIMARY KEY,
        auth_system TEXT NOT NULL,
        auth_provider TEXT NOT NULL,
        auth_issuer TEXT NOT NULL,
        auth_project_ref TEXT NOT NULL,
        environment_class TEXT NOT NULL,
        auth_subject TEXT NOT NULL,
        application_user_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      INSERT INTO users (id, status) VALUES ('user-inactive', 'DISABLED');
    `);
    const preview = tupleFor("preview");
    sqlite.prepare(`
      INSERT INTO user_auth_identity_bindings (
        id, auth_system, auth_provider, auth_issuer, auth_project_ref,
        environment_class, auth_subject, application_user_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "binding-inactive-user",
      preview.authSystem,
      preview.authProvider,
      preview.authIssuer,
      preview.authProjectRef,
      preview.environmentClass,
      preview.authSubject,
      "user-inactive",
      "ACTIVE",
    );
    const database = drizzleProxy(async (sql, params) => {
      const statement = sqlite.prepare(sql);
      statement.setReturnArrays(true);
      return { rows: statement.all(...params) };
    }) as unknown as Parameters<typeof findVerifiedApplicationActorRows>[1];
    assert.ok(database);

    const inactiveUserRows = await findVerifiedApplicationActorRows(preview, database);
    assert.equal(inactiveUserRows[0]?.applicationUserStatus, "DISABLED");
    assert.equal(resolveVerifiedApplicationActorFromRows(inactiveUserRows), null);

    sqlite.exec("UPDATE users SET status='ACTIVE' WHERE id='user-inactive'");
    sqlite.exec("UPDATE user_auth_identity_bindings SET status='REVOKED' WHERE id='binding-inactive-user'");
    const inactiveBindingRows = await findVerifiedApplicationActorRows(preview, database);
    assert.equal(inactiveBindingRows[0]?.bindingStatus, "REVOKED");
    assert.equal(resolveVerifiedApplicationActorFromRows(inactiveBindingRows), null);
  } finally {
    sqlite.close();
  }
});
