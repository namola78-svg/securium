import assert from "node:assert/strict";
import { execFile as callback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { validateRlsMigrationContracts } from "../scripts/generate-postgres-rls.mjs";

const execFile = promisify(callback);
const ownerId = "0050_sw_foundation_identity_version_binding";
const table = 'public."foundation_question_bindings"';
const enable = `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`;
const revoke = `REVOKE ALL PRIVILEGES ON TABLE ${table} FROM PUBLIC, anon, authenticated;`;
const fixture = {
  manifest: JSON.parse(await readFile("db/postgres/schema-manifest.json", "utf8")),
  historicalSql: await readFile("db/postgres/migrations/0002_server_only_rls_lockdown.sql", "utf8"),
  forwardMigrations: { [ownerId]: await readFile(`db/postgres/migrations/${ownerId}.sql`, "utf8") },
};
const validateForward = source => validateRlsMigrationContracts({ ...fixture, forwardMigrations: { [ownerId]: source } });

test("0002 retains 71 historical relations while 0050 owns the 72nd current relation", () => {
  assert.deepEqual(validateRlsMigrationContracts(fixture), {
    currentTableCount: 72, historicalTableCount: 71, forwardTableCount: 1,
  });
  assert.deepEqual(validateRlsMigrationContracts({ ...fixture, manifest: { ...fixture.manifest, tableOrder: [...fixture.manifest.tableOrder].reverse() } }), validateRlsMigrationContracts(fixture));
  assert.doesNotMatch(fixture.historicalSql, /foundation_question_bindings/);
  assert.equal(createHash("sha256").update(fixture.historicalSql).digest("hex"), "289b707321fab2573780f401ec65e62053e3fba7062361e86e8b5f2fd6fce1cd");
});

test("check and legacy generation validate without changing any published migration bytes", async () => {
  const names = (await readdir("db/postgres/migrations")).filter(name => name.endsWith(".sql")).sort();
  const bytes = () => Promise.all(names.map(name => readFile(`db/postgres/migrations/${name}`)));
  const before = await bytes();
  for (const args of [["--check"], []]) {
    const { stdout } = await execFile(process.execPath, ["scripts/generate-postgres-rls.mjs", ...args], { windowsHide: true });
    assert.match(stdout, /POSTGRES_RLS_MIGRATION_VALID tables=72 historical_tables=71 forward_tables=1/);
  }
  assert.deepEqual(await bytes(), before);
  assert.deepEqual((await readdir("db/postgres/migrations")).filter(name => name.endsWith(".sql")).sort(), names);
});

test("any change to immutable 0002 fails closed", () => {
  assert.throws(() => validateRlsMigrationContracts({ ...fixture, historicalSql: `${fixture.historicalSql}-- changed\n` }), /POSTGRES_RLS_IMMUTABLE_MIGRATION_CHANGED/);
});

for (const [label, mutation] of [
  ["missing RLS", source => source.replace(enable, "")],
  ["commented RLS", source => source.replace(enable, `-- ${enable}`)],
  ["missing client revoke", source => source.replace(revoke, "")],
  ["commented client revoke", source => source.replace(revoke, `/* ${revoke} */`)],
  ["missing creator", source => source.replace(`CREATE TABLE ${table}`, 'CREATE TABLE public."other_table"')],
]) {
  test(`0050 ${label} fails closed against its current security contract`, () => {
    assert.throws(() => validateForward(mutation(fixture.forwardMigrations[ownerId])), /POSTGRES_RLS_TABLE_PROTECTION_MISSING.*foundation_question_bindings.*0050_/);
  });
}

test("RLS protection hidden in a SQL string cannot satisfy the published contract", () => {
  assert.throws(() => validateForward(fixture.forwardMigrations[ownerId].replace(enable, `SELECT '${enable}';`)), /POSTGRES_RLS_IMMUTABLE_MIGRATION_CHANGED/);
});

test("a later disable, client grant, or client policy in the owning migration fails closed", () => {
  for (const sql of [
    `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`,
    `GRANT SELECT ON TABLE ${table} TO anon;`,
    `CREATE POLICY exposed ON ${table} TO authenticated USING (true);`,
  ]) {
    assert.throws(() => validateForward(fixture.forwardMigrations[ownerId].replace("COMMIT;", `${sql}\nCOMMIT;`)), /POSTGRES_RLS_(TABLE_PROTECTION_DISABLED|MIGRATION_DIRECT_CLIENT_ACCESS_FOUND)/);
  }
});

test("unmodeled current tables and absent security owners fail closed", () => {
  const manifest = { ...fixture.manifest, tableCount: fixture.manifest.tableCount + 1, tableOrder: [...fixture.manifest.tableOrder, "new_server_only_table"] };
  assert.throws(() => validateRlsMigrationContracts({ ...fixture, manifest }), /POSTGRES_RLS_SECURITY_OWNER_MISSING table=new_server_only_table/);
  assert.throws(() => validateRlsMigrationContracts({ ...fixture, forwardMigrations: {} }), /POSTGRES_RLS_SECURITY_MIGRATION_MISSING.*foundation_question_bindings/);
});

test("missing historical/current inventory or duplicate manifest tables fail closed", () => {
  for (const tableOrder of [
    fixture.manifest.tableOrder.filter(name => name !== "foundation_question_bindings"),
    fixture.manifest.tableOrder.filter(name => name !== "users"),
    [...fixture.manifest.tableOrder, fixture.manifest.tableOrder[0]],
  ]) {
    const manifest = { ...fixture.manifest, tableCount: tableOrder.length, tableOrder };
    assert.throws(() => validateRlsMigrationContracts({ ...fixture, manifest }), /POSTGRES_RLS_MANIFEST_TABLES_INVALID/);
  }
});
