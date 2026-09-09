import assert from "node:assert/strict";
import test from "node:test";
import { TYPED_RELATION_AUTHORITY_CONTRACT, assertTypedRelationDraftStatus, assertTypedRelationProvenance, assertTypedRelationSourceType } from "../lib/services/typed-relation-authority.ts";

const hasCode = (code: string) => (error: unknown): error is { code: string } => typeof error === "object" && error !== null && "code" in error && error.code === code;

test("Wave B has one directed typed relation authority and no learner state", () => {
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.roleSkillStore, "role_skill_relations");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.skillConceptStore, "skill_concept_relations");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.direction, "ROLE -> SKILL -> CONCEPT");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.inversePolicy, "NONE_STORED; query direction is explicit");
  assert.equal(TYPED_RELATION_AUTHORITY_CONTRACT.learnerState, "not implemented in Wave B");
});

test("typed relation writers require provenance and create DRAFT only", () => {
  assert.equal(assertTypedRelationSourceType(" REVIEW_IMPORT "), "REVIEW_IMPORT");
  assert.equal(assertTypedRelationProvenance('{"review":"current-main"}'), '{"review":"current-main"}');
  assert.equal(assertTypedRelationDraftStatus(undefined), "DRAFT");
  assert.throws(() => assertTypedRelationSourceType(" "), hasCode("TYPED_RELATION_SOURCE_REQUIRED"));
  assert.throws(() => assertTypedRelationProvenance("{}"), hasCode("TYPED_RELATION_PROVENANCE_REQUIRED"));
  assert.throws(() => assertTypedRelationDraftStatus("ACTIVE"), hasCode("TYPED_RELATION_DRAFT_ONLY"));
});
