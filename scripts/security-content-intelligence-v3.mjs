import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import postgres from "postgres";
import { loadLocalEnvIfPresent } from "./load-local-env.mjs";
import {
  buildSecurityContentIntelligenceV3Plan,
  generateSecurityContentV3Sql,
  generateSecurityContentIntelligenceV3Sql,
} from "../lib/data/security-content-upgrade-v3.mjs";

loadLocalEnvIfPresent();

const action = process.argv[2] ?? "plan";
const validActions = new Set([
  "plan",
  "seed:d1-local",
  "verify:d1-local",
  "dry-run:postgres",
  "dry-run:postgres-connected",
  "apply:postgres",
  "verify:postgres",
]);
if (!validActions.has(action)) fail("SECURITY_CONTENT_INTELLIGENCE_V3_ACTION_INVALID");
const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
const persistTo = argValue("--persist-to=");
const plan = buildSecurityContentIntelligenceV3Plan();

if (action === "plan") {
  console.log(JSON.stringify(summary(), null, 2));
} else if (action === "seed:d1-local") {
  await seedD1();
} else if (action === "verify:d1-local") {
  await verifyD1();
} else if (action === "dry-run:postgres") {
  await postgresDryRun();
} else if (action === "dry-run:postgres-connected") {
  await postgresConnectedDryRun();
} else if (action === "apply:postgres") {
  await postgresProductionApply();
} else {
  await verifyPostgresProduction();
}

async function seedD1() {
  await runQualityGate();
  await assertPrerequisites();
  const beforeProtected = await d1Query(protectedSnapshotSql());
  const beforeUser = await d1Query(userSnapshotSql());
  const tempDir = await mkdtemp(join(tmpdir(), "securium-intelligence-v3-"));
  const sqlPath = join(tempDir, "security-content-intelligence-v3.d1.sql");
  try {
    await writeFile(sqlPath, generateSecurityContentIntelligenceV3Sql({ dialect: "d1" }), "utf8");
    const result = await runCapture(process.execPath, ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, ...persistArgs(), "--file", sqlPath]);
    if (result.code !== 0) fail("SECURITY_CONTENT_INTELLIGENCE_V3_D1_APPLY_FAILED", result.stdout.slice(-800));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  const afterProtected = await d1Query(protectedSnapshotSql());
  const afterUser = await d1Query(userSnapshotSql());
  assertSame(beforeProtected, afterProtected, "PROTECTED_COURSE_CHANGED");
  assertSame(beforeUser, afterUser, "USER_DATA_CHANGED");
  await verifyD1();
  console.log("SECURITY_CONTENT_INTELLIGENCE_V3_D1_LOCAL_APPLIED");
}

async function runQualityGate() {
  const result = await runCapture(process.execPath, ["scripts/validate-security-content-intelligence-v3.mjs", `--config=${configPath}`, ...(persistTo ? [`--persist-to=${persistTo}`] : [])]);
  if (result.code !== 0) fail("SECURITY_CONTENT_INTELLIGENCE_V3_QUALITY_GATE_FAILED", result.stdout.slice(-800));
}

async function assertPrerequisites() {
  assertPrerequisiteRows(await d1Query(prerequisiteSql()));
}

