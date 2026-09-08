import { and, asc, eq, or, sql } from "drizzle-orm";
import type { getDb } from "../../db/index.ts";

export type ConceptLifecycle = "ACTIVE" | "DEPRECATED" | "SUPERSEDED" | "UNKNOWN";
export type ResolutionKind =
  | "RESOLVED"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "UNRESOLVED"
  | "DEPRECATED"
  | "SUPERSEDED"
  | "UNKNOWN";
export type MappingStatus = "APPROVED" | "UNVERIFIED" | "DEPRECATED" | "SUPERSEDED";
export type ProvenanceSourceType = "OFFICIAL" | "INTERNAL_CURATED" | "DERIVED" | "UNKNOWN";
export type FreshnessClass =
  | "CURRENT_PUBLISHED"
  | "VERSION_UNKNOWN"
  | "DEPRECATED_OR_SUPERSEDED"
  | "STALE_OR_UNVERIFIED"
  | "UNKNOWN";
export type EligibilityResult = "ELIGIBLE" | "NOT_PUBLIC" | "RESTRICTED" | "UNVERIFIED" | "STALE" | "UNKNOWN";
export type KnowledgeEntityType = "CONCEPT" | "CERTIFICATION" | "LEARNING_CONTENT";
type InternalMappingStatus = "APPROVED" | "SUGGESTED" | "LEGACY_UNVERIFIED" | "REJECTED" | "DEPRECATED" | "SUPERSEDED" | null;
type PublicationState = "PUBLISHED" | "NOT_PUBLIC" | "UNKNOWN";
type AccessState = "PUBLIC" | "RESTRICTED" | "UNKNOWN";
type RevisionState = "CURRENT" | "STALE" | "UNKNOWN";

export type CanonicalConcept = {
  id: string;
  stableKey: string;
  lifecycle?: ConceptLifecycle;
  replacementId?: string;
  versionId?: string;
  version?: number;
  labels?: Array<{ normalizedLabel: string; label?: string; status?: string }>;
};

export type OntologyReference = { id?: string; key?: string; stableKey?: string; alias?: string };
export type CanonicalResolution = {
  kind: ResolutionKind;
  concept?: CanonicalConcept;
  replacement?: CanonicalConcept;
};

type ServerKnowledgeState = {
  canonicalId: string;
  publication: PublicationState;
  access: AccessState;
  mappingStatus: InternalMappingStatus;
  provenanceSourceType?: ProvenanceSourceType;
  sourceReference?: string;
  revision: RevisionState;
  revisionReference?: string;
};

type SearchCandidate = { reference: OntologyReference; score: number };

/** Repository functions are the server-owned authority seam. Callers provide lookup input only. */
type KnowledgeAuthority = {
  resolveConcept(reference: OntologyReference): Promise<CanonicalResolution>;
  loadState(input: { entityType: KnowledgeEntityType; canonicalId: string }): Promise<ServerKnowledgeState | null>;
  searchCandidates(input: { query: string; limit: number }): Promise<readonly SearchCandidate[]>;
};

export type PublicKnowledgeProjection = {
  entityType: KnowledgeEntityType;
  publicId: string;
  canonicalId: string;
  stableKey?: string;
  revisionReference?: string;
  provenance: {
    sourceType: ProvenanceSourceType;
    sourceReference?: string;
    mappingStatus: MappingStatus;
    publication: "PUBLISHED";
  };
  freshness: "CURRENT_PUBLISHED";
};

export type PublicKnowledgeResult =
  | { kind: "PUBLIC"; projection: PublicKnowledgeProjection }
  | { kind: "NOT_FOUND" };

