import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  APPLICATION_SECURITY_CONTENT_ID,
  APPLICATION_SECURITY_COURSE_IDS,
  APPLICATION_SECURITY_SUBITEM_CONTENT_IDS,
  generateApplicationSecurityQuestionSeedSql,
  getApplicationSecurityQuestionBankReadiness,
  applicationSecurityQuestionSamples,
  toApplicationSecurityGradingQuestion,
} from "../lib/data/security-certification-application-security-questions.mjs";

test("application security question bank covers current auto-graded types", () => {
  const readiness = getApplicationSecurityQuestionBankReadiness();

  assert.equal(readiness.questionCount, 8);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.allLinkedToBothCourses, true);
  assert.equal(readiness.allLinkedToApplicationContent, true);
  assert.equal(readiness.allLinkedToApplicationSubItemContent, true);
  assert.equal(
    readiness.subItemContentLinkedCount,
    APPLICATION_SECURITY_SUBITEM_CONTENT_IDS.length,
  );
  assert.deepEqual(readiness.courseCounts, {
    "course-ise": 8,
    "course-isie": 8,
  });
  assert.deepEqual(readiness.typeCounts, {
    TRUE_FALSE: 2,
    SINGLE_CHOICE: 3,
    MULTIPLE_CHOICE: 2,
    SHORT_ANSWER: 1,
  });
});

test("application security questions remain course scoped and content linked", () => {
  for (const question of applicationSecurityQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.ok(question.contentLinks.length >= 2);
    assert.ok(
      question.contentLinks.some(
        (link) =>
          link.contentType === "CONTENT" &&
          link.contentId === APPLICATION_SECURITY_CONTENT_ID &&
          link.relationType === "PRACTICE",
      ),
    );
    assert.ok(
      question.contentLinks.some((link) =>
        APPLICATION_SECURITY_SUBITEM_CONTENT_IDS.includes(link.contentId),
      ),
      `${question.id} should link at least one application security subitem content`,
    );
    assert.deepEqual(
      question.courseLinks.map((link) => link.courseId).sort(),
      [...APPLICATION_SECURITY_COURSE_IDS].sort(),
    );
  }
});

test("application security questions are shared while course weighting stays separated", () => {
  const questionIds = new Set(
    applicationSecurityQuestionSamples.map((question) => question.id),
  );
  assert.equal(
    questionIds.size,
    applicationSecurityQuestionSamples.length,
    "shared application security questions should not be duplicated per course",
  );

  const uploadQuestion = applicationSecurityQuestionSamples.find(
    (question) => question.id === "application-security-official-sample-q03",
  );
  assert.ok(uploadQuestion);
  assert.deepEqual(
    uploadQuestion.courseLinks
      .map((link) => ({ courseId: link.courseId, weight: link.weight }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 100 },
    ],
  );
});

test("application security sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    applicationSecurityQuestionSamples.map((question) => [question.id, question]),
  );

  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q01"),
      ),
      "application-security-official-sample-q01-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q02"),
      ),
      "application-security-official-sample-q02-true",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q03"),
      ),
      [
        "application-security-official-sample-q03-choice-01",
        "application-security-official-sample-q03-choice-02",
        "application-security-official-sample-q03-choice-03",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q05"),
      ),
      [
        "application-security-official-sample-q05-choice-01",
        "application-security-official-sample-q05-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q06"),
      ),
      "출력 인코딩",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q06"),
      ),
      "escape",
    ).score,
    50,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q07"),
      ),
      "application-security-official-sample-q07-choice-01",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toApplicationSecurityGradingQuestion(
        byId.get("application-security-official-sample-q08"),
      ),
      "application-security-official-sample-q08-true",
    ).isCorrect,
    true,
  );
});

test("application security question seed generates additive SQL for D1 and Postgres", () => {
  const d1Sql = generateApplicationSecurityQuestionSeedSql({ dialect: "d1" });
  const postgresSql = generateApplicationSecurityQuestionSeedSql({
    dialect: "postgres",
  });

  assert.match(d1Sql, /INSERT OR IGNORE INTO "questions"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_choices"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "question_courses"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "content_question_links"/);
  assert.doesNotMatch(d1Sql, /\bBEGIN;/);
  assert.doesNotMatch(d1Sql, /\bCOMMIT;/);

  assert.match(postgresSql, /\bBEGIN;/);
  assert.match(postgresSql, /\bCOMMIT;/);
  assert.match(postgresSql, /INSERT INTO "questions"/);
  assert.match(postgresSql, /ON CONFLICT \("id"\) DO UPDATE SET/);
  assert.match(postgresSql, /seed_application_security_questions_2027_2029/);

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});
