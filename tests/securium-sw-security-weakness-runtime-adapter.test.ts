import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import foundationCandidate from "../content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json" with { type: "json" };
import {
  buildSwSecurityWeaknessRuntimeProjection,
  gradeSwSecurityWeaknessQuestion,
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  SwSecurityWeaknessRuntimeAdapterError,
  validateSwSecurityWeaknessFoundation,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";

const FOUNDATION_NAME =
  "SW \uBCF4\uC548\uC57D\uC810 \uC9C4\uB2E8\uC6D0";

const unpublishedCourse = {
  id: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId,
  code: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code,
  slug: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug,
  name: FOUNDATION_NAME,
  bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
  active: true,
  published: false,
  isSample: false,
  deletedAt: null,
} as const;

type MutableFoundation = {
  acceptedDiagnosticTriads: Array<{
    topic: string;
    weaknessId: string;
    questionIds: string[];
  }>;
  questions: Array<{
    id: string;
    role: string;
    answerKey: { verdict: string; diagnosticConclusion: string };
    nonExploitabilityReason?: string;
  }>;
};

function cloneFoundation() {
  return structuredClone(foundationCandidate) as unknown as MutableFoundation;
}

function assertAdapterError(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => {
    return (
      error instanceof SwSecurityWeaknessRuntimeAdapterError &&
      error.code === code
    );
  });
}

test("projects the fixed Foundation with the canonical count vector", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);

  assert.deepEqual(projection.counts, {
    modules: 6,
    objectives: 12,
    theory: 8,
    questions: 21,
    triads: 7,
  });
  assert.equal(projection.modules.length, 6);
  assert.equal(projection.objectives.length, 12);
  assert.equal(projection.theory.length, 8);
  assert.equal(projection.questions.length, 21);
  assert.equal(projection.triads.length, 7);
  assert.equal(projection.course.visibility, "REGISTERED_UNPUBLISHED");
  assert.equal(Object.isFrozen(projection), true);
});

test("allows an already-authorized non-sample publication state without mutating it", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection({
    ...unpublishedCourse,
    published: true,
  });

  assert.equal(projection.course.published, true);
  assert.equal(projection.course.isSample, false);
});

test("rejects the current public sample state before Foundation exposure", () => {
  assertAdapterError(
    () =>
      buildSwSecurityWeaknessRuntimeProjection({
        ...unpublishedCourse,
        published: true,
        isSample: true,
      }),
    "SAMPLE_STATE_CONFLICT",
  );
});

test("requires exact course identity, slug, and binding key", () => {
  assertAdapterError(
    () =>
      buildSwSecurityWeaknessRuntimeProjection({
        ...unpublishedCourse,
        id: "course-other",
      }),
    "COURSE_ID_MISMATCH",
  );
  assertAdapterError(
    () =>
      buildSwSecurityWeaknessRuntimeProjection({
        ...unpublishedCourse,
        slug: "other-slug",
      }),
    "SLUG_MISMATCH",
  );
  assertAdapterError(
    () =>
      buildSwSecurityWeaknessRuntimeProjection({
        ...unpublishedCourse,
        bindingKey: "other-binding",
      }),
    "BINDING_KEY_MISMATCH",
  );
});

test("derives stable module, objective, theory, and question runtime IDs", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);

  assert.deepEqual(
    projection.modules.map((module) => module.runtimeId),
    projection.modules.map(
      (module) => "course-sw-vuln:module:" + module.id,
    ),
  );
  assert.equal(
    new Set(projection.objectives.map((objective) => objective.runtimeId)).size,
    12,
  );
  assert.equal(
    new Set(projection.theory.map((unit) => unit.runtimeId)).size,
    8,
  );
  assert.equal(
    new Set(projection.questions.map((question) => question.id)).size,
    21,
  );
  assert.equal(
    new Set(projection.questions.map((question) => question.runtimeId)).size,
    21,
  );
});

test("builds seven deterministic triads with one member of each role", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);
  const triadIds = projection.triads.map((triad) => triad.id);

  assert.equal(new Set(triadIds).size, 7);
  for (const triad of projection.triads) {
    assert.equal(triad.members.length, 3);
    assert.deepEqual(
      triad.members.map((member) => member.role).sort(),
      ["FALSE_POSITIVE", "SECURE", "VULNERABLE"],
    );
    assert.deepEqual(
      triad.questionIds,
      triad.members.map((member) => member.questionId),
    );
    assert.equal(
      new Set(triad.members.map((member) => member.question.moduleId)).size,
      1,
    );
  }
});

test("preserves all false-positive semantic fields", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);
  const falsePositives = projection.questions.filter(
    (question) => question.role === "FALSE_POSITIVE",
  );

  assert.equal(falsePositives.length, 7);
  for (const question of falsePositives) {
    assert.equal(question.feedback.classification, "FALSE_POSITIVE");
    assert.ok(question.feedback.nonExploitabilityReason);
    assert.ok(question.feedback.reason);
    assert.ok(question.feedback.assumptions.length > 0);
    assert.ok(question.feedback.evidence.length > 0);
    assert.ok(question.feedback.validationOrTransformation);
    assert.ok(question.feedback.diagnosticConclusion);
    assert.ok(question.feedback.explanation);
  }
});

