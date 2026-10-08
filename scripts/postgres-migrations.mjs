import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import process from "node:process";
import { resolve } from "node:path";
import {
  assertMigrationConnectionUrl, createMigrationClient,
  deployMigrationOnReservedConnection, deployBaselineOnReservedConnection,
  MigrationGuardError,
} from "./postgres-migration-guard.mjs";
import {
  BASELINE_BOUNDARY, BASELINE_ID, classifyBaselineState,
  migrationsAfterBoundary, validateBaselineFiles,
} from "./postgres-baseline.mjs";
import { classifyMigrationApplicability } from "./postgres-migration-applicability.mjs";
import { validateHistoricalMigrationLedger } from "./postgres-historical-ledger.mjs";
import { migrationTransactionBody } from "./postgres-migration-transaction.mjs";
import {
  readOwnedPostgresReceipt, inspectOwnedPostgresContainer, getPublishedPostgresPort,
} from "./owned-postgres-container.mjs";

const migrationsDirectory = resolve("db/postgres/migrations");
const command = process.argv[2] ?? "validate";
let migrations;
let runner;
try {
  await main();
} catch (error) {
  // Never print driver messages, stack traces, URLs, query text or credentials.
  console.error(error instanceof MigrationGuardError ? error.code : safeErrorCode(error));
  process.exitCode = 1;
} finally {
  if (runner) {
    try { await runner.close(); }
    catch { console.error("POSTGRES_MIGRATION_CONNECTION_CLEANUP_FAILED"); process.exitCode = 1; }
  }
}

async function main() {
  if (!["validate", "status", "deploy"].includes(command)) fail("POSTGRES_MIGRATION_COMMAND_INVALID");
  migrations = await loadMigrations();
  const validation = validateMigrations(migrations);
  if (command === "validate") {
    const baseline = await validateBaselineFiles();
    migrationTransactionBody(baseline.artifact);
    console.log("POSTGRES_MIGRATIONS_VALID files=" + validation.fileCount + " tables=" + validation.tableCount + " checksum=" + validation.checksum);
    return;
  }
  if (process.env.POSTGRES_MIGRATION_USE_PSQL === "1") fail("MIGRATION_GUARD_SINGLE_SESSION_REQUIRED");
  if (command === "deploy" && (!process.argv.includes("--confirm") ||
    process.env.POSTGRES_MIGRATION_APPROVED !== "APPLY_REVIEWED_MIGRATIONS"
  )) fail("POSTGRES_MIGRATION_APPROVAL_REQUIRED");
  const migrationUrl = process.env.POSTGRES_MIGRATION_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!migrationUrl) fail("DIRECT_URL_REQUIRED");
  runner = await createPostgresMigrationRunner(migrationUrl);
  const { state, baselineRelationExists, appliedMigrationIds } = await inspectDatabaseState(runner);
  if (["AMBIGUOUS_NONEMPTY", "PARTIAL_BASELINE", "UNKNOWN"].includes(state)) fail("POSTGRES_BASELINE_STATE_" + state);
  if (command === "status") {
    if (state === "TRUE_EMPTY") { console.log("POSTGRES_BASELINE_PENDING " + BASELINE_ID); return; }
    if (state === "BASELINE_DATABASE") {
      console.log("POSTGRES_BASELINE_APPLIED_PENDING " + (migrationsAfterBoundary(migrations, BASELINE_BOUNDARY).map(m => m.id).join(",") || "NONE"));
      return;
    }
    const applicable = state === "POST_BOUNDARY_DATABASE"
      ? migrationsAfterBoundary(migrations, BASELINE_BOUNDARY)
      : historicalApplicability(state, baselineRelationExists, appliedMigrationIds);
    const applied = new Set(appliedMigrationIds);
    const pending = applicable.map(m => m.id).filter(id => !applied.has(id));
    console.log(pending.length ? "POSTGRES_MIGRATIONS_PENDING " + pending.join(",") : "POSTGRES_MIGRATIONS_APPLIED");
    return;
  }
  if (state === "TRUE_EMPTY") {
    const result = await runner.applyBaseline();
    if (result.code !== 0) failWithDetail("POSTGRES_BASELINE_DEPLOY_FAILED", result.errorCode);
  }
  const applicable = ["TRUE_EMPTY", "BASELINE_DATABASE", "POST_BOUNDARY_DATABASE"].includes(state)
    ? migrationsAfterBoundary(migrations, BASELINE_BOUNDARY)
    : historicalApplicability(state, baselineRelationExists, appliedMigrationIds);
  // Even previously applied migrations pass through exact checksum validation.
  for (const migration of applicable) {
    const result = await runner.deployMigration(migration);
    if (result.code !== 0) failWithDetail("POSTGRES_MIGRATION_DEPLOY_FAILED", result.errorCode);
  }
  console.log("POSTGRES_MIGRATIONS_DEPLOYED");
}

