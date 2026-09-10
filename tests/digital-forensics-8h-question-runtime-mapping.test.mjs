import assert from "node:assert/strict";
import test from "node:test";
import {
  DIGITAL_FORENSICS_8H_BINDING_KEY,
  DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY,
} from "../lib/services/digital-forensics-8h-runtime-adapter.ts";
import {
  assertDigitalForensics8HQuestionRuntimeMapping,
  buildDigitalForensics8HQuestionRuntimeMapping,
  digitalForensics8HRuntimeQuestionId,
  digitalForensics8HRuntimeQuestionVersionId,
  gradeDigitalForensics8HQuestion,
  projectDigitalForensics8HQuestionRuntimeMapping,
  toDigitalForensics8HGradingQuestion,
  toDigitalForensics8HLearnerQuestion,
} from "../lib/services/digital-forensics-8h-question-runtime-mapping.ts";
import { loadDigitalForensics8HRuntimeModel } from "../lib/services/digital-forensics-8h-runtime-adapter.ts";

const registrationContext = {
  id: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.courseId,
  code: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.code,
  slug: DIGITAL_FORENSICS_8H_RUNTIME_IDENTITY.slug,
  bindingKey: DIGITAL_FORENSICS_8H_BINDING_KEY,
  active: false,
  published: false,
  deletedAt: null,
};

