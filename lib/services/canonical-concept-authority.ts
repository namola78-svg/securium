/**
 * Single Concept authority contract.
 *
 * `ontology_concepts` remains canonical in this repository because the
 * question, content, fact, evidence, and ontology runtime paths reference
 * its IDs. CP-A is intentionally staging/compatibility-only until a future
 * separately authorized migration can rebind those references.
 */
export const CONCEPT_AUTHORITY_CONTRACT = Object.freeze({
  canonicalStore: "ontology_concepts",
  canonicalId: "ontology_concepts.id",
  semanticIdentity: "ontology_concepts.concept_key",
  preferredLabel: "ontology_concepts.label",
  lifecycle: "ontology_concepts.status",
  aliases: "ontology_aliases",
  cpaStoreRole: "STAGING_COMPATIBILITY_ALIAS_SOURCE",
  relationAuthority: "SPECIALIZED_MAPPING_FAMILIES_AND_ONTOLOGY_EDGES_BY_SCOPE",
  inverseStrategy: "STORED_LEGACY_COMPATIBILITY_INVERSE_UNCHANGED",
  unknownResolution: "FAIL_CLOSED",
} as const);

export const RELATION_AUTHORITY_CONTRACT = Object.freeze({
  ontologyEdges: "CANONICAL_FOR_GENERIC_ONTOLOGY_RELATIONS",
  questionConcepts: "CANONICAL_FOR_QUESTION_CONCEPT_MAPPING",
  contentRevisionConcepts: "CANONICAL_FOR_CONTENT_REVISION_CONCEPT_MAPPING",
  factConceptBindings: "CANONICAL_FOR_FACT_CONCEPT_MAPPING",
  evidenceProjections: "CANONICAL_FOR_PERSONAL_EVIDENCE_PROJECTION",
  coreConceptsMetadata: "AUTHORING_HINT_ONLY",
  cpaRelations: "NONE",
  duplicateWritePolicy: "ONE_CANONICAL_FAMILY_PER_EDGE_SEMANTIC",
  direction: "STORED_DIRECTED_EDGE",
} as const);

export type CanonicalConceptLifecycle = "ACTIVE" | "DEPRECATED" | "SUPERSEDED" | "UNKNOWN";

export type CanonicalConcept = {
  id: string;
  stableKey: string;
  lifecycle: CanonicalConceptLifecycle;
  label?: string;
  versionId?: string;
  version?: number;
  labels?: Array<{ normalizedLabel: string; label?: string; status?: string }>;
};

export type CanonicalConceptReference = {
  id?: string;
  key?: string;
  stableKey?: string;
  alias?: string;
};

export type CanonicalConceptResolutionKind =
  | "RESOLVED"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "UNRESOLVED_LEGACY_REFERENCE"
  | "DEPRECATED"
  | "SUPERSEDED"
  | "UNKNOWN";

export type CanonicalConceptResolution = {
  kind: CanonicalConceptResolutionKind;
  concept?: CanonicalConcept;
  candidates?: CanonicalConcept[];
  compatibilityPath?: "CANONICAL" | "CPA_STAGING_TO_CANONICAL";
};

export type CanonicalConceptRecord = {
  id: string;
  stableKey: string;
  label?: string;
  normalizedLabel?: string;
  status: string;
  aliases?: string[];
  labels?: Array<{ normalizedLabel: string; label?: string; status?: string }>;
  versionId?: string;
  version?: number;
};

export type StagingConceptRecord = {
  id: string;
  stableKey: string;
  status: string;
  aliases?: string[];
  labels?: Array<{ normalizedLabel: string; label?: string; status?: string }>;
};

export function normalizeConceptLookup(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function conceptLifecycle(status: string): CanonicalConceptLifecycle {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "ARCHIVED" || status === "RETIRED") return "DEPRECATED";
  if (status === "SUPERSEDED") return "SUPERSEDED";
  return "UNKNOWN";
}

export function toCanonicalConcept(record: CanonicalConceptRecord): CanonicalConcept {
  return {
    id: record.id,
    stableKey: record.stableKey,
    lifecycle: conceptLifecycle(record.status),
    label: record.label,
    versionId: record.versionId,
    version: record.version,
    labels: record.labels,
  };
}

/**
 * Resolve only exact canonical identity or an unambiguous exact alias.
 * Staging/CP-A records may bridge to the canonical store by exact stableKey
 * only. Labels never create a new canonical identity and fuzzy matches are
 * intentionally unsupported.
 */
