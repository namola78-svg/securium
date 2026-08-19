import assert from "node:assert/strict";
import test from "node:test";
import {
  createPracticalAttempt,
  createPracticalEvaluation,
  createReevaluation,
  transitionPracticalAttempt,
  type PracticalEvidenceProjectionInput,
} from "../lib/practical/practical-attempt.ts";
import {
  createRubric,
  createRubricVersion,
  validateDimensionEvaluationResult,
  validateRubricDimension,
} from "../lib/practical/practical-rubric.ts";
import { buildPracticalId } from "../lib/practical/practical-definition.ts";

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
  const record = attempt();
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
        attempt: attempt(),
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
  const record = attempt();
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
    attempt: record,
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
    () => createReevaluation(first, { ...second, evaluationId: first.evaluationId, attempt: record }),
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
