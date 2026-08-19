import postgres from "postgres";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  effectiveOfficialSecurityCertificationCourseLessons,
  INDUSTRIAL_PRC2_DETACHED_COURSE_LESSON_IDS,
  officialSecurityCertificationCourseLessons,
} from "../lib/data/security-certification-course-lessons.mjs";

const VALID_TARGETS = new Set(["d1-local", "postgres"]);
const target = process.argv[2] ?? "d1-local";
const requireCourseLessons = process.argv.includes("--require-course-lessons");
const allowInactive = process.argv.includes("--allow-inactive");
const includeActionQueue = process.argv.includes("--action-queue");
const ACTION_TYPES = new Set([
  "TREE_STATUS",
  "COURSELESSON_LINK_GAP",
  "OFFICIAL_COURSELESSON_GAP",
  "CONTENT_METADATA_GAP",
  "QUESTION_GAP",
]);
const actionQueueLimit = parsePositiveIntArg("--action-queue-limit=", 8);
const actionTypeFilter = parseActionTypeArg("--action-type=");

const expectedTrees = [
  {
    id: "curriculum-ise-2027-2029-official",
    courseId: "course-ise",
    label: "information-security-engineer",
    minNodes: 79,
    physicalCourseLessonCount:
      officialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-ise",
      ).length,
    expectedOfficialCourseLessonCount:
      effectiveOfficialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-ise",
      ).length,
    prc3DeferredCount: 0,
  },
  {
    id: "curriculum-isie-2027-2029-official",
    courseId: "course-isie",
    label: "information-security-industrial-engineer",
    minNodes: 64,
    physicalCourseLessonCount:
      officialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-isie",
      ).length,
    expectedOfficialCourseLessonCount:
      effectiveOfficialSecurityCertificationCourseLessons.filter(
        (lesson) => lesson.courseId === "course-isie",
      ).length,
    prc3DeferredCount: INDUSTRIAL_PRC2_DETACHED_COURSE_LESSON_IDS.length,
  },
];

const isDirectExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  await main();
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  if (!VALID_TARGETS.has(target)) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_TARGET_INVALID");
  }

  if (target === "d1-local") {
    await verifyWithD1Local();
  } else {
    await verifyWithPostgres();
  }
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

