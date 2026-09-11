import { spawn } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { loadSecureCoding8HRuntimeModel } from "../lib/services/secure-coding-8h-runtime-adapter.ts";

const REGISTRATION_RECORD = Object.freeze({
  id: "developer-secure-coding-8h-python-vibe",
  courseGroupId: "group-independent",
  code: "SECURE_CODING_8H",
  slug: "secure-coding-8h-python-vibe",
  name: "Securium Developer Secure Coding 8H",
  shortName: "SC8H",
  description: "Securium Developer Secure Coding 8H",
  totalLevels: 8,
  passingScore: 60,
  difficulty: "INTERMEDIATE",
  active: false,
  published: false,
  displayOrder: 8,
  isSample: false,
});

const REGISTRATION_CONFIRMATION = "SECURE_CODING_8H_NONPROD_REGISTRATION";
const NONPRODUCTION_TARGET = "NONPRODUCTION";

export { REGISTRATION_RECORD };

export function buildCourseLookupSql() {
  return [
    "SELECT id, course_group_id, code, slug, name, short_name, description,",
    "thumbnail_url, total_levels, passing_score, difficulty, active, published,",
    "display_order, is_sample, deleted_at",
    "FROM courses",
    `WHERE id = ${sqlString(REGISTRATION_RECORD.id)}`,
    `OR code = ${sqlString(REGISTRATION_RECORD.code)}`,
    `OR slug = ${sqlString(REGISTRATION_RECORD.slug)}`,
    "ORDER BY id",
  ].join(" ");
}

export function buildCourseGroupLookupSql() {
  return `SELECT id FROM course_groups WHERE id = ${sqlString(REGISTRATION_RECORD.courseGroupId)} LIMIT 2`;
}

export function buildRegistrationInsertSql(dialect) {
  if (dialect !== "d1" && dialect !== "postgres") {
    throw registrationError("INTERNAL_ERROR", "Unsupported registration SQL dialect.");
  }
  // The course visibility flags are integer-backed booleans in both D1 and
  // PostgreSQL. Keep this encoding local to this INSERT; it is not a global
  // conversion for columns that are genuinely PostgreSQL boolean-typed.
  const integerBoolean = (value) => (value ? "1" : "0");
  return [
    "INSERT INTO courses",
    "(id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample)",
    "VALUES",
    `(${sqlString(REGISTRATION_RECORD.id)}, ${sqlString(REGISTRATION_RECORD.courseGroupId)}, ${sqlString(REGISTRATION_RECORD.code)}, ${sqlString(REGISTRATION_RECORD.slug)}, ${sqlString(REGISTRATION_RECORD.name)}, ${sqlString(REGISTRATION_RECORD.shortName)}, ${sqlString(REGISTRATION_RECORD.description)}, ${REGISTRATION_RECORD.totalLevels}, ${REGISTRATION_RECORD.passingScore}, ${sqlString(REGISTRATION_RECORD.difficulty)}, ${integerBoolean(REGISTRATION_RECORD.active)}, ${integerBoolean(REGISTRATION_RECORD.published)}, ${REGISTRATION_RECORD.displayOrder}, ${integerBoolean(REGISTRATION_RECORD.isSample)})`,
  ].join(" ");
}

export function normalizeCourseRow(row) {
  if (!row || typeof row !== "object") {
    throw registrationError("RUNTIME_IDENTITY_MISMATCH", "Course read-back is invalid.");
  }
  return {
    id: String(row.id ?? ""),
    courseGroupId: String(row.course_group_id ?? row.courseGroupId ?? ""),
    code: String(row.code ?? ""),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    shortName: String(row.short_name ?? row.shortName ?? ""),
    description: String(row.description ?? ""),
    thumbnailUrl: row.thumbnail_url ?? row.thumbnailUrl ?? null,
    totalLevels: Number(row.total_levels ?? row.totalLevels),
    passingScore: Number(row.passing_score ?? row.passingScore),
    difficulty: String(row.difficulty ?? ""),
    active: toBoolean(row.active),
    published: toBoolean(row.published),
    displayOrder: Number(row.display_order ?? row.displayOrder),
    isSample: toBoolean(row.is_sample ?? row.isSample),
    deletedAt: row.deleted_at ?? row.deletedAt ?? null,
  };
}

