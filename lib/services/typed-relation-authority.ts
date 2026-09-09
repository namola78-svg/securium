import { AppError } from "../errors.ts";

export const TYPED_RELATION_AUTHORITY_CONTRACT = Object.freeze({
  roleSkillStore: "role_skill_relations",
  skillConceptStore: "skill_concept_relations",
  roleSkillRelation: "ROLE_REQUIRES_SKILL",
  skillConceptRelation: "SKILL_REQUIRES_CONCEPT",
  direction: "ROLE -> SKILL -> CONCEPT",
  endpointAuthority: "occupational_roles / skills / ontology_concepts",
  canonicalWriter: "server-only typed relation repository",
  lifecycle: "DRAFT | ACTIVE | RETIRED",
  inversePolicy: "NONE_STORED; query direction is explicit",
  duplicatePolicy: "one canonical edge per endpoint pair and fixed relation type",
  provenance: "required for every relation",
  relationVersioning: "current governed row with positive relation_version; no inverse or append-only duplicate rows",
  readModel: "skillsForRole / conceptsForSkill / rolesForSkill / skillsForConcept; ACTIVE by default",
  deletionPolicy: "endpoint deletion restricted while governed relations exist; retire relation instead",
  learnerState: "not implemented in Wave B",
} as const);

export type TypedRelationLifecycle = "DRAFT" | "ACTIVE" | "RETIRED";

export function assertTypedRelationProvenance(value: string) {
  const normalized = value.trim();
  if (normalized.length <= 2) {
    throw new AppError("Typed relation provenance is required.", 400, "TYPED_RELATION_PROVENANCE_REQUIRED");
  }
  return normalized;
}

export function assertTypedRelationSourceType(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new AppError("Typed relation source type is required.", 400, "TYPED_RELATION_SOURCE_REQUIRED");
  }
  return normalized;
}

export function assertTypedRelationDraftStatus(status: string | undefined) {
  if (status && status !== "DRAFT") {
    throw new AppError("Wave B relation writers create DRAFT relations only.", 400, "TYPED_RELATION_DRAFT_ONLY");
  }
  return "DRAFT" as const;
}