async function mappingFixture() {
  return buildDigitalForensics8HQuestionRuntimeMapping({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
}

test("projects all 40 Foundation questions one-to-one with stable IDs and versions", async () => {
  const manifest = await mappingFixture();
  assert.equal(manifest.questionCount, 40);
  assert.equal(manifest.mappings.length, 40);
  assert.equal(new Set(manifest.mappings.map((mapping) => mapping.foundationQuestionId)).size, 40);
  assert.equal(new Set(manifest.mappings.map((mapping) => mapping.runtimeQuestionId)).size, 40);
  assert.equal(new Set(manifest.mappings.map((mapping) => mapping.runtimeQuestionVersionId)).size, 40);
  assert.equal(
    manifest.mappings[0].runtimeQuestionId,
    "question-course-digital-forensics-8h-DF-H01-Q01",
  );
  assert.equal(
    manifest.mappings[0].runtimeQuestionVersionId,
    "version-question-course-digital-forensics-8h-DF-H01-Q01-v1",
  );
  assert.ok(manifest.mappings.every((mapping) => /^[0-9a-f]{64}$/.test(mapping.semanticHash)));
});

test("preserves question content, category, difficulty, bindings, and semantic hashes", async () => {
  const model = loadDigitalForensics8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
  const manifest = await projectDigitalForensics8HQuestionRuntimeMapping(model);
  for (const mapping of manifest.mappings) {
    const source = model.foundation.questions.find((question) => question.id === mapping.foundationQuestionId);
    assert.ok(source);
    assert.equal(mapping.question.content, source.prompt);
    assert.deepEqual(mapping.choices.map((choice) => choice.content), source.options);
    assert.equal(mapping.foundationAssessmentType, source.assessmentType);
    assert.equal(mapping.foundationDifficulty, source.difficulty);
    assert.equal(mapping.moduleId, source.moduleId);
    assert.deepEqual(mapping.objectiveIds, source.objectiveIds);
    assert.equal(mapping.question.explanation, source.explanation);
    assert.equal(mapping.version.semanticHash, mapping.semanticHash);
    assert.equal(mapping.version.foundationVersion, "digital-forensics-8h-foundation.v1");
  }
});

test("preserves the Foundation assessment and difficulty distributions", async () => {
  const manifest = await mappingFixture();
  const categories = new Map();
  const difficulties = new Map();
  for (const mapping of manifest.mappings) {
    categories.set(mapping.foundationAssessmentType, (categories.get(mapping.foundationAssessmentType) ?? 0) + 1);
    difficulties.set(mapping.foundationDifficulty, (difficulties.get(mapping.foundationDifficulty) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(categories), {
    conceptRecognition: 7,
    workflowProcess: 7,
    scenarioReasoning: 8,
    artifactInterpretation: 7,
    timelineReasoning: 4,
    falsePositiveAlternativeExplanation: 7,
  });
  assert.deepEqual(Object.fromEntries(difficulties), { easy: 10, medium: 20, hard: 10 });
});

test("keeps correctness server-only and delegates grading to the shared grader", async () => {
  const manifest = await mappingFixture();
  const mapping = manifest.mappings[0];
  const learnerQuestion = toDigitalForensics8HLearnerQuestion(mapping);
  assert.equal("answerIndex" in learnerQuestion, false);
  assert.equal("serverOnlyGrading" in learnerQuestion, false);
  assert.ok(learnerQuestion.choices.every((choice) => !("isCorrect" in choice)));

  const gradingQuestion = toDigitalForensics8HGradingQuestion(mapping);
  assert.equal(gradingQuestion.type, "SINGLE_CHOICE");
  assert.equal(gradingQuestion.choices.filter((choice) => choice.isCorrect).length, 1);
  const correctChoice = gradingQuestion.choices.find((choice) => choice.isCorrect);
  assert.ok(correctChoice);
  assert.equal(gradeDigitalForensics8HQuestion(mapping, correctChoice.id).isCorrect, true);
  assert.equal(gradeDigitalForensics8HQuestion(mapping, "not-a-choice").isCorrect, false);
});

test("mapping is deeply frozen and a semantic mutation fails closed", async () => {
  const manifest = await mappingFixture();
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.mappings), true);
  assert.equal(Object.isFrozen(manifest.mappings[0]), true);
  assert.equal(Object.isFrozen(manifest.mappings[0].choices), true);
  assert.equal(Object.isFrozen(manifest.mappings[0].version), true);
  assert.throws(() => {
    manifest.mappings[0].choices[0].content = "mutated";
  }, TypeError);

  const model = loadDigitalForensics8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
  const changed = structuredClone(manifest);
  changed.mappings[0].semanticHash = "0".repeat(64);
  await assert.rejects(
    () => assertDigitalForensics8HQuestionRuntimeMapping(changed, model),
    (error) => error.code === "MAPPING_PROJECTION_MISMATCH",
  );
});

test("revalidates every exposed source-boundary field before projection", async () => {
  const model = loadDigitalForensics8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
  const mutations = [
    ["sourceManifestSha256", "0".repeat(64)],
    ["sourceAuthorityCount", 2],
    ["sourceMemberCount", 21],
    ["sourcePathIntegrity", "21/22"],
    ["sourceHashIntegrity", "21/22"],
    ["rights", "UNRESTRICTED"],
    ["currentness", "STALE"],
    ["h01ToH03", "SOURCE_SUPPORT_MISSING_FOR_STRUCTURE"],
    ["h04ToH08", "LOCAL_SOURCE_PARTIAL"],
    ["h04ToH08LocalDependence", 1],
    ["sourceExpressionReuse", 1],
    ["sourceQuestionReuse", 1],
    ["ocr", 1],
    ["transcription", 1],
    ["reconstruction", 1],
    ["restrictedSourceDependence", 1],
  ];
  for (const [field, value] of mutations) {
    const changed = structuredClone(model);
    changed.sourceBoundary[field] = value;
    await assert.rejects(
      () => projectDigitalForensics8HQuestionRuntimeMapping(changed),
      (error) => error.code === "SOURCE_BOUNDARY_INVALID",
    );
  }
  for (const replacement of [null, "invalid"]) {
    const changed = structuredClone(model);
    changed.sourceBoundary = replacement;
    await assert.rejects(
      () => projectDigitalForensics8HQuestionRuntimeMapping(changed),
      (error) => error.code === "SOURCE_BOUNDARY_INVALID",
    );
  }
});

test("rejects unknown Foundation question identities", () => {
  assert.throws(
    () => digitalForensics8HRuntimeQuestionId("DF-H09-Q01"),
    (error) => error.code === "QUESTION_ID_CONFLICT",
  );
  assert.throws(
    () => digitalForensics8HRuntimeQuestionVersionId("DF-H01-Q01", 0),
    (error) => error.code === "QUESTION_VERSION_MISMATCH",
  );
});

test("rejects malformed projected Foundation questions", async () => {
  const model = loadDigitalForensics8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });
  for (const mutation of [
    (question) => { question.options.length = 3; },
    (question) => { question.answerIndex = 4; },
    (question) => { question.explanation = ""; },
    (question) => { question.difficulty = "unknown"; },
  ]) {
    const changed = structuredClone(model);
    mutation(changed.foundation.questions[0]);
    await assert.rejects(
      () => projectDigitalForensics8HQuestionRuntimeMapping(changed),
      (error) => error.code === "QUESTION_AUTHORITY_INVALID",
    );
  }
});
