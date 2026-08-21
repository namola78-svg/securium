import { AppError } from "../errors.ts";
import { conceptMappingQualificationSchema } from "../validation.ts";

export type OntologyEntityType =
  | "CONCEPT"
  | "CURRICULUM_NODE"
  | "CONTENT"
  | "COURSE_LESSON"
  | "QUESTION"
  | "STANDARD"
  | "LAW"
  | "CASE_STUDY"
  | "WEAKNESS"
  | "RISK_SCENARIO"
  | "PRIVACY_ASSESSMENT_ITEM";

export type OntologyRelationType =
  | "COVERS"
  | "EXPLAINS"
  | "TESTS"
  | "REUSES_CONTENT"
  | "ASSESSED_BY"
  | "PREREQUISITE_OF"
  | "RELATED_TO"
  | "DERIVED_FROM"
  | "PARENT_OF"
  | "CHILD_OF"
  | "SYNONYM_OF"
  | "CROSS_COURSE_EQUIVALENT";

export type OntologyConceptInput = {
  label: string;
  namespace?: string;
  category?: string;
  aliases?: string[];
  sourceType?: OntologyEntityType;
  sourceId?: string;
  weight?: number;
};

export type OntologyConcept = {
  key: string;
  label: string;
  normalizedLabel: string;
  namespace: string;
  category: string;
  aliases: string[];
  sourceType?: OntologyEntityType;
  sourceId?: string;
  weight: number;
};

export type OntologyEdgeInput = {
  courseId?: string;
  fromType: OntologyEntityType;
  fromId: string;
  toType: OntologyEntityType;
  toId: string;
  relation: OntologyRelationType;
  confidence?: number;
  evidence?: string[];
};

export type OntologyEdge = {
  key: string;
  courseId?: string;
  fromType: OntologyEntityType;
  fromId: string;
  toType: OntologyEntityType;
  toId: string;
  relation: OntologyRelationType;
  confidence: number;
  evidence: string[];
};

export type CurriculumContentBridgeInput = {
  courseId: string;
  curriculumNodeId: string;
  courseLessonId: string;
  contentId: string;
  conceptIds?: string[];
  evidence?: string[];
};

export type OntologyCoverageNode = {
  id: string;
  courseId: string;
  title: string;
  nodeType: string;
  depth?: number;
  required?: boolean;
};

export type OntologyCoverageGap = OntologyCoverageNode & {
  score: number;
  reasons: string[];
};

export type OntologyGraph = {
  concepts: OntologyConcept[];
  edges: OntologyEdge[];
  conceptsByKey: Map<string, OntologyConcept>;
  aliasesByLookup: Map<string, string[]>;
  outgoingEdgesByConcept: Map<string, OntologyEdge[]>;
  incomingEdgesByConcept: Map<string, OntologyEdge[]>;
  courseIdsByConceptKey: Map<string, Set<string>>;
};

export type OntologyConceptMatch = {
  concept: OntologyConcept;
  matchedBy: "label" | "alias";
  matchedValue: string;
  courseScoped: boolean;
};

export type OntologyRetrievalExpansion = {
  originalQuery: string;
  expandedQueries: string[];
  matchedConceptKeys: string[];
  matchedConceptLabels: string[];
  relatedConceptKeys: string[];
  courseId?: string;
};

export type OntologyReviewStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type OntologyReviewRole =
  | "CONTENT_EDITOR"
  | "CONTENT_REVIEWER"
  | "COURSE_MANAGER"
  | "ADMIN"
  | "SUPER_ADMIN";

export type OntologyReviewTransitionInput = {
  currentStatus: OntologyReviewStatus;
  nextStatus: OntologyReviewStatus;
  actorRoles: OntologyReviewRole[];
  evidence?: string[];
  changeSummary?: string;
};

export type OntologyReviewTransition = {
  from: OntologyReviewStatus;
  to: OntologyReviewStatus;
  requiresAuditLog: true;
  auditAction: "ONTOLOGY_DRAFTED" | "ONTOLOGY_ACTIVATED" | "ONTOLOGY_ARCHIVED";
};

