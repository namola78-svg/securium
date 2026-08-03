import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  generateSecurityCertificationCurriculumSeedSql,
  getSecurityCertificationCurriculumSeedStats,
} from "../lib/curriculum/security-certification-curriculum-seed.ts";

test("security certification curriculum seed generates D1 and Postgres SQL", () => {
  const d1Sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "d1" });
  const postgresSql = generateSecurityCertificationCurriculumSeedSql({ dialect: "postgres" });

  assert.match(d1Sql, /INSERT OR IGNORE INTO "curriculum_trees"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "curriculum_nodes"/);
  assert.doesNotMatch(d1Sql, /\bBEGIN;/);
  assert.doesNotMatch(d1Sql, /\bCOMMIT;/);
  assert.match(postgresSql, /INSERT INTO "curriculum_trees"/);
  assert.match(postgresSql, /\bBEGIN;/);
  assert.match(postgresSql, /\bCOMMIT;/);
  assert.match(postgresSql, /ON CONFLICT \("id"\) DO NOTHING/);
});

test("security certification curriculum seed keeps trees in DRAFT review state", () => {
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "postgres" });

  assert.equal((sql.match(/'DRAFT'/g) ?? []).length, 2);
});

test("security certification curriculum seed includes both official course trees", () => {
  const stats = getSecurityCertificationCurriculumSeedStats();
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "d1" });

  assert.deepEqual(
    stats.map((stat) => `${stat.courseId}:${stat.version}`),
    ["course-ise:2027-2029", "course-isie:2027-2029"],
  );
  assert.match(sql, /'curriculum-ise-2027-2029-official'/);
  assert.match(sql, /'curriculum-isie-2027-2029-official'/);
  assert.equal(stats.every((stat) => stat.nodeCount > 0), true);
});

test("security certification curriculum seed marks PDF cross-check metadata as complete", () => {
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "postgres" });

  assert.match(sql, /\"confirmedFromPdf\":true/);
  assert.match(sql, /\"needsPdfVerification\":false/);
  assert.match(sql, /\"pdfCrossCheckedAt\":\"2026-08-01\"/);
  assert.match(sql, /\"examTrack\":/);
  assert.doesNotMatch(sql, /\"needsPdfVerification\":true/);
});

test("security certification curriculum seed is additive only", () => {
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "postgres" });

  assert.doesNotMatch(sql, /\bDROP\b/i);
  assert.doesNotMatch(sql, /\bDELETE\b/i);
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
  assert.doesNotMatch(sql, /\bUPDATE\b/i);
});

test("security certification curriculum seed creates stable node ids with parent references", () => {
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect: "d1" });

  assert.match(sql, /'curriculum-node-ise-2027-2029-01'/);
  assert.match(sql, /'curriculum-node-ise-2027-2029-01-01'/);
  assert.match(sql, /'curriculum-node-ise-2027-2029-01'/);
  assert.match(sql, /'curriculum-node-isie-2027-2029-02'/);
});

test("security certification curriculum seed apply script gates remote data changes", () => {
  const script = readFileSync(
    "scripts/apply-security-certification-curriculum-seed.mjs",
    "utf8",
  );

  assert.match(script, /--confirm-production-seed/);
  assert.match(script, /SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_SEED/);
  assert.match(script, /APPLY_SECURITY_CERTIFICATION_CURRICULUM_SEED/);
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /assertProductionSeedApproval\(\)/);
});

