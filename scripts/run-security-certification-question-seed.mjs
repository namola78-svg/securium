import postgres from "postgres";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  APPLICATION_SECURITY_CONTENT_ID,
  APPLICATION_SECURITY_COURSE_IDS,
  SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_VALUE,
  generateApplicationSecurityQuestionSeedSql,
  getApplicationSecurityQuestionBankReadiness,
} from "../lib/data/security-certification-application-security-questions.mjs";
import {
  INFORMATION_SECURITY_GENERAL_CONTENT_ID,
  INFORMATION_SECURITY_GENERAL_COURSE_IDS,
  SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_VALUE,
  generateInformationSecurityGeneralQuestionSeedSql,
  getInformationSecurityGeneralQuestionBankReadiness,
} from "../lib/data/security-certification-information-security-general-questions.mjs";

const CONFIRM_FLAG = "--confirm-production-seed";
const domains = {
  "application-security": {
    label: "APPLICATION_SECURITY",
    contentId: APPLICATION_SECURITY_CONTENT_ID,
    courseIds: APPLICATION_SECURITY_COURSE_IDS,
    questionPattern: "application-security-official-sample-q%",
    tempPrefix: "securium-application-security-questions-",
    tempFileName: "application-security-questions.d1.sql",
    applicationName: "securium-application-security-question-seed",
    confirmEnvName: SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_NAME,
    confirmEnvValue: SECURITY_CERTIFICATION_APPLICATION_QUESTION_CONFIRM_ENV_VALUE,
    readiness: getApplicationSecurityQuestionBankReadiness,
    seedSql: generateApplicationSecurityQuestionSeedSql,
  },
  "information-security-general": {
    label: "INFORMATION_SECURITY_GENERAL",
    contentId: INFORMATION_SECURITY_GENERAL_CONTENT_ID,
    courseIds: INFORMATION_SECURITY_GENERAL_COURSE_IDS,
    questionPattern: "information-security-general-official-sample-q%",
    tempPrefix: "securium-information-security-general-questions-",
    tempFileName: "information-security-general-questions.d1.sql",
    applicationName: "securium-information-security-general-question-seed",
    confirmEnvName:
      SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_NAME,
    confirmEnvValue:
      SECURITY_CERTIFICATION_INFORMATION_SECURITY_GENERAL_QUESTION_CONFIRM_ENV_VALUE,
    readiness: getInformationSecurityGeneralQuestionBankReadiness,
    seedSql: generateInformationSecurityGeneralQuestionSeedSql,
  },
};

const VALID_ACTIONS = new Set([
  "stats",
  "seed:d1-local",
  "seed:postgres",
  "verify:d1-local",
  "verify:postgres",
]);

const domainKey = process.argv[2];
const action = process.argv[3] ?? "stats";
const domain = domains[domainKey];

if (!domain) {
  fail("SECURITY_CERTIFICATION_QUESTION_DOMAIN_INVALID");
}

if (!VALID_ACTIONS.has(action)) {
  fail("SECURITY_CERTIFICATION_QUESTION_ACTION_INVALID");
}

if (action === "stats") {
  console.log(
    JSON.stringify({
      status: `${domain.label}_QUESTION_SEED_STATS`,
      ...domain.readiness(),
    }),
  );
  process.exit(0);
}

if (action === "seed:d1-local") {
  await runD1LocalSeed(domain);
  process.exit(0);
}

if (action === "seed:postgres") {
  assertProductionSeedApproval(domain);
  await runPostgresSeed(domain);
  process.exit(0);
}

if (action === "verify:d1-local") {
  await verifyD1Local(domain);
  process.exit(0);
}

await verifyPostgres(domain);

