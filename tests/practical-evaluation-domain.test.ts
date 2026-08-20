import assert from "node:assert/strict";
import test from "node:test";
import {
  createPracticalAttempt,
  createPracticalEvaluation,
  createReevaluation,
  digestPracticalJson,
  transitionPracticalAttempt,
  validateCanonicalPracticalJson,
  type PracticalEvidenceProjectionInput,
} from "../lib/practical/practical-attempt.ts";
import {
  createRubric,
  createRubricVersion,
  validateDimensionEvaluationResult,
  validateRubricDimension,
} from "../lib/practical/practical-rubric.ts";
import { buildPracticalId } from "../lib/practical/practical-definition.ts";
import { sanitizeAuditMetadata } from "../lib/services/audit-service.ts";

const digest = "c".repeat(64);
const practicalId = buildPracticalId(
  "secure-development",
  "diagnose-sql-injection",
);
const practicalVersionId = `practical-version:${practicalId}:v1`;
const rubric = createRubric({
  namespace: "secure-development",
  purposeKey: "diagnosis",
  lifecycle: "ACTIVE",
});
const rubricVersion = createRubricVersion({
  rubricId: rubric.id,
  version: 1,
  digest,
  dimensions: [
    {
      key: "core:detection",
      evaluationMode: "DETERMINISTIC",
      required: true,
      supportsDeterministic: true,
      supportsQualitative: false,
      contributesToEvidence: true,
      score: { minimum: 0, maximum: 2, passing: 1 },
    },
    {
      key: "core:reasoning",
      evaluationMode: "RUBRIC",
      required: true,
      supportsDeterministic: false,
      supportsQualitative: true,
      contributesToEvidence: true,
    },
  ],
});
const responseSpec = [
  { key: "reasoning", type: "FREE_TEXT" as const, required: true },
];

function attempt(versionId = practicalVersionId, rubricId = rubricVersion.id) {
  return createPracticalAttempt({
    attemptId: "attempt-01",
    learnerReference: "learner-01",
    practicalId,
    practicalVersionId: versionId,
    rubricVersionId: rubricId,
    objectivePlacementId: "objective-placement-01",
    practicalPlacementId: "practical-placement-01",
    responseSpec,
    responses: [{ key: "reasoning", type: "FREE_TEXT", value: "analysis" }],
    startedAt: "2026-08-19T00:00:00.000Z",
    draftRevision: 2,
  });
}

function submittedAttempt() {
  return transitionPracticalAttempt(
    attempt(),
    "SUBMITTED",
    "2026-08-19T00:10:00.000Z",
  );
}

function evaluatedAttempt() {
  return transitionPracticalAttempt(submittedAttempt(), "EVALUATED");
}

function results() {
  return [
    {
      dimensionKey: "core:detection",
      outcome: "PASS",
      points: 2,
      maximumPoints: 2,
      deterministicChecks: [
        {
          checkKey: "expected-classification",
          kind: "CLASSIFICATION",
          outcome: "PASS",
          observedValue: "profile-owned-value",
        },
      ],
    },
    {
      dimensionKey: "core:reasoning",
      outcome: "PARTIAL",
      deterministicChecks: [],
      rationale: "rubric-backed",
    },
  ];
}

test("Rubric identity and RubricVersion are separate and immutable", () => {
  assert.equal(rubric.id, "rubric:secure-development:diagnosis");
  assert.equal(rubricVersion.rubricId, rubric.id);
  assert.equal(rubricVersion.version, 1);
  assert.ok(Object.isFrozen(rubricVersion));
  assert.ok(Object.isFrozen(rubricVersion.dimensions));
});

test("rubric dimensions use bounded optional scores and typed outcomes", () => {
  const result = validateDimensionEvaluationResult(results()[0]);
  assert.equal(result.outcome, "PASS");
  assert.equal(result.maximumPoints, 2);
  assert.throws(
    () =>
      validateDimensionEvaluationResult({
        dimensionKey: "core:detection",
        outcome: "PASS",
        points: 3,
        maximumPoints: 2,
        deterministicChecks: [],
      }),
    /INVALID_DIMENSION_POINTS/,
  );
});

