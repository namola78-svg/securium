import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { resolve } from "node:path";
import {
  assertMigrationConnectionUrl,
  deployMigrationOnReservedConnection,
  MigrationGuardError,
} from "./postgres-migration-guard.mjs";
import {
  BASELINE_BOUNDARY,
  BASELINE_ID,
  classifyBaselineState,
  migrationsAfterBoundary,
  validateBaselineFiles,
} from "./postgres-baseline.mjs";

const migrationsDirectory = resolve("db/postgres/migrations");
const command = process.argv[2] ?? "validate";

if (!["validate", "status", "deploy"].includes(command)) {
  fail("POSTGRES_MIGRATION_COMMAND_INVALID");
}

const migrations = await loadMigrations();
const validation = validateMigrations(migrations);

if (command === "validate") {
  await validateBaselineFiles();
  console.log(
    `POSTGRES_MIGRATIONS_VALID files=${validation.fileCount} tables=${validation.tableCount} checksum=${validation.checksum}`,
  );
  process.exit(0);
}

const migrationUrls = resolveMigrationUrls();
if (!migrationUrls.length) fail("DIRECT_URL_REQUIRED");
if (
  command === "deploy" &&
  process.env.POSTGRES_MIGRATION_USE_PSQL === "1"
) {
  fail("MIGRATION_GUARD_SINGLE_SESSION_REQUIRED");
}
let runnerIndex = 0;
let runner = await createPostgresMigrationRunner(migrationUrls[runnerIndex]);

if (command === "status") {
  const state = await inspectDatabaseState(runner);
  if (state === "TRUE_EMPTY") {
    await runner.close();
    console.log(`POSTGRES_BASELINE_PENDING ${BASELINE_ID}`);
    process.exit(0);
  }
  if (state === "BASELINE_DATABASE") {
    await runner.close();
    console.log(`POSTGRES_BASELINE_APPLIED_PENDING ${migrationsAfterBoundary(migrations, BASELINE_BOUNDARY).map((migration) => migration.id).join(",") || "NONE"}`);
    process.exit(0);
  }
  if (state === "POST_BOUNDARY_DATABASE") {
    const result = await queryWithConnectionFallback(
      "SELECT id FROM app_schema_migrations ORDER BY applied_at",
    );
    await runner.close();
    if (result.code !== 0) failWithDetail("POSTGRES_MIGRATION_STATUS_FAILED", result.errorCode);
    const applied = new Set(result.stdout.split(/\r?\n/).filter(Boolean));
    const pending = migrationsAfterBoundary(migrations, BASELINE_BOUNDARY)
      .map((migration) => migration.id)
      .filter((id) => !applied.has(id));
    console.log(
      pending.length
        ? `POSTGRES_MIGRATIONS_PENDING ${pending.join(",")}`
        : "POSTGRES_MIGRATIONS_APPLIED",
    );
    process.exit(0);
  }
  if (["AMBIGUOUS_NONEMPTY", "PARTIAL_BASELINE", "UNKNOWN"].includes(state)) {
    await runner.close();
    fail(`POSTGRES_BASELINE_STATE_${state}`);
  }
  const result = await queryWithConnectionFallback(
    "SELECT id FROM app_schema_migrations ORDER BY applied_at",
  );
  await runner.close();
  if (result.errorCode === "42P01") {
    console.log(
      `POSTGRES_MIGRATIONS_PENDING ${migrations
        .map((migration) => migration.id)
        .join(",")}`,
    );
    process.exit(0);
  }
  if (result.code !== 0) {
    failWithDetail("POSTGRES_MIGRATION_STATUS_FAILED", result.errorCode);
  }
  const applied = new Set(result.stdout.split(/\r?\n/).filter(Boolean));
  const pending = migrations
    .map((migration) => migration.id)
    .filter((id) => !applied.has(id));
  console.log(
    pending.length
      ? `POSTGRES_MIGRATIONS_PENDING ${pending.join(",")}`
      : "POSTGRES_MIGRATIONS_APPLIED",
  );
  process.exit(0);
}

