import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
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
import { expandRetrievalQueriesWithConceptAliases } from "../lib/ai/retrieval-provider.ts";
import { applicationSecurityQuestionSamples } from "../lib/data/security-certification-application-security-questions.mjs";

const execFileAsync = promisify(execFile);

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

  assert.equal(courseLessonEdges.length, 142);
  assert.equal(contentReuseEdges.length, 142);
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

test("explicit primary placement preserves supporting ontology relations by course", () => {
  const questionId = "pr-c1a-explicit-primary-fixture";
  const supportingContentIds = [
    "content-official-security-cert-application-security-overview",
    "content-official-security-cert-application-web-app-security",
    "content-official-security-cert-application-application-weakness-response",
  ];
  const edges = buildSecurityCertificationQuestionOntologyEdges([
    {
      id: questionId,
      courseLinks: [{ courseId: "course-ise" }, { courseId: "course-isie" }],
      contentLinks: supportingContentIds.map((contentId) => ({
        contentType: "CONTENT",
        contentId,
      })),
      primaryCurriculumPlacements: [
        {
          courseId: "course-ise",
          curriculumTreeId: "curriculum-ise-2027-2029-official",
          curriculumNodeId: "curriculum-node-ise-2027-2029-01-03-02-01",
        },
        {
          courseId: "course-isie",
          curriculumTreeId: "curriculum-isie-2027-2029-official",
          curriculumNodeId: "curriculum-node-isie-2027-2029-01-03-02-01",
        },
      ],
    },
  ]);
  const contentEdges = edges.filter(
    (edge) =>
      edge.fromId === questionId &&
      edge.toType === "CONTENT" &&
      edge.relation === "DERIVED_FROM",
  );

  assert.equal(contentEdges.length, supportingContentIds.length * 2);
  for (const courseId of ["course-ise", "course-isie"]) {
    assert.deepEqual(
      contentEdges
        .filter((edge) => edge.courseId === courseId)
        .map((edge) => edge.toId)
        .sort(),
      [...supportingContentIds].sort(),
    );
  }
  assert.equal(new Set(edges.map((edge) => edge.key)).size, edges.length);
  assert.equal(
    edges.some(
      (edge) =>
        edge.courseId === "course-ise" &&
        edge.fromId.includes("curriculum-node-isie"),
    ),
    false,
  );
});