export type ConceptMappingOrigin =
  | "HUMAN_AUTHORED"
  | "RULE_BASED"
  | "AI_SUGGESTED"
  | "CANONICAL_PACKAGE"
  | "IMPORT";

export type ConceptMappingStatus =
  | "LEGACY_UNVERIFIED"
  | "SUGGESTED"
  | "APPROVED"
  | "REJECTED"
  | "SUPERSEDED";

export function assertConceptMappingQualificationPreserved(input: {
  factScope: string;
  qualificationJson: string | null;
  mappingStatus: ConceptMappingStatus;
}) {
  if (!input.qualificationJson) {
    if (input.mappingStatus === "APPROVED" && input.factScope !== "global") {
      throw new AppError(
        "A scoped Fact cannot be mapped without a matching qualification.",
        409,
        "QUALIFICATION_LOSS_BLOCKED",
      );
    }
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.qualificationJson);
  } catch {
    throw new AppError("Mapping qualification must be valid JSON.", 400, "QUALIFICATION_INVALID");
  }
  const result = conceptMappingQualificationSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("Mapping qualification has an unsupported shape.", 400, "QUALIFICATION_INVALID");
  }
  if (input.factScope === "global") return;
  const scopes = Array.isArray(result.data.scope)
    ? result.data.scope
    : result.data.scope
      ? [result.data.scope]
      : [];
  if (!scopes.includes(input.factScope)) {
    throw new AppError(
      "Mapping qualification would broaden the Fact scope.",
      409,
      "QUALIFICATION_LOSS_BLOCKED",
    );
  }
}

const DEFAULT_NAMESPACE = "securium";

