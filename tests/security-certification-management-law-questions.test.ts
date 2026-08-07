import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  MANAGEMENT_LAW_CONTENT_ID,
  MANAGEMENT_LAW_COURSE_IDS,
  MANAGEMENT_LAW_EXCLUDED_COURSE_IDS,
  MANAGEMENT_LAW_SUBITEM_CONTENT_IDS_BY_QUESTION_ID,
  generateManagementLawQuestionSeedSql,
  getManagementLawQuestionBankReadiness,
  managementLawQuestionSamples,
  toManagementLawGradingQuestion,
} from "../lib/data/security-certification-management-law-questions.mjs";

test("management law question bank is engineer-only", () => {
  const readiness = getManagementLawQuestionBankReadiness();

  assert.equal(readiness.questionCount, 9);
  assert.deepEqual(MANAGEMENT_LAW_COURSE_IDS, ["course-ise"]);
  assert.deepEqual(MANAGEMENT_LAW_EXCLUDED_COURSE_IDS, ["course-isie"]);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.allLinkedToEngineerCourseOnly, true);
  assert.equal(readiness.leaksToIndustrialEngineer, false);
  assert.equal(readiness.allLinkedToManagementContent, true);
  assert.equal(readiness.subItemContentLinkedCount, 9);
  assert.deepEqual(readiness.courseCounts, {
    "course-ise": 9,
    "course-isie": 0,
  });
  assert.deepEqual(readiness.typeCounts, {
    TRUE_FALSE: 3,
    SINGLE_CHOICE: 2,
    MULTIPLE_CHOICE: 3,
    SHORT_ANSWER: 1,
  });
});

test("management law questions remain content linked without industrial course leakage", () => {
  for (const question of managementLawQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.equal(question.contentLinks.length, 2);
    assert.deepEqual(question.contentLinks[0], {
      contentType: "CONTENT",
      contentId: MANAGEMENT_LAW_CONTENT_ID,
      relationType: "PRACTICE",
    });
    const expectedSubItemContentId = Object.entries(
      MANAGEMENT_LAW_SUBITEM_CONTENT_IDS_BY_QUESTION_ID,
    ).find(([questionId]) => questionId === question.id)?.[1];
    assert.ok(expectedSubItemContentId);
    assert.deepEqual(question.contentLinks[1], {
      contentType: "CONTENT",
      contentId: expectedSubItemContentId,
      relationType: "PRACTICE",
    });
    assert.deepEqual(
      question.courseLinks.map((link) => link.courseId),
      ["course-ise"],
      `${question.id} must stay isolated to the information security engineer course`,
    );
  }
});

test("management law sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    managementLawQuestionSamples.map((question) => [question.id, question]),
  );

  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q01"),
      ),
      "management-law-official-sample-q01-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q02"),
      ),
      "management-law-official-sample-q02-true",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q03"),
      ),
      [
        "management-law-official-sample-q03-choice-01",
        "management-law-official-sample-q03-choice-02",
        "management-law-official-sample-q03-choice-03",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q06"),
      ),
      [
        "management-law-official-sample-q06-choice-01",
        "management-law-official-sample-q06-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q05"),
      ),
      "ISMS-P",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toManagementLawGradingQuestion(
        byId.get("management-law-official-sample-q05"),
      ),
      "관리체계",
    ).score,
    50,
  );
});

test("management law question seed generates additive SQL for D1 and Postgres", () => {
  const d1Sql = generateManagementLawQuestionSeedSql({ dialect: "d1" });
  const postgresSql = generateManagementLawQuestionSeedSql({
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
  assert.match(postgresSql, /seed_management_law_questions_2027_2029/);
  assert.match(postgresSql, /INSERT INTO "app_schema_migrations" \("id", "checksum"\)/);
  assert.doesNotMatch(postgresSql, /INSERT INTO "schema_migrations"/);
  assert.doesNotMatch(postgresSql, /"answer_config"/);
  assert.doesNotMatch(postgresSql, /INTO "question_courses" \("id"/);
  assert.doesNotMatch(postgresSql, /course-isie/);

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});