function normalizeLookup(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedMappingStatus(input: InternalMappingStatus): MappingStatus {
  switch (input) {
    case "APPROVED": return "APPROVED";
    case "SUPERSEDED": return "SUPERSEDED";
    case "DEPRECATED": return "DEPRECATED";
    default: return "UNVERIFIED";
  }
}

function freshnessOf(state: ServerKnowledgeState, resolution: CanonicalResolution): FreshnessClass {
  const lifecycle = resolution.concept?.lifecycle ?? "UNKNOWN";
  const mapping = normalizedMappingStatus(state.mappingStatus);
  if (lifecycle === "DEPRECATED" || lifecycle === "SUPERSEDED" || mapping === "DEPRECATED" || mapping === "SUPERSEDED") return "DEPRECATED_OR_SUPERSEDED";
  if (mapping !== "APPROVED" || state.revision === "STALE") return "STALE_OR_UNVERIFIED";
  if (state.revision === "UNKNOWN") return "VERSION_UNKNOWN";
  if (state.publication !== "PUBLISHED") return "UNKNOWN";
  return "CURRENT_PUBLISHED";
}

function eligibilityOf(entityType: KnowledgeEntityType, state: ServerKnowledgeState, resolution: CanonicalResolution): EligibilityResult {
  if (resolution.kind === "AMBIGUOUS" || resolution.kind === "UNKNOWN" || resolution.kind === "UNRESOLVED") return "UNKNOWN";
  if (entityType === "CONCEPT" && !resolution.concept) return "NOT_PUBLIC";
  if (state.access === "RESTRICTED") return "RESTRICTED";
  if (state.access === "UNKNOWN") return "UNKNOWN";
  if (state.publication !== "PUBLISHED") return state.publication === "NOT_PUBLIC" ? "NOT_PUBLIC" : "UNKNOWN";
  if (normalizedMappingStatus(state.mappingStatus) !== "APPROVED" || (state.provenanceSourceType ?? "UNKNOWN") === "UNKNOWN") return "UNVERIFIED";
  const freshness = freshnessOf(state, resolution);
  if (freshness !== "CURRENT_PUBLISHED") return "STALE";
  if (resolution.kind === "DEPRECATED" || resolution.kind === "SUPERSEDED") return "STALE";
  return "ELIGIBLE";
}

function publicIdFor(entityType: KnowledgeEntityType, canonicalId: string) {
  const namespace = entityType === "CONCEPT" ? "concept" : entityType === "CERTIFICATION" ? "certification" : "learning-content";
  return publicKnowledgeId(namespace, canonicalId);
}

function project(entityType: KnowledgeEntityType, resolution: CanonicalResolution, state: ServerKnowledgeState): PublicKnowledgeProjection | undefined {
  if (!resolution.concept && entityType === "CONCEPT") return undefined;
  const canonicalId = state.canonicalId;
  const publicId = publicIdFor(entityType, canonicalId);
  if (!publicId || state.publication !== "PUBLISHED" || state.access !== "PUBLIC" || normalizedMappingStatus(state.mappingStatus) !== "APPROVED" || (state.provenanceSourceType ?? "UNKNOWN") === "UNKNOWN" || freshnessOf(state, resolution) !== "CURRENT_PUBLISHED") return undefined;
  return {
    entityType,
    publicId,
    canonicalId,
    stableKey: resolution.concept?.stableKey,
    revisionReference: state.revisionReference,
    provenance: {
      sourceType: state.provenanceSourceType ?? "UNKNOWN",
      sourceReference: state.sourceReference,
      mappingStatus: "APPROVED",
      publication: "PUBLISHED",
    },
    freshness: "CURRENT_PUBLISHED",
  };
}

export function publicKnowledgeId(entity: "concept" | "certification" | "learning-content", canonicalId: string) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(canonicalId)) return undefined;
  return `${entity}:${canonicalId}`;
}

export function canonicalIdFromPublicKnowledgeId(input: string, entity: "concept" | "certification" | "learning-content") {
  const prefix = `${entity}:`;
  if (!input.startsWith(prefix)) return undefined;
  const id = input.slice(prefix.length);
  return /^[a-zA-Z0-9._:-]+$/.test(id) && id ? id : undefined;
}

function createKnowledgeQueryService(authority: KnowledgeAuthority) {
  async function resolveConcept(reference: OntologyReference): Promise<CanonicalResolution> {
    if (!reference.id && !reference.key && !reference.stableKey && !reference.alias) return { kind: "NOT_FOUND" };
    return authority.resolveConcept({
      id: reference.id,
      key: reference.key,
      stableKey: reference.stableKey,
      alias: reference.alias ? normalizeLookup(reference.alias) : undefined,
    });
  }

  async function getPublicEntity(input: { entityType: KnowledgeEntityType; publicId: string }): Promise<PublicKnowledgeResult> {
    const namespace = input.entityType === "CONCEPT" ? "concept" : input.entityType === "CERTIFICATION" ? "certification" : "learning-content";
    const canonicalId = canonicalIdFromPublicKnowledgeId(input.publicId, namespace);
    if (!canonicalId) return { kind: "NOT_FOUND" };
    const resolution = input.entityType === "CONCEPT" ? await resolveConcept({ id: canonicalId }) : { kind: "RESOLVED" as const };
    const state = await authority.loadState({ entityType: input.entityType, canonicalId });
    if (!state || state.canonicalId !== canonicalId || eligibilityOf(input.entityType, state, resolution) !== "ELIGIBLE") return { kind: "NOT_FOUND" };
    const projection = project(input.entityType, resolution, state);
    return projection ? { kind: "PUBLIC", projection } : { kind: "NOT_FOUND" };
  }

  async function search(input: { query: string; limit?: number }) {
    const limit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 20)));
    const candidates = await authority.searchCandidates({ query: normalizeLookup(input.query), limit });
    const results: Array<{ score: number; projection: PublicKnowledgeProjection }> = [];
    for (const candidate of candidates.slice(0, limit)) {
      const resolution = await resolveConcept(candidate.reference);
      if (resolution.kind !== "RESOLVED" || !resolution.concept) continue;
      const state = await authority.loadState({ entityType: "CONCEPT", canonicalId: resolution.concept.id });
      if (!state || eligibilityOf("CONCEPT", state, resolution) !== "ELIGIBLE") continue;
      const projection = project("CONCEPT", resolution, state);
      if (projection) results.push({ score: candidate.score, projection });
    }
    return results;
  }

  return Object.freeze({ getPublicEntity, resolveConcept, search });
}



