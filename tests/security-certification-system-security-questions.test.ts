import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE,
  SYSTEM_SECURITY_CONTENT_ID,
  SYSTEM_SECURITY_COURSE_IDS,
  SYSTEM_SECURITY_SUBITEM_CONTENT_IDS,
  generateSystemSecurityQuestionSeedSql,
  getSystemSecurityQuestionBankReadiness,
  systemSecurityQuestionSamples,
  toSystemSecurityGradingQuestion,
} from "../lib/data/security-certification-system-security-questions.mjs";

test("system security question bank covers current auto-graded types", () => {
  const readiness = getSystemSecurityQuestionBankReadiness();

  assert.equal(readiness.questionCount, 13);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.allLinkedToBothCourses, true);
  assert.equal(readiness.allLinkedToSystemContent, true);
  assert.equal(readiness.linkedSubItemContentCount, 9);
  assert.equal(readiness.allSubItemContentsLinked, true);
  assert.deepEqual(readiness.courseCounts, {
    "course-ise": 13,
    "course-isie": 13,
  });
  assert.deepEqual(readiness.typeCounts, {
    TRUE_FALSE: 4,
    SINGLE_CHOICE: 6,
    MULTIPLE_CHOICE: 2,
    SHORT_ANSWER: 1,
  });
});

test("system security questions remain course scoped and content linked", () => {
  for (const question of systemSecurityQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.equal(question.contentLinks.length >= 2, true);
    assert.deepEqual(question.contentLinks[0], {
      contentType: "CONTENT",
      contentId: SYSTEM_SECURITY_CONTENT_ID,
      relationType: "PRACTICE",
    });
    assert.deepEqual(
      question.courseLinks.map((link) => link.courseId).sort(),
      [...SYSTEM_SECURITY_COURSE_IDS].sort(),
    );
  }

  const linkedSubItemContentIds = new Set(
    systemSecurityQuestionSamples.flatMap((question) =>
      question.contentLinks
        .filter((link) =>
          Object.values(SYSTEM_SECURITY_SUBITEM_CONTENT_IDS).includes(
            link.contentId,
          ),
        )
        .map((link) => link.contentId),
    ),
  );
  assert.deepEqual(
    [...linkedSubItemContentIds].sort(),
    Object.values(SYSTEM_SECURITY_SUBITEM_CONTENT_IDS).sort(),
  );
});

test("system security questions are shared while course weighting stays separated", () => {
  const questionIds = new Set(
    systemSecurityQuestionSamples.map((question) => question.id),
  );
  assert.equal(
    questionIds.size,
    systemSecurityQuestionSamples.length,
    "shared system security questions should not be duplicated per course",
  );

  for (const question of systemSecurityQuestionSamples) {
    const courseWeights = Object.fromEntries(
      question.courseLinks.map((link) => [link.courseId, link.weight]),
    );
    assert.equal(
      Object.keys(courseWeights).length,
      SYSTEM_SECURITY_COURSE_IDS.length,
      `${question.id} should keep one course link per target course`,
    );
    assert.equal(
      courseWeights["course-ise"] >= courseWeights["course-isie"],
      true,
      `${question.id} should allow engineer depth without weakening industrial scope`,
    );
  }

  const logAnalysisQuestion = systemSecurityQuestionSamples.find(
    (question) => question.id === "system-security-official-sample-q03",
  );
  assert.ok(logAnalysisQuestion);
  assert.deepEqual(
    logAnalysisQuestion.courseLinks
      .map((link) => ({ courseId: link.courseId, weight: link.weight }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 100 },
    ],
    "course-specific weight must stay on the join table, not duplicate the question",
  );

  const cloudResponsibilityQuestion = systemSecurityQuestionSamples.find(
    (question) => question.id === "system-security-official-sample-q04",
  );
  assert.ok(cloudResponsibilityQuestion);
  assert.deepEqual(
    cloudResponsibilityQuestion.courseLinks
      .map((link) => ({ courseId: link.courseId, weight: link.weight }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 95 },
    ],
    "cloud responsibility depth can differ by course without duplicating content",
  );
});

test("system security sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    systemSecurityQuestionSamples.map((question) => [question.id, question]),
  );

  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q01"),
      ),
      "system-security-official-sample-q01-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q02"),
      ),
      "system-security-official-sample-q02-false",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q03"),
      ),
      [
        "system-security-official-sample-q03-choice-01",
        "system-security-official-sample-q03-choice-02",
        "system-security-official-sample-q03-choice-03",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q03"),
      ),
      [
        "system-security-official-sample-q03-choice-01",
        "system-security-official-sample-q03-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q06"),
      ),
      "최소 권한",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q06"),
      ),
      "privilege",
    ).score,
    50,
    "short-answer partial credit should remain advisory and below full score",
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q07"),
      ),
      "system-security-official-sample-q07-choice-01",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toSystemSecurityGradingQuestion(
        byId.get("system-security-official-sample-q08"),
      ),
      "system-security-official-sample-q08-false",
    ).isCorrect,
    true,
  );
});

test("system security question seed generates additive SQL for D1 and Postgres", () => {
  const d1Sql = generateSystemSecurityQuestionSeedSql({ dialect: "d1" });
  const postgresSql = generateSystemSecurityQuestionSeedSql({ dialect: "postgres" });

  assert.match(d1Sql, /INSERT OR IGNORE INTO "questions"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_choices"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_courses"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_subjects"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_topics"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "content_question_links"/);
  assert.doesNotMatch(d1Sql, /\bBEGIN;/);
  assert.doesNotMatch(d1Sql, /\bCOMMIT;/);

  assert.match(postgresSql, /\bBEGIN;/);
  assert.match(postgresSql, /\bCOMMIT;/);
  assert.match(postgresSql, /INSERT INTO "questions"/);
  assert.match(postgresSql, /INSERT INTO "question_subjects"/);
  assert.match(postgresSql, /INSERT INTO "question_topics"/);
  assert.match(postgresSql, /ON CONFLICT \("id"\) DO UPDATE SET/);
  assert.match(postgresSql, /seed_system_security_questions_2027_2029/);
  assert.match(
    postgresSql,
    /system-security-content-link-system-security-official-sample-q07-system-analysis-tools/,
  );

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});

test("system security question apply script gates remote data changes", () => {
  const script = readFileSync(
    "scripts/apply-system-security-question-seed.mjs",
    "utf8",
  );

  assert.match(script, /--confirm-production-seed/);
  assert.match(script, /SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME/);
  assert.equal(
    SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE,
    "APPLY_SYSTEM_SECURITY_QUESTION_SEED",
  );
  assert.equal(
    SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME,
    "SECURIUM_CONFIRM_SYSTEM_SECURITY_QUESTION_SEED",
  );
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /assertProductionSeedApproval\(\)/);
  assert.match(script, /SYSTEM_SECURITY_CONTENT_ID/);
});

test("system security question verifier is read-only and supports D1 and Postgres", () => {
  const script = readFileSync(
    "scripts/verify-system-security-question-flow.mjs",
    "utf8",
  );

  assert.match(script, /SYSTEM_SECURITY_QUESTION_FLOW_D1_LOCAL_OK/);
  assert.match(script, /SYSTEM_SECURITY_QUESTION_FLOW_POSTGRES_OK/);
  assert.match(script, /SYSTEM_SECURITY_CONTENT_ID/);
  assert.match(script, /SYSTEM_SECURITY_COURSE_IDS/);
  assert.match(script, /content_question_links/);
  assert.match(script, /question_courses/);

  for (const forbidden of [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\b/i,
  ]) {
    assert.doesNotMatch(script, forbidden);
  }
});
