import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  INFORMATION_SECURITY_GENERAL_CONTENT_ID,
  INFORMATION_SECURITY_GENERAL_COURSE_IDS,
  generateInformationSecurityGeneralQuestionSeedSql,
  getInformationSecurityGeneralQuestionBankReadiness,
  INFORMATION_SECURITY_GENERAL_SUBITEM_CONTENT_IDS_BY_QUESTION_ID,
  securityCertificationInformationSecurityGeneralQuestionSamples,
  toInformationSecurityGeneralGradingQuestion,
} from "../lib/data/security-certification-information-security-general-questions.mjs";

test("information security general question bank covers current auto-graded types", () => {
  const readiness = getInformationSecurityGeneralQuestionBankReadiness();

  assert.equal(readiness.questionCount, 8);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.allLinkedToBothCourses, true);
  assert.equal(readiness.allLinkedToGeneralContent, true);
  assert.equal(readiness.subItemContentLinkedCount, 8);
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

test("information security general questions remain course scoped and content linked", () => {
  for (const question of securityCertificationInformationSecurityGeneralQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.equal(question.contentLinks.length, 2);
    assert.deepEqual(question.contentLinks[0], {
      contentType: "CONTENT",
      contentId: INFORMATION_SECURITY_GENERAL_CONTENT_ID,
      relationType: "PRACTICE",
    });
    const expectedSubItemContentId = Object.entries(
      INFORMATION_SECURITY_GENERAL_SUBITEM_CONTENT_IDS_BY_QUESTION_ID,
    ).find(([questionId]) => questionId === question.id)?.[1];
    assert.ok(expectedSubItemContentId);
    assert.deepEqual(question.contentLinks[1], {
      contentType: "CONTENT",
      contentId: expectedSubItemContentId,
      relationType: "PRACTICE",
    });
    assert.deepEqual(
      question.courseLinks.map((link) => link.courseId).sort(),
      [...INFORMATION_SECURITY_GENERAL_COURSE_IDS].sort(),
    );
  }
});

test("information security general questions are shared while course weighting stays separated", () => {
  const questionIds = new Set(
    securityCertificationInformationSecurityGeneralQuestionSamples.map(
      (question) => question.id,
    ),
  );
  assert.equal(
    questionIds.size,
    securityCertificationInformationSecurityGeneralQuestionSamples.length,
    "shared information security general questions should not be duplicated per course",
  );

  const signatureQuestion =
    securityCertificationInformationSecurityGeneralQuestionSamples.find(
      (question) =>
        question.id === "information-security-general-official-sample-q03",
    );
  assert.ok(signatureQuestion);
  assert.deepEqual(
    signatureQuestion.courseLinks
      .map((link) => ({ courseId: link.courseId, weight: link.weight }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: "course-ise", weight: 115 },
      { courseId: "course-isie", weight: 100 },
    ],
  );
});

test("information security general sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    securityCertificationInformationSecurityGeneralQuestionSamples.map(
      (question) => [question.id, question],
    ),
  );

  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q01"),
      ),
      "information-security-general-official-sample-q01-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q02"),
      ),
      "information-security-general-official-sample-q02-true",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q03"),
      ),
      [
        "information-security-general-official-sample-q03-choice-01",
        "information-security-general-official-sample-q03-choice-02",
        "information-security-general-official-sample-q03-choice-03",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q06"),
      ),
      [
        "information-security-general-official-sample-q06-choice-01",
        "information-security-general-official-sample-q06-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q04"),
      ),
      "해시 함수",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toInformationSecurityGeneralGradingQuestion(
        byId.get("information-security-general-official-sample-q04"),
      ),
      "digest",
    ).score,
    50,
  );
});

test("information security general question seed generates additive SQL for D1 and Postgres", () => {
  const d1Sql = generateInformationSecurityGeneralQuestionSeedSql({
    dialect: "d1",
  });
  const postgresSql = generateInformationSecurityGeneralQuestionSeedSql({
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
  assert.match(
    postgresSql,
    /seed_information_security_general_questions_2027_2029/,
  );
  assert.match(postgresSql, /INSERT INTO "app_schema_migrations" \("id", "checksum"\)/);
  assert.doesNotMatch(postgresSql, /INSERT INTO "schema_migrations"/);
  assert.doesNotMatch(postgresSql, /"answer_config"/);
  assert.doesNotMatch(postgresSql, /INTO "question_courses" \("id"/);

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});
