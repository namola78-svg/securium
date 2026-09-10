import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ISRM_FOUNDATION_COUNTS,
  ISRM_RUNTIME_IDENTITY,
  ISRM_RUNTIME_ADAPTER_EXECUTION,
  ISRM_RUNTIME_ADAPTER_PURITY,
  ISRM_SOURCE_SEMANTIC_VERSION,
  assertIsrmCanonicalVisibility,
  assertIsrmRuntimeBinding,
  gradeIsrmRuntimeQuestion,
  loadIsrmFoundationRuntimeReadModel,
  validateIsrmFoundationAuthority,
} from "../lib/services/securium-isrm-foundation-runtime-adapter.ts";

const canonicalRuntime = {
  courseId: "course-isrm",
  code: "ISRM",
  slug: "isrm",
  foundationCourseId: "course-isrm",
  active: true,
  published: false,
  isSample: false,
  deletedAt: null,
};

test("fixed canonical Foundation authority validates without runtime persistence", () => {
  const authority = validateIsrmFoundationAuthority();
  assert.deepEqual(authority.counts, ISRM_FOUNDATION_COUNTS);
  assert.equal(authority.courseId, "course-isrm");
  assert.equal(authority.code, "ISRM");
  assert.equal(authority.slug, "isrm");
  assert.equal(authority.sourceSemanticVersion, ISRM_SOURCE_SEMANTIC_VERSION);
  assert.equal(authority.publication, "NOT_AUTHORIZED");
  assert.equal(authority.executablePracticals, 0);
});

test("adapter projects the exact Foundation vector and preserves boundaries", () => {
  const model = loadIsrmFoundationRuntimeReadModel(canonicalRuntime);
  assert.equal(model.execution, ISRM_RUNTIME_ADAPTER_EXECUTION);
  assert.equal(model.persistence, "NON_PERSISTENT");
  assert.deepEqual(model.counts, ISRM_FOUNDATION_COUNTS);
  assert.equal(model.subjects.length, 5);
  assert.equal(model.units.length, 12);
  assert.equal(model.theory.length, 3);
  assert.equal(model.questions.length, 30);
  assert.equal(model.practicals.length, 10);
  assert.equal(model.source.officialSourceSemanticVersion, ISRM_SOURCE_SEMANTIC_VERSION);
  assert.equal(model.publication, "NOT_AUTHORIZED");
  assert.equal(model.questionAttempts.writesInAdapter, 0);
  assert.equal(model.grading.authority, "SHARED_GRADER");
  assert.equal(model.grading.duplicateIsrmGrader, 0);
  assert.equal(new Set(model.subjects.map((item) => item.runtimeKey)).size, 5);
  assert.equal(new Set(model.units.map((item) => item.runtimeKey)).size, 12);
  assert.equal(new Set(model.theory.map((item) => item.runtimeKey)).size, 3);
  assert.equal(new Set(model.questions.map((item) => item.id)).size, 30);
  assert.equal(new Set(model.practicals.map((item) => item.runtimeKey)).size, 10);
  assert.ok(model.units.every((unit) => unit.classification === "SECURIUM_PEDAGOGICAL"));
  assert.ok(model.practicals.every((practical) => practical.classification === "SYNTHETIC" && practical.mode === "SPEC_ONLY" && practical.officialExamContent === false));
  assert.equal(JSON.stringify(model).includes('"content"'), false);
  assert.deepEqual(model.runtimeIdentity, ISRM_RUNTIME_IDENTITY);
});

test("adapter requires the exact course identity tuple and Foundation binding", () => {
  assert.doesNotThrow(() => assertIsrmRuntimeBinding(canonicalRuntime));
  for (const [field, value] of [["courseId", "wrong"], ["code", "WRONG"], ["slug", "wrong"], ["foundationCourseId", "wrong"]]) {
    assert.throws(
      () => assertIsrmRuntimeBinding({ ...canonicalRuntime, [field]: value }),
      (error) => error.code === (field === "courseId" ? "COURSE_ID_MISMATCH" : field === "code" ? "COURSE_CODE_MISMATCH" : field === "slug" ? "COURSE_SLUG_MISMATCH" : "RUNTIME_IDENTITY_CONFLICT"),
    );
  }
});

test("published or sample legacy visibility cannot expose canonical Foundation", () => {
  for (const changes of [{ published: true }, { isSample: true }, { active: false }]) {
    assert.throws(
      () => assertIsrmCanonicalVisibility({ ...canonicalRuntime, ...changes }),
      (error) => error.code === "PUBLICATION_STATE_CONFLICT",
    );
  }
});

test("canonical question IDs normalize through the shared grader only", () => {
  const result = gradeIsrmRuntimeQuestion({
    questionId: "isrm-q-v2-01",
    question: {
      type: "SINGLE_CHOICE",
      choices: [
        { id: "choice-a", content: "A", isCorrect: true },
        { id: "choice-b", content: "B", isCorrect: false },
      ],
    },
    answer: "choice-a",
  });
  assert.equal(result.supported, true);
  assert.equal(result.isCorrect, true);
  assert.equal(result.score, 100);
  assert.throws(
    () => gradeIsrmRuntimeQuestion({ questionId: "sample-question-01", question: { type: "SINGLE_CHOICE", choices: [] }, answer: "x" }),
    (error) => error.code === "QUESTION_ID_CONFLICT",
  );
});

test("adapter is fixed-path, read-only, and does not import registration or database authority", async () => {
  const source = await readFile(new URL("../lib/services/securium-isrm-foundation-runtime-adapter.ts", import.meta.url), "utf8");
  assert.match(source, /content-drafts\/securium-isrm-foundation\/manifest\.json/);
  assert.doesNotMatch(source, /provider-factory|db\/repositories|INSERT|UPDATE|DELETE|transaction\(/);
  assert.match(source, /ISRM_RUNTIME_ADAPTER_PURITY/);
  assert.equal(ISRM_RUNTIME_ADAPTER_PURITY, "READ_ONLY_PURE_NON_PERSISTENT");
});