export function normalizeOntologyLabel(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/[(){}\[\],.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createOntologyConceptKey(
  label: string,
  namespace = DEFAULT_NAMESPACE,
) {
  const normalizedNamespace = normalizeOntologyLabel(namespace).replace(
    /[^a-z0-9가-힣]+/g,
    "-",
  );
  const normalizedLabel = normalizeOntologyLabel(label)
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedLabel) {
    throw new AppError("Ontology concept label is required.", 400, "ONTOLOGY_LABEL_REQUIRED");
  }

  return `ontology:${normalizedNamespace || DEFAULT_NAMESPACE}:${normalizedLabel}`;
}

export function createOntologyConcept(
  input: OntologyConceptInput,
): OntologyConcept {
  const normalizedLabel = normalizeOntologyLabel(input.label);
  if (!normalizedLabel) {
    throw new AppError("Ontology concept label is required.", 400, "ONTOLOGY_LABEL_REQUIRED");
  }

  const aliases = uniqueStrings(
    (input.aliases ?? [])
      .map((alias) => alias.trim())
      .filter((alias) => alias.length > 0),
  );

  return {
    key: createOntologyConceptKey(input.label, input.namespace),
    label: input.label.trim(),
    normalizedLabel,
    namespace: input.namespace?.trim() || DEFAULT_NAMESPACE,
    category: input.category?.trim() || "general",
    aliases,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    weight: normalizeWeight(input.weight),
  };
}

export function dedupeOntologyConcepts(
  inputs: OntologyConceptInput[],
): OntologyConcept[] {
  const conceptsByLookup = new Map<string, OntologyConcept>();

  for (const input of inputs) {
    const concept = createOntologyConcept(input);
    const lookups = [
      concept.normalizedLabel,
      ...concept.aliases.map((alias) => normalizeOntologyLabel(alias)),
    ].filter(Boolean);
    const existingKey = lookups.find((lookup) => conceptsByLookup.has(lookup));

    if (!existingKey) {
      for (const lookup of lookups) conceptsByLookup.set(lookup, concept);
      continue;
    }

    const existing = conceptsByLookup.get(existingKey);
    if (!existing) continue;

    const merged: OntologyConcept = {
      ...existing,
      category: existing.category === "general" ? concept.category : existing.category,
      aliases: uniqueStrings([
        ...existing.aliases,
        concept.label,
        ...concept.aliases,
      ]).filter((alias) => normalizeOntologyLabel(alias) !== existing.normalizedLabel),
      weight: Math.max(existing.weight, concept.weight),
      sourceType: existing.sourceType ?? concept.sourceType,
      sourceId: existing.sourceId ?? concept.sourceId,
    };

    const mergedLookups = [
      merged.normalizedLabel,
      ...merged.aliases.map((alias) => normalizeOntologyLabel(alias)),
    ].filter(Boolean);
    for (const lookup of mergedLookups) conceptsByLookup.set(lookup, merged);
  }

  return uniqueBy([...conceptsByLookup.values()], (concept) => concept.key).sort(
    (a, b) => b.weight - a.weight || a.label.localeCompare(b.label),
  );
}

export function createOntologyEdge(input: OntologyEdgeInput): OntologyEdge {
  if (!input.fromId.trim() || !input.toId.trim()) {
    throw new AppError("Ontology edge endpoints are required.", 400, "ONTOLOGY_EDGE_ENDPOINT_REQUIRED");
  }

  const confidence = normalizeConfidence(input.confidence);
  const evidence = uniqueStrings(
    (input.evidence ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

  return {
    key: [
      input.courseId ?? "global",
      input.fromType,
      input.fromId,
      input.relation,
      input.toType,
      input.toId,
    ].join(":"),
    courseId: input.courseId,
    fromType: input.fromType,
    fromId: input.fromId,
    toType: input.toType,
    toId: input.toId,
    relation: input.relation,
    confidence,
    evidence,
  };
}

export function buildOntologyGraph(input: {
  concepts: OntologyConcept[];
  edges: OntologyEdge[];
}): OntologyGraph {
  const conceptsByKey = new Map(
    input.concepts.map((concept) => [concept.key, concept]),
  );
  const aliasesByLookup = new Map<string, string[]>();
  const outgoingEdgesByConcept = new Map<string, OntologyEdge[]>();
  const incomingEdgesByConcept = new Map<string, OntologyEdge[]>();
  const courseIdsByConceptKey = new Map<string, Set<string>>();

  for (const concept of input.concepts) {
    addLookup(aliasesByLookup, concept.normalizedLabel, concept.key);
    addLookup(aliasesByLookup, concept.label, concept.key);
    for (const alias of concept.aliases) {
      addLookup(aliasesByLookup, alias, concept.key);
    }
  }

  for (const edge of input.edges) {
    if (edge.fromType === "CONCEPT") {
      addEdge(outgoingEdgesByConcept, edge.fromId, edge);
      if (edge.courseId) addCourseScope(courseIdsByConceptKey, edge.fromId, edge.courseId);
    }
    if (edge.toType === "CONCEPT") {
      addEdge(incomingEdgesByConcept, edge.toId, edge);
      if (edge.courseId) addCourseScope(courseIdsByConceptKey, edge.toId, edge.courseId);
    }
  }

  return {
    concepts: input.concepts,
    edges: input.edges,
    conceptsByKey,
    aliasesByLookup,
    outgoingEdgesByConcept,
    incomingEdgesByConcept,
    courseIdsByConceptKey,
  };
}

export function findOntologyConceptMatches(input: {
  query: string;
  graph: OntologyGraph;
  courseId?: string;
  limit?: number;
}): OntologyConceptMatch[] {
  const normalizedQuery = normalizeOntologyLabel(input.query);
  if (!normalizedQuery) return [];

  const matches = new Map<string, OntologyConceptMatch>();
  for (const [lookup, conceptKeys] of input.graph.aliasesByLookup.entries()) {
    const normalizedLookup = normalizeOntologyLabel(lookup);
    if (
      normalizedLookup !== normalizedQuery &&
      !normalizedQuery.includes(normalizedLookup) &&
      !normalizedLookup.includes(normalizedQuery)
    ) {
      continue;
    }

    for (const conceptKey of conceptKeys) {
      const concept = input.graph.conceptsByKey.get(conceptKey);
      if (!concept) continue;
      const courseScoped = isConceptInCourseScope(
        input.graph,
        conceptKey,
        input.courseId,
      );
      if (!courseScoped) continue;
      matches.set(conceptKey, {
        concept,
        matchedBy:
          normalizedLookup === concept.normalizedLabel ? "label" : "alias",
        matchedValue: lookup,
        courseScoped,
      });
    }
  }

  return [...matches.values()]
    .sort(
      (a, b) =>
        exactMatchScore(b.matchedValue, normalizedQuery) -
          exactMatchScore(a.matchedValue, normalizedQuery) ||
        b.concept.weight - a.concept.weight ||
        a.concept.label.localeCompare(b.concept.label),
    )
    .slice(0, Math.max(1, Math.min(input.limit ?? 8, 50)));
}

export function expandOntologyRetrievalQueries(input: {
  query: string;
  graph: OntologyGraph;
  courseId?: string;
  limit?: number;
}) {
  const matches = findOntologyConceptMatches(input);
  const relatedConceptKeys = uniqueStrings(
    matches.flatMap((match) =>
      getOntologyRelatedConceptKeys({
        graph: input.graph,
        conceptKey: match.concept.key,
        courseId: input.courseId,
      }),
    ),
  );
  const relatedConcepts = relatedConceptKeys
    .map((key) => input.graph.conceptsByKey.get(key))
    .filter((concept): concept is OntologyConcept => Boolean(concept));
  const expandedQueries = uniqueStrings([
    input.query,
    ...matches.flatMap((match) => [
      match.concept.label,
      ...match.concept.aliases,
    ]),
    ...relatedConcepts.flatMap((concept) => [
      concept.label,
      ...concept.aliases.slice(0, 3),
    ]),
  ])
    .filter((query) => query.trim().length > 0)
    .slice(0, Math.max(1, Math.min(input.limit ?? 12, 50)));

  return {
    originalQuery: input.query,
    expandedQueries,
    matchedConceptKeys: matches.map((match) => match.concept.key),
    matchedConceptLabels: matches.map((match) => match.concept.label),
    relatedConceptKeys,
    courseId: input.courseId,
  } satisfies OntologyRetrievalExpansion;
}

export function createOntologyConceptRelationshipEdges(input: {
  parentConceptKey?: string;
  childConceptKey?: string;
  relatedConceptKeys?: Array<[string, string]>;
  synonymConceptKeys?: Array<[string, string]>;
  courseId?: string;
  evidence?: string[];
}) {
  const edges: OntologyEdge[] = [];
  if (input.parentConceptKey && input.childConceptKey) {
    edges.push(
      createOntologyEdge({
        courseId: input.courseId,
        fromType: "CONCEPT",
        fromId: input.parentConceptKey,
        toType: "CONCEPT",
        toId: input.childConceptKey,
        relation: "PARENT_OF",
        confidence: 1,
        evidence: input.evidence,
      }),
      createOntologyEdge({
        courseId: input.courseId,
        fromType: "CONCEPT",
        fromId: input.childConceptKey,
        toType: "CONCEPT",
        toId: input.parentConceptKey,
        relation: "CHILD_OF",
        confidence: 1,
        evidence: input.evidence,
      }),
    );
  }
  for (const [fromId, toId] of input.relatedConceptKeys ?? []) {
    edges.push(
      createOntologyEdge({
        courseId: input.courseId,
        fromType: "CONCEPT",
        fromId,
        toType: "CONCEPT",
        toId,
        relation: "RELATED_TO",
        confidence: 0.75,
        evidence: input.evidence,
      }),
    );
  }
  for (const [fromId, toId] of input.synonymConceptKeys ?? []) {
    edges.push(
      createOntologyEdge({
        courseId: input.courseId,
        fromType: "CONCEPT",
        fromId,
        toType: "CONCEPT",
        toId,
        relation: "SYNONYM_OF",
        confidence: 0.95,
        evidence: input.evidence,
      }),
    );
  }
  return edges;
}

export function createCrossCourseConceptMapping(input: {
  sourceCourseId: string;
  targetCourseId: string;
  sourceConceptKey: string;
  targetConceptKey: string;
  evidence?: string[];
}) {
  return [
    createOntologyEdge({
      courseId: input.sourceCourseId,
      fromType: "CONCEPT",
      fromId: input.sourceConceptKey,
      toType: "CONCEPT",
      toId: input.targetConceptKey,
      relation: "CROSS_COURSE_EQUIVALENT",
      confidence: 0.9,
      evidence: input.evidence,
    }),
    createOntologyEdge({
      courseId: input.targetCourseId,
      fromType: "CONCEPT",
      fromId: input.targetConceptKey,
      toType: "CONCEPT",
      toId: input.sourceConceptKey,
      relation: "CROSS_COURSE_EQUIVALENT",
      confidence: 0.9,
      evidence: input.evidence,
    }),
  ];
}

export function createCurriculumContentOntologyEdges(
  input: CurriculumContentBridgeInput,
) {
  const baseEvidence = input.evidence ?? [];
  const edges: OntologyEdge[] = [
    createOntologyEdge({
      courseId: input.courseId,
      fromType: "CURRICULUM_NODE",
      fromId: input.curriculumNodeId,
      toType: "COURSE_LESSON",
      toId: input.courseLessonId,
      relation: "COVERS",
      confidence: 1,
      evidence: baseEvidence,
    }),
    createOntologyEdge({
      courseId: input.courseId,
      fromType: "COURSE_LESSON",
      fromId: input.courseLessonId,
      toType: "CONTENT",
      toId: input.contentId,
      relation: "REUSES_CONTENT",
      confidence: 1,
      evidence: baseEvidence,
    }),
  ];

  for (const conceptId of input.conceptIds ?? []) {
    edges.push(
      createOntologyEdge({
        courseId: input.courseId,
        fromType: "CONTENT",
        fromId: input.contentId,
        toType: "CONCEPT",
        toId: conceptId,
        relation: "EXPLAINS",
        confidence: 0.85,
        evidence: baseEvidence,
      }),
    );
  }

  return edges;
}

export function assertOntologyCourseScope(input: {
  expectedCourseId: string;
  edge: Pick<OntologyEdge, "courseId" | "key">;
}) {
  if (input.edge.courseId && input.edge.courseId !== input.expectedCourseId) {
    throw new AppError(
      "Ontology edge belongs to a different course.",
      403,
      "ONTOLOGY_COURSE_SCOPE_MISMATCH",
    );
  }
}

export function rankOntologyCoverageGaps(input: {
  curriculumNodes: OntologyCoverageNode[];
  edges: Pick<OntologyEdge, "courseId" | "fromType" | "fromId" | "toType" | "relation">[];
}) {
  const edgesByCourseAndNode = new Map<string, typeof input.edges>();

  for (const edge of input.edges) {
    if (edge.fromType !== "CURRICULUM_NODE") continue;
    const key = `${edge.courseId ?? "global"}:${edge.fromId}`;
    const current = edgesByCourseAndNode.get(key) ?? [];
    current.push(edge);
    edgesByCourseAndNode.set(key, current);
  }

  return input.curriculumNodes
    .map((node): OntologyCoverageGap => {
      const relatedEdges =
        edgesByCourseAndNode.get(`${node.courseId}:${node.id}`) ??
        edgesByCourseAndNode.get(`global:${node.id}`) ??
        [];
      const reasons: string[] = [];
      let score = 0;

      if (relatedEdges.length === 0) {
        score += 70;
        reasons.push("NO_CURRICULUM_EDGE");
      } else {
        return { ...node, score, reasons };
      }
      if (node.required) {
        score += 20;
        reasons.push("REQUIRED_NODE");
      }
      if ((node.depth ?? 0) >= 3) {
        score += 10;
        reasons.push("DEEP_DETAIL_NODE");
      }

      return { ...node, score, reasons };
    })
    .filter((gap) => gap.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function validateOntologyReviewTransition(
  input: OntologyReviewTransitionInput,
): OntologyReviewTransition {
  if (input.currentStatus === input.nextStatus) {
    throw new AppError(
      "Ontology status is already set.",
      409,
      "ONTOLOGY_STATUS_UNCHANGED",
    );
  }

  if (input.nextStatus === "ACTIVE") {
    assertOntologyReviewRole(input.actorRoles, [
      "CONTENT_REVIEWER",
      "COURSE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    if (!hasReviewEvidence(input.evidence)) {
      throw new AppError(
        "Active ontology items require review evidence.",
        400,
        "ONTOLOGY_REVIEW_EVIDENCE_REQUIRED",
      );
    }
    return {
      from: input.currentStatus,
      to: input.nextStatus,
      requiresAuditLog: true,
      auditAction: "ONTOLOGY_ACTIVATED",
    };
  }

  if (input.nextStatus === "ARCHIVED") {
    assertOntologyReviewRole(input.actorRoles, [
      "COURSE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    if (!input.changeSummary?.trim()) {
      throw new AppError(
        "Archiving ontology items requires a change summary.",
        400,
        "ONTOLOGY_ARCHIVE_SUMMARY_REQUIRED",
      );
    }
    return {
      from: input.currentStatus,
      to: input.nextStatus,
      requiresAuditLog: true,
      auditAction: "ONTOLOGY_ARCHIVED",
    };
  }

  assertOntologyReviewRole(input.actorRoles, [
    "CONTENT_EDITOR",
    "CONTENT_REVIEWER",
    "COURSE_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ]);
  return {
    from: input.currentStatus,
    to: input.nextStatus,
    requiresAuditLog: true,
    auditAction: "ONTOLOGY_DRAFTED",
  };
}

function normalizeWeight(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(100, Number(value)));
}

function normalizeConfidence(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, Number(value)));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function addLookup(
  lookups: Map<string, string[]>,
  value: string,
  conceptKey: string,
) {
  const normalized = normalizeOntologyLabel(value);
  if (!normalized) return;
  lookups.set(normalized, uniqueStrings([...(lookups.get(normalized) ?? []), conceptKey]));
}

function addEdge(
  edgesByConcept: Map<string, OntologyEdge[]>,
  conceptKey: string,
  edge: OntologyEdge,
) {
  edgesByConcept.set(conceptKey, [...(edgesByConcept.get(conceptKey) ?? []), edge]);
}

function addCourseScope(
  scopes: Map<string, Set<string>>,
  conceptKey: string,
  courseId: string,
) {
  const current = scopes.get(conceptKey) ?? new Set<string>();
  current.add(courseId);
  scopes.set(conceptKey, current);
}

function isConceptInCourseScope(
  graph: OntologyGraph,
  conceptKey: string,
  courseId?: string,
) {
  if (!courseId) return true;
  const scopes = graph.courseIdsByConceptKey.get(conceptKey);
  return !scopes || scopes.size === 0 || scopes.has(courseId);
}

function getOntologyRelatedConceptKeys(input: {
  graph: OntologyGraph;
  conceptKey: string;
  courseId?: string;
}) {
  const relations = new Set<OntologyRelationType>([
    "PARENT_OF",
    "CHILD_OF",
    "SYNONYM_OF",
    "RELATED_TO",
    "CROSS_COURSE_EQUIVALENT",
  ]);
  const keys: string[] = [];
  for (const edge of [
    ...(input.graph.outgoingEdgesByConcept.get(input.conceptKey) ?? []),
    ...(input.graph.incomingEdgesByConcept.get(input.conceptKey) ?? []),
  ]) {
    if (!relations.has(edge.relation)) continue;
    if (edge.courseId && input.courseId && edge.courseId !== input.courseId) continue;
    const relatedKey =
      edge.fromId === input.conceptKey ? edge.toId : edge.fromId;
    if (
      relatedKey !== input.conceptKey &&
      input.graph.conceptsByKey.has(relatedKey) &&
      isConceptInCourseScope(input.graph, relatedKey, input.courseId)
    ) {
      keys.push(relatedKey);
    }
  }
  return uniqueStrings(keys);
}

function exactMatchScore(value: string, normalizedQuery: string) {
  return normalizeOntologyLabel(value) === normalizedQuery ? 1 : 0;
}

function uniqueBy<T>(values: T[], keyFactory: (value: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = keyFactory(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function assertOntologyReviewRole(
  actorRoles: OntologyReviewRole[],
  allowedRoles: OntologyReviewRole[],
) {
  if (!actorRoles.some((role) => allowedRoles.includes(role))) {
    throw new AppError(
      "Actor is not allowed to change ontology review status.",
      403,
      "ONTOLOGY_REVIEW_FORBIDDEN",
    );
  }
}

function hasReviewEvidence(evidence: string[] | undefined) {
  return (evidence ?? []).some((item) => item.trim().length > 0);
}