export function classifyExistingCourseRows(rows) {
  if (!Array.isArray(rows)) {
    throw registrationError("INTERNAL_ERROR", "Course lookup result is invalid.");
  }
  if (rows.length === 0) return "INSERT_REQUIRED";
  if (rows.length !== 1) {
    throw registrationError(
      "IDENTITY_COLLISION",
      "Multiple runtime rows match the Secure Coding identity.",
    );
  }
  assertExactRegistrationRow(normalizeCourseRow(rows[0]));
  return "IDEMPOTENT_NOOP";
}

export function assertExactRegistrationRow(row) {
  const expected = REGISTRATION_RECORD;
  const checks = [
    [row.id, expected.id],
    [row.courseGroupId, expected.courseGroupId],
    [row.code, expected.code],
    [row.slug, expected.slug],
    [row.name, expected.name],
    [row.shortName, expected.shortName],
    [row.description, expected.description],
    [row.totalLevels, expected.totalLevels],
    [row.passingScore, expected.passingScore],
    [row.difficulty, expected.difficulty],
    [row.active, expected.active],
    [row.published, expected.published],
    [row.displayOrder, expected.displayOrder],
    [row.isSample, expected.isSample],
    [row.thumbnailUrl, null],
    [row.deletedAt, null],
  ];
  if (checks.some(([actual, wanted]) => actual !== wanted)) {
    throw registrationError(
      "RUNTIME_IDENTITY_MISMATCH",
      "Existing Secure Coding runtime metadata conflicts with the approved record.",
    );
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  loadSecureCoding8HRuntimeModel({
    runtimeCourse: {
      id: REGISTRATION_RECORD.id,
      slug: REGISTRATION_RECORD.slug,
      active: REGISTRATION_RECORD.active,
      published: REGISTRATION_RECORD.published,
      deletedAt: null,
    },
    exposure: "registration",
  });
  await runFoundationValidator();
  const result =
    options.provider === "d1-local"
      ? await registerD1Local()
      : await registerPostgresNonProduction();
  console.log(JSON.stringify({
    status: "SECURE_CODING_8H_RUNTIME_REGISTRATION_VERIFIED",
    provider: options.provider,
    created: result.created,
    idempotent: !result.created,
    courseId: REGISTRATION_RECORD.id,
    slug: REGISTRATION_RECORD.slug,
    active: REGISTRATION_RECORD.active,
    published: REGISTRATION_RECORD.published,
    isSample: REGISTRATION_RECORD.isSample,
  }));
}

async function runFoundationValidator() {
  const result = await spawnCaptured(process.execPath, [
    "scripts/validate-secure-coding-8h-foundation.mjs",
  ]);
  if (result.code !== 0) {
    throw registrationError(
      "FOUNDATION_INVALID",
      "The canonical Secure Coding Foundation validator did not pass.",
    );
  }
}

function parseOptions(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(
      "Usage: node scripts/register-secure-coding-8h-runtime.mjs --provider=d1-local|postgres",
    );
    process.exit(0);
  }
  if (args.length !== 1 || !args[0].startsWith("--provider=")) {
    throw registrationError(
      "REGISTRATION_TARGET_REQUIRED",
      "Choose exactly one fixed non-production provider target.",
    );
  }
  const provider = args[0].slice("--provider=".length);
  if (provider !== "d1-local" && provider !== "postgres") {
    throw registrationError("REGISTRATION_TARGET_INVALID", "Provider target is invalid.");
  }
  return { provider };
}