test("PR-C1B Q4-Q7 metadata leaves supporting ontology edges byte-equivalent", () => {
  const targetQuestionIds = new Set([
    "application-security-official-sample-q01",
    "application-security-official-sample-q02",
    "application-security-official-sample-q03",
    "application-security-official-sample-q06",
  ]);
  const activatedQuestions = applicationSecurityQuestionSamples.filter((question) =>
    targetQuestionIds.has(question.id),
  );
  const legacyProjection = activatedQuestions.map((question) => {
    const projectedQuestion = { ...question };
    delete (projectedQuestion as { primaryCurriculumPlacements?: unknown })
      .primaryCurriculumPlacements;
    return projectedQuestion;
  });
  const activatedEdges = buildSecurityCertificationQuestionOntologyEdges(
    activatedQuestions,
  );
  const legacyEdges = buildSecurityCertificationQuestionOntologyEdges(legacyProjection);

  assert.equal(activatedQuestions.length, 4);
  assert.deepEqual(activatedEdges, legacyEdges);
  assert.equal(new Set(activatedEdges.map((edge) => edge.key)).size, activatedEdges.length);
  assert.ok(
    activatedEdges.every(
      (edge) => edge.toType === "CONTENT" || edge.toType === "CONCEPT",
    ),
  );
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

test("network course isolation preserves course-scoped ontology edge identities", () => {
  const targetNodeIds = new Set([
    "curriculum-node-ise-2027-2029-01-02-03-02",
    "curriculum-node-isie-2027-2029-01-02-03-02",
  ]);
  const edgeKeys = buildSecurityCertificationOntologyEdges()
    .filter(
      (edge) =>
        edge.fromType === "CURRICULUM_NODE" &&
        edge.toType === "COURSE_LESSON" &&
        targetNodeIds.has(edge.fromId),
    )
    .map((edge) => edge.key)
    .sort();

  assert.deepEqual(edgeKeys, [
    "course-ise:CURRICULUM_NODE:curriculum-node-ise-2027-2029-01-02-03-02:COVERS:COURSE_LESSON:course-lesson-ise-official-network-network-security-solutions",
    "course-isie:CURRICULUM_NODE:curriculum-node-isie-2027-2029-01-02-03-02:COVERS:COURSE_LESSON:course-lesson-isie-official-network-network-security-solutions",
  ]);
  assert.equal(
    createHash("sha256").update(JSON.stringify(edgeKeys)).digest("hex"),
    "c400ef520b41cdcb6bfb597e9cd1f486b713230de4f8fb0b94de23aeee207bc7",
  );
});

test("PR1 electronic-commerce concepts remain Engineer-only DRAFT ontology gaps", () => {
  const concepts = buildSecurityCertificationOntologyConcepts();
  const electronicCommerce = concepts.filter((concept) =>
    concept.sourceId?.includes("-01-03-ec"),
  );

  assert.deepEqual(
    electronicCommerce.map((concept) => concept.sourceId),
    [
      "curriculum-node-ise-2027-2029-01-03-ec",
      "curriculum-node-ise-2027-2029-01-03-ec-01",
    ],
  );
  assert.equal(
    concepts.some((concept) => concept.sourceId?.includes("curriculum-node-isie-2027-2029-01-03-ec")),
    false,
  );

  const engineerGaps = getSecurityCertificationOntologyGaps(
    "curriculum-ise-2027-2029-official",
  );
  assert.equal(
    engineerGaps.some((gap) => gap.id === "curriculum-node-ise-2027-2029-01-03-ec"),
    true,
  );
  assert.equal(
    engineerGaps.some(
      (gap) => gap.id === "curriculum-node-ise-2027-2029-01-03-ec-01",
    ),
    true,
  );
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

test("security certification retrieval expansion matches English aliases to official concepts", () => {
  const candidates = getSecurityCertificationRetrievalConceptAliases();
  const expanded = expandRetrievalQueriesWithConceptAliases(
    { query: "RBAC", courseId: "course-ise", limit: 8 },
    candidates,
  );

  assert.ok(expanded.includes("RBAC"));
  assert.ok(expanded.includes("Access Control"));
  assert.ok(expanded.some((query) => query !== "RBAC" && query !== "Access Control"));
});

test("security certification retrieval expansion keeps unrelated course aliases out", () => {
  const candidates = getSecurityCertificationRetrievalConceptAliases();
  const expanded = expandRetrievalQueriesWithConceptAliases(
    { query: "RBAC", courseId: "course-pia", limit: 8 },
    candidates,
  );

  assert.deepEqual(expanded, ["RBAC"]);
});

test("security certification retrieval alias inspector is exposed as a read-only npm script", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(
    packageJson.scripts["curriculum:security-certification:retrieval-aliases"],
    "node scripts/inspect-security-certification-retrieval-aliases.mjs",
  );
});

test("security certification ontology docs describe read-only retrieval alias diagnostics", async () => {
  const docs = await readFile(
    "docs/curriculum/security-certification-ontology-coverage.md",
    "utf8",
  );

  assert.match(docs, /Retrieval alias diagnostics/);
  assert.match(docs, /curriculum:security-certification:retrieval-aliases/);
  assert.match(docs, /read-only/);
  assert.match(docs, /does not run DB migrations, seeds, network calls, or AI calls/);
});

test("security certification retrieval alias inspector reports JSON diagnostics without DB access", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    "scripts/inspect-security-certification-retrieval-aliases.mjs",
    "--query=RBAC",
    "--course-id=course-ise",
    "--format=json",
  ]);
  const diagnostics = JSON.parse(stdout);

  assert.equal(diagnostics.originalQuery, "RBAC");
  assert.equal(diagnostics.courseId, "course-ise");
  assert.ok(diagnostics.expandedQueries.includes("Access Control"));
  assert.ok(diagnostics.matchedConceptLabels.length > 0);
  assert.ok(diagnostics.scopedCandidateCount > 0);
  assert.ok(diagnostics.scopedCandidateCount <= diagnostics.candidateCount);
});