async function runD1LocalSeed(config) {
  const sql = config.seedSql({ dialect: "d1" });
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const tempDir = await mkdtemp(join(tmpdir(), config.tempPrefix));
  const tempSqlPath = join(tempDir, config.tempFileName);

  try {
    await writeFile(tempSqlPath, sql, "utf8");
    await runInheritProcess(process.execPath, [
      "scripts/run-wrangler.mjs",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      configPath,
      "--file",
      tempSqlPath,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log(`${config.label}_QUESTION_SEED_D1_LOCAL_APPLIED`);
}

async function runPostgresSeed(config) {
  const sql = connectPostgres(config, "seed");

  try {
    await assertPostgresPrerequisites(sql, config);
    await sql.unsafe(config.seedSql({ dialect: "postgres" }));
  } catch (error) {
    fail(`${config.label}_QUESTION_SEED_POSTGRES_FAILED`, safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`${config.label}_QUESTION_SEED_POSTGRES_APPLIED`);
}

async function verifyD1Local(config) {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const rows = await d1Query(configPath, buildVerificationSql(config, "d1"), config);
  verifyRows(rows, config);
  printResult("d1-local", rows, config);
  console.log(`${config.label}_QUESTION_FLOW_D1_LOCAL_OK`);
}

async function verifyPostgres(config) {
  const sql = connectPostgres(config, "verify");

  try {
    const rows = await sql.unsafe(buildVerificationSql(config, "postgres"));
    verifyRows(rows, config);
    printResult("postgres", rows, config);
  } catch (error) {
    fail(`${config.label}_QUESTION_FLOW_POSTGRES_FAILED`, safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`${config.label}_QUESTION_FLOW_POSTGRES_OK`);
}

function connectPostgres(config, purpose) {
  const connectionUrl =
    purpose === "verify" ? resolvePostgresVerifyUrl() : resolvePostgresSeedUrl();

  return postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name: `${config.applicationName}-${purpose}`,
    },
  });
}

async function assertPostgresPrerequisites(sql, config) {
  const requiredTables = [
    "questions",
    "question_choices",
    "question_courses",
    "question_versions",
    "content_question_links",
    "contents",
    "courses",
    "users",
  ];
  const tableRows = await sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ${sql(requiredTables)}
  `;
  const existingTables = new Set(tableRows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));
  if (missingTables.length) {
    fail(
      `${config.label}_QUESTION_SCHEMA_MISSING:${missingTables.join(",")}`,
      "Apply the base PostgreSQL migrations before running this seed.",
    );
  }

  const courseRows = await sql`
    SELECT id FROM courses WHERE id IN ${sql(config.courseIds)}
  `;
  const existingCourses = new Set(courseRows.map((row) => row.id));
  const missingCourses = config.courseIds.filter((id) => !existingCourses.has(id));
  if (missingCourses.length) {
    fail(
      `${config.label}_QUESTION_COURSE_MISSING:${missingCourses.join(",")}`,
      "Apply or verify the base course seed before running this seed.",
    );
  }

  const contentRows = await sql`
    SELECT id FROM contents WHERE id = ${config.contentId}
  `;
  if (contentRows.length !== 1) {
    fail(
      `${config.label}_CONTENT_MISSING:${config.contentId}`,
      "Apply the official CourseLesson content seed first.",
    );
  }

  const requiredUsers = ["user-admin", "user-content-reviewer"];
  const userRows = await sql`
    SELECT id FROM users WHERE id IN ${sql(requiredUsers)}
  `;
  const existingUsers = new Set(userRows.map((row) => row.id));
  const missingUsers = requiredUsers.filter((id) => !existingUsers.has(id));
  if (missingUsers.length) {
    fail(
      `${config.label}_QUESTION_SEED_USER_MISSING:${missingUsers.join(",")}`,
      "Apply or verify the base development administrator seed before running this seed.",
    );
  }
}

function assertProductionSeedApproval(config) {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
    );
  }

  if (process.env[config.confirmEnvName] !== config.confirmEnvValue) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${config.confirmEnvName}=${config.confirmEnvValue} before running.`,
    );
  }
}