test("security certification curriculum activation requires clean precheck", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const script = readFileSync(
    "scripts/activate-security-certification-curriculum.mjs",
    "utf8",
  );

  assert.equal(
    packageJson.scripts["curriculum:security-certification:activate:check:postgres"],
    "node scripts/activate-security-certification-curriculum.mjs --check-only",
  );
  assert.equal(
    packageJson.scripts["curriculum:security-certification:activate:check:d1-local"],
    "node scripts/activate-security-certification-curriculum.mjs d1-local --check-only",
  );
  assert.match(script, /--confirm-production-activation/);
  assert.match(script, /--check-only/);
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_TARGET_UNSUPPORTED/);
  assert.match(script, /SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_POSTGRES_OK/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_LOCAL_OK/);
  assert.match(script, /buildPreActivationSql\("d1"\)/);
  assert.match(script, /buildPreActivationSql\("postgres"\)/);
  assert.match(script, /buildActivationPlanSql/);
  assert.match(script, /assertPreActivationCoverage/);
  assert.match(script, /run-wrangler\.mjs/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_CHECK_D1_JSON_INVALID/);
  assert.match(script, /activationPlan/);
  assert.match(script, /plannedAction/);
  assert.match(script, /ACTIVATE/);
  assert.match(script, /ARCHIVE/);
  assert.match(script, /metadata_target_node_count/);
  assert.match(script, /metadata_linked_node_count/);
  assert.match(script, /official_unlinked_course_lesson_count/);
  assert.match(script, /published_question_count/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_CONTENT_METADATA_GAP/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_COURSELESSON_LINK_GAP/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_PRECHECK_QUESTION_GAP/);
});

test("security certification curriculum verification script checks D1 and Postgres targets", () => {
  const script = readFileSync(
    "scripts/verify-security-certification-curriculum-seed.mjs",
    "utf8",
  );

  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_VERIFY_D1_LOCAL_OK/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_VERIFY_POSTGRES_OK/);
  assert.match(script, /정보보안관리 및 법규/);
  assert.match(script, /nodeCount: 79/);
  assert.match(script, /nodeCount: 64/);
});

test("security certification curriculum coverage script is read-only and reports content links", () => {
  const script = readFileSync(
    "scripts/verify-security-certification-curriculum-coverage.mjs",
    "utf8",
  );

  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_POSTGRES_OK/);
  assert.match(script, /published_course_lesson_count/);
  assert.match(script, /official_seed_course_lesson_count/);
  assert.match(script, /official_unlinked_course_lesson_count/);
  assert.match(script, /--require-course-lessons/);
  assert.match(script, /--allow-inactive/);
  assert.match(script, /--action-queue/);
  assert.match(script, /--action-queue-limit=<n>/);
  assert.match(script, /--action-type=<type>/);
  assert.match(script, /buildCoverageActionQueue/);
  assert.match(script, /parsePositiveIntArg/);
  assert.match(script, /parseActionTypeArg/);
  assert.match(script, /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_LIMIT_INVALID/);
  assert.match(
    script,
    /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_ACTION_TYPE_INVALID/,
  );
  assert.match(script, /severity: actionSeverity/);
  assert.match(script, /nextStep: actionNextStep/);
  assert.match(script, /Request explicit production activation/);
  assert.match(script, /COURSELESSON_LINK_GAP/);
  assert.match(script, /officialUnlinkedCourseLessonCount/);
  assert.match(script, /official CourseLesson items need CurriculumNode links/);
  assert.match(script, /CONTENT_METADATA_GAP/);
  assert.match(script, /curriculum_nodes\.metadata\.linkedContent/);
  assert.match(script, /metadata_target_node_count/);
  assert.match(script, /node_type <> 'TRACK'/);
  assert.match(script, /excluding TRACK structure nodes/);
  assert.match(script, /QUESTION_GAP/);
  assert.match(
    script,
    /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_OFFICIAL_COURSE_LESSONS_LOW/,
  );
  assert.match(script, /metadata_linked_node_count/);
  assert.match(script, /metadataTargetNodeCount/);
  assert.match(script, /published_question_count/);
  assert.match(
    script,
    /POSTGRES_VERIFY_URL[\s\S]*DATABASE_URL[\s\S]*POSTGRES_SEED_URL/,
  );
  assert.doesNotMatch(script, /\bINSERT\b/i);
  assert.doesNotMatch(script, /\bUPDATE\b/i);
  assert.doesNotMatch(script, /\bDELETE\b/i);
  assert.doesNotMatch(script, /\bDROP\b/i);
});

