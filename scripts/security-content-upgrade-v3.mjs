import postgres from "postgres";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadLocalEnvIfPresent } from "./load-local-env.mjs";
import {
  SECURITY_CONTENT_V3_CONFIRM_ENV_NAME,
  SECURITY_CONTENT_V3_CONFIRM_ENV_VALUE,
  buildSecurityContentV3Plan,
  generateSecurityContentV3Sql,
} from "../lib/data/security-content-upgrade-v3.mjs";

loadLocalEnvIfPresent();

const VALID_ACTIONS = new Set([
  "plan",
  "seed:d1-local",
  "seed:postgres",
  "verify:d1-local",
  "verify:postgres",
]);
const action = process.argv[2] ?? "plan";
const persistTo = argValue("--persist-to=");
if (!VALID_ACTIONS.has(action)) fail("SECURITY_CONTENT_V3_ACTION_INVALID");

const sourceRoot = resolveSourceRoot();
const source = await readSource(sourceRoot);
const plan = buildSecurityContentV3Plan(source);

if (action === "plan") {
  console.log(JSON.stringify(planSummary(plan, sourceRoot), null, 2));
  process.exit(0);
}

if (action === "seed:d1-local") {
  await seedD1(source, plan);
  process.exit(0);
}

if (action === "seed:postgres") {
  assertProductionApproval();
  await seedPostgres(source, plan);
  process.exit(0);
}

if (action === "verify:d1-local") {
  await verifyD1(plan);
  process.exit(0);
}

await verifyPostgres(plan);

async function readSource(root) {
  const requiredReadFiles = [
    "manifest.json",
    "content.schema.json",
    "content-policy.ts",
    join("data", "normalized-knowledge-base.json"),
  ];
  for (const relativePath of requiredReadFiles) {
    if (!existsSync(join(root, relativePath))) {
      fail(`SECURITY_CONTENT_V3_SOURCE_FILE_MISSING:${relativePath}`);
    }
  }
  return JSON.parse(
    await readFile(join(root, "data", "normalized-knowledge-base.json"), "utf8"),
  );
}

function resolveSourceRoot() {
  const explicit = argValue("--source-root=") ?? process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT;
  const root = resolve(explicit?.trim() || "securium-content-upgrade-v2");
  if (!existsSync(root)) fail("SECURITY_CONTENT_V3_SOURCE_ROOT_MISSING");
  return root;
}