function historicalApplicability(databaseState, baselineRelationExists, appliedMigrationIds) {
  const { applicable, notApplicable } = classifyMigrationApplicability(migrations, {
    databaseState, baselineRelationExists, appliedMigrationIds,
  });
  reportNotApplicableMigrations(notApplicable);
  return applicable;
}

async function createPostgresMigrationRunner(migrationUrl) {
  const registry = JSON.parse(await readFile(new URL("../db/postgres/migration-targets.json", import.meta.url), "utf8"));
  if (registry.version !== 1 || !Array.isArray(registry.approvedTargets)) fail("MIGRATION_GUARD_TARGET_REGISTRY_INVALID");
  let disposable = null;
  if (process.env.POSTGRES_MIGRATION_DISPOSABLE_RECEIPT) {
    const receipt = await readOwnedPostgresReceipt(process.env.POSTGRES_MIGRATION_DISPOSABLE_RECEIPT);
    if (!receipt?.containerId) fail("MIGRATION_GUARD_DISPOSABLE_OWNERSHIP_REQUIRED");
    const actual = await inspectOwnedPostgresContainer(receipt);
    if (!actual?.running || actual.id !== receipt.containerId || actual.name !== "/" + receipt.containerName || actual.ownerToken !== receipt.ownerToken) fail("MIGRATION_GUARD_DISPOSABLE_OWNERSHIP_MISMATCH");
    disposable = { port: Number(await getPublishedPostgresPort(receipt)) };
  }
  const ca = process.env.POSTGRES_MIGRATION_TLS_CA_FILE
    ? await readFile(process.env.POSTGRES_MIGRATION_TLS_CA_FILE, "utf8") : null;
  const plan = assertMigrationConnectionUrl(migrationUrl, { approvedTargets: registry.approvedTargets, disposable, ca });
  let postgres;
  try { postgres = (await import("postgres")).default; }
  catch { fail("POSTGRES_DRIVER_UNAVAILABLE"); }
  const sql = createMigrationClient(postgres, plan);
  const identity = { database: plan.database, role: plan.role };
  try {
    const [row] = await sql.unsafe("SELECT current_database() AS database_name, current_user AS current_user, session_user AS session_user");
    if (row?.database_name !== identity.database || row?.current_user !== identity.role || row?.session_user !== identity.role) fail("MIGRATION_GUARD_DATABASE_ROLE_MISMATCH");
  } catch (error) {
    await sql.end({ timeout: 5 });
    throw error;
  }
  console.log("MIGRATION_GUARD_CONNECTION mode=" + plan.mode + " port=" + plan.port + " driver=postgresjs tls=" + plan.tls + " authority=" + plan.provider);
  return {
    close: () => sql.end({ timeout: 5 }),
    queryRows: statement => sql.unsafe(statement),
    deployMigration: migration => deployMigrationOnReservedConnection({ sql, migration, identity }),
    applyBaseline: async () => deployBaselineOnReservedConnection({
      sql, baseline: await validateBaselineFiles(), identity,
    }),
  };
}
function reportNotApplicableMigrations(migrations) {
  for (const migration of migrations) {
    migrationTransactionBody(migration.sql);
    console.log(
      `POSTGRES_MIGRATION_NOT_APPLICABLE migration=${migration.id} lineage=HISTORICAL_DATABASE reason=BASELINE_RECEIPT_TABLE_ABSENT receipt=NONE`,
    );
  }
}

async function loadMigrations() {
  const entries = (await readdir(migrationsDirectory))
    .filter((entry) => /^\d{4}_.+\.sql$/.test(entry))
    .sort();
  if (!entries.length) fail("POSTGRES_MIGRATION_NOT_FOUND");
  return Promise.all(
    entries.map(async (entry) => {
      const path = resolve(migrationsDirectory, entry);
      const sql = await readFile(path, "utf8");
      return {
        id: entry.replace(/\.sql$/, ""),
        path,
        sql,
      };
    }),
  );
}