test("security certification coverage action queue documents triage fields", () => {
  const docs = readFileSync(
    "docs/curriculum/security-certification-course-lessons-coverage.md",
    "utf8",
  );

  assert.match(docs, /Action queue triage fields/);
  assert.match(docs, /--action-queue-limit=<n>/);
  assert.match(docs, /--action-type=<type>/);
  assert.match(docs, /CONTENT_METADATA_GAP --action-queue-limit=20/);
  assert.match(docs, /severity/);
  assert.match(docs, /nextStep/);
  assert.match(docs, /read-only coverage results/);
});

test("security certification coverage action queue has npm entrypoints", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  assert.equal(
    packageJson.scripts["curriculum:security-certification:coverage-actions:d1-local"],
    "node scripts/verify-security-certification-curriculum-coverage.mjs d1-local --allow-inactive --action-queue",
  );
  assert.equal(
    packageJson.scripts["curriculum:security-certification:coverage-actions:postgres"],
    "node scripts/verify-security-certification-curriculum-coverage.mjs postgres --require-course-lessons --action-queue",
  );
});

test("security certification linked content backfill has gated npm entrypoints", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const script = readFileSync(
    "scripts/apply-security-certification-curriculum-linked-content.mjs",
    "utf8",
  );

  assert.equal(
    packageJson.scripts["curriculum:security-certification:linked-content:stats"],
    "node scripts/apply-security-certification-curriculum-linked-content.mjs stats",
  );
  assert.equal(
    packageJson.scripts["curriculum:security-certification:linked-content:d1-local"],
    "node scripts/apply-security-certification-curriculum-linked-content.mjs d1-local",
  );
  assert.equal(
    packageJson.scripts["curriculum:security-certification:linked-content:postgres"],
    "node scripts/apply-security-certification-curriculum-linked-content.mjs postgres",
  );
  assert.match(
    script,
    /SECURIUM_CONFIRM_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL/,
  );
  assert.match(script, /APPLY_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL/);
  assert.match(script, /--confirm-production-seed/);
  assert.match(script, /mergeMetadata/);
  assert.match(script, /linkedContent/);
});

test("security certification coverage verifier exposes safe help without DB access", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-security-certification-curriculum-coverage.mjs", "--help"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /coverage verifier/);
  assert.match(result.stdout, /--action-queue/);
  assert.match(result.stdout, /--action-queue-limit=<n>/);
  assert.match(result.stdout, /--action-type=<type>/);
  assert.match(result.stdout, /coverage-actions:postgres/);
});

test("security certification coverage verifier rejects invalid action queue limits before DB access", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-security-certification-curriculum-coverage.mjs",
      "d1-local",
      "--action-queue",
      "--action-queue-limit=0",
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_LIMIT_INVALID:0/,
  );
});

test("security certification coverage verifier rejects invalid action queue types before DB access", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-security-certification-curriculum-coverage.mjs",
      "d1-local",
      "--action-queue",
      "--action-type=UNKNOWN_GAP",
    ],
    { encoding: "utf8" },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_ACTION_TYPE_INVALID:UNKNOWN_GAP/,
  );
});

test("operations readiness documents curriculum coverage action queue", () => {
  const docs = readFileSync("docs/operations-readiness.md", "utf8");

  assert.match(docs, /coverage-actions:d1-local/);
  assert.match(docs, /coverage-actions:postgres/);
  assert.match(docs, /CONTENT_METADATA_GAP/);
  assert.match(docs, /Operational readiness/);
});

test("course lesson coverage docs explain linked content backfill gate", () => {
  const docs = readFileSync(
    "docs/curriculum/security-certification-course-lessons-coverage.md",
    "utf8",
  );

  assert.match(docs, /linkedContent metadata backfill/);
  assert.match(docs, /linked-content:d1-local/);
  assert.match(docs, /linked-content:postgres/);
  assert.match(
    docs,
    /SECURIUM_CONFIRM_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL/,
  );
  assert.match(docs, /explicitly\s+approved/);
});