async function database() {
  const [{ getDb }, schema] = await Promise.all([import("../../db/index.ts"), import("../../db/schema.ts")]);
  return { db: getDb(), ...schema };
}

export type CanonicalOntologyRow = {
  id: string;
  conceptKey: string;
  label: string;
  normalizedLabel: string;
  status: string;
};

export type CanonicalOntologyRepository = {
  findByIdOrKey(input: { id?: string; key?: string }): Promise<CanonicalOntologyRow[]>;
  findByAlias(normalizedAlias: string): Promise<CanonicalOntologyRow[]>;
  search(input: { normalizedQuery: string; limit: number }): Promise<Array<{ id: string; stableKey: string; text: string }>>;
  findActiveConcept(id: string): Promise<{ id: string } | null>;
  findPublishedContent(id: string): Promise<{ id: string } | null>;
};
type CanonicalOntologyDatabase = ReturnType<typeof getDb>;

function lifecycleForOntologyStatus(status: string): ConceptLifecycle {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "ARCHIVED") return "DEPRECATED";
  return "UNKNOWN";
}

function resolutionForOntologyRow(row: CanonicalOntologyRow): CanonicalResolution {
  const lifecycle = lifecycleForOntologyStatus(row.status);
  const concept: CanonicalConcept = {
    id: row.id,
    stableKey: row.conceptKey,
    lifecycle,
    labels: [{ normalizedLabel: row.normalizedLabel, label: row.label, status: row.status }],
  };
  return {
    kind: lifecycle === "ACTIVE" ? "RESOLVED" : lifecycle === "DEPRECATED" ? "DEPRECATED" : "UNKNOWN",
    concept,
  };
}

export function createCanonicalOntologyAuthorityFromRepository(repository: CanonicalOntologyRepository): KnowledgeAuthority {
  return Object.freeze({
    async resolveConcept(reference: OntologyReference) {
      const lookup = reference.id ?? reference.stableKey ?? reference.key;
      const rows = lookup
        ? await repository.findByIdOrKey(reference.id ? { id: lookup } : { key: lookup })
        : reference.alias
          ? await repository.findByAlias(normalizeLookup(reference.alias))
          : [];
      if (rows.length === 0) return { kind: lookup || reference.alias ? "UNRESOLVED" as const : "NOT_FOUND" as const };
      if (rows.length > 1) return { kind: "AMBIGUOUS" as const };
      return resolutionForOntologyRow(rows[0]);
    },
    async searchCandidates(input: { query: string; limit: number }) {
      const normalizedQuery = normalizeLookup(input.query);
      const rows = await repository.search({ normalizedQuery, limit: input.limit });
      const candidates = new Map<string, { reference: OntologyReference; score: number }>();
      for (const row of rows) {
        const score = row.text === normalizedQuery ? 1 : 0.5;
        const existing = candidates.get(row.id);
        if (!existing || score > existing.score) candidates.set(row.id, { reference: { stableKey: row.stableKey }, score });
      }
      return [...candidates.values()].sort((left, right) => right.score - left.score || String(left.reference.stableKey).localeCompare(String(right.reference.stableKey))).slice(0, input.limit);
    },
    async loadState(input: { entityType: KnowledgeEntityType; canonicalId: string }) {
      if (input.entityType === "CONCEPT") {
        const row = await repository.findActiveConcept(input.canonicalId);
        return row ? { canonicalId: row.id, publication: "UNKNOWN" as const, access: "UNKNOWN" as const, mappingStatus: null, provenanceSourceType: "UNKNOWN" as const, revision: "UNKNOWN" as const } : null;
      }
      if (input.entityType === "LEARNING_CONTENT") {
        const row = await repository.findPublishedContent(input.canonicalId);
        return row ? { canonicalId: row.id, publication: "PUBLISHED" as const, access: "UNKNOWN" as const, mappingStatus: null, provenanceSourceType: "UNKNOWN" as const, revision: "UNKNOWN" as const } : null;
      }
      return null;
    },
  });
}

async function resolveCanonicalConcept(reference: OntologyReference): Promise<CanonicalResolution> {
  try {
    const { db } = await database();
    return createCanonicalOntologyAuthority(db).resolveConcept(reference);
  } catch { return { kind: "UNKNOWN" }; }
}

