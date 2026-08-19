import postgres from "postgres";
import { spawn } from "node:child_process";
import { evaluateCurrentEngineerBetaActivationEligibility } from "../lib/curriculum/security-certification-activation-eligibility.ts";
import { effectiveOfficialSecurityCertificationCourseLessons } from "../lib/data/security-certification-course-lessons.mjs";

const CONFIRM_FLAG = "--confirm-production-activation";
const CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION";
const CONFIRM_ENV_VALUE = "ACTIVATE_SECURITY_CERTIFICATION_CURRICULUM";
const CHECK_ONLY_FLAG = "--check-only";
const HELP_FLAG = "--help";

const targetTreeIds = [
  "curriculum-ise-2027-2029-official",
  "curriculum-isie-2027-2029-official",
];
const targetCourseIds = ["course-ise", "course-isie"];
const expectedTrees = [
  {
    id: "curriculum-ise-2027-2029-official",
    courseId: "course-ise",
    minNodes: 79,
    expectedOfficialCourseLessonCount:
      effectiveOfficialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-ise",
      ).length,
  },
  {
    id: "curriculum-isie-2027-2029-official",
    courseId: "course-isie",
    minNodes: 64,
    expectedOfficialCourseLessonCount:
      effectiveOfficialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-isie",
      ).length,
  },
];

const engineerBetaActivationEligibility =
  evaluateCurrentEngineerBetaActivationEligibility();

const checkOnly = process.argv.includes(CHECK_ONLY_FLAG);
const target = process.argv.includes("d1-local") ? "d1-local" : "postgres";

if (process.argv.includes(HELP_FLAG)) {
  printHelp();
} else if (checkOnly) {
  assertEngineerBetaActivationEligibility();
  if (target === "d1-local") {
    await checkActivationReadinessWithD1Local();
  } else {
    await checkActivationReadinessWithPostgres();
  }
} else {
  assertEngineerBetaActivationEligibility();
  if (target !== "postgres") {
    fail("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_TARGET_UNSUPPORTED", target);
  }
  assertProductionActivationApproval();
  await activateWithPostgres();
}

function assertEngineerBetaActivationEligibility() {
  if (engineerBetaActivationEligibility.eligible) return;
  console.error(
    JSON.stringify(
      {
        code: "SECURITY_CERTIFICATION_ENGINEER_BETA_ACTIVATION_INELIGIBLE",
        eligibility: engineerBetaActivationEligibility,
      },
      null,
      2,
    ),
  );
  fail("SECURITY_CERTIFICATION_ENGINEER_BETA_ACTIVATION_INELIGIBLE");
}

async function checkActivationReadinessWithD1Local() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const readiness = await d1Query(configPath, buildPreActivationSql("d1"));
  const activationPlan = await d1Query(configPath, buildActivationPlanSql());
  assertPreActivationCoverage(readiness);
  console.log("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_LOCAL_OK");
  console.log(
    JSON.stringify(
      {
        readiness,
        activationPlan,
      },
      null,
      2,
    ),
  );
}

