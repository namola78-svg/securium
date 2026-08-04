import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertOntologyCourseScope,
  buildOntologyGraph,
  createCrossCourseConceptMapping,
  createCurriculumContentOntologyEdges,
  createOntologyConcept,
  createOntologyConceptKey,
  createOntologyConceptRelationshipEdges,
  dedupeOntologyConcepts,
  expandOntologyRetrievalQueries,
  findOntologyConceptMatches,
  normalizeOntologyLabel,
  rankOntologyCoverageGaps,
  validateOntologyReviewTransition,
} from "../lib/services/ontology-service.ts";
import {
  ontologyReviewStatusSchema,
  parseInput,
} from "../lib/validation.ts";

test("normalizes ontology labels for stable concept matching", () => {
  assert.equal(normalizeOntologyLabel("  Access   Control  "), "access control");
  assert.equal(normalizeOntologyLabel("SQL Injection / Access Control"), "sql injection/access control");
  assert.equal(
    createOntologyConceptKey("SQL Injection Access Control", "security-certification"),
    "ontology:security-certification:sql-injection-access-control",
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

test("builds an ontology graph with aliases, hierarchy and related concepts", () => {
  const parent = createOntologyConcept({
    label: "Access Control",
    aliases: ["접근통제", "Authorization"],
    weight: 20,
  });
  const child = createOntologyConcept({
    label: "RBAC",
    aliases: ["Role Based Access Control"],
    weight: 15,
  });
  const related = createOntologyConcept({
    label: "Least Privilege",
    aliases: ["최소권한"],
    weight: 10,
  });
  const graph = buildOntologyGraph({
    concepts: [parent, child, related],
    edges: [
      ...createOntologyConceptRelationshipEdges({
        parentConceptKey: parent.key,
        childConceptKey: child.key,
        relatedConceptKeys: [[child.key, related.key]],
        synonymConceptKeys: [[parent.key, related.key]],
        courseId: "course-ise",
        evidence: ["ontology-test"],
      }),
    ],
  });

  const matches = findOntologyConceptMatches({
    query: "Role Based Access Control",
    graph,
    courseId: "course-ise",
  });
  const expansion = expandOntologyRetrievalQueries({
    query: "Role Based Access Control",
    graph,
    courseId: "course-ise",
    limit: 12,
  });

  assert.equal(matches[0]?.concept.key, child.key);
  assert.ok(expansion.expandedQueries.includes("RBAC"));
  assert.ok(expansion.expandedQueries.includes("Access Control"));
  assert.ok(expansion.expandedQueries.includes("Least Privilege"));
  assert.ok(expansion.relatedConceptKeys.includes(parent.key));
  assert.ok(expansion.relatedConceptKeys.includes(related.key));
});

test("ontology retrieval expansion keeps course scoped mappings isolated", () => {
  const engineerConcept = createOntologyConcept({
    label: "Incident Response",
    namespace: "security-certification",
    aliases: ["IR"],
  });
  const privacyConcept = createOntologyConcept({
    label: "Privacy Incident Response",
    namespace: "privacy",
    aliases: ["PIA Incident"],
  });
  const graph = buildOntologyGraph({
    concepts: [engineerConcept, privacyConcept],
    edges: createCrossCourseConceptMapping({
      sourceCourseId: "course-ise",
      targetCourseId: "course-pia",
      sourceConceptKey: engineerConcept.key,
      targetConceptKey: privacyConcept.key,
      evidence: ["cross-course-map"],
    }),
  });

  const engineerExpansion = expandOntologyRetrievalQueries({
    query: "IR",
    graph,
    courseId: "course-ise",
  });
  const unrelatedExpansion = expandOntologyRetrievalQueries({
    query: "IR",
    graph,
    courseId: "course-cppg",
  });

  assert.ok(engineerExpansion.expandedQueries.includes("Incident Response"));
  assert.ok(engineerExpansion.expandedQueries.includes("Privacy Incident Response"));
  assert.deepEqual(unrelatedExpansion.expandedQueries, ["IR"]);
});

test("ontology graph storage migrations and repository contract are additive", async () => {
  const [d1Sql, postgresSql, repositorySource] = await Promise.all([
    readFile(
      new URL("../drizzle/0019_ontology_graph_storage.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../db/postgres/migrations/0008_ontology_graph_storage.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../db/ontology-repositories.ts", import.meta.url), "utf8"),
  ]);

  for (const tableName of [
    "ontology_concepts",
    "ontology_aliases",
    "ontology_edges",
  ]) {
    assert.match(d1Sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${tableName}"`));
    assert.match(
      postgresSql,
      new RegExp(`CREATE TABLE IF NOT EXISTS "${tableName}"`),
    );
    assert.match(
      postgresSql,
      new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\."${tableName}"`),
    );
    assert.match(
      postgresSql,
      new RegExp(`ALTER TABLE public\\."${tableName}" ENABLE ROW LEVEL SECURITY`),
    );
  }

  assert.match(postgresSql, /INSERT INTO app_schema_migrations \(id, checksum\)/);
  assert.match(repositorySource, /upsertOntologyConcept/);
  assert.match(repositorySource, /upsertOntologyEdge/);
  assert.match(repositorySource, /listOntologyAdminConceptRows/);
  assert.match(repositorySource, /listOntologyAdminEdgeRows/);
  assert.match(repositorySource, /getOntologyReviewTarget/);
  assert.match(repositorySource, /updateOntologyReviewStatus/);
  assert.match(repositorySource, /buildDatabaseOntologyGraph/);
  assert.doesNotMatch(d1Sql, /\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
  assert.doesNotMatch(postgresSql, /\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
});

test("ontology review transitions require roles, evidence and audit actions", () => {
  assert.deepEqual(
    validateOntologyReviewTransition({
      currentStatus: "DRAFT",
      nextStatus: "ACTIVE",
      actorRoles: ["CONTENT_REVIEWER"],
      evidence: ["official-curriculum-page-2"],
    }),
    {
      from: "DRAFT",
      to: "ACTIVE",
      requiresAuditLog: true,
      auditAction: "ONTOLOGY_ACTIVATED",
    },
  );

  assert.throws(
    () =>
      validateOntologyReviewTransition({
        currentStatus: "DRAFT",
        nextStatus: "ACTIVE",
        actorRoles: ["CONTENT_EDITOR"],
        evidence: ["official-curriculum-page-2"],
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ONTOLOGY_REVIEW_FORBIDDEN",
  );

  assert.throws(
    () =>
      validateOntologyReviewTransition({
        currentStatus: "DRAFT",
        nextStatus: "ACTIVE",
        actorRoles: ["CONTENT_REVIEWER"],
        evidence: [],
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ONTOLOGY_REVIEW_EVIDENCE_REQUIRED",
  );

  assert.deepEqual(
    validateOntologyReviewTransition({
      currentStatus: "ACTIVE",
      nextStatus: "ARCHIVED",
      actorRoles: ["COURSE_MANAGER"],
      changeSummary: "Superseded by updated official curriculum mapping.",
    }),
    {
      from: "ACTIVE",
      to: "ARCHIVED",
      requiresAuditLog: true,
      auditAction: "ONTOLOGY_ARCHIVED",
    },
  );

  assert.throws(
    () =>
      validateOntologyReviewTransition({
        currentStatus: "ACTIVE",
        nextStatus: "ACTIVE",
        actorRoles: ["ADMIN"],
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "ONTOLOGY_STATUS_UNCHANGED",
  );
});

test("ontology review status input preserves safe filters and rejects external return paths", () => {
  const parsed = parseInput(ontologyReviewStatusSchema, {
    targetType: "CONCEPT",
    targetId: "concept-1",
    nextStatus: "ACTIVE",
    evidence: "official-page-1, review-ticket-7",
    returnTo: "/admin/ontology?namespace=security-certification&conceptStatus=DRAFT",
  });

  assert.deepEqual(parsed.evidence, ["official-page-1", "review-ticket-7"]);
  assert.equal(
    parsed.returnTo,
    "/admin/ontology?namespace=security-certification&conceptStatus=DRAFT",
  );

  for (const returnTo of [
    "//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
  ]) {
    assert.throws(
      () =>
        parseInput(ontologyReviewStatusSchema, {
          targetType: "EDGE",
          targetId: "edge-1",
          nextStatus: "DRAFT",
          returnTo,
        }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "VALIDATION_ERROR",
    );
  }
});

test("admin ontology console is protected and uses review-status workflow", async () => {
  const [
    adminHomeSource,
    adminOntologySource,
    reviewRouteSource,
    auditSource,
    validationSource,
  ] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/ontology/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/admin/ontology/review-status/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/services/audit-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/validation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(adminHomeSource, /href="\/admin\/ontology"/);
  assert.match(adminHomeSource, /Ontology 관리|Ontology Admin/);
  assert.match(adminOntologySource, /requireCatalogManager\("\/admin\/ontology"\)/);
  assert.match(adminOntologySource, /listOntologyAdminConceptRows/);
  assert.match(adminOntologySource, /listOntologyAdminEdgeRows/);
  assert.match(adminOntologySource, /buildAdminOntologyReturnTo/);
  assert.match(adminOntologySource, /returnTo=\{returnTo\}/);
  assert.match(adminOntologySource, /concept\.status/);
  assert.match(adminOntologySource, /edge\.status/);
  assert.match(adminOntologySource, /formatDateTime/);
  assert.match(adminOntologySource, /OntologyStatusForm/);
  assert.match(adminOntologySource, /\/api\/admin\/ontology\/review-status/);
  assert.match(adminOntologySource, /name="evidence"/);
  assert.match(adminOntologySource, /name="changeSummary"/);
  assert.match(adminOntologySource, /ONTOLOGY_STORAGE_UNAVAILABLE/);
  assert.doesNotMatch(adminOntologySource, /upsertOntologyConcept/);
  assert.doesNotMatch(adminOntologySource, /upsertOntologyEdge/);
  assert.match(adminOntologySource, /method="post"/i);
  assert.match(reviewRouteSource, /requireOntologyAdministrator/);
  assert.match(reviewRouteSource, /assertSameOrigin/);
  assert.match(reviewRouteSource, /validateOntologyReviewTransition/);
  assert.match(reviewRouteSource, /updateOntologyReviewStatus/);
  assert.match(reviewRouteSource, /recordAudit/);
  assert.match(reviewRouteSource, /evidence:\s*input\.evidence/);
  assert.match(reviewRouteSource, /evidenceCount:\s*input\.evidence\.length/);
  assert.match(auditSource, /ONTOLOGY_ACTIVATED/);
  assert.match(auditSource, /evidenceCount/);
  assert.match(validationSource, /safeInternalPath/);
  assert.match(validationSource, /isSafeInternalPath/);
});
