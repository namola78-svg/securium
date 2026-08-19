import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniquePrimaryPracticalContributions,
  buildPracticalId,
  buildPrimaryPracticalContributionKey,
  classifyPracticalChange,
  createPractical,
  createPracticalPlacement,
  createPracticalVersion,
  normalizePracticalObjectiveBindings,
  validateAssessmentArtifact,
  validateLearnerResponses,
} from "../lib/practical/practical-definition.ts";
import { buildAssessmentObjectiveId } from "../lib/assessment/assessment-objective.ts";

const digest = { algorithm: "SHA-256" as const, value: "a".repeat(64) };
const primaryObjectiveId = buildAssessmentObjectiveId(
  "secure-development",
  "diagnose-injection",
);
const supportingObjectiveId = buildAssessmentObjectiveId(
  "secure-development",
  "explain-injection",
);

function objectiveBindings() {
  return [
    { objectiveId: supportingObjectiveId, role: "SUPPORTING", order: 1 },
    { objectiveId: primaryObjectiveId, role: "PRIMARY", order: 0 },
  ];
}

test("Practical stable identity is deterministic and distinct from Question", () => {
  const id = buildPracticalId("secure-development", "diagnose-sql-injection");
  assert.equal(id, "practical:secure-development:diagnose-sql-injection");
  assert.notEqual(id, "question-sw-sql-injection");
});

test("Practical classification is CRE-compatible metadata", () => {
  const practical = createPractical({
    namespace: "secure-development",
    intentKey: "diagnose-sql-injection",
    classification: "DEV_SAMPLE",
    lifecycle: "DRAFT",
  });
  assert.equal(practical.classification, "DEV_SAMPLE");
  assert.throws(
    () =>
      createPractical({
        namespace: "secure-development",
        intentKey: "invalid",
        classification: "PUBLISHED",
        lifecycle: "ACTIVE",
      }),
    /INVALID_PRACTICAL_CLASSIFICATION/,
  );
});

test("PracticalVersion changes independently from stable Practical", () => {
  const practicalId = buildPracticalId(
    "secure-development",
    "diagnose-sql-injection",
  );
  const base = {
    practicalId,
    objectiveBindings: objectiveBindings(),
    responseSpec: [{ key: "diagnosis", type: "FREE_TEXT", required: true }],
    rubricVersionId: "rubric-version:rubric:secure-development:diagnosis:v1",
    payloadDigest: digest,
  };
  const v1 = createPracticalVersion({ ...base, version: 1, scenario: "v1" });
  const v2 = createPracticalVersion({
    ...base,
    version: 2,
    scenario: "typo corrected",
    payloadDigest: { ...digest, value: "b".repeat(64) },
  });
  assert.equal(v1.practicalId, v2.practicalId);
  assert.notEqual(v1.id, v2.id);
});

test("version-versus-identity rule is explicit", () => {
  assert.equal(classifyPracticalChange("RELEASED_TYPO_OR_FORMATTING"), "NEW_VERSION");
  assert.equal(classifyPracticalChange("RUBRIC_LINKAGE"), "NEW_VERSION");
  assert.equal(classifyPracticalChange("CAPABILITY"), "NEW_IDENTITY");
  assert.equal(classifyPracticalChange("ASSESSMENT_PURPOSE"), "NEW_IDENTITY");
});

test("exactly one primary Objective and deterministic supporting order are enforced", () => {
  const normalized = normalizePracticalObjectiveBindings(objectiveBindings());
  assert.equal(normalized[0].role, "PRIMARY");
  assert.deepEqual(normalized.map((item) => item.order), [0, 1]);
  assert.throws(
    () =>
      normalizePracticalObjectiveBindings([
        ...objectiveBindings(),
        { objectiveId: supportingObjectiveId, role: "PRIMARY", order: 0 },
      ]),
    /EXACTLY_ONE_PRIMARY_OBJECTIVE_REQUIRED|DUPLICATE_OBJECTIVE_BINDING/,
  );
  assert.throws(
    () =>
      normalizePracticalObjectiveBindings([
        { objectiveId: primaryObjectiveId, role: "PRIMARY", order: 0 },
        { objectiveId: primaryObjectiveId, role: "SUPPORTING", order: 1 },
      ]),
    /DUPLICATE_OBJECTIVE_BINDING/,
  );
});

