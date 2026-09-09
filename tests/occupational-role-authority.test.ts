import assert from "node:assert/strict";
import test from "node:test";
import {
  OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT,
  assertOccupationalRoleAlias,
  assertOccupationalRoleKey,
  resolveOccupationalRoleRecords,
} from "../lib/services/occupational-role-authority.ts";

const appSec = { id: "role-1", roleKey: "role:security:appsec-engineer", label: "Application Security Engineer", status: "ACTIVE" };
const soc = { id: "role-2", roleKey: "role:security:soc-analyst", label: "SOC Analyst", status: "ACTIVE" };
const aliases = [{ roleId: "role-1", alias: "application security engineer" }];

test("occupational Role is separate from RBAC and has one canonical authority", () => {
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.canonicalStore, "occupational_roles");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.rbacBoundary, "AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE");
  assert.equal(OCCUPATIONAL_ROLE_AUTHORITY_CONTRACT.conceptAuthority, "ontology_concepts / ontology_aliases");
});

test("Role key and alias identity are bounded", () => {
  assert.equal(assertOccupationalRoleKey(appSec.roleKey), appSec.roleKey);
  assert.equal(assertOccupationalRoleAlias("  Application  Security Engineer "), "application security engineer");
  assert.throws(() => assertOccupationalRoleKey("role:Security:bad"));
  assert.throws(() => assertOccupationalRoleAlias("蹂댁븞 遺꾩꽍媛"));
});

test("Role resolver accepts exact ID, key, and registered alias", () => {
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: appSec.id }, roles: [appSec, soc] }).kind, "RESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { roleKey: appSec.roleKey }, roles: [appSec, soc] }).role?.id, appSec.id);
  assert.equal(resolveOccupationalRoleRecords({ reference: { alias: "Application Security Engineer" }, roles: [appSec, soc], aliases }).role?.id, appSec.id);
});

test("unknown, label-only, and ambiguous Role references fail closed", () => {
  assert.equal(resolveOccupationalRoleRecords({ reference: { id: "missing" }, roles: [appSec, soc] }).kind, "UNRESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { label: appSec.label }, roles: [appSec, soc] }).kind, "UNRESOLVED");
  assert.equal(resolveOccupationalRoleRecords({ reference: { alias: "shared" }, roles: [appSec, soc], aliases: [{ roleId: appSec.id, alias: "shared" }, { roleId: soc.id, alias: "shared" }] }).kind, "AMBIGUOUS");
});