async function registerD1Local() {
  const groupRows = parseD1Rows(
    await runWrangler(["--command", buildCourseGroupLookupSql()]),
  );
  if (groupRows.length !== 1 || groupRows[0]?.id !== REGISTRATION_RECORD.courseGroupId) {
    throw registrationError("COURSE_GROUP_MISSING", "The existing independent course group is unavailable.");
  }

  const before = parseD1Rows(
    await runWrangler(["--command", buildCourseLookupSql()]),
  );
  const decision = classifyExistingCourseRows(before);
  if (decision === "INSERT_REQUIRED") {
    await runWrangler(["--command", buildRegistrationInsertSql("d1")]);
  }
  const after = parseD1Rows(
    await runWrangler(["--command", buildCourseLookupSql()]),
  );
  if (after.length !== 1) {
    throw registrationError("RUNTIME_IDENTITY_MISMATCH", "D1 registration read-back was not exactly one row.");
  }
  assertExactRegistrationRow(normalizeCourseRow(after[0]));
  return { created: decision === "INSERT_REQUIRED" };
}

async function registerPostgresNonProduction() {
  if (process.env.SECURIUM_RUNTIME_REGISTRATION_TARGET !== NONPRODUCTION_TARGET) {
    throw registrationError("NONPRODUCTION_TARGET_REQUIRED", "PostgreSQL registration requires an explicit non-production target.");
  }
  if (process.env.SECURIUM_RUNTIME_REGISTRATION_CONFIRM !== REGISTRATION_CONFIRMATION) {
    throw registrationError("REGISTRATION_CONFIRMATION_REQUIRED", "PostgreSQL registration confirmation is invalid.");
  }
  const connectionUrl = process.env.POSTGRES_SEED_URL?.trim();
  if (!connectionUrl) {
    throw registrationError("POSTGRES_SEED_URL_REQUIRED", "Use only an explicitly supplied non-production seed URL.");
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw registrationError("POSTGRES_SEED_URL_INVALID", "The PostgreSQL seed URL is invalid.");
  }
  if (!/^postgres(?:ql)?:$/.test(parsedUrl.protocol) || /prod/i.test(parsedUrl.hostname)) {
    throw registrationError("POSTGRES_SEED_URL_INVALID", "The PostgreSQL target is not accepted as non-production.");
  }

  const { default: postgres } = await import("postgres");
  const sql = postgres(connectionUrl, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 10,
    ssl: "require",
  });
  try {
    const result = await sql.begin(async (transaction) => {
      const groupRows = await transaction.unsafe(buildCourseGroupLookupSql());
      if (groupRows.length !== 1 || groupRows[0]?.id !== REGISTRATION_RECORD.courseGroupId) {
        throw registrationError("COURSE_GROUP_MISSING", "The existing independent course group is unavailable.");
      }
      const before = await transaction.unsafe(buildCourseLookupSql());
      const decision = classifyExistingCourseRows(before);
      if (decision === "INSERT_REQUIRED") {
        await transaction.unsafe(buildRegistrationInsertSql("postgres"));
      }
      const after = await transaction.unsafe(buildCourseLookupSql());
      if (after.length !== 1) {
        throw registrationError("RUNTIME_IDENTITY_MISMATCH", "PostgreSQL registration read-back was not exactly one row.");
      }
      assertExactRegistrationRow(normalizeCourseRow(after[0]));
      return { created: decision === "INSERT_REQUIRED" };
    });
    return result;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function runWrangler(operationArguments) {
  const result = await spawnCaptured(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    ...operationArguments,
    "--json",
  ]);
  if (result.code !== 0) {
    throw registrationError("D1_REGISTRATION_FAILED", "The local D1 registration operation failed.");
  }
  return result.stdout;
}

function parseD1Rows(output) {
  let payload;
  try {
    payload = JSON.parse(output);
  } catch {
    throw registrationError("D1_READBACK_INVALID", "The local D1 read-back was not valid JSON.");
  }
  const batches = Array.isArray(payload) ? payload : [payload];
  return batches.flatMap((batch) => (Array.isArray(batch?.results) ? batch.results : []));
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function toBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function registrationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function spawnCaptured(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
      },
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolvePromise({ code: 1, stdout }));
    child.on("exit", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

const isDirectExecution =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error?.code ?? "SECURE_CODING_8H_RUNTIME_REGISTRATION_FAILED");
    process.exitCode = 1;
  });
}
