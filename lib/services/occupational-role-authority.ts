import { AppError } from "../errors.ts";

export const OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT = Object.freeze({
  canonicalStore: "occupational_roles",
  canonicalId: "occupational_roles.id",
  semanticIdentity: "occupational_roles.role_key",
  preferredLabel: "occupational_roles.label",
  aliases: "occupational_role_aliases",
  lifecycle: "DRAFT | ACTIVE | RETIRED",
  activeReviewRequirement: "reviewedBy + reviewedAt + reviewEvidenceJson",
  rbacBoundary: "AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE",
  courseBoundary: "OCCUPATIONAL_ROLE != COURSE",
  certificationBoundary: "OCCUPATIONAL_ROLE != CERTIFICATION",
  conceptAuthority: "ontology_concepts / ontology_aliases",
  skillStatus: "CANONICAL_SKILL_FOUNDATION_WAVE_A",
  roleRelationAuthority: "role_skill_relations",
} as const);

export const OCCUPATIONAL_ROLE_RELATION_CONTRACT = Object.freeze({
  roleToSkill: "ROLE_REQUIRES_SKILL",
  roleToConcept: "NOT_DIRECT; traverse ROLE_REQUIRES_SKILL then SKILL_REQUIRES_CONCEPT",
  skillToConcept: "SKILL_REQUIRES_CONCEPT",
  roleHierarchy: "NOT_IMPLEMENTED",
  authority: "role_skill_relations / skill_concept_relations",
  futureAuthority: "BOUNDED_TYPED_RELATIONS_WAVE_B",
} as const);

export const OCCUPATIONAL_ROLE_KEY_MAX_LENGTH = 255;
export const OCCUPATIONAL_ROLE_ALIAS_MAX_LENGTH = 300;

export type OccupationalRoleLifecycle = "ACTIVE" | "DEPRECATED" | "UNKNOWN";

export type OccupationalRoleReference = {
  id?: string;
  roleKey?: string;
  alias?: string;
  label?: string;
};

export type OccupationalRoleRecord = {
  id: string;
  roleKey: string;
  label: string;
  description?: string;
  status: string;
  sourceType?: string;
  sourceId?: string;
  provenanceJson?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewEvidenceJson?: string;
  aliases?: string[];
};

export type OccupationalRoleAliasRecord = {
  roleId: string;
  alias: string;
  normalizedAlias?: string;
  status?: string;
};

export type OccupationalRole = {
  id: string;
  roleKey: string;
  label: string;
  description?: string;
  lifecycle: OccupationalRoleLifecycle;
  sourceType?: string;
  sourceId?: string;
  provenanceJson?: string;
  aliases?: string[];
};

export type OccupationalRoleResolution = {
  kind: "RESOLVED" | "DEPRECATED" | "AMBIGUOUS" | "UNRESOLVED" | "UNKNOWN";
  role?: OccupationalRole;
  candidates?: OccupationalRole[];
};

export function normalizeOccupationalRoleLookup(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function assertOccupationalRoleKey(roleKey: string) {
  const normalized = roleKey.trim();
  if (
    normalized.length > OCCUPATIONAL_ROLE_KEY_MAX_LENGTH ||
    !/^role:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/.test(normalized)
  ) {
    throw new AppError(
      "Occupational Role key must use role:<namespace>:<identity> format.",
      400,
      "OCCUPATIONAL_ROLE_KEY_INVALID",
    );
  }
  return normalized;
}

export function assertOccupationalRoleLabel(label: string) {
  const normalized = label.normalize("NFKC").trim();
  if (!normalized) {
    throw new AppError("Occupational Role label is required.", 400, "OCCUPATIONAL_ROLE_LABEL_REQUIRED");
  }
  return normalized;
}

export function assertOccupationalRoleAlias(alias: string) {
  const normalized = normalizeOccupationalRoleLookup(alias);
  if (
    !normalized ||
    normalized.length > OCCUPATIONAL_ROLE_ALIAS_MAX_LENGTH ||
    !/^[\x20-\x7E]+$/.test(normalized)
  ) {
    throw new AppError(
      "Occupational Role alias must normalize to printable ASCII text.",
      400,
      "OCCUPATIONAL_ROLE_ALIAS_INVALID",
    );
  }
  return normalized;
}

export function roleLifecycle(status: string): OccupationalRoleLifecycle {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "RETIRED") return "DEPRECATED";
  return "UNKNOWN";
}

export function toOccupationalRole(record: OccupationalRoleRecord): OccupationalRole {
  return {
    id: record.id,
    roleKey: record.roleKey,
    label: record.label,
    description: record.description,
    lifecycle: roleLifecycle(record.status),
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    provenanceJson: record.provenanceJson,
    aliases: record.aliases,
  };
}

export function resolveOccupationalRoleRecords(input: {
  reference: OccupationalRoleReference;
  roles: readonly OccupationalRoleRecord[];
  aliases?: readonly OccupationalRoleAliasRecord[];
}): OccupationalRoleResolution {
  const roles = input.roles;
  const matches: OccupationalRole[][] = [];

  if (input.reference.id) {
    matches.push(roles.filter((record) => record.id === input.reference.id).map(toOccupationalRole));
  }

  if (input.reference.roleKey) {
    matches.push(roles.filter((record) => record.roleKey === input.reference.roleKey).map(toOccupationalRole));
  }

  if (input.reference.alias) {
    const normalized = normalizeOccupationalRoleLookup(input.reference.alias);
    const aliases = input.aliases ?? [];
    const roleIds = new Set(
      aliases
        .filter((alias) => normalizeOccupationalRoleLookup(alias.alias) === normalized)
        .map((alias) => alias.roleId),
    );
    matches.push(roles.filter((role) => roleIds.has(role.id)).map(toOccupationalRole));
  }

  if (!matches.length || matches.some((candidateSet) => candidateSet.length === 0)) {
    return { kind: "UNRESOLVED" };
  }

  return finalize(matches.flat());
}

function finalize(candidates: OccupationalRole[]) {
  const unique = [...new Map(candidates.map((role) => [role.id, role])).values()].sort((left, right) => left.id.localeCompare(right.id));
  if (unique.length > 1) return { kind: "AMBIGUOUS" as const, candidates: unique };
  const role = unique[0];
  if (!role) return { kind: "UNRESOLVED" as const };
  if (role.lifecycle === "DEPRECATED") return { kind: "DEPRECATED" as const, role };
  if (role.lifecycle === "UNKNOWN") return { kind: "UNKNOWN" as const, role };
  return { kind: "RESOLVED" as const, role };
}
