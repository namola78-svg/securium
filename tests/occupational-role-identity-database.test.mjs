import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationPaths = [
  "drizzle/0045_occupational_role_foundation.sql",
  "drizzle/0046_occupational_role_identity_hardening.sql",
  "drizzle/0047_occupational_role_alias_hardening.sql",
];

async function applyMigration(database, path) {
  const sql = (await readFile(path, "utf8")).replaceAll("--> statement-breakpoint", "");
  database.exec(sql);
}

async function createRoleDatabase(paths = migrationPaths) {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON; CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);");
  for (const path of paths) await applyMigration(database, path);
  return database;
}

function insertRole(database, values = {}) {
  const role = {
    id: "role-db-1",
    roleKey: "role:security:appsec-engineer",
    label: "Application Security Engineer",
    status: "DRAFT",
    ...values,
  };
  database
    .prepare("INSERT INTO occupational_roles (id, role_key, label, status, reviewed_by, reviewed_at, review_evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(role.id, role.roleKey, role.label, role.status, role.reviewedBy ?? null, role.reviewedAt ?? null, role.reviewEvidenceJson ?? "[]");
  return role;
}

test("D1 database accepts canonical Role creation and safe metadata updates", async () => {
  const database = await createRoleDatabase();
  insertRole(database);
  database.prepare("UPDATE occupational_roles SET label = ?, description = ? WHERE id = ?").run(
    "Application Security Specialist",
    "Updated description",
    "role-db-1",
  );
  const row = database.prepare("SELECT role_key, label, description FROM occupational_roles WHERE id = ?").get("role-db-1");
  assert.deepEqual({ ...row }, {
    role_key: "role:security:appsec-engineer",
    label: "Application Security Specialist",
    description: "Updated description",
  });
  database.close();
});

test("D1 rejects malformed Role keys and duplicate canonical keys", async () => {
  const database = await createRoleDatabase();
  for (const [index, roleKey] of [
    "security:appsec",
    "role::appsec",
    "role:security:",
    "role:Security:appsec",
    "role:security:appsec engineer",
    "role:security:appsec/engineer",
    "role:security:appsec:extra",
    " role:security:appsec ",
    `role:security:${"x".repeat(250)}`,
  ].entries()) {
    assert.throws(
      () => insertRole(database, { id: `invalid-${index}`, roleKey }),
      /CHECK constraint failed|constraint failed/i,
      roleKey,
    );
  }
  insertRole(database);
  assert.throws(
    () => insertRole(database, { id: "duplicate", roleKey: "role:security:appsec-engineer" }),
    /UNIQUE constraint failed/i,
  );
  database.close();
});

test("D1 enforces canonical alias storage and normalized alias uniqueness", async () => {
  const database = await createRoleDatabase();
  insertRole(database);
  insertRole(database, {
    id: "role-db-2",
    roleKey: "role:security:soc-analyst",
    label: "SOC Analyst",
  });
  const insertAlias = (id, alias, normalizedAlias, roleId = "role-db-1") =>
    database.prepare(
      "INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES (?, ?, ?, ?)",
    ).run(id, roleId, alias, normalizedAlias);

  insertAlias("alias-1", "application security engineer", "application security engineer");
  for (const [id, alias, normalizedAlias] of [
    ["alias-upper", "Application Security Engineer", "Application Security Engineer"],
    ["alias-spaces", "application  security engineer", "application  security engineer"],
    ["alias-trim", " application security engineer", "application security engineer"],
    ["alias-mismatch", "application security engineer", "different"],
    ["alias-nbsp", "application\u00a0security engineer", "application\u00a0security engineer"],
    ["alias-fullwidth", `${String.fromCodePoint(0xff21)}pplication security engineer`, `${String.fromCodePoint(0xff21)}pplication security engineer`],
  ]) {
    assert.throws(
      () => insertAlias(id, alias, normalizedAlias),
      /CHECK constraint failed|constraint failed/i,
      id,
    );
  }
  insertAlias("alias-soc", "soc analyst", "soc analyst", "role-db-2");
  assert.throws(
    () => insertAlias("alias-duplicate", "application security engineer", "application security engineer"),
    /UNIQUE constraint failed/i,
  );
  assert.throws(
    () => insertAlias("alias-cross-role", "application security engineer", "application security engineer", "role-db-2"),
    /UNIQUE constraint failed/i,
  );
  assert.throws(
    () => database.prepare("UPDATE occupational_role_aliases SET alias = ?, normalized_alias = ? WHERE id = ?").run(
      "soc analyst",
      "soc analyst",
      "alias-1",
    ),
    /UNIQUE constraint failed/i,
  );
  assert.throws(
    () => insertAlias("alias-missing-role", "unknown role alias", "unknown role alias", "missing-role"),
    /FOREIGN KEY constraint failed/i,
  );
  database.close();
});

test("D1 rejects canonical role_key mutation but allows label and description mutation", async () => {
  const database = await createRoleDatabase();
  insertRole(database);
  assert.throws(
    () => database.prepare("UPDATE occupational_roles SET role_key = ? WHERE id = ?").run(
      "role:security:renamed-appsec",
      "role-db-1",
    ),
    /semantic key is immutable/i,
  );
  const row = database.prepare("SELECT role_key FROM occupational_roles WHERE id = ?").get("role-db-1");
  assert.deepEqual({ ...row }, { role_key: "role:security:appsec-engineer" });
  database.close();
});

test("D1 preserves ACTIVE review safety while Role activation remains out of scope", async () => {
  const database = await createRoleDatabase();
  assert.throws(
    () => insertRole(database, { id: "unsafe-active", status: "ACTIVE" }),
    /NOT NULL|CHECK constraint failed|constraint failed/i,
  );
  database.close();
});

test("D1 alias hardening rejects pre-existing collisions before replacing the canonical table and retries safely", async () => {
  const database = await createRoleDatabase(migrationPaths.slice(0, 2));
  insertRole(database);
  insertRole(database, {
    id: "role-db-2",
    roleKey: "role:security:soc-analyst",
    label: "SOC Analyst",
  });
  const insertAlias = (id, roleId) => database.prepare(
    "INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES (?, ?, ?, ?)",
  ).run(id, roleId, "shared alias", "shared alias");
  insertAlias("alias-1", "role-db-1");
  insertAlias("alias-2", "role-db-2");

  const beforeRows = database.prepare(
    "SELECT id, role_id, alias, normalized_alias FROM occupational_role_aliases ORDER BY id",
  ).all();
  await assert.rejects(
    () => applyMigration(database, migrationPaths[2]),
    /UNIQUE constraint failed: occupational_role_aliases\.normalized_alias/i,
  );
  assert.deepEqual(database.prepare(
    "SELECT id, role_id, alias, normalized_alias FROM occupational_role_aliases ORDER BY id",
  ).all(), beforeRows);
  assert.equal(database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__new_occupational_role_aliases'",
  ).get(), undefined);
  assert.equal(database.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'occupational_role_aliases_normalized_unique'",
  ).get(), undefined);
  assert.ok(database.prepare("PRAGMA index_list('occupational_role_aliases')").all().some(
    (index) => index.name === "occupational_role_aliases_role_normalized_unique",
  ));

  await assert.rejects(
    () => applyMigration(database, migrationPaths[2]),
    /UNIQUE constraint failed: occupational_role_aliases\.normalized_alias/i,
  );
  assert.deepEqual(database.prepare(
    "SELECT id, role_id, alias, normalized_alias FROM occupational_role_aliases ORDER BY id",
  ).all(), beforeRows);

  database.prepare("DELETE FROM occupational_role_aliases WHERE id = ?").run("alias-2");
  await applyMigration(database, migrationPaths[2]);
  assert.ok(database.prepare("PRAGMA index_list('occupational_role_aliases')").all().some(
    (index) => index.name === "occupational_role_aliases_normalized_unique" && index.unique === 1,
  ));
  assert.throws(
    () => database.prepare(
      "INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES (?, ?, ?, ?)",
    ).run("alias-3", "role-db-2", "shared alias", "shared alias"),
    /UNIQUE constraint failed/i,
  );
  database.close();
});

test("D1 alias hardening fails safely for a pre-existing non-ASCII compatibility alias", async () => {
  const database = await createRoleDatabase(migrationPaths.slice(0, 2));
  insertRole(database);
  const nonAsciiAlias = `${String.fromCodePoint(0xff41)}pplication security engineer`;
  database.prepare(
    "INSERT INTO occupational_role_aliases (id, role_id, alias, normalized_alias) VALUES (?, ?, ?, ?)",
  ).run("alias-fullwidth", "role-db-1", nonAsciiAlias, nonAsciiAlias);
  const beforeTable = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'occupational_role_aliases'",
  ).get().sql;
  await assert.rejects(
    () => applyMigration(database, migrationPaths[2]),
    /CHECK constraint failed|constraint failed/i,
  );
  assert.equal(database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'occupational_role_aliases'",
  ).get().sql, beforeTable);
  assert.deepEqual(
    database.prepare("SELECT id, alias, normalized_alias FROM occupational_role_aliases").all()
      .map((row) => ({ ...row })),
    [{ id: "alias-fullwidth", alias: nonAsciiAlias, normalized_alias: nonAsciiAlias }],
  );
  database.close();
});