if (
  !process.argv.includes("--confirm") ||
  process.env.POSTGRES_MIGRATION_APPROVED !== "APPLY_REVIEWED_MIGRATIONS"
) {
  fail("POSTGRES_MIGRATION_APPROVAL_REQUIRED");
}
const databaseState = await inspectDatabaseState(runner);
if (["AMBIGUOUS_NONEMPTY", "PARTIAL_BASELINE", "UNKNOWN"].includes(databaseState)) {
  await runner.close();
  fail(`POSTGRES_BASELINE_STATE_${databaseState}`);
}
if (databaseState === "TRUE_EMPTY") {
  await validateBaselineFiles();
  await runner.applyBaseline();
}
let migrationsToApply;
if (databaseState === "TRUE_EMPTY" || databaseState === "BASELINE_DATABASE") {
  migrationsToApply = migrationsAfterBoundary(migrations, BASELINE_BOUNDARY);
} else if (databaseState === "POST_BOUNDARY_DATABASE") {
  const result = await queryWithConnectionFallback(
    "SELECT id FROM app_schema_migrations ORDER BY applied_at",
  );
  if (result.code !== 0) {
    await runner.close();
    failWithDetail("POSTGRES_MIGRATION_STATUS_FAILED", result.errorCode);
  }
  const applied = new Set(result.stdout.split(/\r?\n/).filter(Boolean));
  migrationsToApply = migrationsAfterBoundary(migrations, BASELINE_BOUNDARY)
    .filter((migration) => !applied.has(migration.id));
} else {
  migrationsToApply = migrations;
}
for (const migration of migrationsToApply) {
  const result = await runner.deployMigration(migration);
  if (result.code !== 0) {
    failWithDetail("POSTGRES_MIGRATION_DEPLOY_FAILED", result.errorCode);
  }
}
await runner.close();
console.log("POSTGRES_MIGRATIONS_DEPLOYED");

async function queryWithConnectionFallback(statement) {
  while (true) {
    const result = await runner.query(statement);
    if (
      result.code === 0 ||
      !isConnectionFallbackError(result.errorCode) ||
      runnerIndex >= migrationUrls.length - 1
    ) {
      return result;
    }
    await runner.close();
    runnerIndex += 1;
    runner = await createPostgresMigrationRunner(migrationUrls[runnerIndex]);
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
      ...migration.sql.matchAll(/\bCREATE TABLE(?: IF NOT EXISTS)? "(?!app_schema_migrations)([^"]+)"/g),
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

function resolveMigrationUrls() {
  const explicitUrl = process.env.POSTGRES_MIGRATION_URL?.trim();
  if (explicitUrl) return [explicitUrl];
  return uniqueValues([
    process.env.DIRECT_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
  ]);
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isConnectionFallbackError(code) {
  return [
    "EACCES",
    "ECONNREFUSED",
    "ENETUNREACH",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ETIMEDOUT",
  ].includes(code);
}

async function createPostgresMigrationRunner(directUrl) {
  let connectionPlan = null;
  if (command === "deploy") {
    try {
      connectionPlan = assertMigrationConnectionUrl(directUrl);
    } catch (error) {
      if (error instanceof MigrationGuardError) fail(error.code);
      fail("DIRECT_URL_INVALID");
    }
  }
  const preferPsql = process.env.POSTGRES_MIGRATION_USE_PSQL === "1";
  const connectionEnvironment = preferPsql
    ? createLibpqEnvironment(directUrl)
    : null;
  const psql = preferPsql ? await maybeFindPsql() : null;
  if (psql) {
    return {
      close: async () => {},
      deployMigration: async () => ({
        code: 1,
        stdout: "",
        ddlStarted: false,
        errorCode: "MIGRATION_GUARD_SINGLE_SESSION_REQUIRED",
      }),
      query: (sql) =>
        runProcess(psql, ["-At", "-c", sql], connectionEnvironment),
    };
  }

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    if (preferPsql) fail("PSQL_NOT_AVAILABLE");
    fail("POSTGRES_DRIVER_UNAVAILABLE");
  }
  const sql = postgres(directUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name: "securium-postgres-migrations",
    },
  });
  if (command === "deploy") {
    console.log(
      `MIGRATION_GUARD_CONNECTION mode=${connectionPlan?.mode} port=${connectionPlan?.port} driver=postgresjs`,
    );
  }
  return {
    close: async () => {
      await sql.end({ timeout: 5 });
    },
    deployMigration: (migration) =>
      deployMigrationOnReservedConnection({ sql, migration }),
    query: async (statement) => {
      try {
        const rows = await sql.unsafe(statement);
        return {
          code: 0,
          stdout: rows
            .map((row) => Object.values(row).join("|"))
            .join("\n"),
        };
      } catch (error) {
        return { code: 1, errorCode: safeErrorCode(error), stdout: "" };
      }
    },
    queryRows: async (statement) => sql.unsafe(statement),
    applyBaseline: async () => {
      const baseline = await validateBaselineFiles();
      const reserved = await sql.reserve();
      try {
        await reserved.unsafe(`SET securium.baseline_artifact_sha256 = '${baseline.manifest.artifactDigest}'`);
        await reserved.unsafe(`SET securium.baseline_schema_sha256 = '${baseline.manifest.schemaDigest}'`);
        await reserved.unsafe(`SET securium.baseline_security_sha256 = '${baseline.manifest.securityDigest}'`);
        await reserved.unsafe(baseline.artifact);
        const receipts = await reserved.unsafe(
          `SELECT baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256
           FROM app_schema_baseline_receipts WHERE baseline_id = '${BASELINE_ID}'`,
        );
        if (receipts.length !== 1 || receipts[0].artifact_sha256 !== baseline.manifest.artifactDigest || receipts[0].schema_sha256 !== baseline.manifest.schemaDigest || receipts[0].security_sha256 !== baseline.manifest.securityDigest) {
          throw new Error("POSTGRES_BASELINE_RECEIPT_VERIFICATION_FAILED");
        }
      } finally {
        await reserved.release();
      }
    },
  };
}