test("PracticalPlacement produces one deterministic primary contribution", () => {
  const placement = createPracticalPlacement({
    courseId: "course-sw-vuln",
    curriculumTreeVersionId: "tree-sw-v1",
    objectivePlacementId: "objective-placement-sw-injection",
    practicalId: buildPracticalId(
      "secure-development",
      "diagnose-sql-injection",
    ),
    contributionRole: "PRIMARY",
    order: 1,
  });
  assert.equal(
    buildPrimaryPracticalContributionKey(placement),
    'practical-contribution:["course-sw-vuln","tree-sw-v1","objective-placement-sw-injection","practical:secure-development:diagnose-sql-injection","PRIMARY"]',
  );
});

test("duplicate primary contributions are rejected and supporting mappings contribute zero", () => {
  const common = {
    courseId: "course-sw-vuln",
    curriculumTreeVersionId: "tree-sw-v1",
    objectivePlacementId: "objective-placement-sw-injection",
    practicalId: buildPracticalId(
      "secure-development",
      "diagnose-sql-injection",
    ),
    order: 1,
  };
  const primary = createPracticalPlacement({ ...common, contributionRole: "PRIMARY" });
  const supporting = createPracticalPlacement({
    ...common,
    objectivePlacementId: "objective-placement-sw-supporting",
    contributionRole: "SUPPORTING",
  });
  assert.doesNotThrow(() =>
    assertUniquePrimaryPracticalContributions([primary, supporting]),
  );
  assert.throws(
    () => assertUniquePrimaryPracticalContributions([primary, primary]),
    /DUPLICATE_PRIMARY_PRACTICAL_CONTRIBUTION/,
  );
});

test("PracticalPlacement tuple encoding separates colon and pipe partitions", () => {
  const practicalId = buildPracticalId("identity", "placement-collision");
  const place = (courseId: string, curriculumTreeVersionId: string) =>
    createPracticalPlacement({
      courseId,
      curriculumTreeVersionId,
      objectivePlacementId: "objective:placement|one",
      practicalId,
      contributionRole: "PRIMARY",
      order: 0,
    });

  assert.notEqual(place("course:a", "tree").id, place("course", "a:tree").id);
  assert.notEqual(place("course|a", "tree").id, place("course", "a|tree").id);
});

test("primary contribution encoding eliminates false duplicates and preserves true duplicates", () => {
  const practicalId = buildPracticalId("identity", "contribution-collision");
  const common = {
    objectivePlacementId: "objective:placement|one",
    practicalId,
    contributionRole: "PRIMARY" as const,
    order: 0,
  };
  const left = createPracticalPlacement({
    ...common,
    courseId: "a|b",
    curriculumTreeVersionId: "c",
  });
  const right = createPracticalPlacement({
    ...common,
    courseId: "a",
    curriculumTreeVersionId: "b|c",
  });
  const duplicate = createPracticalPlacement({
    ...common,
    courseId: "a|b",
    curriculumTreeVersionId: "c",
  });

  assert.notEqual(
    buildPrimaryPracticalContributionKey(left),
    buildPrimaryPracticalContributionKey(right),
  );
  assert.doesNotThrow(() =>
    assertUniquePrimaryPracticalContributions([left, right]),
  );
  assert.equal(
    buildPrimaryPracticalContributionKey(left),
    buildPrimaryPracticalContributionKey(duplicate),
  );
  assert.throws(
    () => assertUniquePrimaryPracticalContributions([left, duplicate]),
    /DUPLICATE_PRIMARY_PRACTICAL_CONTRIBUTION/,
  );
});

