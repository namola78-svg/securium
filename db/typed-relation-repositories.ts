import "server-only";
import { and, eq } from "drizzle-orm";
import { occupationalRoles, ontologyConcepts, roleSkillRelations, skillConceptRelations, skills } from "./schema";
import { getDb } from "./index";
import {
  assertTypedRelationDraftStatus,
  assertTypedRelationProvenance,
  assertTypedRelationSourceType,
  type TypedRelationLifecycle,
} from "../lib/services/typed-relation-authority.ts";

type RelationInput = {
  id: string;
  sourceType?: string;
  sourceId?: string;
  provenanceJson: string;
  status?: "DRAFT";
};

export type RelationReadStatus = TypedRelationLifecycle | "ALL";

function statusPredicate(column: typeof roleSkillRelations.status | typeof skillConceptRelations.status, status: RelationReadStatus) {
  return status === "ALL" ? undefined : eq(column, status);
}

/** Canonical read model: only the requested directed edge family is traversed. */
export async function skillsForRole(roleId: string, status: RelationReadStatus = "ACTIVE") {
  return getDb()
    .select({ skill: skills, relation: roleSkillRelations })
    .from(roleSkillRelations)
    .innerJoin(skills, eq(skills.id, roleSkillRelations.skillId))
    .where(and(eq(roleSkillRelations.roleId, roleId), statusPredicate(roleSkillRelations.status, status)));
}

export async function conceptsForSkill(skillId: string, status: RelationReadStatus = "ACTIVE") {
  return getDb()
    .select({ concept: ontologyConcepts, relation: skillConceptRelations })
    .from(skillConceptRelations)
    .innerJoin(ontologyConcepts, eq(ontologyConcepts.id, skillConceptRelations.conceptId))
    .where(and(eq(skillConceptRelations.skillId, skillId), statusPredicate(skillConceptRelations.status, status)));
}

export async function rolesForSkill(skillId: string, status: RelationReadStatus = "ACTIVE") {
  return getDb()
    .select({ role: occupationalRoles, relation: roleSkillRelations })
    .from(roleSkillRelations)
    .innerJoin(occupationalRoles, eq(occupationalRoles.id, roleSkillRelations.roleId))
    .where(and(eq(roleSkillRelations.skillId, skillId), statusPredicate(roleSkillRelations.status, status)));
}

export async function skillsForConcept(conceptId: string, status: RelationReadStatus = "ACTIVE") {
  return getDb()
    .select({ skill: skills, relation: skillConceptRelations })
    .from(skillConceptRelations)
    .innerJoin(skills, eq(skills.id, skillConceptRelations.skillId))
    .where(and(eq(skillConceptRelations.conceptId, conceptId), statusPredicate(skillConceptRelations.status, status)));
}

/** Create the only supported Role -> Skill edge type as an unpublished DRAFT. */
export async function createRoleRequiresSkillDraft(input: RelationInput & { roleId: string; skillId: string }) {
  const [row] = await getDb()
    .insert(roleSkillRelations)
    .values({
      id: input.id,
      roleId: input.roleId,
      skillId: input.skillId,
      relationType: "ROLE_REQUIRES_SKILL",
      status: assertTypedRelationDraftStatus(input.status),
      sourceType: assertTypedRelationSourceType(input.sourceType ?? "SECURIUM_AUTHORED"),
      sourceId: input.sourceId?.trim() || null,
      provenanceJson: assertTypedRelationProvenance(input.provenanceJson),
      reviewEvidenceJson: "[]",
    })
    .returning();
  return row;
}

/** Create the only supported Skill -> Concept edge type as an unpublished DRAFT. */
export async function createSkillRequiresConceptDraft(input: RelationInput & { skillId: string; conceptId: string }) {
  const [row] = await getDb()
    .insert(skillConceptRelations)
    .values({
      id: input.id,
      skillId: input.skillId,
      conceptId: input.conceptId,
      relationType: "SKILL_REQUIRES_CONCEPT",
      status: assertTypedRelationDraftStatus(input.status),
      sourceType: assertTypedRelationSourceType(input.sourceType ?? "SECURIUM_AUTHORED"),
      sourceId: input.sourceId?.trim() || null,
      provenanceJson: assertTypedRelationProvenance(input.provenanceJson),
      reviewEvidenceJson: "[]",
    })
    .returning();
  return row;
}
