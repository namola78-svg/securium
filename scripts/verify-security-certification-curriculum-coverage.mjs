import postgres from "postgres";
import { spawn } from "node:child_process";

const VALID_TARGETS = new Set(["d1-local", "postgres"]);
const target = process.argv[2] ?? "d1-local";

const expectedTrees = [
  {
    id: "curriculum-ise-2027-2029-official",
    courseId: "course-ise",
    label: "information-security-engineer",
    minNodes: 79,
  },
  {
    id: "curriculum-isie-2027-2029-official",
    courseId: "course-isie",
    label: "information-security-industrial-engineer",
    minNodes: 64,
  },
];

if (!VALID_TARGETS.has(target)) {
  fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_TARGET_INVALID");
}

if (target === "d1-local") {
  await verifyWithD1Local();
} else {
  await verifyWithPostgres();
}

async function verifyWithD1Local() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const rows = await d1Query(configPath, buildCoverageSql("d1"));
  verifyCoverageRows(rows);
  printCoverage(rows);
  console.log("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_D1_LOCAL_OK");
}

async function verifyWithPostgres() {
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
      application_name: "securium-security-certification-curriculum-coverage",
    },
  });

  try {
    const rows = await sql.unsafe(buildCoverageSql("postgres"));
    verifyCoverageRows(rows);
    printCoverage(rows);
  } catch (error) {
    fail(
      "SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_POSTGRES_FAILED",
      safeErrorCode(error),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_POSTGRES_OK");
}

function buildCoverageSql(dialect) {
  const countCast = dialect === "postgres" ? "::int" : "";
  const treeIds = expectedTrees.map((tree) => sqlString(tree.id)).join(",");
  const courseIds = expectedTrees.map((tree) => sqlString(tree.courseId)).join(",");

  return `
WITH official_trees AS (
  SELECT id, course_id, title, status
  FROM curriculum_trees
  WHERE id IN (${treeIds})
),
tree_nodes AS (
  SELECT
    curriculum_tree_id,
    COUNT(*)${countCast} AS node_count,
    SUM(CASE WHEN metadata LIKE '%"linkedContent"%' THEN 1 ELSE 0 END)${countCast} AS metadata_linked_node_count
  FROM curriculum_nodes
  WHERE curriculum_tree_id IN (${treeIds})
    AND status <> 'ARCHIVED'
  GROUP BY curriculum_tree_id
),
published_course_lessons AS (
  SELECT
    course_id,
    COUNT(*)${countCast} AS published_course_lesson_count,
    COUNT(DISTINCT curriculum_node_id)${countCast} AS course_lesson_node_count,
    SUM(CASE WHEN curriculum_node_id IS NULL OR curriculum_node_id = '' THEN 1 ELSE 0 END)${countCast} AS unlinked_course_lesson_count
  FROM course_lessons
  WHERE course_id IN (${courseIds})
    AND status = 'PUBLISHED'
    AND deleted_at IS NULL
  GROUP BY course_id
),
published_course_questions AS (
  SELECT
    qc.course_id,
    COUNT(DISTINCT qc.question_id)${countCast} AS published_question_count
  FROM question_courses qc
  INNER JOIN questions q ON q.id = qc.question_id
  WHERE qc.course_id IN (${courseIds})
    AND q.status = 'PUBLISHED'
  GROUP BY qc.course_id
)
SELECT
  t.id,
  t.course_id AS course_id,
  t.title,
  t.status,
  COALESCE(n.node_count, 0) AS node_count,
  COALESCE(n.metadata_linked_node_count, 0) AS metadata_linked_node_count,
  COALESCE(cl.published_course_lesson_count, 0) AS published_course_lesson_count,
  COALESCE(cl.course_lesson_node_count, 0) AS course_lesson_node_count,
  COALESCE(cl.unlinked_course_lesson_count, 0) AS unlinked_course_lesson_count,
  COALESCE(pq.published_question_count, 0) AS published_question_count
FROM official_trees t
LEFT JOIN tree_nodes n ON n.curriculum_tree_id = t.id
LEFT JOIN published_course_lessons cl ON cl.course_id = t.course_id
LEFT JOIN published_course_questions pq ON pq.course_id = t.course_id
ORDER BY t.id;`;
}

function verifyCoverageRows(rows) {
  for (const expected of expectedTrees) {
    const row = rows.find((item) => item.id === expected.id);
    if (!row) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_TREE_MISSING", expected.id);
    }
    if (row.course_id !== expected.courseId && row.courseId !== expected.courseId) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_COURSE_MISMATCH", expected.id);
    }
    if (row.status !== "ACTIVE") {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_TREE_NOT_ACTIVE", expected.id);
    }
    if (Number(row.node_count ?? row.nodeCount) < expected.minNodes) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_NODE_COUNT_LOW", expected.id);
    }
  }
}

function printCoverage(rows) {
  const normalizedRows = rows.map((row) => ({
    id: row.id,
    courseId: row.course_id ?? row.courseId,
    status: row.status,
    nodeCount: Number(row.node_count ?? row.nodeCount),
    metadataLinkedNodeCount: Number(
      row.metadata_linked_node_count ?? row.metadataLinkedNodeCount,
    ),
    publishedCourseLessonCount: Number(
      row.published_course_lesson_count ?? row.publishedCourseLessonCount,
    ),
    courseLessonNodeCount: Number(
      row.course_lesson_node_count ?? row.courseLessonNodeCount,
    ),
    unlinkedCourseLessonCount: Number(
      row.unlinked_course_lesson_count ?? row.unlinkedCourseLessonCount,
    ),
    publishedQuestionCount: Number(
      row.published_question_count ?? row.publishedQuestionCount,
    ),
  }));
  console.log(JSON.stringify({ coverage: normalizedRows }, null, 2));
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
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_D1_FAILED");
  }

  return parseWranglerResults(result.stdout);
}

function parseWranglerResults(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_D1_JSON_MISSING");
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_D1_JSON_INVALID");
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
