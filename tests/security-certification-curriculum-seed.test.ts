import assert from "node:assert/strict";
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
  assert.match(script, /--require-course-lessons/);
  assert.match(script, /--allow-inactive/);
  assert.match(
    script,
    /SECURITY_CERTIFICATION_CURRICULUM_COVERAGE_OFFICIAL_COURSE_LESSONS_LOW/,
  );
  assert.match(script, /metadata_linked_node_count/);
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