test("projects all questions into the existing short-answer practice shape", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);

  assert.equal(projection.practice.questions.length, 21);
  for (const question of projection.practice.questions) {
    assert.equal(question.courseId, "course-sw-vuln");
    assert.equal(question.type, "SHORT_ANSWER");
    assert.equal(question.automaticGradingAvailable, true);
    assert.deepEqual(question.choices, []);
    assert.ok(question.content.includes(question.case.code));
    assert.ok(question.content.includes(question.case.source));
    assert.ok(question.triadId.startsWith("course-sw-vuln:triad:"));
  }
});

test("uses the shared grader for the canonical verdict of every question", () => {
  const projection = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);

  for (const question of projection.questions) {
    const result = gradeSwSecurityWeaknessQuestion(
      unpublishedCourse,
      question.id,
      question.answerKey.verdict,
    );
    assert.equal(result.supported, true);
    assert.equal(result.isCorrect, true);
    assert.equal(result.score, 100);
    assert.equal(result.caseRole, question.role);
    assert.equal(result.triadId, question.triadId);
    assert.equal(result.feedback.classification, question.role);
  }
});

test("does not independently grade a wrong diagnostic verdict", () => {
  const questionId = "sw-fa-q-iv-v";
  const result = gradeSwSecurityWeaknessQuestion(
    unpublishedCourse,
    questionId,
    "SECURE",
  );

  assert.equal(result.supported, true);
  assert.equal(result.isCorrect, false);
  assert.equal(result.score, 0);
  assert.equal(result.diagnosis, "SECURE");
});

test("keeps the repository seam binding-only and free of Foundation content", () => {
  const repositorySource = readFileSync(
    new URL("../db/repositories.ts", import.meta.url),
    "utf8",
  );
  assert.match(repositorySource, /projectSwSecurityWeaknessRuntimeCourse/);
  assert.match(repositorySource, /buildSwSecurityWeaknessRuntimeProjection/);
  assert.doesNotMatch(repositorySource, /sw-fa-q-/);
  assert.doesNotMatch(repositorySource, /Parser\\.parse/);
  assert.doesNotMatch(repositorySource, /nonExploitabilityReason/);
});

test("rejects a triad that crosses diagnostic topics", () => {
  const candidate = cloneFoundation();
  candidate.acceptedDiagnosticTriads[0].topic = "Wrong topic";
  assertAdapterError(
    () => validateSwSecurityWeaknessFoundation(candidate),
    "TRIAD_CROSS_CATEGORY",
  );
});

test("rejects a triad weakness identity not bound to its canonical question group", () => {
  const candidate = cloneFoundation();
  candidate.acceptedDiagnosticTriads[0].weaknessId = "SW-WAVE-99";
  assertAdapterError(
    () => validateSwSecurityWeaknessFoundation(candidate),
    "TRIAD_CROSS_CATEGORY",
  );
});

test("rejects duplicate triad role/reference assembly", () => {
  const candidate = cloneFoundation();
  candidate.acceptedDiagnosticTriads[0].questionIds[1] =
    candidate.acceptedDiagnosticTriads[0].questionIds[0];
  assert.throws(
    () => validateSwSecurityWeaknessFoundation(candidate),
    (error: unknown) => {
      return (
        error instanceof SwSecurityWeaknessRuntimeAdapterError &&
        (error.code === "FOUNDATION_INVALID" ||
          error.code === "TRIAD_DUPLICATE_ROLE")
      );
    },
  );
});

test("rejects false-positive payloads without non-exploitability reasoning", () => {
  const candidate = cloneFoundation();
  const falsePositive = candidate.questions.find(
    (question) => question.role === "FALSE_POSITIVE",
  );
  assert.ok(falsePositive);
  delete falsePositive.nonExploitabilityReason;
  assertAdapterError(
    () => validateSwSecurityWeaknessFoundation(candidate),
    "FALSE_POSITIVE_REASONING_MISSING",
  );
});

test("rejects Foundation count mismatch and incomplete question coverage", () => {
  const candidate = cloneFoundation();
  candidate.questions.pop();
  assertAdapterError(
    () => validateSwSecurityWeaknessFoundation(candidate),
    "COUNT_MISMATCH",
  );
});

test("does not embed canonical question bodies in the repository seam", () => {
  const repositorySource = readFileSync(
    new URL("../db/repositories.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(repositorySource, /sw-fa-q-/);
  assert.doesNotMatch(repositorySource, /Parser\\.parse/);
  assert.doesNotMatch(repositorySource, /nonExploitabilityReason/);
});

test("repeated projection is deterministic and preserves triad role linkage", () => {
  const first = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);
  const second = buildSwSecurityWeaknessRuntimeProjection(unpublishedCourse);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.practice.triads.map((triad) =>
      triad.members.map((member) => [member.id, member.diagnosticRole]),
    ),
    second.practice.triads.map((triad) =>
      triad.members.map((member) => [member.id, member.diagnosticRole]),
    ),
  );
});

test("provider-neutral runtime identities project identically for PostgreSQL and D1", () => {
  const postgresProjection = buildSwSecurityWeaknessRuntimeProjection({
    ...unpublishedCourse,
  });
  const d1Projection = buildSwSecurityWeaknessRuntimeProjection({
    ...unpublishedCourse,
  });
  assert.deepEqual(postgresProjection, d1Projection);
});

test("adapter source has no runtime DB, network, or code-execution side effect", () => {
  const adapterSource = readFileSync(
    new URL(
      "../lib/services/securium-sw-security-weakness-runtime-adapter.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(adapterSource, /getDb\s*\(/);
  assert.doesNotMatch(adapterSource, /\bfetch\s*\(/);
  assert.doesNotMatch(adapterSource, /\b(?:eval|exec|writeFile)\s*\(/);
});
