import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Published LF migration bytes define the historical contract, not today's
// manifest. New manifest tables must name their own reviewed security owner.
const historicalMigrationId = "0002_server_only_rls_lockdown";
const historicalSha256 = "289b707321fab2573780f401ec65e62053e3fba7062361e86e8b5f2fd6fce1cd";
const forwardSecurityOwners = Object.freeze({
  foundation_question_bindings: Object.freeze({
    migrationId: "0050_sw_foundation_identity_version_binding",
    sha256: "ec5730411e45abf0d6a37e0c41b175c4a1e87097b955f6573ef66991f4e51043",
    requireForceRls: false,
  }),
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const manifest = JSON.parse(await readFile(resolve("db/postgres/schema-manifest.json"), "utf8"));
    const historicalSql = await readMigration(historicalMigrationId);
    const forwardMigrations = Object.fromEntries(await Promise.all(
      Object.values(forwardSecurityOwners).map(async ({ migrationId }) => [migrationId, await readMigration(migrationId)]),
    ));
    const result = validateRlsMigrationContracts({ manifest, historicalSql, forwardMigrations });
    // Both the legacy generation command and --check are now read-only. Never
    // regenerate a published migration from a changing application manifest.
    console.log(`POSTGRES_RLS_MIGRATION_VALID tables=${result.currentTableCount} historical_tables=${result.historicalTableCount} forward_tables=${result.forwardTableCount}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

async function readMigration(id) {
  return readFile(resolve(`db/postgres/migrations/${id}.sql`), "utf8");
}

export function validateRlsMigrationContracts({ manifest, historicalSql, forwardMigrations }) {
  if (!Array.isArray(manifest.tableOrder) || manifest.tableCount !== manifest.tableOrder.length) {
    fail("POSTGRES_RLS_MANIFEST_TABLES_INVALID");
  }
  const tableNames = ["app_schema_migrations", ...manifest.tableOrder];
  tableNames.forEach(identifier);
  if (new Set(tableNames).size !== tableNames.length) fail("POSTGRES_RLS_MANIFEST_TABLES_INVALID");
  if (digest(historicalSql) !== historicalSha256) fail("POSTGRES_RLS_IMMUTABLE_MIGRATION_CHANGED");
  const historicalNames = [...historicalSql.matchAll(/^ALTER TABLE public\."([^"]+)" ENABLE ROW LEVEL SECURITY;$/gm)].map(match => match[1]);
  if (historicalSql !== buildMigration(historicalNames)) fail("POSTGRES_RLS_MIGRATION_OUT_OF_DATE");
  validateMigration(historicalSql, historicalNames.length);
  if (historicalNames.some(name => !tableNames.includes(name)) ||
      Object.keys(forwardSecurityOwners).some(name => !tableNames.includes(name))) {
    fail("POSTGRES_RLS_MANIFEST_TABLES_INVALID");
  }
  const laterNames = tableNames.filter(name => !historicalNames.includes(name));
  for (const name of laterNames) {
    const owner = forwardSecurityOwners[name];
    if (!owner) fail(`POSTGRES_RLS_SECURITY_OWNER_MISSING table=${name}`);
    const source = forwardMigrations[owner.migrationId];
    if (typeof source !== "string") fail(`POSTGRES_RLS_SECURITY_MIGRATION_MISSING table=${name}`);
    const sql = source.replace(/\/\*[\s\S]*?\*\/|--[^\r\n]*/g, "").replace(/\s+/g, " ");
    const table = `public.${identifier(name)}`;
    if (!sql.includes(`CREATE TABLE ${table} (`) ||
        !sql.includes(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM PUBLIC, anon, authenticated;`) ||
        !sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`) ||
        (owner.requireForceRls && !sql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`))) {
      fail(`POSTGRES_RLS_TABLE_PROTECTION_MISSING table=${name} migration=${owner.migrationId}`);
    }
    validateMigration(source, 1);
    if (/\bDISABLE ROW LEVEL SECURITY\b/i.test(sql)) fail("POSTGRES_RLS_TABLE_PROTECTION_DISABLED");
    // Also reject edits that preserve matching snippets but change the published
    // contract elsewhere (e.g. hiding protection in a string or granting access).
    if (digest(source) !== owner.sha256) fail(`POSTGRES_RLS_IMMUTABLE_MIGRATION_CHANGED migration=${owner.migrationId}`);
  }
  return { currentTableCount: tableNames.length, historicalTableCount: historicalNames.length, forwardTableCount: laterNames.length };
}

function digest(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

function buildMigration(names) {
  const lines = [
    "-- GENERATED from db/postgres/schema-manifest.json.",
    "-- Server-only access lockdown. Production execution requires explicit approval.",
    "BEGIN;",
    "",
    "-- Browser clients must not access application tables through the Data API.",
  ];

  for (const name of names) {
    lines.push(
      `REVOKE ALL PRIVILEGES ON TABLE public.${identifier(name)} FROM PUBLIC, anon, authenticated;`,
      `ALTER TABLE public.${identifier(name)} ENABLE ROW LEVEL SECURITY;`,
    );
  }

  lines.push(
    "",
    "-- Keep future postgres-owned objects closed unless a reviewed migration grants access.",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    "  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    "  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    "  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;",
    "",
    "INSERT INTO public.app_schema_migrations (id, checksum)",
    "VALUES ('0002_server_only_rls_lockdown', 'server-only-lockdown-001')",
    "ON CONFLICT (id) DO NOTHING;",
    "",
    "COMMIT;",
    "",
  );
  return lines.join("\n");
}

function validateMigration(value, expectedTableCount) {
  if (!/\bBEGIN;/.test(value) || !/\bCOMMIT;\s*$/i.test(value)) {
    fail("POSTGRES_RLS_MIGRATION_TRANSACTION_REQUIRED");
  }
  const enabledCount = [
    ...value.matchAll(/\bENABLE ROW LEVEL SECURITY\b/g),
  ].length;
  const revokeCount = [
    ...value.matchAll(/\bREVOKE ALL PRIVILEGES ON TABLE\b/g),
  ].length;
  if (enabledCount !== expectedTableCount || revokeCount !== expectedTableCount) {
    fail("POSTGRES_RLS_MIGRATION_TABLE_COUNT_INVALID");
  }
  if (
    /\bCREATE POLICY\b/i.test(value) ||
    /\bGRANT\b[\s\S]*\b(?:anon|authenticated)\b/i.test(value)
  ) {
    fail("POSTGRES_RLS_MIGRATION_DIRECT_CLIENT_ACCESS_FOUND");
  }
}

function identifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Unsafe identifier: ${value}`);
  }
  return `"${value}"`;
}

function fail(code) {
  throw new Error(code);
}