test("bounded rubric scores reject every non-finite numeric field", () => {
  const baseDimension = {
    key: "core:scored",
    evaluationMode: "RUBRIC",
    required: true,
    supportsDeterministic: false,
    supportsQualitative: true,
    contributesToEvidence: true,
  } as const;
  const invalidScores = [
    { minimum: Number.NaN, maximum: 2, passing: 1 },
    { minimum: Number.POSITIVE_INFINITY, maximum: 2, passing: 1 },
    { minimum: Number.NEGATIVE_INFINITY, maximum: 2, passing: 1 },
    { minimum: 0, maximum: Number.NaN, passing: 1 },
    { minimum: 0, maximum: Number.POSITIVE_INFINITY, passing: 1 },
    { minimum: 0, maximum: Number.NEGATIVE_INFINITY, passing: 1 },
    { minimum: 0, maximum: 2, passing: Number.NaN },
    { minimum: 0, maximum: 2, passing: Number.POSITIVE_INFINITY },
    { minimum: 0, maximum: 2, passing: Number.NEGATIVE_INFINITY },
  ];

  for (const score of invalidScores) {
    assert.throws(
      () => validateRubricDimension({ ...baseDimension, score }),
      /INVALID_BOUNDED_SCORE/,
    );
  }
});

test("dimension results reject non-finite awarded points", () => {
  for (const points of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    assert.throws(
      () =>
        validateDimensionEvaluationResult({
          dimensionKey: "core:scored",
          outcome: "PASS",
          points,
          maximumPoints: 2,
          deterministicChecks: [],
        }),
      /INVALID_DIMENSION_POINTS/,
    );
  }
});

test("dimension results reject non-finite maximum points", () => {
  for (const maximumPoints of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    assert.throws(
      () =>
        validateDimensionEvaluationResult({
          dimensionKey: "core:scored",
          outcome: "PASS",
          points: 1,
          maximumPoints,
          deterministicChecks: [],
        }),
      /INVALID_DIMENSION_POINTS/,
    );
  }
});

test("finite score boundaries, decimals, and negative zero remain valid and serializable", () => {
  const dimension = validateRubricDimension({
    key: "core:scored",
    evaluationMode: "RUBRIC",
    required: true,
    supportsDeterministic: false,
    supportsQualitative: true,
    contributesToEvidence: true,
    score: { minimum: 0, maximum: 2.75, passing: 0.5 },
  });
  const lower = validateDimensionEvaluationResult({
    dimensionKey: "core:scored",
    outcome: "PARTIAL",
    points: -0,
    maximumPoints: 2.75,
    deterministicChecks: [],
  });
  const upper = validateDimensionEvaluationResult({
    dimensionKey: "core:scored",
    outcome: "PASS",
    points: 2.75,
    maximumPoints: 2.75,
    deterministicChecks: [],
  });
  const roundTrip = JSON.parse(JSON.stringify(upper));

  assert.deepEqual(dimension.score, { minimum: 0, maximum: 2.75, passing: 0.5 });
  assert.ok(lower.points === 0);
  assert.equal(upper.points, upper.maximumPoints);
  assert.equal(roundTrip.points, 2.75);
  assert.equal(roundTrip.maximumPoints, 2.75);
});

test("deterministic outcomes reject coercible object representations without mutation", () => {
  const customToString = Object.freeze({ toString: () => "PASS" });
  const valueOfAndToString = Object.freeze({
    valueOf: () => 1,
    toString: () => "PASS",
  });
  const invalidOutcomes: readonly unknown[] = [
    customToString,
    new String("PASS"),
    Object.freeze(["PASS"]),
    valueOfAndToString,
  ];

  for (const outcome of invalidOutcomes) {
    assert.throws(
      () =>
        validateDimensionEvaluationResult({
          dimensionKey: "core:detection",
          outcome: "PASS",
          deterministicChecks: [
            { checkKey: "check-1", kind: "EXACT_OPTION", outcome },
          ],
        }),
      /INVALID_DETERMINISTIC_CHECK_OUTCOME/,
    );
  }
  assert.equal(customToString.toString(), "PASS");
  assert.equal(valueOfAndToString.valueOf(), 1);
});

