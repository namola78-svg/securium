import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb } from ".";
import {
  ontologyAliases,
  ontologyConcepts,
  ontologyEdges,
} from "./schema";
import {
  buildOntologyGraph,
  normalizeOntologyLabel,
  type OntologyConcept,
  type OntologyEdge,
  type OntologyEntityType,
  type OntologyGraph,
  type OntologyRelationType,
} from "@/lib/services/ontology-service";
import { AppError } from "@/lib/errors";

// CP-A governed identity writes are intentionally separate from legacy ontology rows.
export {
  addConceptLabel,
  createConcept,
  createConceptVersion,
} from "./concept-persistence-repositories";

export type OntologyConceptFilters = {
  namespace?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  sourceType?: OntologyEntityType;
  sourceId?: string;
  limit?: number;
};

export type OntologyEdgeFilters = {
  courseId?: string;
  relation?: OntologyRelationType;
  fromType?: OntologyEntityType;
  fromId?: string;
  toType?: OntologyEntityType;
  toId?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  limit?: number;
};

export type OntologyAdminStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type OntologyAdminConceptRow = OntologyConcept & {
  id: string;
  status: OntologyAdminStatus;
  updatedAt: string;
};

export type OntologyAdminEdgeRow = OntologyEdge & {
  id: string;
  status: OntologyAdminStatus;
  updatedAt: string;
};

export type OntologyReviewTargetType = "CONCEPT" | "EDGE";

export type OntologyReviewStatusUpdateInput = {
  targetType: OntologyReviewTargetType;
  targetId: string;
  status: OntologyAdminStatus;
};

export type OntologyReviewTarget = {
  id: string;
  key: string;
  targetType: OntologyReviewTargetType;
  status: OntologyAdminStatus;
};

