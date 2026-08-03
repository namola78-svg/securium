import { AppError } from "../errors.ts";

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
  | "DERIVED_FROM";

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