async function inspectDatabaseState(runner) {
  if (!runner.queryRows) return "UNKNOWN";
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
    ? await runner.queryRows("SELECT id FROM public.app_schema_migrations ORDER BY applied_at, id")
    : [];
  const historical = migrationRows.filter((row) => Number(row.id?.slice(0, 4)) <= Number(BASELINE_BOUNDARY));
  const postBoundary = migrationRows
    .filter((row) => Number(row.id?.slice(0, 4)) > Number(BASELINE_BOUNDARY) || Number.isNaN(Number(row.id?.slice(0, 4))))
    .map((row) => row.id);
  const baseline = appRows[0]?.baseline_relation
    ? await runner.queryRows(`SELECT count(*)::int AS count, bool_and(baseline_id = '${BASELINE_ID}' AND schema_boundary = '${BASELINE_BOUNDARY}') AS valid FROM public.app_schema_baseline_receipts`)
    : [{ count: 0, valid: false }];
  return classifyBaselineState({
    applicationRelationCount: Number(relationRows[0]?.count ?? 0),
    historicalReceiptCount: historical.length,
    baselineReceiptCount: Number(baseline[0]?.count ?? 0),
    baselineReceiptValid: Boolean(baseline[0]?.valid),
    historicalReceiptsValid: true,
    postBoundaryMigrationIds: postBoundary,
    expectedPostBoundaryMigrationIds: migrationsAfterBoundary(migrations, BASELINE_BOUNDARY).map((migration) => migration.id),
  });
}

async function maybeFindPsql() {
  const candidates =
    process.platform === "win32"
      ? ["psql.exe", "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"]
      : ["psql"];
  for (const candidate of candidates) {
    try {
      if (candidate.includes("\\") || candidate.includes("/")) {
        await access(candidate);
      }
      const result = await runProcess(candidate, ["--version"], process.env);
      if (result.code === 0) return candidate;
    } catch {
      // Try the next approved local executable.
    }
  }
  return null;
}

function createLibpqEnvironment(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("DIRECT_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    fail("DIRECT_URL_INVALID");
  }
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };
}

function runProcess(executable, args, environment) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", () => {});
    child.on("error", () => resolvePromise({ code: 1, stdout: "" }));
    child.on("close", (code) =>
      resolvePromise({ code: code ?? 1, stdout }),
    );
  });
}

function fail(code) {
  console.error(code);
  process.exit(1);
}

function failWithDetail(code, detail) {
  console.error(detail ? `${code}:${detail}` : code);
  process.exit(1);
}

function safeErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  const name = "name" in error ? error.name : undefined;
  if (typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)) return name;
  return "UNKNOWN";
}