async function seedD1(sourceData, currentPlan) {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  await assertD1Prerequisites(configPath, currentPlan);
  const before = await d1Query(configPath, protectedCourseSnapshotSql());
  const tempDir = await mkdtemp(join(tmpdir(), "securium-content-v3-"));
  const sqlPath = join(tempDir, "security-content-v3.d1.sql");
  try {
    await writeFile(sqlPath, generateSecurityContentV3Sql(sourceData, { dialect: "d1" }), "utf8");
    const result = await runCapture(process.execPath, [
      "scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, ...persistArgs(), "--file", sqlPath,
    ]);
    if (result.code !== 0) {
      fail("SECURITY_CONTENT_V3_PROCESS_FAILED", result.stdout.slice(-500));
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  const after = await d1Query(configPath, protectedCourseSnapshotSql());
  assertProtectedSnapshot(before, after);
  await verifyD1(currentPlan, configPath);
  console.log("SECURITY_CONTENT_V3_D1_LOCAL_APPLIED");
}

async function seedPostgres(sourceData, currentPlan) {
  const sql = connectPostgres("seed");
  try {
    await assertPostgresPrerequisites(sql, currentPlan);
    const before = await sql.unsafe(protectedCourseSnapshotSql());
    await sql.unsafe(generateSecurityContentV3Sql(sourceData, { dialect: "postgres" }));
    const after = await sql.unsafe(protectedCourseSnapshotSql());
    assertProtectedSnapshot(before, after);
    await verifyPostgresWithConnection(sql, currentPlan);
  } catch (error) {
    fail("SECURITY_CONTENT_V3_POSTGRES_FAILED", safeError(error));
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log("SECURITY_CONTENT_V3_POSTGRES_APPLIED");
}

async function assertD1Prerequisites(configPath, currentPlan) {
  const rows = await d1Query(configPath, prerequisiteSql());
  assertPrerequisites(rows, currentPlan);
  await assertD1NoProtectedProgressConflict(configPath, currentPlan);
}

async function assertD1NoProtectedProgressConflict(configPath, currentPlan) {
  const ids = currentPlan.questions.map((question) => sqlString(question.id)).join(",");
  const rows = await d1Query(configPath, `
SELECT COUNT(*) AS value FROM (
  SELECT question_id FROM question_attempts WHERE course_id='course-isie' AND question_id IN (${ids})
  UNION ALL SELECT question_id FROM wrong_notes WHERE course_id='course-isie' AND question_id IN (${ids})
  UNION ALL SELECT target_id FROM bookmarks WHERE course_id='course-isie' AND target_type='QUESTION' AND target_id IN (${ids})
  UNION ALL SELECT target_id FROM review_schedules WHERE course_id='course-isie' AND target_type='QUESTION' AND target_id IN (${ids})
);`);
  if (Number(rows[0]?.value) !== 0) fail("SECURITY_CONTENT_V3_ISIE_PROGRESS_CONFLICT");
}

async function assertPostgresPrerequisites(sql, currentPlan) {
  const rows = await sql.unsafe(prerequisiteSql());
  assertPrerequisites(rows, currentPlan);
  const ids = currentPlan.questions.map((question) => sqlString(question.id)).join(",");
  const conflicts = await sql.unsafe(`
SELECT COUNT(*)::int AS value FROM (
  SELECT question_id FROM question_attempts WHERE course_id='course-isie' AND question_id IN (${ids})
  UNION ALL SELECT question_id FROM wrong_notes WHERE course_id='course-isie' AND question_id IN (${ids})
  UNION ALL SELECT target_id FROM bookmarks WHERE course_id='course-isie' AND target_type='QUESTION' AND target_id IN (${ids})
  UNION ALL SELECT target_id FROM review_schedules WHERE course_id='course-isie' AND target_type='QUESTION' AND target_id IN (${ids})
) scoped;`);
  if (Number(conflicts[0]?.value) !== 0) fail("SECURITY_CONTENT_V3_ISIE_PROGRESS_CONFLICT");
}

function prerequisiteSql() {
  return `
SELECT 'course' AS kind, COUNT(*) AS value FROM courses WHERE id IN ('course-ise','course-isie')
UNION ALL SELECT 'subject',COUNT(*) FROM subjects WHERE course_id='course-ise' AND code IN ('SYSTEM_SECURITY','NETWORK_SECURITY','APPLICATION_SECURITY','SECURITY_FOUNDATION','SECURITY_LAW')
UNION ALL SELECT 'topic',COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id='course-ise' AND t.code='CORE'
UNION ALL SELECT 'curriculum',COUNT(*) FROM curriculum_nodes WHERE curriculum_tree_id='curriculum-ise-2027-2029-official'
UNION ALL SELECT 'actor',COUNT(*) FROM users WHERE id='user-content-editor';`;
}

function assertPrerequisites(rows) {
  const values = new Map(rows.map((row) => [row.kind, Number(row.value)]));
  if (values.get("course") !== 2) fail("SECURITY_CONTENT_V3_COURSES_MISSING");
  if (values.get("subject") !== 5 || values.get("topic") !== 5) {
    fail("SECURITY_CONTENT_V3_TAXONOMY_MISSING");
  }
  if (!values.get("curriculum")) fail("SECURITY_CONTENT_V3_CURRICULUM_MISSING");
  if (values.get("actor") !== 1) fail("SECURITY_CONTENT_V3_ACTOR_MISSING");
}

async function verifyD1(currentPlan, configPath = argValue("--config=") ?? "wrangler.local.jsonc") {
  const rows = await d1Query(configPath, verificationSql("d1"));
  assertVerification(rows, currentPlan);
  console.log(JSON.stringify({ target: "d1-local", ...verificationSummary(rows) }, null, 2));
  console.log("SECURITY_CONTENT_V3_D1_LOCAL_OK");
}

async function verifyPostgres(currentPlan) {
  const sql = connectPostgres("verify");
  try {
    await verifyPostgresWithConnection(sql, currentPlan);
  } catch (error) {
    fail("SECURITY_CONTENT_V3_POSTGRES_VERIFY_FAILED", safeError(error));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function verifyPostgresWithConnection(sql, currentPlan) {
  const rows = await sql.unsafe(verificationSql("postgres"));
  assertVerification(rows, currentPlan);
  console.log(JSON.stringify({ target: "postgres", ...verificationSummary(rows) }, null, 2));
  console.log("SECURITY_CONTENT_V3_POSTGRES_OK");
}

function verificationSql(dialect) {
  const cast = dialect === "postgres" ? "::int" : "";
  return `
SELECT
 (SELECT COUNT(*)${cast} FROM contents WHERE id LIKE 'sec-upgrade-lesson-%') AS contents,
 (SELECT COUNT(*)${cast} FROM questions WHERE id LIKE 'sec-upgrade-written-%' OR id LIKE 'sec-upgrade-practical-%') AS questions,
 (SELECT COUNT(*)${cast} FROM questions WHERE id LIKE 'sec-upgrade-written-%') AS written,
 (SELECT COUNT(*)${cast} FROM questions WHERE id LIKE 'sec-upgrade-practical-%') AS practical,
 (SELECT COUNT(*)${cast} FROM course_lessons WHERE id LIKE 'upgrade-course-lesson-%' AND course_id='course-ise' AND curriculum_node_id IS NOT NULL) AS course_lessons,
 (SELECT COUNT(*)${cast} FROM content_question_links WHERE question_id LIKE 'sec-upgrade-written-%' OR question_id LIKE 'sec-upgrade-practical-%') AS content_links,
 (SELECT COUNT(*)${cast} FROM question_versions WHERE question_id LIKE 'sec-upgrade-written-%' OR question_id LIKE 'sec-upgrade-practical-%') AS question_versions,
 (SELECT COUNT(*)${cast} FROM ontology_concepts WHERE source_id='SECURIUM_CONTENT_UPGRADE_V2') AS ontology_concepts,
 (SELECT COUNT(*)${cast} FROM ontology_edges WHERE course_id='course-ise' AND (from_id LIKE 'sec-upgrade-%' OR to_id LIKE 'sec-upgrade-%' OR from_id LIKE 'upgrade-course-lesson-%' OR to_id LIKE 'upgrade-course-lesson-%')) AS ontology_edges,
 (SELECT COUNT(*)${cast} FROM question_courses WHERE course_id='course-isie' AND (question_id LIKE 'sec-upgrade-written-%' OR question_id LIKE 'sec-upgrade-practical-%')) AS wrong_course_links,
 (SELECT COUNT(*)${cast} FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id JOIN question_courses qc ON qc.question_id=qs.question_id WHERE (qs.question_id LIKE 'sec-upgrade-written-%' OR qs.question_id LIKE 'sec-upgrade-practical-%') AND s.course_id<>qc.course_id) AS course_subject_mismatch,
 (SELECT COUNT(*)${cast} FROM question_topics qt JOIN topics t ON t.id=qt.topic_id JOIN question_subjects qs ON qs.question_id=qt.question_id WHERE (qt.question_id LIKE 'sec-upgrade-written-%' OR qt.question_id LIKE 'sec-upgrade-practical-%') AND t.subject_id<>qs.subject_id) AS subject_topic_mismatch,
 (SELECT COUNT(*)${cast} FROM questions q LEFT JOIN question_courses qc ON qc.question_id=q.id LEFT JOIN question_subjects qs ON qs.question_id=q.id LEFT JOIN question_topics qt ON qt.question_id=q.id WHERE (q.id LIKE 'sec-upgrade-written-%' OR q.id LIKE 'sec-upgrade-practical-%') AND (qc.question_id IS NULL OR qs.question_id IS NULL OR qt.question_id IS NULL)) AS orphans;`;
}

function assertVerification(rows, currentPlan) {
  const metrics = new Map(Object.entries(rows[0] ?? {}).map(([metric, value]) => [metric, Number(value)]));
  const expectedQuestions = currentPlan.questions.length;
  const exact = {
    contents: currentPlan.contents.length,
    questions: expectedQuestions,
    written: currentPlan.sourceSummary.writtenQuestionCount,
    practical: currentPlan.sourceSummary.practicalQuestionCount,
    course_lessons: currentPlan.courseLessons.length,
    content_links: expectedQuestions,
    question_versions: expectedQuestions,
    ontology_concepts: currentPlan.concepts.length,
  };
  for (const [metric, expected] of Object.entries(exact)) {
    if (metrics.get(metric) !== expected) {
      fail("SECURITY_CONTENT_V3_COUNT_MISMATCH", `${metric}:${metrics.get(metric)}!=${expected}`);
    }
  }
  for (const metric of ["wrong_course_links", "course_subject_mismatch", "subject_topic_mismatch", "orphans"]) {
    if (metrics.get(metric) !== 0) fail("SECURITY_CONTENT_V3_INTEGRITY_MISMATCH", metric);
  }
  if ((metrics.get("ontology_edges") ?? 0) < expectedQuestions * 2) {
    fail("SECURITY_CONTENT_V3_ONTOLOGY_EDGES_MISSING");
  }
}

function protectedCourseSnapshotSql() {
  return `
SELECT c.id,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id) AS subjects,
 (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id) AS topics,
 (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id=c.id) AS learning_units,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS lessons,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) AS questions
FROM courses c
WHERE c.id NOT IN ('course-ise','course-isie')
ORDER BY c.id;`;
}

function assertProtectedSnapshot(before, after) {
  if (JSON.stringify(normalizeRows(before)) !== JSON.stringify(normalizeRows(after))) {
    fail("SECURITY_CONTENT_V3_PROTECTED_COURSE_CHANGED");
  }
}

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value])));
}

