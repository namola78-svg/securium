import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const d1 = await readFile("drizzle/0046_auth_identity_binding_contract.sql", "utf8");
const postgres = await readFile("db/postgres/migrations/0059_auth_identity_binding_contract.sql", "utf8");
const model = await readFile("db/schema.ts", "utf8");

const tupleColumns = [
  "auth_system", "auth_provider", "auth_issuer", "auth_project_ref", "environment_class", "auth_subject",
];

test("D1 and PostgreSQL enforce permanent uniqueness across all six identity dimensions", () => {
  for (const sql of [d1, postgres]) {
    assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*?user_auth_identity_bindings_tuple_unique/);
    for (const column of tupleColumns) assert.match(sql, new RegExp(`\\"?${column}\\"?`));
    assert.doesNotMatch(sql, /WHERE\s+["`]?status["`]?\s*=\s*['"]ACTIVE['"]/i);
  }
  assert.match(model, /uniqueIndex\("user_auth_identity_bindings_tuple_unique"\)/);
});

test("terminal attribution is required while non-terminal revocation metadata is absent", () => {
  for (const sql of [d1, postgres]) {
    assert.match(sql, /'REVOKED',\s*'SUPERSEDED'[\s\S]*?revoked_at[\s\S]*?IS NOT NULL[\s\S]*?revoked_by[\s\S]*?IS NOT NULL/i);
    assert.match(sql, /'PENDING',\s*'ACTIVE'[\s\S]*?revoked_at[\s\S]*?IS NULL[\s\S]*?revoked_by[\s\S]*?IS NULL[\s\S]*?revocation_reason[\s\S]*?IS NULL/i);
  }
  // A terminal reason is intentionally optional: actor and timestamp establish attribution;
  // reason text may be unavailable or sensitive and is not needed to enforce lifecycle state.
  assert.doesNotMatch(postgres, /revocation_reason"\s+IS NOT NULL/i);
});

test("history deletion is blocked in D1 and PostgreSQL service-role grants", () => {
  assert.match(d1, /CREATE TRIGGER[\s\S]*?BEFORE DELETE ON `user_auth_identity_bindings`[\s\S]*?RAISE\(ABORT/);
  assert.match(postgres, /CREATE RULE "user_auth_identity_bindings_no_delete"[\s\S]*?ON DELETE[\s\S]*?DO INSTEAD NOTHING/);
  assert.match(postgres, /REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(postgres, /REVOKE DELETE, TRUNCATE[\s\S]*FROM service_role/);
  assert.match(postgres, /GRANT SELECT, INSERT, UPDATE[\s\S]*TO service_role/);
  assert.match(d1, /AUTH_IDENTITY_BINDING_TUPLE_IMMUTABLE/);
  assert.match(postgres, /AUTH_IDENTITY_BINDING_TUPLE_IMMUTABLE/);
  assert.match(d1, /AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE/);
  assert.match(postgres, /AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE/);
  assert.doesNotMatch(d1, /DELETE FROM `user_auth_identity_bindings`|TRUNCATE/i);
});

test("migration namespaces advance without changing an applied migration", async () => {
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  assert.equal(journal.entries.at(-1).tag, "0046_auth_identity_binding_contract");
  assert.equal(journal.entries.at(-1).idx, 46);
  assert.match(postgres, /0059_auth_identity_binding_contract/);
});

test("D1 migration enforces tuple history and lifecycle invariants in SQLite", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE users (id text PRIMARY KEY);");
    db.exec(d1);
    db.exec("INSERT INTO users (id) VALUES ('user-1');");
    const insert = db.prepare(`INSERT INTO user_auth_identity_bindings
      (id, auth_system, auth_provider, auth_issuer, auth_project_ref, environment_class, auth_subject,
       application_user_id, status, revoked_at, revoked_by, revocation_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const bind = (id, overrides = {}) => insert.run(
      id, overrides.authSystem ?? "supabase", overrides.authProvider ?? "google",
      overrides.authIssuer ?? "https://issuer.invalid", overrides.authProjectRef ?? "project-1",
      overrides.environmentClass ?? "nonprod", overrides.authSubject ?? "subject-1",
      "user-1", overrides.status ?? "ACTIVE", overrides.revokedAt ?? null,
      overrides.revokedBy ?? null, overrides.revocationReason ?? null, "operator-1",
    );

    bind("first");
    assert.throws(() => bind("active-duplicate"), /UNIQUE constraint failed/);
    db.prepare("UPDATE user_auth_identity_bindings SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP, revoked_by='operator-2' WHERE id='first'").run();
    assert.throws(() => bind("revoked-reuse"), /UNIQUE constraint failed/);
    assert.throws(() => db.prepare("UPDATE user_auth_identity_bindings SET status='ACTIVE', revoked_at=NULL, revoked_by=NULL WHERE id='first'").run(), /AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE/);
    assert.throws(() => db.prepare("UPDATE user_auth_identity_bindings SET revoked_by='operator-3' WHERE id='first'").run(), /AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE/);
    assert.throws(() => bind("terminal-no-time", { authSubject: "subject-2", status: "REVOKED", revokedBy: "operator-2" }), /CHECK constraint failed/);
    assert.throws(() => bind("terminal-no-actor", { authSubject: "subject-2", status: "SUPERSEDED", revokedAt: "2026-10-01" }), /CHECK constraint failed/);
    assert.throws(() => bind("pending-revocation-reason", { authSubject: "subject-2", status: "PENDING", revocationReason: "premature" }), /CHECK constraint failed/);
    assert.throws(() => bind("active-revoked-at", { authSubject: "subject-2", revokedAt: "2026-10-01" }), /CHECK constraint failed/);
    bind("different-environment", { environmentClass: "prod" });
    bind("different-subject", { authSubject: "subject-2" });
    assert.throws(() => db.prepare("UPDATE user_auth_identity_bindings SET auth_subject='subject-mutated' WHERE id='different-subject'").run(), /AUTH_IDENTITY_BINDING_TUPLE_IMMUTABLE/);
    assert.throws(() => db.prepare("UPDATE user_auth_identity_bindings SET status='PENDING' WHERE id='different-subject'").run(), /AUTH_IDENTITY_BINDING_STATUS_TRANSITION_INVALID/);
    bind("superseded-history", { authSubject: "subject-3", status: "SUPERSEDED", revokedAt: "2026-10-01", revokedBy: "operator-2" });
    assert.throws(() => bind("superseded-reuse", { authSubject: "subject-3" }), /UNIQUE constraint failed/);
    assert.doesNotThrow(() => bind("optional-terminal-reason", { authSubject: "subject-4", status: "REVOKED", revokedAt: "2026-10-01", revokedBy: "operator-2" }));
    assert.throws(() => db.prepare("DELETE FROM user_auth_identity_bindings WHERE id='first'").run(), /AUTH_IDENTITY_BINDING_HISTORY_APPEND_ONLY/);
  } finally {
    db.close();
  }
});
