import postgres from "postgres";
import process from "node:process";

const connectionUrl =
  process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();

if (!connectionUrl) {
  fail("POSTGRES_CONNECTION_URL_REQUIRED");
}

const sql = postgres(connectionUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 5,
  onnotice: false,
  debug: false,
  connection: { application_name: "securium-runtime-status" },
});

try {
  const migrations = await sql`
    SELECT id
    FROM app_schema_migrations
    ORDER BY id
  `;
  const [tableResult] = await sql`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const [counts] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM courses) AS courses,
      (SELECT COUNT(*)::int FROM user_course_enrollments) AS enrollments,
      (SELECT COUNT(*)::int FROM questions) AS questions,
      (SELECT COUNT(*)::int FROM question_attempts) AS attempts
  `;
  console.log(
    JSON.stringify({
      ok: true,
      migrationIds: migrations.map((migration) => migration.id),
      publicTables: tableResult?.count ?? 0,
      counts,
    }),
  );
} catch (error) {
  failWithDetail("POSTGRES_RUNTIME_STATUS_FAILED", safeErrorCode(error));
} finally {
  await sql.end({ timeout: 5 });
}

function fail(code) {
  console.error(code);
  process.exitCode = 1;
}

function failWithDetail(code, detail) {
  console.error(detail ? `${code}:${detail}` : code);
  process.exitCode = 1;
}

function safeErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  const name = "name" in error ? error.name : undefined;
  if (typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)) return name;
  return "UNKNOWN";
}