export function resolveCanonicalConceptRecords(input: {
  reference: CanonicalConceptReference;
  canonical: readonly CanonicalConceptRecord[];
  staging?: readonly StagingConceptRecord[];
}): CanonicalConceptResolution {
  const canonical = input.canonical;
  const staging = input.staging ?? [];
  const direct = directCanonicalCandidates(input.reference, canonical);
  if (direct.length) return finalizeCandidates(direct, "CANONICAL");

  const stagingStableKeys = stagingStableKeysForReference(input.reference, staging);
  if (stagingStableKeys.length) {
    const bridged = canonical.filter((record) => stagingStableKeys.includes(record.stableKey)).map(toCanonicalConcept);
    if (bridged.length) return finalizeCandidates(bridged, "CPA_STAGING_TO_CANONICAL");
    return { kind: "UNRESOLVED_LEGACY_REFERENCE" };
  }

  const aliasCandidates = aliasCanonicalCandidates(input.reference.alias, canonical);
  const stagingAliasKeys = stagingStableKeysForReference(input.reference, staging);
  const bridgedAliasCandidates = canonical.filter((record) => stagingAliasKeys.includes(record.stableKey)).map(toCanonicalConcept);
  const combined = uniqueById([...aliasCandidates, ...bridgedAliasCandidates]);
  if (combined.length) return finalizeCandidates(combined, combined.some((item) => bridgedAliasCandidates.includes(item)) ? "CPA_STAGING_TO_CANONICAL" : "CANONICAL");

  if (input.reference.id || input.reference.key || input.reference.stableKey) {
    return { kind: "UNRESOLVED_LEGACY_REFERENCE" };
  }
  return { kind: "NOT_FOUND" };
}

function directCanonicalCandidates(reference: CanonicalConceptReference, records: readonly CanonicalConceptRecord[]) {
  if (reference.id) return records.filter((record) => record.id === reference.id).map(toCanonicalConcept);
  const stableKey = reference.stableKey ?? reference.key;
  if (stableKey) return records.filter((record) => record.stableKey === stableKey).map(toCanonicalConcept);
  return [];
}

function stagingStableKeysForReference(reference: CanonicalConceptReference, records: readonly StagingConceptRecord[]) {
  const exact = reference.id
    ? records.filter((record) => record.id === reference.id)
    : (reference.stableKey ?? reference.key)
      ? records.filter((record) => record.stableKey === (reference.stableKey ?? reference.key))
      : [];
  const alias = reference.alias ? aliasStagingRecords(reference.alias, records) : [];
  return [...new Set([...exact, ...alias].map((record) => record.stableKey))];
}

function aliasCanonicalCandidates(alias: string | undefined, records: readonly CanonicalConceptRecord[]) {
  if (!alias) return [];
  const normalized = normalizeConceptLookup(alias);
  return records
    .filter((record) => {
      const labels = [record.normalizedLabel, ...(record.aliases ?? []), ...(record.labels ?? []).map((label) => label.normalizedLabel)].filter((label): label is string => Boolean(label));
      return labels.some((label) => normalizeConceptLookup(label) === normalized);
    })
    .map(toCanonicalConcept);
}

function aliasStagingRecords(alias: string, records: readonly StagingConceptRecord[]) {
  const normalized = normalizeConceptLookup(alias);
  return records.filter((record) => {
    const labels = [...(record.aliases ?? []), ...(record.labels ?? []).map((label) => label.normalizedLabel)];
    return labels.some((label) => normalizeConceptLookup(label) === normalized);
  });
}

function finalizeCandidates(candidates: CanonicalConcept[], compatibilityPath: "CANONICAL" | "CPA_STAGING_TO_CANONICAL"): CanonicalConceptResolution {
  const unique = uniqueById(candidates);
  if (unique.length > 1) return { kind: "AMBIGUOUS", candidates: unique, compatibilityPath };
  const concept = unique[0];
  if (!concept) return { kind: "NOT_FOUND" };
  if (concept.lifecycle === "DEPRECATED") return { kind: "DEPRECATED", concept, compatibilityPath };
  if (concept.lifecycle === "UNKNOWN") return { kind: "UNKNOWN", concept, compatibilityPath };
  return { kind: "RESOLVED", concept, compatibilityPath };
}

function uniqueById(concepts: CanonicalConcept[]) {
  return [...new Map(concepts.map((concept) => [concept.id, concept])).values()];
}
