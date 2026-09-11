import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertSecureCoding8HQuestionRuntimeMapping,
  buildSecureCoding8HQuestionRuntimeMapping,
  projectSecureCoding8HQuestionRuntimeMapping,
  secureCoding8HRuntimeQuestionId,
  secureCoding8HRuntimeQuestionVersionId,
} from "../lib/services/secure-coding-8h-question-runtime-mapping.ts";
import { loadSecureCoding8HRuntimeModel } from "../lib/services/secure-coding-8h-runtime-adapter.ts";
import { gradeQuestion } from "../lib/services/grading-service.ts";

const COURSE_ID = "developer-secure-coding-8h-python-vibe";
const COURSE_SLUG = "secure-coding-8h-python-vibe";
const CANDIDATE_ID = "securium-developer-secure-coding-8h-python-vibe-foundation-v1";
const registrationContext = {
  id: COURSE_ID,
  slug: COURSE_SLUG,
  active: false,
  published: false,
  deletedAt: null,
};
const REVISION_CONTEXT = {
  sourceRevisionId: "q36-answer-binding-repair-candidate",
  sourceRevisionVersion: "candidate-1",
  questionVersionOverrides: { Q36: 2 },
};

function model() {
  return loadSecureCoding8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
}

function clone(value) {
  return structuredClone(value);
}

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => error?.code === code, code);
}

test("builds exactly 40 deterministic Foundation-bound mappings", async () => {
  const first = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  const second = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);

  assert.deepEqual(first, second);
  assert.equal(first.courseId, COURSE_ID);
  assert.equal(first.courseSlug, COURSE_SLUG);
  assert.equal(first.foundationCandidateId, CANDIDATE_ID);
  assert.equal(first.questionCount, 40);
  assert.equal(first.mappings.length, 40);
  assert.deepEqual(
    first.mappings.map((entry) => entry.foundationQuestionId),
    Array.from({ length: 40 }, (_, index) => `Q${String(index + 1).padStart(2, "0")}`),
  );
  assert.equal(new Set(first.mappings.map((entry) => entry.runtimeQuestionId)).size, 40);
  assert.equal(new Set(first.mappings.map((entry) => entry.runtimeQuestionVersionId)).size, 40);
  assert.equal(first.mappings.every((entry) => entry.conceptMappingSetHash === null), true);
  assert.equal(first.mappings.every((entry) => entry.question.status === "DRAFT"), true);
  assert.equal(first.mappings.every((entry) => entry.question.isSample === false), true);
  assert.equal(first.mappings.every((entry) => entry.choices.length === 4), true);
  assert.equal(first.mappings.every((entry) => entry.choices.filter((choice) => choice.isCorrect).length === 1), true);
});

test("uses deterministic runtime and version identities and preserves answer order", async () => {
  assert.equal(
    secureCoding8HRuntimeQuestionId("Q01"),
    "question-developer-secure-coding-8h-python-vibe-Q01",
  );
  assert.equal(
    secureCoding8HRuntimeQuestionVersionId("Q01", 1),
    "version-question-developer-secure-coding-8h-python-vibe-Q01-v1",
  );
  const mapping = (await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT)).mappings[0];
  assert.deepEqual(mapping.choices.map((choice) => choice.displayOrder), [1, 2, 3, 4]);
  assert.deepEqual(mapping.choices.map((choice) => choice.content), [
    "The framework version only",
    "Who controls the value, what validates it, and which interpreter or sink receives it",
    "Whether the function is short",
    "Whether the browser rendered the form",
  ]);
  assert.equal(mapping.choices[1].isCorrect, true);
  assert.equal(mapping.choices.filter((choice) => choice.isCorrect).length, 1);
  assert.equal(mapping.question.type, "SINGLE_CHOICE");
  assert.equal(mapping.question.difficulty, "MEDIUM");
  assert.equal(mapping.question.explanation.length > 0, true);
});

test("all 40 projections remain compatible with the shared single-choice grader", async () => {
  const result = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  for (const mapping of result.mappings) {
    const correct = mapping.choices.find((choice) => choice.isCorrect);
    assert.ok(correct, mapping.foundationQuestionId);
    const grade = gradeQuestion(
      { type: mapping.question.type, choices: mapping.choices },
      correct.id,
    );
    assert.equal(grade.supported, true, mapping.foundationQuestionId);
    assert.equal(grade.isCorrect, true, mapping.foundationQuestionId);
    assert.equal(grade.score, 100, mapping.foundationQuestionId);
  }
});

test("keeps the projection frozen and excludes practical/lab authority", async () => {
  const result = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.mappings), true);
  assert.equal(Object.isFrozen(result.mappings[0]), true);
  assert.equal(Object.isFrozen(result.mappings[0].question), true);
  assert.equal(Object.isFrozen(result.mappings[0].choices), true);
  assert.equal("practicals" in result, false);
  assert.equal("executableLabs" in result, false);
  assert.throws(() => {
    result.mappings[0].question.content = "mutated";
  });
});

test("revalidates the generated projection and detects runtime identity drift", async () => {
  const sourceModel = model();
  const result = await projectSecureCoding8HQuestionRuntimeMapping(sourceModel, REVISION_CONTEXT);
  await assertSecureCoding8HQuestionRuntimeMapping(result, sourceModel, REVISION_CONTEXT);
  const wrongRuntimeId = clone(result);
  wrongRuntimeId.mappings[0].runtimeQuestionId = "wrong-runtime-id";
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(wrongRuntimeId, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );
});