function planSummary(currentPlan, root) {
  return {
    status: "SECURITY_CONTENT_V3_PLAN_OK",
    sourceRoot: root,
    readOnlySource: true,
    targetCourseIds: ["course-ise", "course-isie"],
    importedCourseIds: ["course-ise"],
    ...currentPlan.sourceSummary,
    contentCount: currentPlan.contents.length,
    questionCount: currentPlan.questions.length,
    ontologyConceptCount: currentPlan.concepts.length,
    ontologyEdgeCount: currentPlan.ontologyEdges.length,
  };
}

function verificationSummary(rows) {
  return { metrics: Object.fromEntries(Object.entries(rows[0] ?? {}).map(([metric, value]) => [metric, Number(value)])) };
}

function connectPostgres(purpose) {
  const url = purpose === "seed"
    ? process.env.POSTGRES_SEED_URL || process.env.POSTGRES_MIGRATION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL
    : process.env.POSTGRES_VERIFY_URL || process.env.DATABASE_URL || process.env.POSTGRES_SEED_URL || process.env.POSTGRES_MIGRATION_URL || process.env.DIRECT_URL;
  if (!url?.trim()) fail("SECURITY_CONTENT_V3_POSTGRES_URL_REQUIRED");
  return postgres(url.trim(), { max: 1, prepare: false, ssl: "require", connect_timeout: 10, idle_timeout: 5, onnotice: false });
}