test("deterministic outcomes reject primitive non-strings and invalid literals", () => {
  const invalidOutcomes: readonly unknown[] = [
    1,
    0,
    true,
    null,
    undefined,
    Symbol("PASS"),
    "pass",
    " PASS ",
    "UNKNOWN",
    "",
  ];

  for (const outcome of invalidOutcomes) {
    assert.throws(
      () =>
        validateDimensionEvaluationResult({
          dimensionKey: "core:detection",
          outcome: "PASS",
          deterministicChecks: [
            { checkKey: "check-1", kind: "EXACT_OPTION", outcome },
          ],
        }),
      /INVALID_DETERMINISTIC_CHECK_OUTCOME/,
    );
  }
});

test("deterministic outcome literals remain primitive strings through JSON round-trip", () => {
  for (const outcome of ["PASS", "FAIL", "NOT_RUN"] as const) {
    const check = Object.freeze({
      checkKey: "check-1",
      kind: "EXACT_OPTION",
      outcome,
    });
    const input = Object.freeze({
      dimensionKey: "core:detection",
      outcome: "PASS",
      deterministicChecks: Object.freeze([check]),
    });
    const result = validateDimensionEvaluationResult(input);
    const validatedOutcome = result.deterministicChecks[0].outcome;
    const roundTrip = JSON.parse(JSON.stringify(result));

    assert.equal(typeof validatedOutcome, "string");
    assert.equal(validatedOutcome, outcome);
    assert.equal(roundTrip.deterministicChecks[0].outcome, outcome);
    assert.equal(check.outcome, outcome);
  }
});

test("PracticalAttempt binds exact PracticalVersion and RubricVersion", () => {
  const record = attempt();
  assert.equal(record.practicalVersionId, practicalVersionId);
  assert.equal(record.rubricVersionId, rubricVersion.id);
  assert.equal(record.draftRevision, 2);
});

test("attempt lifecycle permits only frozen transitions without mutation", () => {
  const original = attempt();
  const submitted = transitionPracticalAttempt(
    original,
    "SUBMITTED",
    "2026-08-19T00:10:00.000Z",
  );
  const evaluated = transitionPracticalAttempt(submitted, "EVALUATED");
  assert.equal(original.state, "IN_PROGRESS");
  assert.equal(submitted.state, "SUBMITTED");
  assert.equal(evaluated.state, "EVALUATED");
  assert.throws(
    () => transitionPracticalAttempt(evaluated, "IN_PROGRESS"),
    /INVALID_PRACTICAL_ATTEMPT_TRANSITION/,
  );
});

test("historical attempts never move to later Practical or Rubric versions", () => {
  const historical = attempt();
  const newerPracticalVersionId = `practical-version:${practicalId}:v2`;
  const newerRubricVersionId = `rubric-version:${rubric.id}:v2`;
  assert.notEqual(historical.practicalVersionId, newerPracticalVersionId);
  assert.notEqual(historical.rubricVersionId, newerRubricVersionId);
  assert.equal(historical.practicalVersionId, practicalVersionId);
  assert.equal(historical.rubricVersionId, rubricVersion.id);
});

test("Evaluation binds deterministic and rubric results to exact versions", () => {
  const record = submittedAttempt();
  const evaluation = createPracticalEvaluation({
    evaluationId: "evaluation-01",
    sequence: 1,
    attempt: record,
    practicalVersionId,
    rubricVersionId: rubricVersion.id,
    dimensionResults: results(),
    qualification: "PENDING_REVIEW",
    provenance: {
      method: "HYBRID",
      evaluatedAt: "2026-08-19T00:20:00.000Z",
      evaluatorReference: "reviewer-role-security",
    },
  });
  assert.equal(evaluation.attemptId, record.attemptId);
  assert.deepEqual(
    evaluation.dimensionResults.map((item) => item.outcome),
    ["PASS", "PARTIAL"],
  );
  assert.equal(evaluation.qualification, "PENDING_REVIEW");
});

