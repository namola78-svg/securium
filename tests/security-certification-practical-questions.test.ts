import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  PRACTICAL_SECURITY_CONTENT_ID,
  PRACTICAL_SECURITY_CONTENT_IDS,
  PRACTICAL_SECURITY_COURSE_IDS,
  getPracticalSecurityQuestionBankReadiness,
  practicalSecurityQuestionSamples,
  toPracticalSecurityGradingQuestion,
} from "../lib/data/security-certification-practical-questions.mjs";
import { engineerPracticalLogMonitoringQuestion } from "../lib/data/security-certification-engineer-practical-log-monitoring-authoring.mjs";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function authoredQuestionCorePayload(question: Record<string, unknown>) {
  return {
    answerConfig: question.answerConfig,
    authoringMetadata: question.authoringMetadata,
    choices: question.choices,
    content: question.content,
    difficulty: question.difficulty,
    explanation: question.explanation,
    id: question.id,
    sampleOnly: question.sampleOnly,
    source: question.source,
    sourceClass: question.sourceClass,
    sourceDate: question.sourceDate,
    tags: question.tags,
    title: question.title,
    type: question.type,
    wrongAnswerExplanation: question.wrongAnswerExplanation,
  };
}

test("practical security question bank is shared by engineer and industrial engineer", () => {
  const readiness = getPracticalSecurityQuestionBankReadiness();

  assert.equal(readiness.questionCount, 22);
  assert.deepEqual(PRACTICAL_SECURITY_COURSE_IDS, ["course-ise", "course-isie"]);
  assert.equal(readiness.allPublished, true);
  assert.equal(readiness.allSampleOnly, true);
  assert.equal(readiness.allIndependentlyAuthored, true);
  assert.equal(readiness.sharedQuestionCount, 17);
  assert.equal(readiness.engineerOnlyQuestionCount, 5);
  assert.equal(readiness.allSharedQuestionsLinkedToBothCourses, true);
  assert.equal(readiness.allEngineerOnlyQuestionsScopedToEngineer, true);
  assert.equal(readiness.allLinkedToPracticalContent, true);
  assert.deepEqual(readiness.courseCounts, {
    "course-ise": 22,
    "course-isie": 17,
  });
  assert.deepEqual(readiness.typeCounts, {
    SINGLE_CHOICE: 3,
    TRUE_FALSE: 7,
    MULTIPLE_CHOICE: 8,
    SHORT_ANSWER: 4,
  });
});

test("Engineer log-monitoring Question activates once with exact source binding and relations", () => {
  const questionId = "practical-security-official-engineer-log-monitoring-q01";
  const contentId =
    "content-official-security-cert-ise-practical-log-collection-monitoring";
  const activeQuestions = practicalSecurityQuestionSamples.filter(
    (question) => question.id === questionId,
  );

  assert.equal(
    canonicalSha256(engineerPracticalLogMonitoringQuestion),
    "1cee810f93bfdb6559ffe2a4b5efa390a18827cd265cbe8e302915700cfcef26",
  );
  assert.equal(
    canonicalSha256(
      authoredQuestionCorePayload(
        engineerPracticalLogMonitoringQuestion as unknown as Record<string, unknown>,
      ),
    ),
    "4c9a7a763fea4b6e3e931f6f8bde8030982c86aac2e00a7956a86024cb274dbf",
  );
  assert.equal(activeQuestions.length, 1);
  assert.equal(activeQuestions[0]?.status, "PUBLISHED");
  assert.deepEqual(activeQuestions[0]?.courseLinks, [
    { courseId: "course-ise", weight: 110 },
  ]);
  assert.deepEqual(activeQuestions[0]?.contentLinks, [
    { contentType: "CONTENT", contentId, relationType: "PRACTICE" },
  ]);
  assert.deepEqual(
    activeQuestions[0]?.choices
      .filter((choice: { isCorrect: boolean }) => choice.isCorrect)
      .map((choice: { id: string }) => choice.id),
    [
      `${questionId}-choice-01`,
      `${questionId}-choice-02`,
    ],
  );
  assert.equal(
    activeQuestions[0]?.courseLinks.some(
      (link: { courseId: string }) => link.courseId === "course-isie",
    ),
    false,
  );
});

test("practical security questions remain linked to practical content", () => {
  const knownPracticalContentIds = new Set(Object.values(PRACTICAL_SECURITY_CONTENT_IDS));

  for (const question of practicalSecurityQuestionSamples) {
    assert.equal(question.status, "PUBLISHED");
    assert.equal(question.sampleOnly, true);
    assert.match(question.source, /SECURIUM independently authored/);
    assert.equal(question.contentLinks.length, 1);
    assert.equal(question.contentLinks[0].contentType, "CONTENT");
    assert.equal(question.contentLinks[0].relationType, "PRACTICE");
    assert.equal(knownPracticalContentIds.has(question.contentLinks[0].contentId), true);
    if (question.id.includes("engineer")) {
      assert.deepEqual(
        question.courseLinks.map((link: { courseId: string }) => link.courseId),
        ["course-ise"],
      );
    } else {
      assert.deepEqual(
        question.courseLinks.map((link: { courseId: string }) => link.courseId),
        ["course-ise", "course-isie"],
      );
    }
  }
});

test("practical security sub item questions cover shared and engineer-only official content", () => {
  const linkedContentIds = new Set(
    practicalSecurityQuestionSamples.flatMap((question) =>
      question.contentLinks.map((link: { contentId: string }) => link.contentId),
    ),
  );
  const expectedSubItemContentIds = Object.values(PRACTICAL_SECURITY_CONTENT_IDS).filter(
    (contentId) => contentId !== PRACTICAL_SECURITY_CONTENT_ID,
  );

  for (const contentId of expectedSubItemContentIds) {
    assert.equal(linkedContentIds.has(contentId), true, `${contentId} should have a question`);
  }
});

test("practical security sample answers are graded by the shared grading engine", () => {
  const byId = new Map(
    practicalSecurityQuestionSamples.map((question) => [question.id, question]),
  );

  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q01"),
      ),
      "practical-security-official-sample-q01-choice-01",
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q02"),
      ),
      "practical-security-official-sample-q02-false",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q03"),
      ),
      [
        "practical-security-official-sample-q03-choice-01",
        "practical-security-official-sample-q03-choice-02",
        "practical-security-official-sample-q03-choice-03",
      ],
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q06"),
      ),
      [
        "practical-security-official-sample-q06-choice-01",
        "practical-security-official-sample-q06-choice-02",
      ],
    ).score,
    0,
    "multiple-choice grading should require the exact correct set",
  );
  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q04"),
      ),
      "확산 방지",
    ).isCorrect,
    true,
  );
  assert.equal(
    gradeQuestion(
      toPracticalSecurityGradingQuestion(
        byId.get("practical-security-official-sample-q04"),
      ),
      "대응 조치",
    ).score,
    40,
  );
});
