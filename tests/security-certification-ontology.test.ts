import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecurityCertificationOntologyConcepts,
  buildSecurityCertificationOntologyEdges,
  buildSecurityCertificationQuestionOntologyEdges,
  getSecurityCertificationOntologyCoverageSummaries,
  getSecurityCertificationOntologyGaps,
  getSecurityCertificationRetrievalConceptAliases,
  officialCurriculumNodeId,
} from "../lib/curriculum/security-certification-ontology.ts";
import {
  flattenOfficialCurriculumTree,
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
} from "../lib/curriculum/security-certification-standards.ts";

test("security certification ontology concepts are derived without duplicating shared terms", () => {
  const concepts = buildSecurityCertificationOntologyConcepts();
  const keys = concepts.map((concept) => concept.key);

  assert.ok(concepts.length > 20);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(concepts.some((concept) => concept.sourceType === "CONTENT"));
  assert.ok(concepts.some((concept) => concept.sourceType === "CURRICULUM_NODE"));
});

test("security certification ontology edges link CourseLesson, Content and Concepts by course scope", () => {
  const edges = buildSecurityCertificationOntologyEdges();
  const courseLessonEdges = edges.filter(
    (edge) => edge.fromType === "CURRICULUM_NODE" && edge.toType === "COURSE_LESSON",
  );
  const contentReuseEdges = edges.filter(
    (edge) => edge.fromType === "COURSE_LESSON" && edge.toType === "CONTENT",
  );
  const conceptEdges = edges.filter(
    (edge) => edge.fromType === "CONTENT" && edge.toType === "CONCEPT",
  );

  assert.equal(courseLessonEdges.length, 139);
  assert.equal(contentReuseEdges.length, 139);
  assert.ok(conceptEdges.length > 20);
  assert.ok(edges.every((edge) => edge.courseId === "course-ise" || edge.courseId === "course-isie"));
  assert.ok(edges.every((edge) => edge.evidence.length > 0));
});

test("ontology CourseLesson edges point only to official curriculum nodes", () => {
  const knownNodeIds = new Set(
    SECURITY_CERTIFICATION_CURRICULUM_TREES.flatMap((tree) =>
      flattenOfficialCurriculumTree(tree).map((node) =>
        officialCurriculumNodeId(node.stableKey),
      ),
    ),
  );
  const nodeEdges = buildSecurityCertificationOntologyEdges().filter(
    (edge) => edge.fromType === "CURRICULUM_NODE",
  );

  assert.ok(nodeEdges.length > 0);
  assert.ok(nodeEdges.every((edge) => knownNodeIds.has(edge.fromId)));
});

test("security certification question ontology edges connect practice items to content and concepts", () => {
  const edges = buildSecurityCertificationQuestionOntologyEdges();
  const questionContentEdges = edges.filter(
    (edge) =>
      edge.fromType === "QUESTION" &&
      edge.toType === "CONTENT" &&
      edge.relation === "DERIVED_FROM",
  );
  const questionConceptEdges = edges.filter(
    (edge) =>
      edge.fromType === "QUESTION" &&
      edge.toType === "CONCEPT" &&
      edge.relation === "TESTS",
  );

  assert.ok(questionContentEdges.length > 100);
  assert.ok(questionConceptEdges.length > questionContentEdges.length);
  assert.ok(edges.every((edge) => edge.courseId === "course-ise" || edge.courseId === "course-isie"));
  assert.ok(edges.every((edge) => edge.evidence.length > 0));
  assert.equal(new Set(edges.map((edge) => edge.key)).size, edges.length);
});

test("shared content is reused while ontology edges keep engineer and industrial courses separate", () => {
  const networkContentEdges = buildSecurityCertificationOntologyEdges().filter(
    (edge) =>
      edge.relation === "REUSES_CONTENT" &&
      edge.toId === "content-official-security-cert-network-security-overview",
  );

  assert.equal(networkContentEdges.length, 2);
  assert.deepEqual(
    networkContentEdges.map((edge) => edge.courseId).sort(),
    ["course-ise", "course-isie"],
  );
  assert.notEqual(networkContentEdges[0].fromId, networkContentEdges[1].fromId);
});

test("ontology coverage summaries expose linked nodes and remaining gaps per course", () => {
  const summaries = getSecurityCertificationOntologyCoverageSummaries();

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((summary) => summary.courseId).sort(),
    ["course-ise", "course-isie"],
  );
  assert.equal(
    summaries.find((summary) => summary.courseId === "course-ise")
      ?.linkedCurriculumNodeCount,
    77,
  );
  assert.equal(
    summaries.find((summary) => summary.courseId === "course-isie")
      ?.linkedCurriculumNodeCount,
    62,
  );
  assert.ok(
    Number(
      summaries.find((summary) => summary.courseId === "course-ise")
        ?.questionContentEdgeCount,
    ) > 0,
  );
  assert.ok(
    Number(
      summaries.find((summary) => summary.courseId === "course-isie")
        ?.questionConceptEdgeCount,
    ) > 0,
  );
  assert.ok(summaries.every((summary) => summary.gapCount > 0));
  assert.ok(summaries.every((summary) => summary.topGapIds.length > 0));
});

test("ontology gap ranking can be requested for a single official tree", () => {
  const gaps = getSecurityCertificationOntologyGaps(
    "curriculum-ise-2027-2029-official",
  );

  assert.ok(gaps.length > 0);
  assert.ok(gaps.every((gap) => gap.courseId === "course-ise"));
  assert.ok(gaps[0].reasons.includes("NO_CURRICULUM_EDGE"));
});

test("security certification ontology exposes course-scoped concept aliases for retrieval", () => {
  const aliases = getSecurityCertificationRetrievalConceptAliases();
  const accessControl = aliases.find(
    (candidate) => candidate.label === "접근통제",
  );

  assert.ok(aliases.length > 20);
  assert.ok(accessControl);
  assert.ok(accessControl.aliases?.includes("Access Control"));
  assert.ok(accessControl.aliases?.includes("RBAC"));
  assert.ok(accessControl.courseIds?.includes("course-ise"));
  assert.ok(accessControl.courseIds?.includes("course-isie"));
});
