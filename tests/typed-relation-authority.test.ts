import assert from "node:assert/strict";
import test from "node:test";
import {
  TYPED_RELATION_AUTHORITY_CONTRACT,
  assertTypedRelationDraftStatus,
  assertTypedRelationProvenance,
  assertTypedRelationSourceType,
} from "../lib/services/typed-relation-authority.ts";

test("Wave B has one bounded directed Role-Skill-Concept authority", () => {
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.roleSkillStore, "role_skill_relations");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.skillConceptStore, "skill_concept_relations");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.roleSkillRelation, "ROLE_REQUIRES_SKILL");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.skillConceptRelation, "SKILL_REQUIRES_CONCEPT");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.direction, "ROLE -> SKILL -> CONCEPT");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.inversePolicy, "NONE_STORED; query direction is explicit");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.relationVersioning, "current governed row with positive relation_version; no inverse or append-only duplicate rows");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.readModel, "skillsForRole / conceptsForSkill / rolesForSkill / skillsForConcept; ACTIVE by default");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.deletionPolicy, "endpoint deletion restricted while governed relations exist; retire relation instead");
});

test("typed relation writers require provenance and are DRAFT-only", () => {
  assert.equal(assertTypedRelationSourceType("  REVIEW_IMPORT "), "REVIEW_IMPORT");
  assert.equal(assertTypedRelationProvenance('{"review":"wave-b"}'), '{"review":"wave-b"}');
  assert.equal(assertTypedRelationDraftStatus(undefined), "DRAFT");
  const hasCode = (code: string) => (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === code;
  assert.throws(() => assertTypedRelationSourceType("   "), hasCode("TYPED_RELATION_SOURCE_REQUIRED"));
  assert.throws(() => assertTypedRelationProvenance("{}"), hasCode("TYPED_RELATION_PROVENANCE_REQUIRED"));
  assert.throws(() => assertTypedRelationDraftStatus("ACTIVE"), hasCode("TYPED_RELATION_DRAFT_ONLY"));
});
