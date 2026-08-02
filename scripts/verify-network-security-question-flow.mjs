import postgres from "postgres";
import { spawn } from "node:child_process";
import {
  NETWORK_SECURITY_CONTENT_ID,
  NETWORK_SECURITY_COURSE_IDS,
  getNetworkSecurityQuestionBankReadiness,
} from "../lib/data/security-certification-network-security-questions.mjs";

const VALID_TARGETS = new Set(["d1-local", "postgres"]);
const target = process.argv[2] ?? "d1-local";

if (!VALID_TARGETS.has(target)) {
  fail("NETWORK_SECURITY_QUESTION_FLOW_TARGET_INVALID");
}

if (target === "d1-local") {
  await verifyD1Local();
} else {
  await verifyPostgres();
}

async function verifyD1Local() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const rows = await d1Query(configPath, buildVerificationSql("d1"));
  verifyRows(rows);
  printResult("d1-local", rows);
  console.log("NETWORK_SECURITY_QUESTION_FLOW_D1_LOCAL_OK");
}

async function verifyPostgres() {
  const connectionUrl = resolvePostgresUrl();
  const sql = postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name: "securium-network-security-question-flow-verify",
    },
  });

  try {
    const rows = await sql.unsafe(buildVerificationSql("postgres"));
    verifyRows(rows);
    printResult("postgres", rows);
  } catch (error) {
    fail("NETWORK_SECURITY_QUESTION_FLOW_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("NETWORK_SECURITY_QUESTION_FLOW_POSTGRES_OK");
}

function buildVerificationSql(dialect) {
  const countCast = dialect === "postgres" ? "::int" : "";
  const questionPattern = "network-security-official-sample-q%";
  const courseIds = NETWORK_SECURITY_COURSE_IDS.map((courseId) =>
    sqlString(courseId),
  ).join(",");
  const contentId = sqlString(NETWORK_SECURITY_CONTENT_ID);

  return `
WITH network_questions AS (
  SELECT id, type, status, is_sample
  FROM questions
  WHERE id LIKE ${sqlString(questionPattern)}
),
summary AS (
  SELECT
    'summary' AS row_type,
    'all' AS scope,
    COUNT(*)${countCast} AS value
  FROM network_questions
  UNION ALL
  SELECT
    'published',
    'all',
    SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END)${countCast}
  FROM network_questions
  UNION ALL
  SELECT
    'sample',
    'all',
    SUM(CASE WHEN is_sample = 1 THEN 1 ELSE 0 END)${countCast}
  FROM network_questions
),
type_counts AS (
  SELECT
    'type' AS row_type,
    type AS scope,
    COUNT(*)${countCast} AS value
  FROM network_questions
  GROUP BY type
),
course_counts AS (
  SELECT
    'course' AS row_type,
    qc.course_id AS scope,
    COUNT(DISTINCT qc.question_id)${countCast} AS value
  FROM question_courses qc
  INNER JOIN network_questions q ON q.id = qc.question_id
  WHERE qc.course_id IN (${courseIds})
  GROUP BY qc.course_id
),
content_links AS (
  SELECT
    'content' AS row_type,
    cql.content_id AS scope,
    COUNT(DISTINCT cql.question_id)${countCast} AS value
  FROM content_question_links cql
  INNER JOIN network_questions q ON q.id = cql.question_id
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

function verifyRows(rows) {
  const readiness = getNetworkSecurityQuestionBankReadiness();
  const rowMap = new Map(
    rows.map((row) => [`${row.row_type ?? row.rowType}:${row.scope}`, Number(row.value)]),
  );

  assertCount(rowMap, "summary:all", readiness.questionCount);
  assertCount(rowMap, "published:all", readiness.questionCount);
  assertCount(rowMap, "sample:all", readiness.questionCount);
  assertCount(
    rowMap,
    `content:${NETWORK_SECURITY_CONTENT_ID}`,
    readiness.contentLinkedCount,
  );

  for (const [type, count] of Object.entries(readiness.typeCounts)) {
    assertCount(rowMap, `type:${type}`, count);
  }

  for (const courseId of NETWORK_SECURITY_COURSE_IDS) {
    assertCount(rowMap, `course:${courseId}`, readiness.courseCounts[courseId]);
  }
}

function printResult(targetName, rows) {
  const normalizedRows = rows.map((row) => ({
    type: row.row_type ?? row.rowType,
    scope: row.scope,
    value: Number(row.value),
  }));
  console.log(
    JSON.stringify(
      {
        target: targetName,
        contentId: NETWORK_SECURITY_CONTENT_ID,
        courseIds: NETWORK_SECURITY_COURSE_IDS,
        rows: normalizedRows,
      },
      null,
      2,
    ),
  );
}

async function d1Query(configPath, statement) {
  const result = await runProcess(process.execPath, [
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
    fail("NETWORK_SECURITY_QUESTION_FLOW_D1_FAILED");
  }

  return parseWranglerResults(result.stdout);
}

function parseWranglerResults(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail("NETWORK_SECURITY_QUESTION_FLOW_D1_JSON_MISSING");
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail("NETWORK_SECURITY_QUESTION_FLOW_D1_JSON_INVALID");
  }
}

function resolvePostgresUrl() {
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

function assertCount(rowMap, key, expected) {
  const actual = rowMap.get(key) ?? 0;
  if (actual !== expected) {
    fail(
      "NETWORK_SECURITY_QUESTION_FLOW_COUNT_MISMATCH",
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

function runProcess(executable, args) {
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