async function checkActivationReadinessWithPostgres() {
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
      application_name:
        "securium-security-certification-curriculum-activation-check",
    },
  });

  try {
    const rows = await sql.unsafe(buildPreActivationSql("postgres"));
    const activationPlan = await sql.unsafe(buildActivationPlanSql());
    assertPreActivationCoverage(rows);
    console.log("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_POSTGRES_OK");
    console.log(
      JSON.stringify(
        {
          readiness: rows,
          activationPlan,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    fail(
      "SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_POSTGRES_FAILED",
      safeErrorCode(error),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function activateWithPostgres() {
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
      application_name:
        "securium-security-certification-curriculum-activation",
    },
  });

  try {
    await sql.begin(async (tx) => {
      const preActivationRows = await tx.unsafe(buildPreActivationSql("postgres"));
      assertPreActivationCoverage(preActivationRows);

      await tx.unsafe(
        `UPDATE curriculum_trees
         SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
         WHERE course_id IN (${targetCourseIds.map(sqlString).join(",")})
           AND status = 'ACTIVE'
           AND id NOT IN (${targetTreeIds.map(sqlString).join(",")});`,
      );

      await tx.unsafe(
        `UPDATE curriculum_trees
         SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${targetTreeIds.map(sqlString).join(",")});`,
      );
    });

    const rows = await sql.unsafe(
      `SELECT id, course_id AS "courseId", status
       FROM curriculum_trees
       WHERE id IN (${targetTreeIds.map(sqlString).join(",")})
       ORDER BY id;`,
    );

    for (const treeId of targetTreeIds) {
      const row = rows.find((item) => item.id === treeId);
      if (!row) fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_MISSING", treeId);
      if (row.status !== "ACTIVE") {
        fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_NOT_ACTIVE", treeId);
      }
    }

    console.log("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_POSTGRES_OK");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    fail(
      "SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_POSTGRES_FAILED",
      safeErrorCode(error),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function buildActivationPlanSql() {
  const treeIds = targetTreeIds.map(sqlString).join(",");
  const courseIds = targetCourseIds.map(sqlString).join(",");

  return `
SELECT
  id,
  course_id AS "courseId",
  title,
  status AS "currentStatus",
  CASE
    WHEN id IN (${treeIds}) THEN 'ACTIVATE'
    WHEN course_id IN (${courseIds}) AND status = 'ACTIVE' THEN 'ARCHIVE'
    ELSE 'UNCHANGED'
  END AS "plannedAction"
FROM curriculum_trees
WHERE id IN (${treeIds})
   OR (course_id IN (${courseIds}) AND status = 'ACTIVE')
ORDER BY course_id, id;`;
}

function buildPreActivationSql(dialect = "postgres") {
  const countCast = dialect === "postgres" ? "::int" : "";
  const treeIds = targetTreeIds.map(sqlString).join(",");
  const courseIds = targetCourseIds.map(sqlString).join(",");
  const officialCourseLessonIds = effectiveOfficialSecurityCertificationCourseLessons
    .map((lesson) => sqlString(lesson.id))
    .join(",");

  return `
WITH official_trees AS (
  SELECT id, course_id, status
  FROM curriculum_trees
  WHERE id IN (${treeIds})
),
tree_nodes AS (
  SELECT
    curriculum_tree_id,
    COUNT(*)${countCast} AS node_count,
    SUM(CASE WHEN node_type <> 'TRACK' THEN 1 ELSE 0 END)${countCast} AS metadata_target_node_count,
    SUM(CASE WHEN metadata LIKE '%"linkedContent"%' THEN 1 ELSE 0 END)${countCast} AS metadata_linked_node_count
  FROM curriculum_nodes
  WHERE curriculum_tree_id IN (${treeIds})
    AND status <> 'ARCHIVED'
  GROUP BY curriculum_tree_id
),
published_course_lessons AS (
  SELECT
    course_id,
    SUM(CASE WHEN id IN (${officialCourseLessonIds}) THEN 1 ELSE 0 END)${countCast} AS official_seed_course_lesson_count,
    SUM(CASE WHEN id IN (${officialCourseLessonIds}) AND (curriculum_node_id IS NULL OR curriculum_node_id = '') THEN 1 ELSE 0 END)${countCast} AS official_unlinked_course_lesson_count
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
  t.course_id AS "courseId",
  t.status,
  COALESCE(n.node_count, 0) AS "nodeCount",
  COALESCE(n.metadata_target_node_count, 0) AS "metadataTargetNodeCount",
  COALESCE(n.metadata_linked_node_count, 0) AS "metadataLinkedNodeCount",
  COALESCE(cl.official_seed_course_lesson_count, 0) AS "officialSeedCourseLessonCount",
  COALESCE(cl.official_unlinked_course_lesson_count, 0) AS "officialUnlinkedCourseLessonCount",
  COALESCE(pq.published_question_count, 0) AS "publishedQuestionCount"
FROM official_trees t
LEFT JOIN tree_nodes n ON n.curriculum_tree_id = t.id
LEFT JOIN published_course_lessons cl ON cl.course_id = t.course_id
LEFT JOIN published_course_questions pq ON pq.course_id = t.course_id
ORDER BY t.id;`;
}

function assertPreActivationCoverage(rows) {
  for (const expected of expectedTrees) {
    const row = rows.find((item) => item.id === expected.id);
    if (!row) fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_TREE_MISSING", expected.id);
    if (row.courseId !== expected.courseId) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_COURSE_MISMATCH", expected.id);
    }
    if (Number(row.nodeCount) < expected.minNodes) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_NODE_COUNT_LOW", expected.id);
    }
    if (
      Number(row.metadataTargetNodeCount) !== Number(row.metadataLinkedNodeCount)
    ) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_CONTENT_METADATA_GAP", expected.id);
    }
    if (
      Number(row.officialSeedCourseLessonCount) <
      expected.expectedOfficialCourseLessonCount
    ) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_COURSELESSON_COUNT_LOW", expected.id);
    }
    if (Number(row.officialUnlinkedCourseLessonCount) > 0) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_COURSELESSON_LINK_GAP", expected.id);
    }
    if (Number(row.publishedQuestionCount) <= 0) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_QUESTION_GAP", expected.id);
    }
  }
}

function assertProductionActivationApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production curriculum activation.`,
    );
  }

  if (process.env[CONFIRM_ENV_NAME] !== CONFIRM_ENV_VALUE) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${CONFIRM_ENV_NAME}=${CONFIRM_ENV_VALUE} before running.`,
    );
  }
}

function resolvePostgresUrl() {
  const connectionUrl =
    process.env.POSTGRES_ACTIVATION_URL?.trim() ||
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim();

  if (!connectionUrl) {
    fail("POSTGRES_ACTIVATION_URL_REQUIRED");
  }

  return connectionUrl;
}

function printHelp() {
  console.log(`SECURIUM security certification curriculum activation

Read-only checks:
  npm run curriculum:security-certification:activate:check:d1-local
  npm run curriculum:security-certification:activate:check:postgres

Production activation:
  $env:${CONFIRM_ENV_NAME} = "${CONFIRM_ENV_VALUE}"
  npm run curriculum:security-certification:activate:postgres -- ${CONFIRM_FLAG}
  Remove-Item Env:${CONFIRM_ENV_NAME}

Connection URL priority:
  POSTGRES_ACTIVATION_URL
  POSTGRES_SEED_URL
  DATABASE_URL
  POSTGRES_MIGRATION_URL
  DIRECT_URL

Safety:
  - d1-local is check-only and never activates curriculum trees.
  - PostgreSQL activation runs a clean precheck inside the same transaction.
  - Do not run production activation without explicit approval and backup readiness.
`);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function argValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
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
    fail("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_FAILED");
  }

  return parseWranglerResults(result.stdout);
}

function parseWranglerResults(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_JSON_MISSING");
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_JSON_INVALID");
  }
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