test("AI-assisted provenance alone cannot grant canonical qualification", () => {
  assert.throws(
    () =>
      createPracticalEvaluation({
        evaluationId: "evaluation-ai",
        sequence: 1,
        attempt: submittedAttempt(),
        practicalVersionId,
        rubricVersionId: rubricVersion.id,
        dimensionResults: results(),
        qualification: "QUALIFIED",
        provenance: {
          method: "AI_ASSISTED",
          evaluatedAt: "2026-08-19T00:20:00.000Z",
          aiModel: { provider: "provider", model: "model", version: "v1" },
        },
      }),
    /AI_ASSISTED_ALONE_CANNOT_QUALIFY/,
  );
});

test("re-evaluation is append-only with a new identity and history link", () => {
  const record = submittedAttempt();
  const evaluatedRecord = transitionPracticalAttempt(record, "EVALUATED");
  const first = createPracticalEvaluation({
    evaluationId: "evaluation-01",
    sequence: 1,
    attempt: record,
    practicalVersionId,
    rubricVersionId: rubricVersion.id,
    dimensionResults: results(),
    qualification: "PENDING_REVIEW",
    provenance: {
      method: "RUBRIC",
      evaluatedAt: "2026-08-19T00:20:00.000Z",
      evaluatorReference: "reviewer-role-assessment",
    },
  });
  const second = createReevaluation(first, {
    evaluationId: "evaluation-02",
    attempt: evaluatedRecord,
    practicalVersionId,
    rubricVersionId: rubricVersion.id,
    dimensionResults: results(),
    qualification: "QUALIFIED",
    provenance: {
      method: "HUMAN_REVIEWED",
      evaluatedAt: "2026-08-19T00:30:00.000Z",
      evaluatorReference: "reviewer-role-security",
    },
  });
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.previousEvaluationId, first.evaluationId);
  assert.throws(
    () => createReevaluation(first, { ...second, evaluationId: first.evaluationId, attempt: evaluatedRecord }),
    /REEVALUATION_REQUIRES_NEW_IDENTITY/,
  );
});

test("lifecycle is separate from currentness and provenance is separate from policy", () => {
  const record = createPracticalAttempt({
    ...attempt(),
    responseSpec,
    eligibilityDecisionReference: "cre-decision-event-01",
  });
  assert.equal(record.state, "IN_PROGRESS");
  assert.equal(record.eligibilityDecisionReference, "cre-decision-event-01");
  assert.equal(Object.hasOwn(record, "isPublishable"), false);
  assert.equal(Object.hasOwn(record, "webAllowed"), false);
});

test("future Evidence projection has stable event-time identities without Evidence creation", () => {
  const projection: PracticalEvidenceProjectionInput = {
    assessmentObjectiveId:
      "assessment-objective:secure-development:diagnose-injection",
    objectivePlacementId: "objective-placement-01",
    practicalId,
    practicalVersionId,
    rubricVersionId: rubricVersion.id,
    practicalPlacementId: "practical-placement-01",
    artifactDigests: [digest],
    attemptId: "attempt-01",
    evaluationId: "evaluation-01",
    curriculumVersionReference: "tree-sw-v1",
    criterionReferences: ["annex3-criterion-ref"],
    creDecisionReference: "cre-v2-decision-ref",
    policyDecisionReference: "policy-decision-ref",
    provenanceDecisionReference: "provenance-decision-ref",
    currentnessDecisionReference: "currentness-decision-ref",
  };
  assert.equal(projection.practicalVersionId, practicalVersionId);
  assert.equal(Object.hasOwn(projection, "competencyState"), false);
});

test("SW-P1A F01 service-domain construction starts only IN_PROGRESS", () => {
  assert.equal(attempt().state, "IN_PROGRESS");
});

test("SW-P1A F02 caller-selected later initial states are rejected", () => {
  for (const state of ["SUBMITTED", "EVALUATED", "EXPIRED", "VOIDED"]) {
    assert.throws(
      () => createPracticalAttempt({ ...attempt(), state, responseSpec }),
      /INVALID_INITIAL_PRACTICAL_ATTEMPT_STATE/,
    );
  }
});

test("SW-P1A F03 lifecycle transition matrix is exact", () => {
  const initial = attempt();
  for (const state of ["SUBMITTED", "EXPIRED", "VOIDED"] as const) {
    assert.equal(
      transitionPracticalAttempt(
        initial,
        state,
        state === "SUBMITTED" ? "2026-08-19T01:00:00.000Z" : undefined,
      ).state,
      state,
    );
  }
  for (const state of ["IN_PROGRESS", "EVALUATED"] as const) {
    assert.throws(
      () => transitionPracticalAttempt(initial, state),
      /INVALID_PRACTICAL_ATTEMPT_TRANSITION/,
    );
  }
});

