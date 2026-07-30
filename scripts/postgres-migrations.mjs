import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import process from "node:process";
import { resolve } from "node:path";

const migrationsDirectory = resolve("db/postgres/migrations");
const command = process.argv[2] ?? "validate";

if (!["validate", "status", "deploy"].includes(command)) {
  fail("POSTGRES_MIGRATION_COMMAND_INVALID");
}

const migrations = await loadMigrations();
const validation = validateMigrations(migrations);

if (command === "validate") {
  console.log(
    `POSTGRES_MIGRATIONS_VALID files=${validation.fileCount} tables=${validation.tableCount} checksum=${validation.checksum}`,
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
for (const migration of migrations) {
  const status = await runPsql(psql, connectionEnvironment, [
    "-At",
    "-c",
    `SELECT id FROM app_schema_migrations WHERE id = '${migration.id.replaceAll("'", "''")}'`,
  ]);
  if (status.code !== 0) fail("POSTGRES_MIGRATION_STATUS_FAILED");
  if (status.stdout.trim() === migration.id) continue;
  const result = await runPsql(psql, connectionEnvironment, [
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    migration.path,
  ]);
  if (result.code !== 0) fail("POSTGRES_MIGRATION_DEPLOY_FAILED");
}
console.log("POSTGRES_MIGRATIONS_DEPLOYED");

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