export function createCanonicalOntologyAuthority(db: CanonicalOntologyDatabase): KnowledgeAuthority {
  return createCanonicalOntologyAuthorityFromRepository({
    async findByIdOrKey(input) {
      const { ontologyConcepts } = await import("../../db/schema.ts");
      const selectConcept = { id: ontologyConcepts.id, conceptKey: ontologyConcepts.conceptKey, label: ontologyConcepts.label, normalizedLabel: ontologyConcepts.normalizedLabel, status: ontologyConcepts.status };
      const lookup = input.id ?? input.key;
      if (!lookup) return [];
      return db.select(selectConcept).from(ontologyConcepts).where(input.id ? eq(ontologyConcepts.id, lookup) : eq(ontologyConcepts.conceptKey, lookup)).limit(2) as Promise<CanonicalOntologyRow[]>;
    },
    async findByAlias(normalizedAlias) {
      const { ontologyAliases, ontologyConcepts } = await import("../../db/schema.ts");
      const selectConcept = { id: ontologyConcepts.id, conceptKey: ontologyConcepts.conceptKey, label: ontologyConcepts.label, normalizedLabel: ontologyConcepts.normalizedLabel, status: ontologyConcepts.status };
      return db.select(selectConcept).from(ontologyAliases).innerJoin(ontologyConcepts, eq(ontologyAliases.conceptId, ontologyConcepts.id)).where(eq(ontologyAliases.normalizedAlias, normalizedAlias)).limit(2) as Promise<CanonicalOntologyRow[]>;
    },
    async search({ normalizedQuery, limit }) {
      const { ontologyAliases, ontologyConcepts } = await import("../../db/schema.ts");
      const query = `%${normalizedQuery}%`;
      const [conceptRows, aliasRows] = await Promise.all([
        db.select({ id: ontologyConcepts.id, stableKey: ontologyConcepts.conceptKey, text: ontologyConcepts.normalizedLabel }).from(ontologyConcepts).where(and(eq(ontologyConcepts.status, "ACTIVE"), or(sql`${ontologyConcepts.normalizedLabel} LIKE ${query}`, sql`${ontologyConcepts.conceptKey} LIKE ${query}`))).orderBy(asc(ontologyConcepts.conceptKey)).limit(limit),
        db.select({ id: ontologyConcepts.id, stableKey: ontologyConcepts.conceptKey, text: ontologyAliases.normalizedAlias }).from(ontologyAliases).innerJoin(ontologyConcepts, eq(ontologyAliases.conceptId, ontologyConcepts.id)).where(and(eq(ontologyConcepts.status, "ACTIVE"), sql`${ontologyAliases.normalizedAlias} LIKE ${query}`)).orderBy(asc(ontologyConcepts.conceptKey)).limit(limit),
      ]);
      return [...conceptRows, ...aliasRows];
    },
    async findActiveConcept(id) {
      const { ontologyConcepts } = await import("../../db/schema.ts");
      const [row] = await db.select({ id: ontologyConcepts.id }).from(ontologyConcepts).where(and(eq(ontologyConcepts.id, id), eq(ontologyConcepts.status, "ACTIVE"))).limit(1);
      return row ?? null;
    },
    async findPublishedContent(id) {
      const { contents } = await import("../../db/schema.ts");
      const [row] = await db.select({ id: contents.id }).from(contents).where(and(eq(contents.id, id), eq(contents.status, "PUBLISHED"))).limit(1);
      return row ?? null;
    },
  });
}

async function searchCanonicalCandidates(input: { query: string; limit: number }) {
  try {
    const { db } = await database();
    return createCanonicalOntologyAuthority(db).searchCandidates(input);
  } catch { return []; }
}

async function loadCanonicalState(input: { entityType: KnowledgeEntityType; canonicalId: string }) {
  try {
    const { db } = await database();
    return createCanonicalOntologyAuthority(db).loadState(input);
  } catch { return null; }
}

export const canonicalOntologyAuthority: KnowledgeAuthority = Object.freeze({
  resolveConcept: async (reference) => resolveCanonicalConcept(reference),
  loadState: async (input) => loadCanonicalState(input),
  searchCandidates: async (input) => searchCanonicalCandidates(input),
});

function serverAuthority(): KnowledgeAuthority { return canonicalOntologyAuthority; }
const productionService = createKnowledgeQueryService(serverAuthority());
export function resolvePublicKnowledge(input: Parameters<typeof productionService.getPublicEntity>[0]): Promise<PublicKnowledgeResult> { return productionService.getPublicEntity(input); }
export function searchPublicKnowledge(input: Parameters<typeof productionService.search>[0]) { return productionService.search(input); }