export function buildCoverageSql(dialect) {
  const countCast = dialect === "postgres" ? "::int" : "";
  const treeIds = expectedTrees.map((tree) => sqlString(tree.id)).join(",");
  const courseIds = expectedTrees.map((tree) => sqlString(tree.courseId)).join(",");
  const physicalOfficialCourseLessonValues = officialSecurityCertificationCourseLessons
    .map((lesson) => `(${sqlString(lesson.id)})`)
    .join(",");
  const prc3DeferredCourseLessonValues =
    INDUSTRIAL_PRC2_DETACHED_COURSE_LESSON_IDS.map(
      (id) => `(${sqlString(id)})`,
    ).join(",");

  return `
WITH official_course_lesson_ids(id) AS (
  VALUES ${physicalOfficialCourseLessonValues}
),
prc3_deferred_course_lesson_ids(id) AS (
  VALUES ${prc3DeferredCourseLessonValues}
),
official_trees AS (
  SELECT id, course_id, title, status
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
course_lesson_metrics AS (
  SELECT
    cl.course_id,
    COUNT(*)${countCast} AS total_physical_course_lesson_count,
    SUM(CASE WHEN official.id IS NOT NULL THEN 1 ELSE 0 END)${countCast} AS physical_course_lesson_count,
    SUM(CASE WHEN official.id IS NULL THEN 1 ELSE 0 END)${countCast} AS non_official_physical_course_lesson_count,
    SUM(CASE WHEN cl.status = 'PUBLISHED' THEN 1 ELSE 0 END)${countCast} AS published_course_lesson_count,
    COUNT(DISTINCT CASE WHEN cl.status = 'PUBLISHED' THEN cl.curriculum_node_id ELSE NULL END)${countCast} AS course_lesson_node_count,
    SUM(CASE WHEN official.id IS NOT NULL AND deferred.id IS NULL AND cl.status = 'PUBLISHED' THEN 1 ELSE 0 END)${countCast} AS effective_placement_count,
    COUNT(DISTINCT CASE WHEN official.id IS NOT NULL AND deferred.id IS NULL AND cl.status = 'PUBLISHED' THEN cl.curriculum_node_id ELSE NULL END)${countCast} AS official_seed_node_count,
    SUM(CASE WHEN official.id IS NOT NULL AND deferred.id IS NULL AND cl.status = 'PUBLISHED' AND (cl.curriculum_node_id IS NULL OR cl.curriculum_node_id = '') THEN 1 ELSE 0 END)${countCast} AS official_unlinked_course_lesson_count,
    SUM(CASE WHEN cl.status = 'PUBLISHED' AND (cl.curriculum_node_id IS NULL OR cl.curriculum_node_id = '') THEN 1 ELSE 0 END)${countCast} AS unlinked_course_lesson_count,
    SUM(CASE WHEN deferred.id IS NOT NULL AND cl.status = 'ARCHIVED' THEN 1 ELSE 0 END)${countCast} AS prc3_deferred_count
  FROM course_lessons cl
  LEFT JOIN official_course_lesson_ids official ON official.id = cl.id
  LEFT JOIN prc3_deferred_course_lesson_ids deferred ON deferred.id = cl.id
  WHERE cl.course_id IN (${courseIds})
    AND cl.deleted_at IS NULL
  GROUP BY cl.course_id
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
  COALESCE(n.metadata_target_node_count, 0) AS metadata_target_node_count,
  COALESCE(n.metadata_linked_node_count, 0) AS metadata_linked_node_count,
  COALESCE(cl.total_physical_course_lesson_count, 0) AS total_physical_course_lesson_count,
  COALESCE(cl.physical_course_lesson_count, 0) AS physical_course_lesson_count,
  COALESCE(cl.non_official_physical_course_lesson_count, 0) AS non_official_physical_course_lesson_count,
  COALESCE(cl.published_course_lesson_count, 0) AS published_course_lesson_count,
  COALESCE(cl.course_lesson_node_count, 0) AS course_lesson_node_count,
  COALESCE(cl.effective_placement_count, 0) AS effective_placement_count,
  COALESCE(cl.official_seed_node_count, 0) AS official_seed_node_count,
  COALESCE(cl.official_unlinked_course_lesson_count, 0) AS official_unlinked_course_lesson_count,
  COALESCE(cl.unlinked_course_lesson_count, 0) AS unlinked_course_lesson_count,
  COALESCE(cl.prc3_deferred_count, 0) AS prc3_deferred_count,
  COALESCE(pq.published_question_count, 0) AS published_question_count
FROM official_trees t
LEFT JOIN tree_nodes n ON n.curriculum_tree_id = t.id
LEFT JOIN course_lesson_metrics cl ON cl.course_id = t.course_id
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
    if (!allowInactive && row.status !== "ACTIVE") {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_TREE_NOT_ACTIVE", expected.id);
    }
    if (Number(row.node_count ?? row.nodeCount) < expected.minNodes) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_NODE_COUNT_LOW", expected.id);
    }
    if (requireCourseLessons) {
      const physicalCourseLessonCount = Number(
        row.physical_course_lesson_count ?? row.physicalCourseLessonCount,
      );
      const effectivePlacementCount = Number(
        row.effective_placement_count ??
          row.effectivePlacementCount ??
          row.official_seed_course_lesson_count ??
          row.officialSeedCourseLessonCount,
      );
      const prc3DeferredCount = Number(
        row.prc3_deferred_count ?? row.prc3DeferredCount,
      );

      if (physicalCourseLessonCount !== expected.physicalCourseLessonCount) {
        fail(
          "SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_PHYSICAL_COURSELESSON_MISMATCH",
          expected.id,
        );
      }
      if (effectivePlacementCount !== expected.expectedOfficialCourseLessonCount) {
        fail(
          "SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_OFFICIAL_COURSE_LESSONS_LOW",
          expected.id,
        );
      }
      if (prc3DeferredCount !== expected.prc3DeferredCount) {
        fail(
          "SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_PRC3_DEFERRED_MISMATCH",
          expected.id,
        );
      }
    }
  }
}

function printCoverage(rows) {
  const normalizedRows = normalizeCoverageRows(rows);
  const payload = { coverage: normalizedRows };

  if (includeActionQueue) {
    payload.actionQueue = buildCoverageActionQueue(normalizedRows, {
      limit: actionQueueLimit,
      typeFilter: actionTypeFilter,
    });
  }

  console.log(JSON.stringify(payload, null, 2));
}

function normalizeCoverageRows(rows) {
  return rows.map((row) => {
    const expected = expectedTrees.find((tree) => tree.id === row.id);
    return {
      id: row.id,
      courseId: row.course_id ?? row.courseId,
      status: row.status,
      nodeCount: Number(row.node_count ?? row.nodeCount),
      metadataTargetNodeCount: Number(
        row.metadata_target_node_count ?? row.metadataTargetNodeCount ?? row.node_count ?? row.nodeCount,
      ),
      metadataLinkedNodeCount: Number(
        row.metadata_linked_node_count ?? row.metadataLinkedNodeCount,
      ),
      totalPhysicalCourseLessonCount: Number(
        row.total_physical_course_lesson_count ?? row.totalPhysicalCourseLessonCount,
      ),
      physicalCourseLessonCount: Number(
        row.physical_course_lesson_count ?? row.physicalCourseLessonCount,
      ),
      nonOfficialPhysicalCourseLessonCount: Number(
        row.non_official_physical_course_lesson_count ??
          row.nonOfficialPhysicalCourseLessonCount,
      ),
      publishedCourseLessonCount: Number(
        row.published_course_lesson_count ?? row.publishedCourseLessonCount,
      ),
      courseLessonNodeCount: Number(
        row.course_lesson_node_count ?? row.courseLessonNodeCount,
      ),
      effectivePlacementCount: Number(
        row.effective_placement_count ??
          row.effectivePlacementCount ??
          row.official_seed_course_lesson_count ??
          row.officialSeedCourseLessonCount,
      ),
      officialSeedCourseLessonCount: Number(
        row.effective_placement_count ??
          row.effectivePlacementCount ??
          row.official_seed_course_lesson_count ??
          row.officialSeedCourseLessonCount,
      ),
      officialSeedNodeCount: Number(
        row.official_seed_node_count ?? row.officialSeedNodeCount,
      ),
      officialUnlinkedCourseLessonCount: Number(
        row.official_unlinked_course_lesson_count ?? row.officialUnlinkedCourseLessonCount,
      ),
      unlinkedCourseLessonCount: Number(
        row.unlinked_course_lesson_count ?? row.unlinkedCourseLessonCount,
      ),
      prc3DeferredCount: Number(
        row.prc3_deferred_count ?? row.prc3DeferredCount ?? expected?.prc3DeferredCount ?? 0,
      ),
      expectedPhysicalCourseLessonCount:
        expected?.physicalCourseLessonCount ?? 0,
      expectedEffectivePlacementCount:
        expected?.expectedOfficialCourseLessonCount ?? 0,
      publishedQuestionCount: Number(
        row.published_question_count ?? row.publishedQuestionCount,
      ),
    };
  });
}

function buildCoverageActionQueue(
  rows,
  { limit = 8, typeFilter = null } = {},
) {
  const items = [];

  for (const row of rows) {
    const expected = expectedTrees.find((tree) => tree.id === row.id);
    const officialLessonGap = Math.max(
      0,
      Number(expected?.expectedOfficialCourseLessonCount ?? 0) -
        row.officialSeedCourseLessonCount,
    );
    const contentMetadataGap = Math.max(
      0,
      row.metadataTargetNodeCount - row.metadataLinkedNodeCount,
    );

    if (row.status !== "ACTIVE") {
      items.push(buildActionItem(row, "TREE_STATUS", "공식 커리큘럼 트리를 ACTIVE로 전환"));
    }
    if (row.officialUnlinkedCourseLessonCount > 0) {
      items.push(
        buildActionItem(
          row,
          "COURSELESSON_LINK_GAP",
          `${row.unlinkedCourseLessonCount}개 CourseLesson을 CurriculumNode에 연결`,
        ),
      );
    }
    if (officialLessonGap > 0) {
      items.push(
        buildActionItem(
          row,
          "OFFICIAL_COURSELESSON_GAP",
          `${officialLessonGap}개 공식 CourseLesson 보강`,
        ),
      );
    }
    if (contentMetadataGap > 0) {
      items.push(
        buildActionItem(
          row,
          "CONTENT_METADATA_GAP",
          `${contentMetadataGap}개 CurriculumNode의 본문 Content 연결 확인`,
        ),
      );
    }
    if (row.publishedQuestionCount <= 0) {
      items.push(buildActionItem(row, "QUESTION_GAP", "공개 문제 연결 확인"));
    }
  }

  const filteredItems = typeFilter
    ? items.filter((item) => item.type === typeFilter)
    : items;

  return filteredItems.slice(0, limit);
}

function buildActionItem(row, type, message) {
  const normalizedMessage =
    type === "COURSELESSON_LINK_GAP"
      ? `${row.officialUnlinkedCourseLessonCount} official CourseLesson items need CurriculumNode links`
      : message;
  const item = {
    type,
    severity: actionSeverity(type),
    courseId: row.courseId,
    curriculumTreeId: row.id,
    message: normalizedMessage,
    nextStep: actionNextStep(type),
  };
  if (type === "CONTENT_METADATA_GAP") {
    return {
      ...item,
      basis: "curriculum_nodes.metadata.linkedContent",
      note: "This checks DB metadata links on learning-target nodes, excluding TRACK structure nodes.",
    };
  }
  return item;
}

function actionSeverity(type) {
  if (type === "TREE_STATUS") return "high";
  if (type === "COURSELESSON_LINK_GAP") return "high";
  if (type === "OFFICIAL_COURSELESSON_GAP") return "medium";
  if (type === "CONTENT_METADATA_GAP") return "medium";
  if (type === "QUESTION_GAP") return "medium";
  return "low";
}

function actionNextStep(type) {
  if (type === "TREE_STATUS") {
    return "Request explicit production activation only after read-only checks are clean.";
  }
  if (type === "COURSELESSON_LINK_GAP") {
    return "Open admin shared content and connect the official CourseLesson to the matching CurriculumNode.";
  }
  if (type === "OFFICIAL_COURSELESSON_GAP") {
    return "Review the official CourseLesson seed coverage before production seed approval.";
  }
  if (type === "CONTENT_METADATA_GAP") {
    return "Confirm linkedContent metadata or connect reusable Content through the admin UI.";
  }
  if (type === "QUESTION_GAP") {
    return "Confirm published question coverage for the selected official curriculum tree.";
  }
  return "Review the reported gap before requesting production changes.";
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

function parsePositiveIntArg(prefix, fallback) {
  const rawValue = argValue(prefix);
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_LIMIT_INVALID", rawValue);
  }
  return parsed;
}

function parseActionTypeArg(prefix) {
  const value = argValue(prefix);
  if (!value) return null;
  if (!ACTION_TYPES.has(value)) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_ACTION_TYPE_INVALID", value);
  }
  return value;
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

function printHelp() {
  console.log(`SECURIUM security certification curriculum coverage verifier

Usage:
  node scripts/verify-security-certification-curriculum-coverage.mjs d1-local [options]
  node scripts/verify-security-certification-curriculum-coverage.mjs postgres [options]

Targets:
  d1-local   Read local Cloudflare D1 state through wrangler
  postgres   Read PostgreSQL/Supabase state using POSTGRES_VERIFY_URL or DATABASE_URL

Options:
  --allow-inactive          Allow official CurriculumTree rows that are not ACTIVE
  --require-course-lessons  Fail when official CourseLesson seed coverage is incomplete
  --action-queue           Include prioritized read-only gap actions in the JSON output
  --action-queue-limit=<n>  Limit actionQueue item count, default: 8
  --action-type=<type>      Filter actionQueue by one type, for example CONTENT_METADATA_GAP
  --config=<path>          D1 wrangler config path, default: wrangler.local.jsonc

NPM shortcuts:
  npm run curriculum:security-certification:coverage:d1-local
  npm run curriculum:security-certification:coverage:postgres
  npm run curriculum:security-certification:coverage-actions:d1-local
  npm run curriculum:security-certification:coverage-actions:postgres`);
}

function fail(code, message) {
  console.error(message ? `${code}:${message}` : code);
  process.exit(1);
}
