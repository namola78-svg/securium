import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  NETWORK_SECURITY_CONTENT_ID,
  NETWORK_SECURITY_COURSE_IDS,
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

