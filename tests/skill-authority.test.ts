import assert from "node:assert/strict";
import test from "node:test";
import { assertSkillKey, normalizeSkillAlias, resolveSkillRecords, type SkillAliasRecord, type SkillRecord } from "../lib/services/skill-authority.ts";

const skills: SkillRecord[] = [
  { id: "skill-1", skillKey: "skill:security:secure-code-review", label: "Secure Code Review", description: "", status: "DRAFT", sourceType: "TEST", sourceId: "fixture", provenanceJson: '{"fixture":true}', reviewedBy: null, reviewedAt: null, reviewEvidenceJson: "[]" },
  { id: "skill-2", skillKey: "skill:security:vulnerability-assessment", label: "Vulnerability Assessment", description: "", status: "DRAFT", sourceType: "TEST", sourceId: "fixture", provenanceJson: '{"fixture":true}', reviewedBy: null, reviewedAt: null, reviewEvidenceJson: "[]" },
];
const aliases: SkillAliasRecord[] = [{ id: "alias-1", skillId: "skill-1", alias: "secure code review", normalizedAlias: "secure code review", language: "en", source: "test" }];

test("Skill identity uses one canonical ID/key authority", () => {
  assert.doesNotThrow(() => assertSkillKey(skills[0].skillKey));
  assert.throws(() => assertSkillKey("Secure Code Review"));
  assert.equal(normalizeSkillAlias(" Secure   Code   Review "), "secure code review");
});

test("Skill resolver accepts ID, key, and registered alias", () => {
  for (const reference of [{ id: "skill-1" }, { skillKey: skills[0].skillKey }, { alias: "Secure Code Review" }]) {
    assert.equal(resolveSkillRecords(skills, aliases, reference).status, "RESOLVED");
  }
});

test("unknown, label-only, and conflicting Skill references fail closed", () => {
  assert.equal(resolveSkillRecords(skills, aliases, { id: "missing" }).status, "UNRESOLVED");
  assert.equal(resolveSkillRecords(skills, aliases, { alias: "Secure Code Review Label" }).status, "UNRESOLVED");
  assert.equal(resolveSkillRecords(skills, aliases, { id: "skill-1", skillKey: skills[1].skillKey }).status, "AMBIGUOUS");
});

test("multiple Skill identities must agree on one canonical Skill", () => {
  const skillOneAlias = "secure code review";
  const skillTwoAlias = "vulnerability assessment";
  const allMatching = { id: "skill-1", skillKey: skills[0].skillKey, alias: skillOneAlias };
  const allAliases = [...aliases, { id: "alias-2", skillId: "skill-2", alias: skillTwoAlias, normalizedAlias: skillTwoAlias, language: "en", source: "test" }];

  assert.equal(resolveSkillRecords(skills, allAliases, allMatching).status, "RESOLVED");
  assert.equal(resolveSkillRecords(skills, aliases, { id: "skill-1", skillKey: skills[1].skillKey }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(skills, allAliases, { skillKey: skills[0].skillKey, alias: skillTwoAlias }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(skills, allAliases, { id: "skill-1", alias: skillTwoAlias }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(skills, allAliases, { id: "skill-1", skillKey: skills[0].skillKey, alias: skillTwoAlias }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(skills, aliases, { id: "skill-1", skillKey: "skill:security:missing" }).status, "UNRESOLVED");
});

test("ambiguous normalized aliases fail closed", () => {
  const duplicateAlias: SkillAliasRecord = { id: "alias-2", skillId: "skill-2", alias: "secure code review", normalizedAlias: "secure code review", language: "en", source: "test" };
  const result = resolveSkillRecords(skills, [...aliases, duplicateAlias], { alias: "Secure   Code Review" });
  assert.equal(result.status, "AMBIGUOUS");
  if (result.status === "AMBIGUOUS") assert.deepEqual(result.candidateIds, ["skill-1", "skill-2"]);
});

test("invalid aliases fail closed during resolution", () => {
  assert.equal(resolveSkillRecords(skills, aliases, { alias: "secure\u0000code" }).status, "UNRESOLVED");
});