test("fails closed for cardinality, duplicate, Q41, and unknown Foundation IDs", async () => {
  const sourceModel = model();
  const removed = clone(sourceModel);
  removed.foundation.questions.questions.pop();
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(removed, REVISION_CONTEXT),
    "COUNT_MISMATCH",
  );

  const duplicate = clone(sourceModel);
  duplicate.foundation.questions.questions[1].id = "Q01";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(duplicate, REVISION_CONTEXT),
    "QUESTION_ID_CONFLICT",
  );

  const q41 = clone(sourceModel);
  q41.foundation.questions.questions[39].id = "Q41";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(q41, REVISION_CONTEXT),
    "QUESTION_ID_CONFLICT",
  );

  const unknown = clone(sourceModel);
  unknown.foundation.questions.questions[0].id = "Q00";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(unknown, REVISION_CONTEXT),
    "QUESTION_ID_CONFLICT",
  );
});

test("fails closed for identity, version, type, answer, content, and binding mutations", async () => {
  const sourceModel = model();

  const wrongCourse = clone(sourceModel);
  wrongCourse.runtimeIdentity.courseId = "wrong-course";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(wrongCourse, REVISION_CONTEXT),
    "RUNTIME_IDENTITY_MISMATCH",
  );

  const wrongCandidate = clone(sourceModel);
  wrongCandidate.foundationIdentity.candidateId = "wrong-foundation-v2";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(wrongCandidate, REVISION_CONTEXT),
    "RUNTIME_IDENTITY_MISMATCH",
  );

  const unsupportedType = clone(sourceModel);
  unsupportedType.foundation.questions.questions[0].type = "ESSAY";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(unsupportedType, REVISION_CONTEXT),
    "QUESTION_TYPE_UNSUPPORTED",
  );

  const answerMutation = clone(sourceModel);
  answerMutation.foundation.questions.questions[0].answer = 4;
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(answerMutation, REVISION_CONTEXT),
    "QUESTION_ANSWER_CONFLICT",
  );

  const explanationMutation = clone(sourceModel);
  explanationMutation.foundation.questions.questions[0].explanation = "";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(explanationMutation, REVISION_CONTEXT),
    "FOUNDATION_INVALID",
  );

  const moduleMutation = clone(sourceModel);
  moduleMutation.foundation.questions.questions[0].module = "M08";
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(moduleMutation, REVISION_CONTEXT),
    "FOUNDATION_INVALID",
  );

  const objectiveMutation = clone(sourceModel);
  objectiveMutation.foundation.questions.questions[0].objectiveIds = ["O32"];
  await expectCode(
    () => projectSecureCoding8HQuestionRuntimeMapping(objectiveMutation, REVISION_CONTEXT),
    "FOUNDATION_INVALID",
  );
});

test("fails closed for candidate version, semantic hash, answer, choice order, and missing mappings", async () => {
  const sourceModel = model();
  const base = await projectSecureCoding8HQuestionRuntimeMapping(sourceModel, REVISION_CONTEXT);

  const wrongVersion = clone(base);
  wrongVersion.mappings[0].runtimeQuestionVersionId = "version-wrong-v1";
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(wrongVersion, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const wrongFoundationVersion = clone(base);
  wrongFoundationVersion.foundationVersion = "v2";
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(wrongFoundationVersion, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const hashMutation = clone(base);
  hashMutation.mappings[0].semanticHash = "0".repeat(64);
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(hashMutation, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const answerMutation = clone(base);
  answerMutation.mappings[0].choices[0].isCorrect = true;
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(answerMutation, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const orderMutation = clone(base);
  [orderMutation.mappings[0].choices[0], orderMutation.mappings[0].choices[1]] = [
    orderMutation.mappings[0].choices[1],
    orderMutation.mappings[0].choices[0],
  ];
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(orderMutation, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const missing = clone(base);
  missing.mappings.pop();
  missing.questionCount = 39;
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(missing, sourceModel, REVISION_CONTEXT),
    "MAPPING_PROJECTION_MISMATCH",
  );
});

test("semantic hash changes for assessment content and ignores no runtime database state", async () => {
  const sourceModel = model();
  const baseline = await projectSecureCoding8HQuestionRuntimeMapping(sourceModel, REVISION_CONTEXT);

  const promptMutation = clone(sourceModel);
  promptMutation.foundation.questions.questions[0].prompt += " Revised";
  const changed = await projectSecureCoding8HQuestionRuntimeMapping(promptMutation, REVISION_CONTEXT);
  assert.notEqual(
    changed.mappings[0].semanticHash,
    baseline.mappings[0].semanticHash,
  );

  const source = await readFile("lib/services/secure-coding-8h-question-runtime-mapping.ts", "utf8");
  assert.doesNotMatch(source, /getDb|queryOne|INSERT INTO|UPDATE |DELETE FROM|fetch\(/i);
  assert.doesNotMatch(source, /eval\(|exec\(|spawn\(|execFile\(|vm\./i);
  assert.doesNotMatch(source, /Q4[1-8]|Q48/);
});

test("does not claim Concept mapping, Evidence, or learner state", async () => {
  const result = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  assert.equal(result.mappings.every((entry) => entry.conceptMappingSetHash === null), true);
  assert.equal(result.mappings.some((entry) => "evidence" in entry), false);
  assert.equal(result.mappings.some((entry) => "mastery" in entry), false);
  assert.equal(result.mappings.some((entry) => "confidence" in entry), false);
  assert.equal(result.mappings.some((entry) => "learnerSkillState" in entry), false);
});
