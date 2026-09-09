import assert from "node:assert/strict";
import test from "node:test";
import {
  OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT,
  OCCUPATIONAL_ROLE_RELATION_CONTRACT,
  assertOccupationalRoleAlias,
  assertOccupationalRoleKey,
  resolveOccupationalRoleRecords,
} from "../lib/services/occupational-role-authority.ts";

const appSec = {
  id: "role-id-appsec",
  roleKey: "role:security:appsec-engineer",
  label: "Application Security Engineer",
  status: "ACTIVE",
};
const soc = {
  id: "role-id-soc",
  roleKey: "role:security:soc-analyst",
  label: "SOC Analyst",
  status: "ACTIVE",
};
const draft = {
  id: "role-id-draft",
  roleKey: "role:security:draft-role",
  label: "Draft Role",
  status: "DRAFT",
};
const retired = {
  id: "role-id-retired",
  roleKey: "role:security:retired-role",
  label: "Retired Role",
  status: "RETIRED",
};
const aliases = [
  { roleId: appSec.id, alias: "application security engineer" },
  { roleId: soc.id, alias: "security operations analyst" },
];

test("the behavioral suite exercises the one canonical Role boundary", () => {
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.canonicalStore, "occupational_roles");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.canonicalId, "occupational_roles.id");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.semanticIdentity, "occupational_roles.role_key");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.rbacBoundary, "AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.conceptAuthority, "ontology_concepts / ontology_aliases");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.skillStatus, "CANONICAL_SKILL_FOUNDATION_WAVE_A");
  assert.equal(OCCUPATIONAL_ROLE_RELATION_CONTRACT.roleToSkill, "ROLE_REQUIRES_SKILL");
  assert.equal(OCCUPATIONAL_ROLE_RELATION_CONTRACT.skillToConcept, "SKILL_REQUIRES_CONCEPT");
});

test("canonical Role key and alias writers validate bounded identity", () => {
  assert.equal(assertOccupationalRoleKey("role:security:appsec-engineer"), "role:security:appsec-engineer");
  assert.equal(assertOccupationalRoleAlias("  Application  Security Engineer "), "application security engineer");
  assert.equal(
    assertOccupationalRoleAlias(`Ａpplication${String.fromCodePoint(0xa0)}Security Engineer`),
    "application security engineer",
  );
  assert.throws(() => assertOccupationalRoleAlias("보안 분석가"), /OCCUPATIONAL_ROLE_ALIAS_INVALID|printable ASCII/);
  for (const value of [
    "security:appsec-engineer",
    "role::appsec-engineer",
    "role:security:",
    "role:Security:appsec-engineer",
    "role:security:appsec engineer",
    "role:security:appsec/engineer",
    "role:security:appsec:engineer",
    `role:security:${"x".repeat(250)}`,
  ]) {
    assert.throws(() => assertOccupationalRoleKey(value), /OCCUPATIONAL_ROLE_KEY_INVALID|format/);
  }
  assert.throws(
    () => assertOccupationalRoleAlias("   "),
    (error) => typeof error === "object" && error !== null && "code" in error && error.code === "OCCUPATIONAL_ROLE_ALIAS_INVALID",
  );
});

test("exact canonical ID, role_key, and registered alias resolve", () => {
  const roles = [appSec, soc];
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: appSec.id }, roles }).kind, "RESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { roleKey: appSec.roleKey }, roles }).role?.id, appSec.id);
  assert.equal(resolveOccupationalRoleRecords({ reference: { alias: "Application Security Engineer" }, roles, aliases }).role?.id, appSec.id);
});

test("ID and role_key for the same Role may resolve, while different Roles fail closed", () => {
  const same = resolveOccupationalRoleRecords({
    reference: { id: appSec.id, roleKey: appSec.roleKey },
    roles: [appSec, soc],
  });
  assert.equal(same.kind, "RESOLVED");
  assert.equal(same.role?.id, appSec.id);

  const conflict = resolveOccupationalRoleRecords({
    reference: { id: appSec.id, roleKey: soc.roleKey },
    roles: [appSec, soc],
  });
  assert.equal(conflict.kind, "AMBIGUOUS");
  assert.deepEqual(conflict.candidates?.map((role) => role.id), [appSec.id, soc.id]);
});

test("ID/alias and role_key/alias conflicts fail closed", () => {
  const idAlias = resolveOccupationalRoleRecords({
    reference: { id: appSec.id, alias: "security operations analyst" },
    roles: [appSec, soc],
    aliases,
  });
  assert.equal(idAlias.kind, "AMBIGUOUS");

  const keyAlias = resolveOccupationalRoleRecords({
    reference: { roleKey: appSec.roleKey, alias: "security operations analyst" },
    roles: [appSec, soc],
    aliases,
  });
  assert.equal(keyAlias.kind, "AMBIGUOUS");
});

test("ambiguous aliases, unknown identities, and label-only input fail closed", () => {
  const roles = [appSec, soc];
  const ambiguous = resolveOccupationalRoleRecords({
    reference: { alias: "shared alias" },
    roles: [appSec, soc],
    aliases: [
      { roleId: appSec.id, alias: "shared alias" },
      { roleId: soc.id, alias: "shared alias" },
    ],
  });
  assert.equal(ambiguous.kind, "AMBIGUOUS");
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: "unknown" }, roles }).kind, "UNRESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { alias: "unknown alias" }, roles, aliases }).kind, "UNRESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { label: appSec.label }, roles }).kind, "UNRESOLVED");
});

test("alias collision with a canonical key is not a priority shortcut", () => {
  const result = resolveOccupationalRoleRecords({
    reference: { roleKey: appSec.roleKey, alias: soc.roleKey },
    roles: [appSec, soc],
    aliases: [{ roleId: soc.id, alias: soc.roleKey }],
  });
  assert.equal(result.kind, "AMBIGUOUS");
});

test("resolver candidate ordering is deterministic and lifecycle remains bounded", () => {
  const first = resolveOccupationalRoleRecords({
    reference: { alias: "shared alias" },
    roles: [soc, appSec],
    aliases: [
      { roleId: soc.id, alias: "shared alias" },
      { roleId: appSec.id, alias: "shared alias" },
    ],
  });
  const second = resolveOccupationalRoleRecords({
    reference: { alias: "shared alias" },
    roles: [appSec, soc],
    aliases: [
      { roleId: appSec.id, alias: "shared alias" },
      { roleId: soc.id, alias: "shared alias" },
    ],
  });
  assert.deepEqual(first, second);
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: draft.id }, roles: [draft] }).kind, "UNKNOWN");
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: retired.id }, roles: [retired] }).kind, "DEPRECATED");
});

test("missing second authoritative field does not fall back to a priority match", () => {
  const result = resolveOccupationalRoleRecords({
    reference: { id: appSec.id, roleKey: "role:security:unknown" },
    roles: [appSec, soc],
  });
  assert.equal(result.kind, "UNRESOLVED");
});
