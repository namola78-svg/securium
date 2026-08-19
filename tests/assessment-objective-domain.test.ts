import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueObjectivePlacements,
  buildAssessmentObjectiveId,
  createAssessmentObjective,
  createAssessmentObjectivePlacement,
} from "../lib/assessment/assessment-objective.ts";

test("AssessmentObjective identity is deterministic and semantic", () => {
  assert.equal(
    buildAssessmentObjectiveId("secure-development", "identify-sql-injection"),
    "assessment-objective:secure-development:identify-sql-injection",
  );
  assert.equal(
    buildAssessmentObjectiveId("secure-development", "identify-sql-injection"),
    buildAssessmentObjectiveId("secure-development", "identify-sql-injection"),
  );
});

test("AssessmentObjective remains distinct from Concept identity", () => {
  const objective = createAssessmentObjective({
    namespace: "secure-development",
    capabilityActionKey: "explain-access-control",
    lifecycle: "DRAFT",
  });
  assert.match(objective.id, /^assessment-objective:/);
  assert.notEqual(objective.id, "concept:access-control");
});

test("AssessmentObjective remains distinct from Question identity", () => {
  const objective = createAssessmentObjective({
    namespace: "privacy",
    capabilityActionKey: "classify-processing-risk",
    lifecycle: "APPROVED",
  });
  assert.notEqual(objective.id, "question-privacy-risk-01");
  assert.equal(objective.lifecycle, "APPROVED");
});

test("Objective placement binds course, tree version, node, Concepts and criteria", () => {
  const objectiveId = buildAssessmentObjectiveId("risk", "recommend-treatment");
  const placement = createAssessmentObjectivePlacement({
    objectiveId,
    courseId: "course-isrm",
    curriculumTreeId: "tree-isrm",
    curriculumTreeVersionId: "tree-isrm-v1",
    curriculumNodeId: "node-risk-treatment",
    conceptIds: ["concept-risk-treatment", "concept-residual-risk"],
    criterionReferences: ["criterion:risk-treatment"],
  });
  assert.equal(placement.objectiveId, objectiveId);
  assert.deepEqual(placement.conceptIds, [
    "concept-residual-risk",
    "concept-risk-treatment",
  ]);
});

test("one Objective can be reused through distinct course placements", () => {
  const objectiveId = buildAssessmentObjectiveId(
    "security-controls",
    "explain-access-control",
  );
  const placements = ["course-isms-p", "course-sw-vuln"].map((courseId) =>
    createAssessmentObjectivePlacement({
      objectiveId,
      courseId,
      curriculumTreeId: `tree-${courseId}`,
      curriculumTreeVersionId: `tree-${courseId}-v1`,
      curriculumNodeId: `node-${courseId}-access-control`,
    }),
  );
  assert.doesNotThrow(() => assertUniqueObjectivePlacements(placements));
  assert.equal(new Set(placements.map((item) => item.objectiveId)).size, 1);
});

test("one CurriculumNode can place multiple distinct Objectives", () => {
  const shared = {
    courseId: "course-sw-vuln",
    curriculumTreeId: "tree-sw",
    curriculumTreeVersionId: "tree-sw-v1",
    curriculumNodeId: "node-injection",
  };
  const placements = ["identify-injection", "remediate-injection"].map(
    (capabilityActionKey) =>
      createAssessmentObjectivePlacement({
        ...shared,
        objectiveId: buildAssessmentObjectiveId(
          "secure-development",
          capabilityActionKey,
        ),
      }),
  );
  assert.doesNotThrow(() => assertUniqueObjectivePlacements(placements));
  assert.equal(new Set(placements.map((item) => item.objectiveId)).size, 2);
});

test("duplicate Objective placements are rejected", () => {
  const placement = createAssessmentObjectivePlacement({
    objectiveId: buildAssessmentObjectiveId("privacy", "identify-pia-target"),
    courseId: "course-pia",
    curriculumTreeId: "tree-pia",
    curriculumTreeVersionId: "tree-pia-v1",
    curriculumNodeId: "node-pia-target",
  });
  assert.throws(
    () => assertUniqueObjectivePlacements([placement, placement]),
    /DUPLICATE_OBJECTIVE_PLACEMENT/,
  );
});

test("ObjectivePlacement tuple encoding separates colon and pipe partitions deterministically", () => {
  const objectiveId = buildAssessmentObjectiveId("identity", "prove-placement");
  const place = (courseId: string, curriculumTreeVersionId: string) =>
    createAssessmentObjectivePlacement({
      objectiveId,
      courseId,
      curriculumTreeId: "tree",
      curriculumTreeVersionId,
      curriculumNodeId: "node",
    });
  const colonLeft = place("course:a", "tree");
  const colonRight = place("course", "a:tree");
  const pipeLeft = place("course|a", "tree");
  const pipeRight = place("course", "a|tree");

  assert.notEqual(colonLeft.id, colonRight.id);
  assert.notEqual(pipeLeft.id, pipeRight.id);
  assert.equal(colonLeft.id, place("course:a", "tree").id);
  assert.doesNotThrow(() =>
    assertUniqueObjectivePlacements([
      colonLeft,
      colonRight,
      pipeLeft,
      pipeRight,
    ]),
  );
});

test("ObjectivePlacement tuple encoding preserves punctuation and Unicode without input mutation", () => {
  const objectiveId = buildAssessmentObjectiveId("identity", "encode-references");
  const values = [
    "course:colon",
    "course|pipe",
    "course%percent",
    "course/slash",
    "course\\backslash",
    "course internal space",
    "과정-식별자",
    'course["json",punctuation]',
  ];
  const snapshot = [...values];
  const ids = values.map(
    (courseId) =>
      createAssessmentObjectivePlacement({
        objectiveId,
        courseId,
        curriculumTreeId: "tree/공통",
        curriculumTreeVersionId: "tree\\version|v1",
        curriculumNodeId: "node:공통",
      }).id,
  );

  assert.deepEqual(values, snapshot);
  assert.equal(new Set(ids).size, values.length);
});

test("semantic keys reject display text and source paths", () => {
  assert.throws(
    () => buildAssessmentObjectiveId("Secure Development", "display order 1"),
    /INVALID_NAMESPACE/,
  );
  assert.throws(
    () => buildAssessmentObjectiveId("secure-development", "docs/page/12"),
    /INVALID_CAPABILITY_ACTION_KEY/,
  );
});