function buildVerificationSql(config, dialect) {
  const countCast = dialect === "postgres" ? "::int" : "";
  const courseIds = config.courseIds.map((courseId) => sqlString(courseId)).join(",");
  const contentId = sqlString(config.contentId);

  return `
WITH scoped_questions AS (
  SELECT id, type, status, is_sample
  FROM questions
  WHERE id LIKE ${sqlString(config.questionPattern)}
),
summary AS (
  SELECT
    'summary' AS row_type,
    'all' AS scope,
    COUNT(*)${countCast} AS value
  FROM scoped_questions
  UNION ALL
  SELECT
    'published',
    'all',
    SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END)${countCast}
  FROM scoped_questions
  UNION ALL
  SELECT
    'sample',
    'all',
    SUM(CASE WHEN is_sample = 1 THEN 1 ELSE 0 END)${countCast}
  FROM scoped_questions
),
type_counts AS (
  SELECT
    'type' AS row_type,
    type AS scope,
    COUNT(*)${countCast} AS value
  FROM scoped_questions
  GROUP BY type
),
course_counts AS (
  SELECT
    'course' AS row_type,
    qc.course_id AS scope,
    COUNT(DISTINCT qc.question_id)${countCast} AS value
  FROM question_courses qc
  INNER JOIN scoped_questions q ON q.id = qc.question_id
  WHERE qc.course_id IN (${courseIds})
  GROUP BY qc.course_id
),
content_links AS (
  SELECT
    'content' AS row_type,
    cql.content_id AS scope,
    COUNT(DISTINCT cql.question_id)${countCast} AS value
  FROM content_question_links cql
  INNER JOIN scoped_questions q ON q.id = cql.question_id
  WHERE cql.content_type = 'CONTENT'
    AND cql.content_id = ${contentId}
    AND cql.relation_type = 'PRACTICE'
  GROUP BY cql.content_id
)
SELECT row_type, scope, value FROM summary
UNION ALL
SELECT row_type, scope, value FROM type_counts
UNION ALL
SELECT row_type, scope, value FROM course_counts
UNION ALL
SELECT row_type, scope, value FROM content_links
ORDER BY row_type, scope;`;
}

function verifyRows(rows, config) {
  const readiness = config.readiness();
  const rowMap = new Map(
    rows.map((row) => [`${row.row_type ?? row.rowType}:${row.scope}`, Number(row.value)]),
  );

  assertCount(rowMap, "summary:all", readiness.questionCount, config);
  assertCount(rowMap, "published:all", readiness.questionCount, config);
  assertCount(rowMap, "sample:all", readiness.questionCount, config);
  assertCount(rowMap, `content:${config.contentId}`, readiness.contentLinkedCount, config);

  for (const [type, count] of Object.entries(readiness.typeCounts)) {
    assertCount(rowMap, `type:${type}`, count, config);
  }

  for (const courseId of config.courseIds) {
    assertCount(rowMap, `course:${courseId}`, readiness.courseCounts[courseId], config);
  }
}

function printResult(targetName, rows, config) {
  const normalizedRows = rows.map((row) => ({
    type: row.row_type ?? row.rowType,
    scope: row.scope,
    value: Number(row.value),
  }));
  console.log(
    JSON.stringify(
      {
        target: targetName,
        contentId: config.contentId,
        courseIds: config.courseIds,
        rows: normalizedRows,
      },
      null,
      2,
    ),
  );
}

async function d1Query(configPath, statement, config) {
  const result = await runCaptureProcess(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--command",
    statement,
  ]);

  if (result.code !== 0) {
    fail(`${config.label}_QUESTION_FLOW_D1_FAILED`);
  }

  return parseWranglerResults(result.stdout, config);
}

function parseWranglerResults(stdout, config) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail(`${config.label}_QUESTION_FLOW_D1_JSON_MISSING`);
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail(`${config.label}_QUESTION_FLOW_D1_JSON_INVALID`);
  }
}

function resolvePostgresSeedUrl() {
  const connectionUrl =
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionUrl) {
    fail(
      "POSTGRES_SEED_URL_REQUIRED",
      "Set POSTGRES_SEED_URL, POSTGRES_MIGRATION_URL, DIRECT_URL, or DATABASE_URL.",
    );
  }

  return connectionUrl;
}

function resolvePostgresVerifyUrl() {
  const connectionUrl =
    process.env.POSTGRES_VERIFY_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim();

  if (!connectionUrl) {
    fail("POSTGRES_VERIFY_URL_REQUIRED");
  }

  return connectionUrl;
}

function assertCount(rowMap, key, expected, config) {
  const actual = rowMap.get(key) ?? 0;
  if (actual !== expected) {
    fail(
      `${config.label}_QUESTION_FLOW_COUNT_MISMATCH`,
      `${key}: expected ${expected}, got ${actual}`,
    );
  }
}

function argValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runInheritProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });

    child.on("error", () => {
      fail("SECURITY_CERTIFICATION_QUESTION_SEED_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("SECURITY_CERTIFICATION_QUESTION_SEED_PROCESS_FAILED");
      }
      resolvePromise();
    });
  });
}

function runCaptureProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolvePromise({ code: 1, stdout: "" }));
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

function safeErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  const name = "name" in error ? error.name : undefined;
  if (typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)) return name;
  return "UNKNOWN";
}

function fail(code, message) {
  console.error(message ? `${code}:${message}` : code);
  process.exit(1);
}
