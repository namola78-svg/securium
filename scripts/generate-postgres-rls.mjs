import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve("db/postgres/schema-manifest.json");
const outputPath = resolve(
  "db/postgres/migrations/0002_server_only_rls_lockdown.sql",
);
const checkOnly = process.argv.includes("--check");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const tableNames = ["app_schema_migrations", ...manifest.tableOrder];
const sql = buildMigration(tableNames);

validateMigration(sql, tableNames.length);

if (checkOnly) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== sql) {
    console.error("POSTGRES_RLS_MIGRATION_OUT_OF_DATE");
    process.exit(1);
  }
  console.log(`POSTGRES_RLS_MIGRATION_VALID tables=${tableNames.length}`);
} else {
  await writeFile(outputPath, sql, "utf8");
  console.log(`POSTGRES_RLS_MIGRATION_GENERATED tables=${tableNames.length}`);
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
  if (!value.startsWith("-- GENERATED") || !/\bCOMMIT;\s*$/i.test(value)) {
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
  console.error(code);
  process.exit(1);
}