async function verifyD1() {
  const rows = await d1Query(verificationSql());
  const row = normalizeMetricRow(rows[0]);
  assertVerificationRow(row);
  const report = { generatedAt: new Date().toISOString(), target: "D1_LOCAL", status: "PASS", metrics: row };
  await writeFile(resolve("reports/content-v3/db-validation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log("SECURITY_CONTENT_INTELLIGENCE_V3_D1_LOCAL_OK");
}

async function postgresDryRun() {
  const sql = generateSecurityContentIntelligenceV3Sql({ dialect: "postgres" });
  const courseTokens = sql.match(/course-[a-z0-9-]+/g) ?? [];
  const deleteStatements = sql.match(/DELETE FROM[\s\S]*?;/gi) ?? [];
  const checks = {
    transaction_wrapped: sql.trimStart().startsWith("BEGIN;") && sql.trimEnd().endsWith("COMMIT;"),
    target_courses_only: courseTokens.every((value) => value.includes("course-ise") || value.includes("course-isie")),
    no_global_update: !/(?:^|\n)UPDATE\s+/im.test(sql),
    no_global_delete: deleteStatements.every((value) => /DELETE FROM "question_(courses|subjects|topics)"/.test(value) && /question_id"? IN/.test(value)),
    deterministic_question_scope: sql.includes("question-v3-course-ise-") && sql.includes("question-v3-course-isie-"),
    canonical_concepts_not_mutated: !sql.includes('INSERT INTO "ontology_concepts"') && !sql.includes('UPDATE "ontology_concepts"'),
    user_tables_not_mutated: !/(INSERT INTO|UPDATE|DELETE FROM)\s+"?(question_attempts|wrong_notes|bookmarks|user_progress|user_lesson_progress|user_course_lesson_progress|review_schedules)/i.test(sql),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    status: Object.values(checks).every(Boolean) ? "PASS_STATIC_DRY_RUN" : "FAIL",
    transactionApplyAttempted: false,
    productionWriteAttempted: false,
    connectionStatus: "NOT_USED_STATIC_ONLY",
    sqlSha256: createHash("sha256").update(sql).digest("hex"),
    sqlBytes: Buffer.byteLength(sql),
    statementCount: sql.split(";").filter((value) => value.trim()).length,
    plan: summary(),
    checks,
    connectedDryRunPolicy: {
      action: "dry-run:postgres-connected",
      explicitCliConfirmationRequired: true,
      explicitEnvironmentConfirmationRequired: true,
      alwaysRollback: true,
      protectedCourseSnapshotComparedAfterRollback: true,
      userDataSnapshotComparedAfterRollback: true,
      canonicalBootstrapAndIntelligenceInOneTransaction: true,
    },
    productionApplyPolicy: {
      action: "apply:postgres",
      explicitCliConfirmationRequired: true,
      explicitEnvironmentConfirmationRequired: true,
      exactSqlSha256Required: true,
      authorizedExistingActorRequired: true,
      matchingConnectedDryRunRequired: true,
      connectedDryRunMaximumAgeHours: 24,
      writeConnectionVariables: ["POSTGRES_MIGRATION_URL", "DIRECT_URL", "POSTGRES_SEED_URL", "DATABASE_URL"],
    },
    note: "PostgreSQL and D1 are intentionally not synchronized. A connected transaction dry-run remains required before any separately approved production apply.",
  };
  await writeFile(resolve("reports/content-v3/postgres-dry-run.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (report.status === "FAIL") fail("SECURITY_CONTENT_INTELLIGENCE_V3_POSTGRES_DRY_RUN_FAILED", JSON.stringify(checks));
  console.log(JSON.stringify(report, null, 2));
}

async function postgresConnectedDryRun() {
  assertConnectedDryRunApproval();
  const client = connectPostgres("verify");
  let bundle;
  let sqlSha256 = null;
  let actorIdHash = null;
  let report;
  let failure;
  let transactionStarted = false;
  let transactionRolledBack = false;
  try {
    const actorId = await resolveContentActor(client);
    actorIdHash = sha256(actorId);
    bundle = await postgresTransactionBundle(actorId);
    sqlSha256 = bundle.sqlSha256;
    const versionRows = await client.unsafe("SELECT current_setting('server_version_num')::integer AS server_version_num;");
    const beforeProtected = normalizeRows(await client.unsafe(protectedSnapshotSql()));
    const beforeUser = normalizeRows(await client.unsafe(userSnapshotSql()));
    const beforeTarget = normalizeRows(await client.unsafe(targetSnapshotSql()));
    await client.unsafe("BEGIN;");
    transactionStarted = true;
    let transactionOpen = true;
    try {
      await client.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '120s';");
      await client.unsafe(unwrapTransaction(bundle.bootstrapSql));
      assertPrerequisiteRows(await client.unsafe(prerequisiteSql(actorId)));
      await client.unsafe(unwrapTransaction(bundle.intelligenceSql));
      const metrics = normalizeMetricRow((await client.unsafe(verificationSql()))[0]);
      assertVerificationRow(metrics);
      const simulatedTarget = normalizeRows(await client.unsafe(targetSnapshotSql()));
      await client.unsafe("ROLLBACK;");
      transactionOpen = false;
      transactionRolledBack = true;
      const afterProtected = normalizeRows(await client.unsafe(protectedSnapshotSql()));
      const afterUser = normalizeRows(await client.unsafe(userSnapshotSql()));
      const afterTarget = normalizeRows(await client.unsafe(targetSnapshotSql()));
      assertRowsSame(beforeProtected, afterProtected, "PROTECTED_COURSE_CHANGED_AFTER_ROLLBACK");
      assertRowsSame(beforeUser, afterUser, "USER_DATA_CHANGED_AFTER_ROLLBACK");
      assertRowsSame(beforeTarget, afterTarget, "TARGET_COURSE_CHANGED_AFTER_ROLLBACK");
      report = {
        generatedAt: new Date().toISOString(),
        target: "POSTGRES_CONNECTED",
        status: "PASS_CONNECTED_ROLLBACK",
        serverVersionNum: Number(versionRows[0]?.server_version_num ?? 0),
        sqlSha256,
        bootstrapSqlSha256: bundle.bootstrapSqlSha256,
        intelligenceSqlSha256: bundle.intelligenceSqlSha256,
        actorIdSha256: actorIdHash,
        canonicalBootstrapIncluded: true,
        transactionApplyAttempted: true,
        transactionRolledBack: true,
        productionWriteAttempted: false,
        protectedCoursesUnchanged: true,
        userDataUnchanged: true,
        targetCoursesRestoredAfterRollback: true,
        targetCourseSimulation: buildSnapshotDelta(beforeTarget, simulatedTarget),
        metrics,
      };
    } catch (error) {
      if (transactionOpen) {
        await client.unsafe("ROLLBACK;").then(() => { transactionRolledBack = true; }).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    failure = error;
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
  if (failure) {
    const error = safeError(failure);
    report = {
      generatedAt: new Date().toISOString(),
      target: "POSTGRES_CONNECTED",
      status: error.includes("relation \"ontology_concepts\" does not exist")
        ? "BLOCKED_REMOTE_SCHEMA_PREREQUISITE"
        : "FAIL_CONNECTED_DRY_RUN",
      sqlSha256,
      actorIdSha256: actorIdHash,
      transactionApplyAttempted: transactionStarted,
      transactionRolledBack,
      productionWriteAttempted: false,
      requiredMigration: error.includes("ontology_concepts") ? "0008_ontology_graph_storage" : null,
      error,
    };
    await writeJsonReport("postgres-connected-dry-run.json", report);
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_POSTGRES_CONNECTED_DRY_RUN_FAILED", error);
  }
  await writeJsonReport("postgres-connected-dry-run.json", report);
  console.log(JSON.stringify(report, null, 2));
}

async function postgresProductionApply() {
  assertProductionApplyApproval();
  const actorId = process.env.SECURIUM_SECURITY_CONTENT_V3_ACTOR_ID?.trim() || await resolveContentActorForProduction();
  const bundle = await postgresTransactionBundle(actorId);
  const sqlSha256 = bundle.sqlSha256;
  if (process.env.SECURIUM_SECURITY_CONTENT_V3_SQL_SHA256 !== sqlSha256) {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_PRODUCTION_SQL_SHA_REQUIRED");
  }
  const connectedReport = await readConnectedDryRunReport();
  const connectedReportAgeMs = Date.now() - Date.parse(connectedReport.generatedAt ?? "");
  if (
    connectedReport.status !== "PASS_CONNECTED_ROLLBACK" ||
    connectedReport.transactionRolledBack !== true ||
    connectedReport.sqlSha256 !== sqlSha256 ||
    connectedReport.actorIdSha256 !== sha256(actorId) ||
    !Number.isFinite(connectedReportAgeMs) ||
    connectedReportAgeMs < 0 ||
    connectedReportAgeMs > 24 * 60 * 60 * 1000
  ) {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_CONNECTED_DRY_RUN_REQUIRED");
  }
  const client = connectPostgres("apply");
  let report;
  let failure;
  try {
    await assertContentActor(client, actorId);
    await client.unsafe("BEGIN;");
    let transactionOpen = true;
    try {
      await client.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '120s';");
      const beforeProtected = normalizeRows(await client.unsafe(protectedSnapshotSql()));
      const beforeUser = normalizeRows(await client.unsafe(userSnapshotSql()));
      const beforeTarget = normalizeRows(await client.unsafe(targetSnapshotSql()));
      await client.unsafe(unwrapTransaction(bundle.bootstrapSql));
      assertPrerequisiteRows(await client.unsafe(prerequisiteSql(actorId)));
      await client.unsafe(unwrapTransaction(bundle.intelligenceSql));
      const metrics = normalizeMetricRow((await client.unsafe(verificationSql()))[0]);
      assertVerificationRow(metrics);
      const afterTarget = normalizeRows(await client.unsafe(targetSnapshotSql()));
      const targetCourseChanges = buildSnapshotDelta(beforeTarget, afterTarget);
      assertRowsSame(connectedReport.targetCourseSimulation, targetCourseChanges, "TARGET_COURSE_SIMULATION_CHANGED");
      assertRowsSame(beforeProtected, normalizeRows(await client.unsafe(protectedSnapshotSql())), "PROTECTED_COURSE_CHANGED");
      assertRowsSame(beforeUser, normalizeRows(await client.unsafe(userSnapshotSql())), "USER_DATA_CHANGED");
      await client.unsafe("COMMIT;");
      transactionOpen = false;
      report = {
        generatedAt: new Date().toISOString(),
        target: "POSTGRES_PRODUCTION",
        status: "PASS_COMMITTED",
        sqlSha256,
        bootstrapSqlSha256: bundle.bootstrapSqlSha256,
        intelligenceSqlSha256: bundle.intelligenceSqlSha256,
        actorIdSha256: sha256(actorId),
        canonicalBootstrapIncluded: true,
        connectedDryRunGeneratedAt: connectedReport.generatedAt,
        protectedCoursesUnchanged: true,
        userDataUnchanged: true,
        targetCourseChanges,
        metrics,
      };
    } catch (error) {
      if (transactionOpen) await client.unsafe("ROLLBACK;").catch(() => undefined);
      throw error;
    }
  } catch (error) {
    failure = error;
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
  if (failure) fail("SECURITY_CONTENT_INTELLIGENCE_V3_POSTGRES_PRODUCTION_APPLY_FAILED", safeError(failure));
  await writeJsonReport("postgres-production-apply.json", report);
  console.log(JSON.stringify(report, null, 2));
}

async function verifyPostgresProduction() {
  const productionReport = await readProductionApplyReport();
  const client = connectPostgres("verify");
  let report;
  let failure;
  try {
    const actorId = await resolveContentActor(client);
    assertPrerequisiteRows(await client.unsafe(prerequisiteSql(actorId)));
    const metrics = normalizeMetricRow((await client.unsafe(verificationSql()))[0]);
    assertVerificationRow(metrics);
    const targetCourses = normalizeRows(await client.unsafe(targetSnapshotSql()));
    assertRowsSame(productionReport.targetCourseChanges.map((row) => row.simulatedAfter), targetCourses, "PRODUCTION_TARGET_SNAPSHOT_MISMATCH");
    const protectedCourses = normalizeRows(await client.unsafe(protectedSnapshotSql()));
    const userData = normalizeRows(await client.unsafe(userSnapshotSql()));
    report = {
      generatedAt: new Date().toISOString(),
      target: "POSTGRES_PRODUCTION_READ_ONLY_VALIDATION",
      status: "PASS_POST_COMMIT_VALIDATION",
      sqlSha256: productionReport.sqlSha256,
      productionAppliedAt: productionReport.generatedAt,
      transactionProtectedCoursesUnchanged: productionReport.protectedCoursesUnchanged,
      transactionUserDataUnchanged: productionReport.userDataUnchanged,
      targetCourses,
      protectedCourses,
      userData,
      metrics,
    };
  } catch (error) {
    failure = error;
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
  if (failure) fail("SECURITY_CONTENT_INTELLIGENCE_V3_POSTGRES_VERIFY_FAILED", safeError(failure));
  await writeJsonReport("postgres-production-validation.json", report);
  console.log(JSON.stringify(report, null, 2));
}

async function postgresTransactionBundle(actorId) {
  const sourceRoot = resolve(process.env.SECURIUM_CONTENT_V2_SOURCE_ROOT?.trim() || "securium-content-upgrade-v2");
  const source = JSON.parse(await readFile(join(sourceRoot, "data", "normalized-knowledge-base.json"), "utf8"));
  const bootstrapSql = generateSecurityContentV3Sql(source, { dialect: "postgres", actorId });
  const intelligenceSql = generateSecurityContentIntelligenceV3Sql({ dialect: "postgres", actorId });
  return {
    bootstrapSql,
    intelligenceSql,
    bootstrapSqlSha256: sha256(bootstrapSql),
    intelligenceSqlSha256: sha256(intelligenceSql),
    sqlSha256: sha256(`${bootstrapSql}\n${intelligenceSql}`),
  };
}

async function resolveContentActor(client) {
  const rows = await client.unsafe(`SELECT u.id
FROM users u
JOIN user_roles ur ON ur.user_id=u.id
JOIN roles r ON r.id=ur.role_id
WHERE u.status='ACTIVE' AND r.code IN ('SUPER_ADMIN','CONTENT_MANAGER')
ORDER BY CASE r.code WHEN 'SUPER_ADMIN' THEN 0 ELSE 1 END, u.id
LIMIT 1;`);
  const actorId = rows[0]?.id;
  if (!actorId) throw new Error("ACTIVE_CONTENT_ACTOR_REQUIRED");
  return actorId;
}

async function resolveContentActorForProduction() {
  const client = connectPostgres("verify");
  try {
    return await resolveContentActor(client);
  } finally {
    await client.end({ timeout: 5 }).catch(() => undefined);
  }
}

async function assertContentActor(client, actorId) {
  const rows = await client.unsafe(`SELECT COUNT(*) AS actor
FROM users u
JOIN user_roles ur ON ur.user_id=u.id
JOIN roles r ON r.id=ur.role_id
WHERE u.id=${q(actorId)} AND u.status='ACTIVE' AND r.code IN ('SUPER_ADMIN','CONTENT_MANAGER');`);
  if (Number(rows[0]?.actor ?? 0) < 1) throw new Error("AUTHORIZED_CONTENT_ACTOR_REQUIRED");
}

function prerequisiteSql(actorId = "user-content-editor") {
  const conceptKeys = [...new Set(plan.ontologyEdges.flatMap((edge) => [
    ...(edge.toType === "CONCEPT" ? [edge.toId] : []),
    ...(edge.fromType === "CONCEPT" ? [edge.fromId] : []),
  ]))];
  const nodeIds = plan.courseLessons.map((lesson) => lesson.curriculumNodeId);
  const subjectIds = [...new Set(plan.questions.map((question) => question.subjectId))];
  const topicIds = [...new Set(plan.questions.map((question) => question.topicId))];
  return `SELECT
 (SELECT COUNT(*) FROM courses WHERE id IN ('course-ise','course-isie')) AS courses,
 (SELECT COUNT(*) FROM subjects WHERE id IN (${subjectIds.map(q).join(",")})) AS subjects,
 (SELECT COUNT(*) FROM topics WHERE id IN (${topicIds.map(q).join(",")})) AS topics,
 (SELECT COUNT(*) FROM curriculum_nodes WHERE id IN (${nodeIds.map(q).join(",")})) AS nodes,
 (SELECT COUNT(*) FROM ontology_concepts WHERE concept_key IN (${conceptKeys.map(q).join(",")})) AS concepts,
 (SELECT COUNT(*) FROM users WHERE id=${q(actorId)}) AS actor;`;
}

function prerequisiteExpected() {
  const conceptKeys = new Set(plan.ontologyEdges.flatMap((edge) => [
    ...(edge.toType === "CONCEPT" ? [edge.toId] : []),
    ...(edge.fromType === "CONCEPT" ? [edge.fromId] : []),
  ]));
  return {
    courses: 2,
    subjects: new Set(plan.questions.map((question) => question.subjectId)).size,
    topics: new Set(plan.questions.map((question) => question.topicId)).size,
    nodes: new Set(plan.courseLessons.map((lesson) => lesson.curriculumNodeId)).size,
    concepts: conceptKeys.size,
    actor: 1,
  };
}

function assertPrerequisiteRows(rows) {
  const row = normalizeMetricRow(rows[0]);
  for (const [key, value] of Object.entries(prerequisiteExpected())) {
    if (row[key] !== value) throw new Error(`PREREQUISITE_MISSING:${key}:${row[key]}!=${value}`);
  }
}

function verificationExpected() {
  return {
    contents: plan.contents.length,
    questions: plan.questions.length,
    course_ise_contents: plan.contents.filter((item) => item.id.includes("content-v3-course-ise-")).length,
    course_isie_contents: plan.contents.filter((item) => item.id.includes("content-v3-course-isie-")).length,
    course_ise_questions: plan.questions.filter((item) => item.courseId === "course-ise").length,
    course_isie_questions: plan.questions.filter((item) => item.courseId === "course-isie").length,
    written: plan.questions.filter((item) => item.examTrack === "WRITTEN").length,
    practical: plan.questions.filter((item) => item.examTrack === "PRACTICAL").length,
    course_lessons: plan.courseLessons.length,
    content_links: plan.questions.length,
    question_versions: plan.questions.length,
    ontology_edges: plan.ontologyEdges.length,
  };
}

function assertVerificationRow(row) {
  for (const [key, value] of Object.entries(verificationExpected())) {
    if (row[key] !== value) throw new Error(`COUNT_MISMATCH:${key}:${row[key]}!=${value}`);
  }
  for (const key of ["orphan_questions", "orphan_contents", "course_subject_mismatch", "subject_topic_mismatch", "content_course_mismatch", "broken_concept_relation", "missing_question_provenance", "missing_content_provenance", "invalid_answer", "placeholder_content"]) {
    if (row[key] !== 0) throw new Error(`INTEGRITY_FAILED:${key}:${row[key]}`);
  }
}

function assertConnectedDryRunApproval() {
  if (!process.argv.includes("--confirm-connected-dry-run")) fail("SECURITY_CONTENT_INTELLIGENCE_V3_CONNECTED_DRY_RUN_CONFIRM_FLAG_REQUIRED");
  if (process.env.SECURIUM_CONFIRM_SECURITY_CONTENT_V3_CONNECTED_DRY_RUN !== "ROLLBACK_SECURITY_CONTENT_V3") {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_CONNECTED_DRY_RUN_CONFIRM_ENV_REQUIRED");
  }
}

function assertProductionApplyApproval() {
  if (!process.argv.includes("--confirm-production-apply")) fail("SECURITY_CONTENT_INTELLIGENCE_V3_PRODUCTION_CONFIRM_FLAG_REQUIRED");
  if (process.env.SECURIUM_CONFIRM_SECURITY_CONTENT_V3_PRODUCTION_APPLY !== "APPLY_SECURITY_CONTENT_V3") {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_PRODUCTION_CONFIRM_ENV_REQUIRED");
  }
}

function connectPostgres(purpose) {
  const url = purpose === "apply"
    ? process.env.POSTGRES_MIGRATION_URL || process.env.POSTGRES_SEED_URL || process.env.DATABASE_URL || process.env.DIRECT_URL
    : process.env.POSTGRES_VERIFY_URL || process.env.DATABASE_URL || process.env.POSTGRES_MIGRATION_URL || process.env.DIRECT_URL || process.env.POSTGRES_SEED_URL;
  if (!url?.trim()) fail("SECURITY_CONTENT_INTELLIGENCE_V3_POSTGRES_URL_REQUIRED");
  return postgres(url.trim(), {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: false,
  });
}

function unwrapTransaction(sqlText) {
  const body = sqlText.trim().replace(/^BEGIN;\s*/i, "").replace(/\s*COMMIT;$/i, "");
  if (body === sqlText.trim()) throw new Error("TRANSACTION_WRAPPER_MISSING");
  return body;
}

async function readConnectedDryRunReport() {
  try {
    return JSON.parse(await readFile(resolve("reports/content-v3/postgres-connected-dry-run.json"), "utf8"));
  } catch {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_CONNECTED_DRY_RUN_REPORT_REQUIRED");
  }
}

async function readProductionApplyReport() {
  try {
    return JSON.parse(await readFile(resolve("reports/content-v3/postgres-production-apply.json"), "utf8"));
  } catch {
    fail("SECURITY_CONTENT_INTELLIGENCE_V3_PRODUCTION_APPLY_REPORT_REQUIRED");
  }
}

async function writeJsonReport(filename, payload) {
  await writeFile(resolve("reports/content-v3", filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeMetricRow(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" || (typeof value === "string" && /^\d+$/.test(value)) ? Number(value) : value])));
}

function buildSnapshotDelta(before, after) {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  return after.map((row) => ({
    id: row.id,
    before: beforeById.get(row.id),
    simulatedAfter: row,
    delta: Object.fromEntries(Object.entries(row)
      .filter(([key, value]) => key !== "id" && typeof value === "number")
      .map(([key, value]) => [key, value - Number(beforeById.get(row.id)?.[key] ?? 0)])),
  }));
}

function assertRowsSame(before, after, code) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeError(error) {
  return error instanceof Error ? error.message.replace(/[\r\n]+/g, " ").slice(0, 500) : "UNKNOWN";
}

function verificationSql() {
  return `SELECT
 (SELECT COUNT(*) FROM contents WHERE id LIKE 'content-v3-course-is%-') AS impossible_guard,
 (SELECT COUNT(*) FROM contents WHERE id LIKE 'content-v3-course-ise-%' OR id LIKE 'content-v3-course-isie-%') AS contents,
 (SELECT COUNT(*) FROM questions WHERE id LIKE 'question-v3-course-ise-%' OR id LIKE 'question-v3-course-isie-%') AS questions,
 (SELECT COUNT(*) FROM course_lessons WHERE course_id='course-ise' AND content_id LIKE 'content-v3-course-ise-%') AS course_ise_contents,
 (SELECT COUNT(*) FROM course_lessons WHERE course_id='course-isie' AND content_id LIKE 'content-v3-course-isie-%') AS course_isie_contents,
 (SELECT COUNT(*) FROM question_courses WHERE course_id='course-ise' AND question_id LIKE 'question-v3-course-ise-%') AS course_ise_questions,
 (SELECT COUNT(*) FROM question_courses WHERE course_id='course-isie' AND question_id LIKE 'question-v3-course-isie-%') AS course_isie_questions,
 (SELECT COUNT(*) FROM questions WHERE id LIKE 'question-v3-course-%-written-%') AS written,
 (SELECT COUNT(*) FROM questions WHERE id LIKE 'question-v3-course-%-practical-%') AS practical,
 (SELECT COUNT(*) FROM course_lessons WHERE id LIKE 'course-lesson-content-v3-course-%') AS course_lessons,
 (SELECT COUNT(*) FROM content_question_links WHERE question_id LIKE 'question-v3-course-%') AS content_links,
 (SELECT COUNT(*) FROM question_versions WHERE question_id LIKE 'question-v3-course-%') AS question_versions,
 (SELECT COUNT(*) FROM ontology_edges WHERE evidence_json LIKE '%SECURIUM_CONTENT_UPGRADE_V3%' AND course_id IN ('course-ise','course-isie')) AS ontology_edges,
 (SELECT COUNT(*) FROM questions q LEFT JOIN question_courses qc ON qc.question_id=q.id LEFT JOIN question_subjects qs ON qs.question_id=q.id LEFT JOIN question_topics qt ON qt.question_id=q.id WHERE q.id LIKE 'question-v3-course-%' AND (qc.question_id IS NULL OR qs.question_id IS NULL OR qt.question_id IS NULL)) AS orphan_questions,
 (SELECT COUNT(*) FROM contents c LEFT JOIN course_lessons cl ON cl.content_id=c.id WHERE c.id LIKE 'content-v3-course-%' AND cl.content_id IS NULL) AS orphan_contents,
 (SELECT COUNT(*) FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id JOIN question_courses qc ON qc.question_id=qs.question_id WHERE qs.question_id LIKE 'question-v3-course-%' AND s.course_id<>qc.course_id) AS course_subject_mismatch,
 (SELECT COUNT(*) FROM question_topics qt JOIN topics t ON t.id=qt.topic_id JOIN question_subjects qs ON qs.question_id=qt.question_id WHERE qt.question_id LIKE 'question-v3-course-%' AND t.subject_id<>qs.subject_id) AS subject_topic_mismatch,
 (SELECT COUNT(*) FROM course_lessons cl JOIN curriculum_nodes cn ON cn.id=cl.curriculum_node_id JOIN curriculum_trees ct ON ct.id=cn.curriculum_tree_id WHERE cl.content_id LIKE 'content-v3-course-%' AND cl.course_id<>ct.course_id) AS content_course_mismatch,
 (SELECT COUNT(*) FROM ontology_edges oe LEFT JOIN ontology_concepts oc ON oc.concept_key=oe.to_id WHERE oe.from_id LIKE 'question-v3-course-%' AND oe.to_type='CONCEPT' AND oc.id IS NULL) AS broken_concept_relation,
 (SELECT COUNT(*) FROM questions WHERE id LIKE 'question-v3-course-%' AND (answer_config_json NOT LIKE '%sourceRefs%' OR answer_config_json NOT LIKE '%sourceTextImported%')) AS missing_question_provenance,
 (SELECT COUNT(*) FROM contents WHERE id LIKE 'content-v3-course-%' AND (body NOT LIKE '%sourceRefs%' OR body NOT LIKE '%sourceTextImported%')) AS missing_content_provenance,
 (SELECT COUNT(*) FROM questions q WHERE q.id LIKE 'question-v3-course-%-written-%' AND ((SELECT COUNT(*) FROM question_choices qc WHERE qc.question_id=q.id AND qc.is_correct=1)<>1 OR (SELECT COUNT(*) FROM question_choices qc WHERE qc.question_id=q.id)<>4)) AS invalid_answer,
 (SELECT COUNT(*) FROM contents WHERE id LIKE 'content-v3-course-%' AND (title LIKE '%기초 체계%' OR title LIKE '%실무 적용%' OR title LIKE '%평가 대비%' OR body LIKE '%필요한 범위부터 선택%')) AS placeholder_content;`;
}

function protectedSnapshotSql() {
  return `SELECT c.id,
 (SELECT COUNT(*) FROM subjects s WHERE s.course_id=c.id) subjects,
 (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id=c.id) topics,
 (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id=c.id) learning_units,
 (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) lessons,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.deleted_at IS NULL) contents,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) questions
 FROM courses c WHERE c.id NOT IN ('course-ise','course-isie') ORDER BY c.id;`;
}

function targetSnapshotSql() {
  return `SELECT c.id,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND cl.deleted_at IS NULL) contents,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id) questions,
 (SELECT COUNT(DISTINCT cl.content_id) FROM course_lessons cl WHERE cl.course_id=c.id AND (cl.content_id LIKE 'sec-upgrade-lesson-%' OR cl.content_id LIKE 'content-v3-course-%')) v3_contents,
 (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id=c.id AND (qc.question_id LIKE 'sec-upgrade-%' OR qc.question_id LIKE 'question-v3-course-%')) v3_questions,
 (SELECT COUNT(*) FROM ontology_edges oe WHERE oe.course_id=c.id) ontology_edges
 FROM courses c WHERE c.id IN ('course-ise','course-isie') ORDER BY c.id;`;
}

function userSnapshotSql() {
  return `SELECT
 (SELECT COUNT(*) FROM question_attempts) question_attempts,
 (SELECT COUNT(*) FROM wrong_notes) wrong_notes,
 (SELECT COUNT(*) FROM bookmarks) bookmarks,
 (SELECT COUNT(*) FROM user_progress) user_progress,
 (SELECT COUNT(*) FROM user_lesson_progress) user_lesson_progress,
 (SELECT COUNT(*) FROM user_course_lesson_progress) user_course_lesson_progress,
 (SELECT COUNT(*) FROM review_schedules) review_schedules;`;
}

function summary() {
  return {
    status: "SECURITY_CONTENT_INTELLIGENCE_V3_PLAN_OK",
    targetCourseIds: ["course-ise", "course-isie"],
    readOnlySource: true,
    ...plan.sourceSummary,
    ontologyConceptsReused: plan.concepts.length,
    ontologyEdges: plan.ontologyEdges.length,
  };
}

function assertSame(before, after, code) {
  if (JSON.stringify(before) !== JSON.stringify(after)) fail(`SECURITY_CONTENT_INTELLIGENCE_V3_${code}`);
}

async function d1Query(statement) {
  const result = await runCapture(process.execPath, ["scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local", "--config", configPath, ...persistArgs(), "--command", statement]);
  if (result.code !== 0) fail("SECURITY_CONTENT_INTELLIGENCE_V3_D1_QUERY_FAILED", result.stdout.slice(-600));
  const clean = result.stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) fail("SECURITY_CONTENT_INTELLIGENCE_V3_D1_JSON_MISSING");
  return JSON.parse(clean.slice(start, end + 1))[0]?.results ?? [];
}

function runCapture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env, windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stdout += chunk; });
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
    child.on("error", () => resolvePromise({ code: 1, stdout }));
  });
}

function persistArgs() { return persistTo ? ["--persist-to", persistTo] : []; }

function q(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function argValue(prefix) { return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length); }
function fail(code, detail = "") { console.error(code, detail); process.exit(1); }
