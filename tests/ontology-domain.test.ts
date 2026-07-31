import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOntologyCourseScope,
  createCurriculumContentOntologyEdges,
  createOntologyConcept,
  createOntologyConceptKey,
  dedupeOntologyConcepts,
  normalizeOntologyLabel,
  rankOntologyCoverageGaps,
} from "../lib/services/ontology-service.ts";

test("normalizes ontology labels for stable concept matching", () => {
  assert.equal(normalizeOntologyLabel("  Access   Control  "), "access control");
  assert.equal(normalizeOntologyLabel("개인정보 / 접근통제"), "개인정보/접근통제");
  assert.equal(
    createOntologyConceptKey("개인정보 접근통제", "security-certification"),
    "ontology:security-certification:개인정보-접근통제",
  );
});

test("deduplicates concepts by label and aliases without losing metadata", () => {
  const concepts = dedupeOntologyConcepts([
    {
      label: "Access Control",
      category: "security-control",
      aliases: ["접근통제", "Authorization"],
      sourceType: "CURRICULUM_NODE",
      sourceId: "node-access-control",
      weight: 10,
    },
    {
      label: "접근통제",
      aliases: ["Access Control"],
      weight: 20,
    },
    {
      label: "암호 알고리즘",
      category: "cryptography",
    },
  ]);

  assert.equal(concepts.length, 2);
  const accessControl = concepts.find((concept) =>
    concept.aliases.includes("접근통제"),
  );
  assert.ok(accessControl);
  assert.equal(accessControl.weight, 20);
  assert.equal(accessControl.category, "security-control");
  assert.equal(accessControl.sourceId, "node-access-control");
});

test("creates course-scoped CurriculumNode to CourseLesson and Content edges", () => {
  const concept = createOntologyConcept({
    label: "시스템 보안",
    namespace: "security-certification",
  });
  const edges = createCurriculumContentOntologyEdges({
    courseId: "course-ise",
    curriculumNodeId: "ise-subject-system-security",
    courseLessonId: "ise-system-security-overview",
    contentId: "content-system-security-overview",
    conceptIds: [concept.key],
    evidence: ["official-exam-standard-page-1"],
  });

  assert.equal(edges.length, 3);
  assert.deepEqual(
    edges.map((edge) => edge.relation),
    ["COVERS", "REUSES_CONTENT", "EXPLAINS"],
  );
  assert.ok(edges.every((edge) => edge.courseId === "course-ise"));
  assert.ok(edges.every((edge) => edge.evidence.includes("official-exam-standard-page-1")));
});

test("keeps shared content reusable while course scope remains separate", () => {
  const engineerEdges = createCurriculumContentOntologyEdges({
    courseId: "course-ise",
    curriculumNodeId: "ise-subject-network-security",
    courseLessonId: "ise-network-overview",
    contentId: "content-network-security-overview",
  });
  const industrialEdges = createCurriculumContentOntologyEdges({
    courseId: "course-isie",
    curriculumNodeId: "isie-subject-network-security",
    courseLessonId: "isie-network-overview",
    contentId: "content-network-security-overview",
  });

  assert.equal(engineerEdges[1].toId, industrialEdges[1].toId);
  assert.notEqual(engineerEdges[0].fromId, industrialEdges[0].fromId);
  assert.notEqual(engineerEdges[0].courseId, industrialEdges[0].courseId);
});

test("rejects ontology edges that cross the requested course scope", () => {
  const [edge] = createCurriculumContentOntologyEdges({
    courseId: "course-ise",
    curriculumNodeId: "ise-subject-system-security",
    courseLessonId: "ise-system-security-overview",
    contentId: "content-system-security-overview",
  });

  assert.throws(
    () => assertOntologyCourseScope({ expectedCourseId: "course-isie", edge }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ONTOLOGY_COURSE_SCOPE_MISMATCH",
  );
});

test("ranks required deep curriculum nodes with missing ontology edges first", () => {
  const gaps = rankOntologyCoverageGaps({
    curriculumNodes: [
      {
        id: "node-a",
        courseId: "course-ise",
        title: "시스템 보안",
        nodeType: "SUBJECT",
        depth: 1,
        required: true,
      },
      {
        id: "node-b",
        courseId: "course-ise",
        title: "운영체제 식별",
        nodeType: "DETAIL_ITEM",
        depth: 4,
        required: true,
      },
      {
        id: "node-c",
        courseId: "course-ise",
        title: "네트워크 보안",
        nodeType: "SUBJECT",
        depth: 1,
      },
    ],
    edges: [
      {
        courseId: "course-ise",
        fromType: "CURRICULUM_NODE",
        fromId: "node-a",
        toType: "COURSE_LESSON",
        relation: "COVERS",
      },
    ],
  });

  assert.equal(gaps[0].id, "node-b");
  assert.deepEqual(gaps[0].reasons, [
    "NO_CURRICULUM_EDGE",
    "REQUIRED_NODE",
    "DEEP_DETAIL_NODE",
  ]);
  assert.ok(gaps.some((gap) => gap.id === "node-c"));
  assert.ok(!gaps.some((gap) => gap.id === "node-a"));
});