test("Practical composite identities support multi-delimiter Unicode deterministically without mutation", () => {
  const practicalId = buildPracticalId("identity", "unicode-placement");
  const input = {
    courseId: '과정:alpha|beta%["x"]/path\\segment',
    curriculumTreeVersionId: "트리 version:1|2",
    objectivePlacementId: '목표:["a|b:c"]',
    practicalId,
    contributionRole: "PRIMARY" as const,
    order: 0,
  };
  const snapshot = { ...input };
  const first = createPracticalPlacement(input);
  const second = createPracticalPlacement({ ...input });

  assert.deepEqual(input, snapshot);
  assert.equal(first.id, second.id);
  assert.equal(
    buildPrimaryPracticalContributionKey(first),
    buildPrimaryPracticalContributionKey(second),
  );
});

test("all frozen static AssessmentArtifact types validate", () => {
  const textTypes = ["TEXT_SCENARIO", "CONFIG", "LOG", "API_CONTRACT"] as const;
  for (const type of textTypes) {
    assert.equal(
      validateAssessmentArtifact({
        id: `artifact-${type.toLowerCase()}`,
        roleKey: type.toLowerCase().replace("_", "-"),
        type,
        digest,
        content: "inert assessment data",
      }).type,
      type,
    );
  }
  assert.equal(
    validateAssessmentArtifact({
      id: "artifact-table",
      roleKey: "input-table",
      type: "TABLE",
      digest,
      columns: ["key"],
      rows: [["value"]],
    }).type,
    "TABLE",
  );
  assert.equal(
    validateAssessmentArtifact({
      id: "artifact-flow",
      roleKey: "data-flow",
      type: "DATA_FLOW",
      digest,
      nodes: [
        { id: "source", label: "Source" },
        { id: "sink", label: "Sink" },
      ],
      edges: [{ from: "source", to: "sink" }],
    }).type,
    "DATA_FLOW",
  );
});

test("CODE AssessmentArtifact is inert data with path-independent logical identity", () => {
  const executed = false;
  const artifact = validateAssessmentArtifact({
    id: "assessment-artifact:practical-secure-development:input-code",
    roleKey: "input-code",
    type: "CODE",
    digest,
    languageId: "javascript",
    files: [
      {
        logicalKey: "main",
        displayName: "../../temporary/input.js",
        content: "executed = true; require('child_process').exec('bad')",
        lineAnchors: [{ key: "suspect", start: 1, end: 1 }],
      },
    ],
  });
  assert.equal(artifact.type, "CODE");
  assert.equal(artifact.executionCapability, "STATIC_ONLY");
  assert.equal(executed, false);
  assert.equal(artifact.files[0].logicalKey, "main");
});

test("typed learner responses enforce required keys and classification schemes", () => {
  const specs = [
    {
      key: "judgment",
      type: "CLASSIFICATION" as const,
      required: true,
      classificationSchemeId: "sw-diagnosis-v1",
    },
    { key: "reasoning", type: "FREE_TEXT" as const, required: true },
    { key: "repair", type: "CODE" as const, required: false },
  ];
  const result = validateLearnerResponses(specs, [
    {
      key: "judgment",
      type: "CLASSIFICATION",
      schemeId: "sw-diagnosis-v1",
      value: "profile-owned-value",
    },
    { key: "reasoning", type: "FREE_TEXT", value: "because" },
  ]);
  assert.deepEqual(result.map((item) => item.type), [
    "CLASSIFICATION",
    "FREE_TEXT",
  ]);
  assert.throws(
    () => validateLearnerResponses(specs, []),
    /REQUIRED_RESPONSE_COMPONENT_MISSING/,
  );
  assert.throws(
    () =>
      validateLearnerResponses(specs, [
        {
          key: "judgment",
          type: "CLASSIFICATION",
          schemeId: "wrong-scheme",
          value: "x",
        },
      ]),
    /CLASSIFICATION_SCHEME_MISMATCH/,
  );
});

test("Practical is neither Lab nor CTF and SW diagnosis values are not core enums", () => {
  const practical = createPractical({
    namespace: "secure-development",
    intentKey: "static-diagnosis",
    classification: "DRAFT",
    lifecycle: "DRAFT",
  });
  assert.match(practical.id, /^practical:/);
  assert.equal(Object.hasOwn(practical, "environment"), false);
  assert.equal(Object.hasOwn(practical, "flag"), false);
  assert.equal(Object.hasOwn(practical, "TRUE_POSITIVE"), false);
});