export async function upsertOntologyConcept(
  concept: OntologyConcept,
  options: { status?: "ACTIVE" | "DRAFT" | "ARCHIVED"; description?: string } = {},
) {
  const [existing] = await getDb()
    .select({ id: ontologyConcepts.id })
    .from(ontologyConcepts)
    .where(eq(ontologyConcepts.conceptKey, concept.key))
    .limit(1);
  const id = existing?.id ?? crypto.randomUUID();

  await getDb()
    .insert(ontologyConcepts)
    .values({
      id,
      conceptKey: concept.key,
      namespace: concept.namespace,
      label: concept.label,
      normalizedLabel: concept.normalizedLabel,
      category: concept.category,
      description: options.description ?? "",
      sourceType: concept.sourceType ?? null,
      sourceId: concept.sourceId ?? null,
      weight: concept.weight,
      status: options.status ?? "ACTIVE",
      metadataJson: JSON.stringify({
        sourceType: concept.sourceType ?? null,
        sourceId: concept.sourceId ?? null,
      }),
    })
    .onConflictDoUpdate({
      target: ontologyConcepts.conceptKey,
      set: {
        namespace: concept.namespace,
        label: concept.label,
        normalizedLabel: concept.normalizedLabel,
        category: concept.category,
        description: options.description ?? "",
        sourceType: concept.sourceType ?? null,
        sourceId: concept.sourceId ?? null,
        weight: concept.weight,
        status: options.status ?? "ACTIVE",
        updatedAt: new Date().toISOString(),
      },
    });

  for (const alias of concept.aliases) {
    const normalizedAlias = normalizeOntologyLabel(alias);
    if (!normalizedAlias) continue;
    await getDb()
      .insert(ontologyAliases)
      .values({
        id: crypto.randomUUID(),
        conceptId: id,
        alias,
        normalizedAlias,
      })
      .onConflictDoUpdate({
        target: [
          ontologyAliases.conceptId,
          ontologyAliases.normalizedAlias,
        ],
        set: {
          alias,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  return { id };
}

export async function upsertOntologyEdge(
  edge: OntologyEdge,
  options: { status?: "ACTIVE" | "DRAFT" | "ARCHIVED" } = {},
) {
  const [existing] = await getDb()
    .select({ id: ontologyEdges.id })
    .from(ontologyEdges)
    .where(eq(ontologyEdges.edgeKey, edge.key))
    .limit(1);
  const id = existing?.id ?? crypto.randomUUID();
  await getDb()
    .insert(ontologyEdges)
    .values({
      id,
      edgeKey: edge.key,
      courseId: edge.courseId ?? null,
      fromType: edge.fromType,
      fromId: edge.fromId,
      toType: edge.toType,
      toId: edge.toId,
      relation: edge.relation,
      confidence: Math.round(edge.confidence * 10000),
      evidenceJson: JSON.stringify(edge.evidence),
      status: options.status ?? "ACTIVE",
      metadataJson: "{}",
    })
    .onConflictDoUpdate({
      target: ontologyEdges.edgeKey,
      set: {
        courseId: edge.courseId ?? null,
        fromType: edge.fromType,
        fromId: edge.fromId,
        toType: edge.toType,
        toId: edge.toId,
        relation: edge.relation,
        confidence: Math.round(edge.confidence * 10000),
        evidenceJson: JSON.stringify(edge.evidence),
        status: options.status ?? "ACTIVE",
        updatedAt: new Date().toISOString(),
      },
    });
  return { id };
}

export async function listOntologyConcepts(
  filters: OntologyConceptFilters = {},
): Promise<OntologyConcept[]> {
  const rows = await getDb()
    .select({
      id: ontologyConcepts.id,
      conceptKey: ontologyConcepts.conceptKey,
      namespace: ontologyConcepts.namespace,
      label: ontologyConcepts.label,
      normalizedLabel: ontologyConcepts.normalizedLabel,
      category: ontologyConcepts.category,
      sourceType: ontologyConcepts.sourceType,
      sourceId: ontologyConcepts.sourceId,
      weight: ontologyConcepts.weight,
    })
    .from(ontologyConcepts)
    .where(and(...conceptConditions(filters)))
    .orderBy(desc(ontologyConcepts.weight), ontologyConcepts.label)
    .limit(safeLimit(filters.limit, 500));

  const aliasesByConceptId = await listAliasesByConceptId(rows.map((row) => row.id));
  return rows.map((row) => ({
    key: row.conceptKey,
    label: row.label,
    normalizedLabel: row.normalizedLabel,
    namespace: row.namespace,
    category: row.category,
    aliases: aliasesByConceptId.get(row.id) ?? [],
    sourceType: row.sourceType as OntologyEntityType | undefined,
    sourceId: row.sourceId ?? undefined,
    weight: row.weight,
  }));
}

export async function listOntologyEdges(
  filters: OntologyEdgeFilters = {},
): Promise<OntologyEdge[]> {
  const rows = await getDb()
    .select({
      edgeKey: ontologyEdges.edgeKey,
      courseId: ontologyEdges.courseId,
      fromType: ontologyEdges.fromType,
      fromId: ontologyEdges.fromId,
      toType: ontologyEdges.toType,
      toId: ontologyEdges.toId,
      relation: ontologyEdges.relation,
      confidence: ontologyEdges.confidence,
      evidenceJson: ontologyEdges.evidenceJson,
    })
    .from(ontologyEdges)
    .where(and(...edgeConditions(filters)))
    .orderBy(desc(ontologyEdges.updatedAt))
    .limit(safeLimit(filters.limit, 1000));

  return rows.map((row) => ({
    key: row.edgeKey,
    courseId: row.courseId ?? undefined,
    fromType: row.fromType as OntologyEntityType,
    fromId: row.fromId,
    toType: row.toType as OntologyEntityType,
    toId: row.toId,
    relation: row.relation as OntologyRelationType,
    confidence: Math.max(0, Math.min(1, row.confidence / 10000)),
    evidence: parseJson<string[]>(row.evidenceJson, []),
  }));
}

export async function listOntologyAdminConceptRows(
  filters: OntologyConceptFilters = {},
): Promise<OntologyAdminConceptRow[]> {
  const rows = await getDb()
    .select({
      id: ontologyConcepts.id,
      conceptKey: ontologyConcepts.conceptKey,
      namespace: ontologyConcepts.namespace,
      label: ontologyConcepts.label,
      normalizedLabel: ontologyConcepts.normalizedLabel,
      category: ontologyConcepts.category,
      sourceType: ontologyConcepts.sourceType,
      sourceId: ontologyConcepts.sourceId,
      weight: ontologyConcepts.weight,
      status: ontologyConcepts.status,
      updatedAt: ontologyConcepts.updatedAt,
    })
    .from(ontologyConcepts)
    .where(and(...conceptConditions(filters)))
    .orderBy(desc(ontologyConcepts.updatedAt), desc(ontologyConcepts.weight))
    .limit(safeLimit(filters.limit, 500));

  const aliasesByConceptId = await listAliasesByConceptId(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    key: row.conceptKey,
    label: row.label,
    normalizedLabel: row.normalizedLabel,
    namespace: row.namespace,
    category: row.category,
    aliases: aliasesByConceptId.get(row.id) ?? [],
    sourceType: row.sourceType as OntologyEntityType | undefined,
    sourceId: row.sourceId ?? undefined,
    weight: row.weight,
    status: normalizeStatus(row.status),
    updatedAt: row.updatedAt,
  }));
}

export async function listOntologyAdminEdgeRows(
  filters: OntologyEdgeFilters = {},
): Promise<OntologyAdminEdgeRow[]> {
  const rows = await getDb()
    .select({
      id: ontologyEdges.id,
      edgeKey: ontologyEdges.edgeKey,
      courseId: ontologyEdges.courseId,
      fromType: ontologyEdges.fromType,
      fromId: ontologyEdges.fromId,
      toType: ontologyEdges.toType,
      toId: ontologyEdges.toId,
      relation: ontologyEdges.relation,
      confidence: ontologyEdges.confidence,
      evidenceJson: ontologyEdges.evidenceJson,
      status: ontologyEdges.status,
      updatedAt: ontologyEdges.updatedAt,
    })
    .from(ontologyEdges)
    .where(and(...edgeConditions(filters)))
    .orderBy(desc(ontologyEdges.updatedAt))
    .limit(safeLimit(filters.limit, 1000));

  return rows.map((row) => ({
    id: row.id,
    key: row.edgeKey,
    courseId: row.courseId ?? undefined,
    fromType: row.fromType as OntologyEntityType,
    fromId: row.fromId,
    toType: row.toType as OntologyEntityType,
    toId: row.toId,
    relation: row.relation as OntologyRelationType,
    confidence: Math.max(0, Math.min(1, row.confidence / 10000)),
    evidence: parseJson<string[]>(row.evidenceJson, []),
    status: normalizeStatus(row.status),
    updatedAt: row.updatedAt,
  }));
}

export async function updateOntologyReviewStatus(
  input: OntologyReviewStatusUpdateInput,
) {
  const updatedAt = new Date().toISOString();

  if (input.targetType === "CONCEPT") {
    const [existing] = await getDb()
      .select({
        id: ontologyConcepts.id,
        conceptKey: ontologyConcepts.conceptKey,
        status: ontologyConcepts.status,
      })
      .from(ontologyConcepts)
      .where(eq(ontologyConcepts.id, input.targetId))
    .limit(1);
    if (!existing) {
      throw new AppError("Ontology concept was not found.", 404, "ONTOLOGY_CONCEPT_NOT_FOUND");
    }
    await getDb()
      .update(ontologyConcepts)
      .set({ status: input.status, updatedAt })
      .where(eq(ontologyConcepts.id, input.targetId));
    return {
      id: existing.id,
      key: existing.conceptKey,
      targetType: input.targetType,
      previousStatus: normalizeStatus(existing.status),
      status: input.status,
      updatedAt,
    };
  }

  const [existing] = await getDb()
    .select({
      id: ontologyEdges.id,
      edgeKey: ontologyEdges.edgeKey,
      status: ontologyEdges.status,
    })
    .from(ontologyEdges)
    .where(eq(ontologyEdges.id, input.targetId))
    .limit(1);
  if (!existing) {
    throw new AppError("Ontology edge was not found.", 404, "ONTOLOGY_EDGE_NOT_FOUND");
  }
  await getDb()
    .update(ontologyEdges)
    .set({ status: input.status, updatedAt })
    .where(eq(ontologyEdges.id, input.targetId));
  return {
    id: existing.id,
    key: existing.edgeKey,
    targetType: input.targetType,
    previousStatus: normalizeStatus(existing.status),
    status: input.status,
    updatedAt,
  };
}

export async function getOntologyReviewTarget(input: {
  targetType: OntologyReviewTargetType;
  targetId: string;
}): Promise<OntologyReviewTarget> {
  if (input.targetType === "CONCEPT") {
    const [existing] = await getDb()
      .select({
        id: ontologyConcepts.id,
        conceptKey: ontologyConcepts.conceptKey,
        status: ontologyConcepts.status,
      })
      .from(ontologyConcepts)
      .where(eq(ontologyConcepts.id, input.targetId))
      .limit(1);
    if (!existing) {
      throw new AppError("Ontology concept was not found.", 404, "ONTOLOGY_CONCEPT_NOT_FOUND");
    }
    return {
      id: existing.id,
      key: existing.conceptKey,
      targetType: input.targetType,
      status: normalizeStatus(existing.status),
    };
  }

  const [existing] = await getDb()
    .select({
      id: ontologyEdges.id,
      edgeKey: ontologyEdges.edgeKey,
      status: ontologyEdges.status,
    })
    .from(ontologyEdges)
    .where(eq(ontologyEdges.id, input.targetId))
    .limit(1);
  if (!existing) {
    throw new AppError("Ontology edge was not found.", 404, "ONTOLOGY_EDGE_NOT_FOUND");
  }
  return {
    id: existing.id,
    key: existing.edgeKey,
    targetType: input.targetType,
    status: normalizeStatus(existing.status),
  };
}

export async function buildDatabaseOntologyGraph(input: {
  namespace?: string;
  courseId?: string;
} = {}): Promise<OntologyGraph> {
  const concepts = await listOntologyConcepts({
    namespace: input.namespace,
    status: "ACTIVE",
    limit: 1000,
  });
  const edges = await listOntologyEdges({
    courseId: input.courseId,
    status: "ACTIVE",
    limit: 2000,
  });
  return buildOntologyGraph({ concepts, edges });
}

async function listAliasesByConceptId(conceptIds: string[]) {
  if (!conceptIds.length) return new Map<string, string[]>();
  const rows = await getDb()
    .select({
      conceptId: ontologyAliases.conceptId,
      alias: ontologyAliases.alias,
    })
    .from(ontologyAliases)
    .where(inArray(ontologyAliases.conceptId, conceptIds));
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    grouped.set(row.conceptId, [...(grouped.get(row.conceptId) ?? []), row.alias]);
  }
  return grouped;
}

function conceptConditions(filters: OntologyConceptFilters) {
  return [
    filters.namespace ? eq(ontologyConcepts.namespace, filters.namespace) : undefined,
    filters.status ? eq(ontologyConcepts.status, filters.status) : undefined,
    filters.sourceType ? eq(ontologyConcepts.sourceType, filters.sourceType) : undefined,
    filters.sourceId ? eq(ontologyConcepts.sourceId, filters.sourceId) : undefined,
  ].filter(Boolean);
}

function edgeConditions(filters: OntologyEdgeFilters) {
  return [
    filters.courseId
      ? or(eq(ontologyEdges.courseId, filters.courseId), isNull(ontologyEdges.courseId))
      : undefined,
    filters.relation ? eq(ontologyEdges.relation, filters.relation) : undefined,
    filters.fromType ? eq(ontologyEdges.fromType, filters.fromType) : undefined,
    filters.fromId ? eq(ontologyEdges.fromId, filters.fromId) : undefined,
    filters.toType ? eq(ontologyEdges.toType, filters.toType) : undefined,
    filters.toId ? eq(ontologyEdges.toId, filters.toId) : undefined,
    filters.status ? eq(ontologyEdges.status, filters.status) : undefined,
  ].filter(Boolean);
}

function safeLimit(value: number | undefined, max: number) {
  return Math.max(1, Math.min(value ?? max, max));
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeStatus(value: string): OntologyAdminStatus {
  return value === "DRAFT" || value === "ARCHIVED" ? value : "ACTIVE";
}