function validateMigrations(migrations) {
  const banned = [
    /\bPRAGMA\b/i,
    /\bAUTOINCREMENT\b/i,
    /\bINSERT\s+OR\s+/i,
    /\blast_insert_rowid\b/i,
    /`/,
    /\bDEFAULT\s+(true|false)\b/i,
  ];
  let tableCount = 0;
  for (const migration of migrations) {
    if (banned.some((pattern) => pattern.test(migration.sql))) {
      fail("POSTGRES_MIGRATION_SQLITE_SYNTAX_FOUND");
    }
    if (
      !migration.sql.trimStart().startsWith("--") ||
      !/\bBEGIN;\s*[\s\S]*\bCOMMIT;\s*$/i.test(migration.sql.trim())
    ) {
      fail("POSTGRES_MIGRATION_TRANSACTION_REQUIRED");
    }
    const registrationPattern = new RegExp(
      `INSERT\\s+INTO\\s+(?:public\\.)?app_schema_migrations\\s*\\(id,\\s*checksum\\)\\s*VALUES\\s*\\('${escapeRegExp(migration.id)}'`,
      "i",
    );
    if (!registrationPattern.test(migration.sql)) {
      fail("POSTGRES_MIGRATION_REGISTRATION_MISSING");
    }
    tableCount += [
      ...migration.sql.matchAll(/\bCREATE TABLE(?: IF NOT EXISTS)? (?:public\.)?"(?!app_schema_migrations)([^"]+)"/g),
    ].length;
  }
  return {
    fileCount: migrations.length,
    tableCount,
    checksum: createHash("sha256")
      .update(migrations.map((migration) => migration.sql).join("\n"))
      .digest("hex")
      .slice(0, 16),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function inspectDatabaseState(runner) {
  if (!runner.queryRows) return { state: "UNKNOWN", baselineRelationExists: null };
  const relationRows = await runner.queryRows(`
    SELECT count(*)::int AS count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
      AND c.relname NOT IN ('app_schema_migrations', 'app_schema_baseline_receipts')
  `);
  const appRows = await runner.queryRows(
    "SELECT to_regclass('public.app_schema_migrations') AS relation, to_regclass('public.app_schema_baseline_receipts') AS baseline_relation",
  );
  const migrationRows = appRows[0]?.relation
    ? await runner.queryRows("SELECT id, checksum FROM public.app_schema_migrations ORDER BY applied_at, id")
    : [];
  const historical = migrationRows.filter((row) => Number(row.id?.slice(0, 4)) <= Number(BASELINE_BOUNDARY));
  const postBoundary = migrationRows
    .filter((row) => Number(row.id?.slice(0, 4)) > Number(BASELINE_BOUNDARY) || Number.isNaN(Number(row.id?.slice(0, 4))))
    .map((row) => row.id);
  const baseline = appRows[0]?.baseline_relation
    ? await runner.queryRows(`SELECT count(*)::int AS count, bool_and(baseline_id = '${BASELINE_ID}' AND schema_boundary = '${BASELINE_BOUNDARY}') AS valid FROM public.app_schema_baseline_receipts`)
    : [{ count: 0, valid: false }];
  let historicalReceiptsValid = false;
  if (Number(baseline[0]?.count ?? 0) === 0 && historical.length) {
    try {
      historicalReceiptsValid = validateHistoricalMigrationLedger(migrations, {
        migrationRows,
        baselineRelationExists: Boolean(appRows[0]?.baseline_relation),
      });
    } catch (error) {

      if (error instanceof MigrationGuardError) fail(error.code);
      throw error;
    }
  }
  const state = classifyBaselineState({
    applicationRelationCount: Number(relationRows[0]?.count ?? 0),
    historicalReceiptCount: historical.length,
    baselineReceiptCount: Number(baseline[0]?.count ?? 0),
    baselineReceiptValid: Boolean(baseline[0]?.valid),
    historicalReceiptsValid,
    postBoundaryMigrationIds: postBoundary,
    expectedPostBoundaryMigrationIds: migrationsAfterBoundary(migrations, BASELINE_BOUNDARY).map((migration) => migration.id),
  });
  return {
    state,
    baselineRelationExists: Boolean(appRows[0]?.baseline_relation),
    appliedMigrationIds: migrationRows.map((row) => row.id),
  };
}

function fail(code) { throw new MigrationGuardError(code); }
function failWithDetail(code, detail) { fail(detail ? code + ":" + detail : code); }
function safeErrorCode(error) {
  const code = error?.code;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "POSTGRES_MIGRATION_FAILED";
}
