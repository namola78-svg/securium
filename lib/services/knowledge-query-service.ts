/** Public contract: trust-bearing composition is server-owned. */
export {
  canonicalIdFromPublicKnowledgeId,
  publicKnowledgeId,
  type CanonicalConcept,
  type CanonicalResolution,
  type ConceptLifecycle,
  type EligibilityResult,
  type FreshnessClass,
  type KnowledgeEntityType,
  type MappingStatus,
  type OntologyReference,
  type ProvenanceSourceType,
  type PublicKnowledgeProjection,
  type PublicKnowledgeResult,
  type ResolutionKind,
} from "./server-knowledge-query-service.ts";

export { resolvePublicKnowledge, searchPublicKnowledge } from "./server-knowledge-query-service.ts";