test("SW-P1A F04 submission snapshot canonicalization is deterministic", async () => {
  const left = await digestPracticalJson({ responses: [1, 2], artifacts: [] });
  const right = await digestPracticalJson({ artifacts: [], responses: [1, 2] });
  assert.equal(left.canonicalJson, right.canonicalJson);
  assert.equal(left.digest, right.digest);
});

test("SW-P1A F05 expiration is in-progress-only and creates no evaluation", () => {
  const expired = transitionPracticalAttempt(attempt(), "EXPIRED");
  assert.equal(expired.state, "EXPIRED");
  assert.equal(Object.hasOwn(expired, "evaluation"), false);
  assert.throws(
    () => transitionPracticalAttempt(submittedAttempt(), "EXPIRED"),
    /INVALID_PRACTICAL_ATTEMPT_TRANSITION/,
  );
});

test("SW-P1A F06 voiding preserves the input attempt", () => {
  const original = submittedAttempt();
  const voided = transitionPracticalAttempt(original, "VOIDED");
  assert.equal(original.state, "SUBMITTED");
  assert.equal(voided.state, "VOIDED");
  assert.equal(voided.attemptId, original.attemptId);
});

test("SW-P1A F07 evaluation before submission is denied", () => {
  assert.throws(
    () =>
      createPracticalEvaluation({
        evaluationId: "evaluation-before-submit",
        sequence: 1,
        attempt: attempt(),
        practicalVersionId,
        rubricVersionId: rubricVersion.id,
        dimensionResults: results(),
        qualification: "PENDING_REVIEW",
        provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
      }),
    /EVALUATION_BEFORE_SUBMISSION/,
  );
});

test("SW-P1A F08 first evaluation binds exact submitted attempt versions", () => {
  const record = submittedAttempt();
  const evaluation = createPracticalEvaluation({
    evaluationId: "evaluation-first-binding",
    sequence: 1,
    attempt: record,
    practicalVersionId,
    rubricVersionId: rubricVersion.id,
    dimensionResults: results(),
    qualification: "PENDING_REVIEW",
    provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
  });
  assert.equal(evaluation.attemptId, record.attemptId);
  assert.equal(evaluation.previousEvaluationId, undefined);
});

test("SW-P1A F09 deterministic literals remain exact primitives", () => {
  for (const outcome of ["PASS", "FAIL", "NOT_RUN"] as const) {
    const result = validateDimensionEvaluationResult({
      dimensionKey: "core:detection",
      outcome: "PASS",
      deterministicChecks: [{ checkKey: "literal", kind: "EXACT_OPTION", outcome }],
    });
    assert.equal(result.deterministicChecks[0].outcome, outcome);
    assert.equal(typeof result.deterministicChecks[0].outcome, "string");
  }
});

test("SW-P1A F10 coercible deterministic outcomes remain rejected", () => {
  for (const outcome of [new String("PASS"), ["PASS"], { toString: () => "PASS" }, " PASS ", "pass"]) {
    assert.throws(
      () => validateDimensionEvaluationResult({
        dimensionKey: "core:detection",
        outcome: "PASS",
        deterministicChecks: [{ checkKey: "coercible", kind: "EXACT_OPTION", outcome }],
      }),
      /INVALID_DETERMINISTIC_CHECK_OUTCOME/,
    );
  }
});

test("SW-P1A F11 canonical JSON rejects top-level non-finite numbers", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(() => validateCanonicalPracticalJson(value), /NON_FINITE_EVALUATION_VALUE/);
  }
});

test("SW-P1A F12 canonical JSON rejects nested non-finite numbers", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => validateCanonicalPracticalJson({ dimension: { checks: [{ value }] } }),
      /NON_FINITE_EVALUATION_VALUE/,
    );
  }
});

test("SW-P1A F13 canonical JSON rejects non-JSON values and cycles", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const value of [undefined, () => true, Symbol("x"), BigInt(1), cycle]) {
    assert.throws(() => validateCanonicalPracticalJson(value));
  }
});

