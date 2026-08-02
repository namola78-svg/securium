import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE,
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
  generateSecurityCertificationCourseLessonSeedSql,
  getSecurityCertificationCourseLessonCoveragePlan,
  getSecurityCertificationCourseLessonSeedStats,
} from "../lib/data/security-certification-course-lessons.mjs";

test("security certification course lesson seed reuses shared contents across engineer tracks", () => {
  const stats = getSecurityCertificationCourseLessonSeedStats();

  assert.equal(stats.contentCount, 6);
  assert.equal(stats.courseLessonCount, 11);
  assert.equal(stats.linkedContentCount, 6);
  assert.equal(stats.reusedContentCount >= 5, true);
  assert.equal(stats.allLessonsHaveKnownContent, true);
  assert.equal(stats.expectedTopLevelNodeCount, 11);
  assert.equal(stats.mappedTopLevelNodeCount, 11);
  assert.equal(stats.unmappedTopLevelNodeCount, 0);
});

test("security certification course lesson seed keeps course progress separated", () => {
  const engineerLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) => lesson.courseId === "course-ise",
  );
  const industrialLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) => lesson.courseId === "course-isie",
  );

  assert.equal(engineerLessons.length, 6);
  assert.equal(industrialLessons.length, 5);

  const courseLessonIds = new Set(
    officialSecurityCertificationCourseLessons.map((lesson) => lesson.id),
  );
  assert.equal(courseLessonIds.size, officialSecurityCertificationCourseLessons.length);

  const reusedSystemContentLessons =
    officialSecurityCertificationCourseLessons.filter(
      (lesson) =>
        lesson.contentId ===
        "content-official-security-cert-system-security-overview",
    );
  assert.deepEqual(
    reusedSystemContentLessons.map((lesson) => lesson.courseId).sort(),
    ["course-ise", "course-isie"],
  );
});

test("security certification course lessons link to official curriculum nodes", () => {
  for (const lesson of officialSecurityCertificationCourseLessons) {
    assert.match(lesson.curriculumNodeId, /^curriculum-node-isi?e-2027-2029-/);
    assert.equal(lesson.sortOrder, 1);
    assert.equal(lesson.isRequired, true);
  }

  assert.ok(
    officialSecurityCertificationCourseLessons.some(
      (lesson) =>
        lesson.courseId === "course-ise" &&
        lesson.curriculumNodeId === "curriculum-node-ise-2027-2029-01-05",
    ),
    "information security engineer should include management and law",
  );
  assert.equal(
    officialSecurityCertificationCourseLessons.some(
      (lesson) =>
        lesson.courseId === "course-isie" &&
        lesson.curriculumNodeId === "curriculum-node-isie-2027-2029-01-05",
    ),
    false,
    "industrial engineer should not receive the engineer-only management and law subject",
  );
});

test("security certification course lesson coverage plan maps every subject and practical top-level node", () => {
  const coveragePlan = getSecurityCertificationCourseLessonCoveragePlan();

  assert.deepEqual(
    coveragePlan.map((tree) => ({
      treeId: tree.treeId,
      expectedNodeCount: tree.expectedNodeCount,
      mappedNodeCount: tree.mappedNodeCount,
      unmappedNodeCount: tree.unmappedNodeCount,
    })),
    [
      {
        treeId: "curriculum-ise-2027-2029-official",
        expectedNodeCount: 6,
        mappedNodeCount: 6,
        unmappedNodeCount: 0,
      },
      {
        treeId: "curriculum-isie-2027-2029-official",
        expectedNodeCount: 5,
        mappedNodeCount: 5,
        unmappedNodeCount: 0,
      },
    ],
  );

  for (const tree of coveragePlan) {
    assert.equal(tree.unmappedNodes.length, 0);
    assert.equal(
      tree.mappedNodes.every((node) => node.courseLessonIds.length === 1),
      true,
    );
    assert.equal(tree.mappedNodes.every((node) => node.contentIds.length === 1), true);
  }
});

test("security certification course lesson seed generates additive SQL", () => {
  const d1Sql = generateSecurityCertificationCourseLessonSeedSql({ dialect: "d1" });
  const postgresSql = generateSecurityCertificationCourseLessonSeedSql({
    dialect: "postgres",
  });

  assert.match(d1Sql, /INSERT OR IGNORE INTO "contents"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "course_lessons"/);
  assert.match(postgresSql, /INSERT INTO "contents"/);
  assert.match(postgresSql, /ON CONFLICT \("id"\) DO UPDATE SET/);
  assert.match(postgresSql, /\bBEGIN;/);
  assert.match(postgresSql, /\bCOMMIT;/);

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});

test("security certification course lesson content is marked as learning overview, not copied questions", () => {
  for (const content of officialSecurityCertificationContents) {
    assert.match(content.body, /공식 문제나 유료 교재 내용을 복제하지 않습니다/);
  }
});

test("network security shared content is expanded into a formal lesson body", () => {
  const networkContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id === "content-official-security-cert-network-security-overview",
  );
  assert.ok(networkContent);

  assert.match(networkContent.body, /# 네트워크보안 정식 학습 본문/);
  assert.match(networkContent.body, /## 1\. 학습 범위/);
  assert.match(networkContent.body, /## 3\. 주요 공격 유형/);
  assert.match(networkContent.body, /## 4\. 보안 프로토콜과 보안장비/);
  assert.match(networkContent.body, /## 7\. 연습 체크리스트/);
  assert.match(networkContent.body, /DoS\/DDoS/);
  assert.match(networkContent.body, /스푸핑은 속임, 스니핑은 관찰/);
  assert.equal(networkContent.learningObjectives.length >= 4, true);
  assert.equal(networkContent.coreConcepts.includes("SIEM"), true);
  assert.equal(networkContent.practicalExamples.length >= 4, true);
});

test("security certification course lesson apply script gates Postgres data changes", () => {
  const script = readFileSync(
    "scripts/apply-security-certification-course-lessons-seed.mjs",
    "utf8",
  );

  assert.match(script, /--confirm-production-seed/);
  assert.match(
    script,
    /SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME/,
  );
  assert.equal(
    SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE,
    "APPLY_SECURITY_CERTIFICATION_COURSE_LESSON_SEED",
  );
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /assertProductionSeedApproval\(\)/);
});
