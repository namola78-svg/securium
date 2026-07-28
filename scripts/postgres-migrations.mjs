import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { resolve } from "node:path";

const migrationPath = resolve(
  "db/postgres/migrations/0001_d1_compatibility_schema.sql",
);
const command = process.argv[2] ?? "validate";

if (!["validate", "status", "deploy"].includes(command)) {
  fail("POSTGRES_MIGRATION_COMMAND_INVALID");
}

const sql = await readFile(migrationPath, "utf8");
const validation = validateMigration(sql);

if (command === "validate") {
  console.log(
    `POSTGRES_MIGRATION_VALID tables=${validation.tableCount} checksum=${validation.checksum}`,
  );
  process.exit(0);
}

const directUrl = process.env.DIRECT_URL?.trim();
if (!directUrl) fail("DIRECT_URL_REQUIRED");
const psql = await findPsql();
const connectionEnvironment = createLibpqEnvironment(directUrl);

if (command === "status") {
  const result = await runPsql(psql, connectionEnvironment, [
    "-At",
    "-c",
    "SELECT id FROM app_schema_migrations ORDER BY applied_at",
  ]);
  if (result.code !== 0) fail("POSTGRES_MIGRATION_STATUS_FAILED");
  console.log(
    result.stdout.includes("0001_d1_compatibility_schema")
      ? "POSTGRES_MIGRATION_APPLIED"
      : "POSTGRES_MIGRATION_PENDING",
  );
  process.exit(0);
}

if (
  !process.argv.includes("--confirm") ||
  process.env.POSTGRES_MIGRATION_APPROVED !== "APPLY_REVIEWED_MIGRATIONS"
) {
  fail("POSTGRES_MIGRATION_APPROVAL_REQUIRED");
}
const result = await runPsql(psql, connectionEnvironment, [
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  migrationPath,
]);
if (result.code !== 0) fail("POSTGRES_MIGRATION_DEPLOY_FAILED");
console.log("POSTGRES_MIGRATION_DEPLOYED");

function validateMigration(value) {
  const banned = [
    /\bPRAGMA\b/i,
    /\bAUTOINCREMENT\b/i,
    /\bINSERT\s+OR\s+/i,
    /\blast_insert_rowid\b/i,
    /`/,
    /\bDEFAULT\s+(true|false)\b/i,
  ];
  if (banned.some((pattern) => pattern.test(value))) {
    fail("POSTGRES_MIGRATION_SQLITE_SYNTAX_FOUND");
  }
  if (!value.trim().startsWith("-- GENERATED") || !/\bCOMMIT;\s*$/i.test(value)) {
    fail("POSTGRES_MIGRATION_TRANSACTION_REQUIRED");
  }
  const tableCount =
    [...value.matchAll(/\bCREATE TABLE "(?!app_schema_migrations)([^"]+)"/g)]
      .length;
  if (tableCount !== 68) fail("POSTGRES_MIGRATION_TABLE_COUNT_INVALID");
  return {
    tableCount,
    checksum: createHash("sha256").update(value).digest("hex").slice(0, 16),
  };
}

async function findPsql() {
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
  fail("PSQL_NOT_AVAILABLE");
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

function runPsql(executable, environment, args) {
  return runProcess(executable, args, environment);
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