test("SW-P1A F14 canonical JSON rejects prototypes accessors and dangerous keys", () => {
  class Custom { value = 1; }
  const accessor = {} as Record<string, unknown>;
  Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
  const dangerous = JSON.parse('{"__proto__":{"polluted":true}}');
  for (const value of [new Custom(), accessor, dangerous, { constructor: "x" }, { toJSON: () => ({}) }]) {
    assert.throws(() => validateCanonicalPracticalJson(value), /INVALID_STRUCTURED_FIELD/);
  }
});

test("SW-P1A F15 canonical JSON enforces depth cardinality and size bounds", () => {
  let deep: unknown = "leaf";
  for (let index = 0; index < 10; index += 1) deep = { child: deep };
  assert.throws(() => validateCanonicalPracticalJson(deep), /DEPTH_LIMIT/);
  assert.throws(() => validateCanonicalPracticalJson(Array.from({ length: 257 }, () => 1)), /ARRAY_LIMIT/);
  assert.throws(() => validateCanonicalPracticalJson(Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`k${index}`, index]))), /KEY_LIMIT/);
  assert.throws(() => validateCanonicalPracticalJson("x".repeat(10_001)), /STRING_LIMIT/);
});

test("SW-P1A F16 AI-assisted evaluation alone cannot qualify", () => {
  assert.throws(
    () => createPracticalEvaluation({
      evaluationId: "evaluation-ai-f16",
      sequence: 1,
      attempt: submittedAttempt(),
      practicalVersionId,
      rubricVersionId: rubricVersion.id,
      dimensionResults: results(),
      qualification: "QUALIFIED",
      provenance: {
        method: "AI_ASSISTED",
        evaluatedAt: "2026-08-19T01:00:00Z",
        aiModel: { provider: "provider", model: "model" },
      },
    }),
    /AI_ASSISTED_ALONE_CANNOT_QUALIFY/,
  );
});

test("SW-P1A F17 incompatible definition and rubric versions are rejected", () => {
  assert.throws(
    () => createPracticalEvaluation({
      evaluationId: "evaluation-mismatch-f17",
      sequence: 1,
      attempt: submittedAttempt(),
      practicalVersionId,
      rubricVersionId: `rubric-version:${rubric.id}:v2`,
      dimensionResults: results(),
      qualification: "PENDING_REVIEW",
      provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
    }),
    /EVALUATION_VERSION_MISMATCH/,
  );
});

test("SW-P1A F18 historical attempts retain exact version bindings", () => {
  const historical = attempt();
  assert.equal(historical.practicalVersionId, practicalVersionId);
  assert.equal(historical.rubricVersionId, rubricVersion.id);
  assert.ok(Object.isFrozen(historical));
});

test("SW-P1A F19 first evaluation requires canonical sequence one", () => {
  assert.throws(
    () => createPracticalEvaluation({
      evaluationId: "evaluation-sequence-f19",
      sequence: 2,
      attempt: submittedAttempt(),
      practicalVersionId,
      rubricVersionId: rubricVersion.id,
      dimensionResults: results(),
      qualification: "PENDING_REVIEW",
      provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
    }),
    /INVALID_EVALUATION_HISTORY_LINK/,
  );
});

test("SW-P1A F20 revision links predecessor plus one", () => {
  const submitted = submittedAttempt();
  const first = createPracticalEvaluation({
    evaluationId: "evaluation-f20-1", sequence: 1, attempt: submitted,
    practicalVersionId, rubricVersionId: rubricVersion.id, dimensionResults: results(),
    qualification: "PENDING_REVIEW",
    provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
  });
  const second = createReevaluation(first, {
    evaluationId: "evaluation-f20-2", attempt: transitionPracticalAttempt(submitted, "EVALUATED"),
    practicalVersionId, rubricVersionId: rubricVersion.id, dimensionResults: results(),
    qualification: "QUALIFIED",
    provenance: { method: "HUMAN_REVIEWED", evaluatedAt: "2026-08-19T01:05:00Z", evaluatorReference: "reviewer" },
  });
  assert.equal(second.sequence, 2);
  assert.equal(second.previousEvaluationId, first.evaluationId);
});