function assertProductionApproval() {
  if (!process.argv.includes("--confirm-production-seed")) fail("SECURITY_CONTENT_V3_CONFIRM_FLAG_REQUIRED");
  if (process.env[SECURITY_CONTENT_V3_CONFIRM_ENV_NAME] !== SECURITY_CONTENT_V3_CONFIRM_ENV_VALUE) {
    fail("SECURITY_CONTENT_V3_CONFIRM_ENV_REQUIRED");
  }
}

async function d1Query(configPath, statement) {
  const result = await runCapture(process.execPath, [
    "scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, ...persistArgs(), "--command", statement,
  ]);
  if (result.code !== 0) fail("SECURITY_CONTENT_V3_D1_QUERY_FAILED", result.stdout.slice(-300));
  const clean = result.stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) fail("SECURITY_CONTENT_V3_D1_JSON_MISSING");
  const payload = JSON.parse(clean.slice(start, end + 1));
  return payload[0]?.results ?? [];
}

function runCapture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stdout += chunk; });
    child.on("error", () => resolvePromise({ code: 1, stdout }));
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

function persistArgs() {
  return persistTo ? ["--persist-to", persistTo] : [];
}

function argValue(prefix) {
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function safeError(error) {
  return error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 300) : "UNKNOWN";
}

function fail(code, detail) {
  console.error(detail ? `${code}:${detail}` : code);
  process.exit(1);
}
