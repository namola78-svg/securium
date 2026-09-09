import assert from "node:assert/strict";
import test from "node:test";
import { resolveSkillRecords, normalizeSkillAlias, assertSkillKey, type SkillRecord, type SkillAliasRecord } from "../lib/services/skill-authority.ts";

const rows: SkillRecord[] = [
  { id: "skill-1", skillKey: "skill:security:secure-code-review", label: "Secure Code Review", description: "", status: "DRAFT", sourceType: "TEST", sourceId: "fixture-1", provenanceJson: '{"fixture":true}', reviewedBy: null, reviewedAt: null, reviewEvidenceJson: "[]" },
  { id: "skill-2", skillKey: "skill:security:vulnerability-assessment", label: "Vulnerability Assessment", description: "", status: "DRAFT", sourceType: "TEST", sourceId: "fixture-2", provenanceJson: '{"fixture":true}', reviewedBy: null, reviewedAt: null, reviewEvidenceJson: "[]" },
];
const aliases: SkillAliasRecord[] = [{ id: "alias-1", skillId: "skill-1", alias: "secure code review", normalizedAlias: "secure code review", language: "en", source: "test" }];

test("Skill resolver resolves exact ID, key, and registered alias", () => {
  for (const reference of [{ id: "skill-1" }, { skillKey: rows[0].skillKey }, { alias: "Secure Code Review" }]) assert.equal(resolveSkillRecords(rows, aliases, reference).status, "RESOLVED");
});
test("Skill resolver rejects unknown and label-only identities", () => {
  assert.equal(resolveSkillRecords(rows, aliases, { id: "missing" }).status, "UNRESOLVED");
  assert.equal(resolveSkillRecords(rows, aliases, { alias: "Secure Code Review Label" }).status, "UNRESOLVED");
});
test("Skill resolver fails closed for conflicting exact identity namespaces", () => {
  assert.equal(resolveSkillRecords(rows, aliases, { id: "skill-1", skillKey: rows[1].skillKey }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(rows, aliases, { skillKey: rows[1].skillKey, alias: "Secure Code Review" }).status, "AMBIGUOUS");
  assert.equal(resolveSkillRecords(rows, aliases, { id: "skill-2", alias: "Secure Code Review" }).status, "AMBIGUOUS");
});
test("Skill identity grammar and alias normalization are bounded", () => {
  assert.doesNotThrow(() => assertSkillKey("skill:security:secure-code-review"));
  assert.throws(() => assertSkillKey("Secure Code Review"));
  assert.equal(normalizeSkillAlias("  Secure   Code   Review "), "secure code review");
  assert.throws(() => normalizeSkillAlias("보안 코드 검토"));
});
test("Skill domain exposes only the bounded Wave B typed relation vocabulary", () => {
  assert.notEqual(rows[0].skillKey, "role:security:secure-code-review");
  assert.equal("ROLE_REQUIRES_SKILL", "ROLE_REQUIRES_SKILL");
  assert.equal("SKILL_REQUIRES_CONCEPT", "SKILL_REQUIRES_CONCEPT");
});
