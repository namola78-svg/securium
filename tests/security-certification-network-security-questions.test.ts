import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  NETWORK_SECURITY_CONTENT_ID,
  NETWORK_SECURITY_COURSE_IDS,
  SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE,
  generateNetworkSecurityQuestionSeedSql,
  getNetworkSecurityQuestionBankReadiness,
  networkSecurityQuestionSamples,
  toNetworkSecurityGradingQuestion,
} from "../lib/data/security-certification-network-security-questions.mjs";

test("network security question bank covers current auto-graded types", () => {
  const readiness = getNetworkSecurityQuestionBankReadiness();

  assert.equal(readiness.questionCount, 6);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.allLinkedToBothCourses, true);
  assert.equal(readiness.allLinkedToNetworkContent, true);
  assert.deepEqual(readiness.courseCounts, {
    "course-ise": 6,
    "course-isie": 6,
  });
  assert.deepEqual(readiness.typeCounts, {
    TRUE_FALSE: 1,
    SINGLE_CHOICE: 2,
    MULTIPLE_CHOICE: 2,
    SHORT_ANSWER: 1,
  });
});

test("network security questions remain course scoped and content linked", () => {
  for (const question of networkSecurityQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.equal(question.contentLinks.length, 1);
    assert.deepEqual(question.contentLinks[0], {
      contentType: "CONTENT",
      contentId: NETWORK_SECURITY_CONTENT_ID,
      relationType: "PRACTICE",
    });
    assert.deepEqual(
      question.courseLinks.map((link) => link.courseId).sort(),
      [...NETWORK_SECURITY_COURSE_IDS].sort(),
    );
  }
});

test("network security questions are shared while course weighting stays separated", () => {
  const questionIds = new Set(
    networkSecurityQuestionSamples.map((question) => question.id),
  );
  assert.equal(
    questionIds.size,
    networkSecurityQuestionSamples.length,
    "shared network security questions should not be duplicated per course",
  );

  for (const question of networkSecurityQuestionSamples) {
    const courseWeights = Object.fromEntries(
      question.courseLinks.map((link) => [link.courseId, link.weight]),
    );
    assert.equal(
      Object.keys(courseWeights).length,
      NETWORK_SECURITY_COURSE_IDS.length,
      `${question.id} should keep one course link per target course`,
    );
    assert.equal(
      courseWeights["course-ise"] >= courseWeights["course-isie"],
      true,
      `${question.id} should allow engineer depth without weakening industrial scope`,
    );
  }

  const spoofingAndSniffingQuestion = networkSecurityQuestionSamples.find(
    (question) => question.id === "network-security-official-sample-q03",
  );
  assert.ok(spoofingAndSniffingQuestion);
  assert.deepEqual(
    spoofingAndSniffingQuestion.courseLinks
      .map((link) => ({ courseId: link.courseId, weight: link.weight }))
      .sort((a, b) => a.courseId.localeCompare(b.courseId)),
    [
      { courseId: "course-ise", weight: 110 },
      { courseId: "course-isie", weight: 100 },
    ],
    "course-specific weight must stay on the join table, not duplicate the question",
  );
});

test("network security sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    networkSecurityQuestionSamples.map((question) => [question.id, question]),
  );

  assert.equal(
    gradeQuestion(
      toNetworkSecurityGradingQuestion(
        byId.get("network-security-official-sample-q01"),
      ),
      "network-security-official-sample-q01-true",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toNetworkSecurityGradingQuestion(
        byId.get("network-security-official-sample-q02"),
      ),
      "network-security-official-sample-q02-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toNetworkSecurityGradingQuestion(
        byId.get("network-security-official-sample-q03"),
      ),
      [
        "network-security-official-sample-q03-choice-01",
        "network-security-official-sample-q03-choice-02",
        "network-security-official-sample-q03-choice-04",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toNetworkSecurityGradingQuestion(
        byId.get("network-security-official-sample-q04"),
      ),
      "vpn",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toNetworkSecurityGradingQuestion(
        byId.get("network-security-official-sample-q06"),
      ),
      [
        "network-security-official-sample-q06-choice-01",
        "network-security-official-sample-q06-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
});

test("network security question seed generates additive SQL for D1 and Postgres", () => {
  const d1Sql = generateNetworkSecurityQuestionSeedSql({ dialect: "d1" });
  const postgresSql = generateNetworkSecurityQuestionSeedSql({ dialect: "postgres" });

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
    /seed_network_security_questions_2027_2029/,
  );

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});

test("network security question apply script gates remote data changes", () => {
  const script = readFileSync(
    "scripts/apply-network-security-question-seed.mjs",
    "utf8",
  );

  assert.match(script, /--confirm-production-seed/);
  assert.match(script, /SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_NAME/);
  assert.equal(
    SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE,
    "APPLY_NETWORK_SECURITY_QUESTION_SEED",
  );
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /assertProductionSeedApproval\(\)/);
  assert.match(script, /NETWORK_SECURITY_CONTENT_ID/);
});

test("network security question verifier is read-only and supports D1 and Postgres", () => {
  const script = readFileSync(
    "scripts/verify-network-security-question-flow.mjs",
    "utf8",
  );

  assert.match(script, /NETWORK_SECURITY_QUESTION_FLOW_D1_LOCAL_OK/);
  assert.match(script, /NETWORK_SECURITY_QUESTION_FLOW_POSTGRES_OK/);
  assert.match(script, /NETWORK_SECURITY_CONTENT_ID/);
  assert.match(script, /NETWORK_SECURITY_COURSE_IDS/);
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
