import { readFile } from "node:fs/promises";
import postgres from "postgres";

const CONFIRM_FLAG = "--confirm-production-schema";
const CONFIRM_ENV = "APPLY_SHARED_CONTENT_SCHEMA";
const migrationPath = new URL(
  "../db/postgres/migrations/0004_shared_content_lesson.sql",
  import.meta.url,
);

function fail(code, message) {
  console.error(code);
  if (message) console.error(message);
  process.exit(1);
}

if (!process.argv.includes(CONFIRM_FLAG)) {
  fail(
    "CONFIRM_FLAG_REQUIRED",
    `Run with ${CONFIRM_FLAG} only after approving the production schema change.`,
  );
}

if (process.env.SECURIUM_CONFIRM_SHARED_CONTENT_SCHEMA !== CONFIRM_ENV) {
  fail(
    "CONFIRM_ENV_REQUIRED",
    `Set SECURIUM_CONFIRM_SHARED_CONTENT_SCHEMA=${CONFIRM_ENV} before running.`,
  );
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DIRECT_URL?.trim();
const connectionUrl = databaseUrl || directUrl;
if (!connectionUrl) {
  fail(
    "DATABASE_URL_OR_DIRECT_URL_REQUIRED",
    "Set DATABASE_URL for pooled runtime access, or DIRECT_URL when direct database access is available.",
  );
}

const requiredBaseTables = [
  "users",
  "courses",
  "curriculum_nodes",
  "app_schema_migrations",
];

const sql = postgres(connectionUrl, {
  max: 1,
  idle_timeout: 1,
  connect_timeout: 15,
  ssl: "require",
});

let failed = false;

try {
  const existingTables = await sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ${sql(requiredBaseTables)}
  `;
  const existing = new Set(existingTables.map((row) => row.tablename));
  const missing = requiredBaseTables.filter((table) => !existing.has(table));
  if (missing.length) {
    fail(
      `BASE_SCHEMA_MISSING:${missing.join(",")}`,
      "Apply the base PostgreSQL migrations before the shared content schema.",
    );
  }

  const migrationSql = await readFile(migrationPath, "utf8");
  if (!migrationSql.includes("CREATE TABLE IF NOT EXISTS \"contents\"")) {
    fail("SHARED_CONTENT_MIGRATION_UNEXPECTED");
  }

  await sql.unsafe(migrationSql);

  const sharedTables = [
    "contents",
    "course_lessons",
    "course_lesson_extensions",
    "user_course_lesson_progress",
  ];
  const rows = await sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ${sql(sharedTables)}
  `;
  const created = new Set(rows.map((row) => row.tablename));
  const stillMissing = sharedTables.filter((table) => !created.has(table));
  if (stillMissing.length) {
    fail(`SHARED_CONTENT_SCHEMA_STILL_MISSING:${stillMissing.join(",")}`);
  }

  console.log(
    JSON.stringify({
      status: "SHARED_CONTENT_SCHEMA_APPLIED",
      tables: sharedTables.length,
    }),
  );
} catch (error) {
  console.error(
    `SHARED_CONTENT_SCHEMA_FAILED:${error.code || error.name || "UNKNOWN"}`,
  );
  failed = true;
} finally {
  await sql.end({ timeout: 1 });
}

if (failed) process.exit(1);