test("SW-P1A F21 invalid sequence and predecessor combinations fail closed", () => {
  const record = evaluatedAttempt();
  assert.throws(() => createPracticalEvaluation({
    evaluationId: "evaluation-f21", sequence: 1, previousEvaluationId: "unexpected",
    attempt: record, practicalVersionId, rubricVersionId: rubricVersion.id,
    dimensionResults: results(), qualification: "PENDING_REVIEW",
    provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
  }), /INVALID_EVALUATION_HISTORY_LINK/);
});

test("SW-P1A F22 evaluation revision leaves prior evaluation immutable", () => {
  const submitted = submittedAttempt();
  const first = createPracticalEvaluation({
    evaluationId: "evaluation-f22-1", sequence: 1, attempt: submitted,
    practicalVersionId, rubricVersionId: rubricVersion.id, dimensionResults: results(),
    qualification: "PENDING_REVIEW",
    provenance: { method: "RUBRIC", evaluatedAt: "2026-08-19T01:00:00Z" },
  });
  createReevaluation(first, {
    evaluationId: "evaluation-f22-2", attempt: transitionPracticalAttempt(submitted, "EVALUATED"),
    practicalVersionId, rubricVersionId: rubricVersion.id, dimensionResults: results(),
    qualification: "QUALIFIED",
    provenance: { method: "HUMAN_REVIEWED", evaluatedAt: "2026-08-19T01:05:00Z", evaluatorReference: "reviewer" },
  });
  assert.ok(Object.isFrozen(first));
  assert.equal(first.sequence, 1);
});

test("SW-P1A F23 evaluator result semantic identity hashes deterministically", async () => {
  const first = await digestPracticalJson({ attemptId: "a", evaluatorJobId: "j", evaluatorResultId: "r" });
  const replay = await digestPracticalJson({ evaluatorResultId: "r", evaluatorJobId: "j", attemptId: "a" });
  assert.equal(first.digest, replay.digest);
});

test("SW-P1A F24 attempt creation idempotency payload is order-safe", async () => {
  const first = await digestPracticalJson({ userId: "u", key: "k", practicalVersionId });
  const replay = await digestPracticalJson({ practicalVersionId, key: "k", userId: "u" });
  const mismatch = await digestPracticalJson({ practicalVersionId, key: "k", userId: "other" });
  assert.equal(first.digest, replay.digest);
  assert.notEqual(first.digest, mismatch.digest);
});

test("SW-P1A F25 submission idempotency distinguishes changed snapshots", async () => {
  const first = await digestPracticalJson({ responses: ["a"], artifacts: [] });
  const replay = await digestPracticalJson({ artifacts: [], responses: ["a"] });
  const changed = await digestPracticalJson({ responses: ["b"], artifacts: [] });
  assert.equal(first.digest, replay.digest);
  assert.notEqual(first.digest, changed.digest);
});

test("SW-P1A F26 stale lifecycle transition is a deterministic conflict", () => {
  const submitted = submittedAttempt();
  assert.throws(
    () => transitionPracticalAttempt(submitted, "SUBMITTED", "2026-08-19T02:00:00Z"),
    /INVALID_PRACTICAL_ATTEMPT_TRANSITION/,
  );
});

test("SW-P1A F27 canonical digest normalizes key order and negative zero", async () => {
  const first = await digestPracticalJson({ z: -0, a: 1 });
  const second = await digestPracticalJson({ a: 1, z: 0 });
  assert.equal(first.canonicalJson, '{"a":1,"z":0}');
  assert.equal(first.digest, second.digest);
});

test("SW-P1A F28 Practical audit metadata is allowlisted bounded and finite", () => {
  const metadata = sanitizeAuditMetadata("PRACTICAL_EVALUATION_CREATED", {
    sequence: 1,
    method: "RUBRIC",
    qualification: "PENDING_REVIEW",
    evaluationPayloadDigest: digest,
    responseBody: "secret response",
    extra: "drop",
    confidence: Number.NaN,
  });
  assert.deepEqual(metadata, {
    sequence: 1,
    method: "RUBRIC",
    qualification: "PENDING_REVIEW",
    evaluationPayloadDigest: digest,
  });
});
