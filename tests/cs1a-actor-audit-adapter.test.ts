import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  assertCs1aGovernanceActor,
  CS1A_GOVERNANCE_AUDIT_ACTION,
  CS1A_GOVERNANCE_ACTOR_ROLES,
  validateCs1aGovernanceAuditEvent,
} from "../lib/policy/cs1a-actor-audit.ts";

const actor = { id: "user-1", roles: ["CONTENT_REVIEWER"] } as const;
const expected = {
  resourceType: "CONTENT_REVISION", resourceId: "content-1", resourceRevisionId: "revision-1",
  revisionHash: "a".repeat(64), policyVersion: "CS1A_POLICY_V1", sourceSetHash: "b".repeat(64),
  humanDecisionHash: "c".repeat(64), decision: "ALLOW_CANONICAL", reasonCode: "AUTHORIZED_PROSPECTIVE_ORIGINAL",
  rightsDisposition: "ORIGINAL_INTERNAL", currentnessDisposition: "CURRENT",
  contentClass: "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED", publicationAuthority: "NOT_GRANTED",
} as const;

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-1", actorUserId: actor.id, action: CS1A_GOVERNANCE_AUDIT_ACTION,
    resourceType: expected.resourceType, resourceId: expected.resourceId, result: "SUCCESS",
    metadata: { ...expected }, ...overrides,
  };
}

test("authorization matrix is fail-closed and least privilege", () => {
  assert.throws(() => assertCs1aGovernanceActor(null), /Authentication/);
  for (const role of ["USER", "CONTENT_EDITOR", "COURSE_MANAGER"]) {
    assert.throws(() => assertCs1aGovernanceActor({ id: "u", roles: [role] }), /authorization/);
  }
  for (const role of CS1A_GOVERNANCE_ACTOR_ROLES) {
    assert.doesNotThrow(() => assertCs1aGovernanceActor({ id: "u", roles: [role] }));
  }
});

test("every governed field rejects an isolated mutation", () => {
  const fields = [
    ["actorUserId", "other"], ["action", "OTHER_ACTION"], ["result", "DENIED"],
    ["resourceType", "OTHER_TYPE"], ["resourceId", "other-resource"], ["resourceRevisionId", "other-revision"],
    ["revisionHash", "d".repeat(64)], ["sourceSetHash", "e".repeat(64)], ["policyVersion", "CS1A_POLICY_V2"],
    ["decision", "DENY"], ["reasonCode", "OTHER_REASON"], ["humanDecisionHash", "f".repeat(64)],
    ["rightsDisposition", "UNKNOWN"], ["currentnessDisposition", "HISTORICAL"],
    ["contentClass", "UNKNOWN"], ["publicationAuthority", "GRANTED_BY_SEPARATE_AUTHORITY"],
  ] as const;
  for (const [field, value] of fields) {
    const input = field === "actorUserId" || field === "action" || field === "result" || field === "resourceType" || field === "resourceId"
      ? { [field]: value } : { metadata: { ...expected, [field]: value } };
    assert.equal(validateCs1aGovernanceAuditEvent(event(input), actor, expected), false, field);
  }
  assert.equal(fields.length, 16);
});

test("four synthetic domains use identical validation", () => {
  for (const resourceType of ["ISMS_P_CONTENT_REVISION", "ISRM_CONTENT_REVISION", "ISA_CONTENT_REVISION", "SECURE_CODING_CONTENT_REVISION"]) {
    const candidate = { ...expected, resourceType, resourceId: `${resourceType}-1` };
    assert.equal(validateCs1aGovernanceAuditEvent({ ...event(), resourceType, resourceId: candidate.resourceId, metadata: candidate }, actor, candidate), true);
  }
});

test("wrong actor/resource/action/result and client-like substitutions fail", () => {
  assert.equal(validateCs1aGovernanceAuditEvent(event({ actorUserId: "other" }), actor, expected), false);
  assert.equal(validateCs1aGovernanceAuditEvent(event({ resourceId: "resource-b" }), actor, expected), false);
  assert.equal(validateCs1aGovernanceAuditEvent(event({ action: "CLIENT_SUPPLIED_ACTION" }), actor, expected), false);
  assert.equal(validateCs1aGovernanceAuditEvent(event({ result: "DENIED" }), actor, expected), false);
  assert.equal(validateCs1aGovernanceAuditEvent(event({ id: "client-chosen-uuid" }), actor, expected), true);
});

test("adapter source enforces server-generated ID and read-back before return", () => {
  const source = readFileSync("lib/services/cs1a-actor-audit-adapter.ts", "utf8");
  assert.match(source, /createAuditEvent\(/);
  assert.match(source, /getAuditLogById\(id\)/);
  assert.match(source, /validateCs1aGovernanceAuditEvent\(event, actor, expected\)/);
  assert.match(source, /return \{ actorAuditLogId: id, event \}/);
  assert.doesNotMatch(source, /actorAuditLogId:\s*expected/);
});

test("audit/read-back failure ordering is fail-closed before receipt append", () => {
  const source = readFileSync("lib/services/cs1a-actor-audit-adapter.ts", "utf8");
  const audit = source.indexOf("createAuditEvent");
  const readback = source.indexOf("getAuditLogById");
  const validation = source.indexOf("validateCs1aGovernanceAuditEvent(event");
  const returned = source.indexOf("return { actorAuditLogId");
  assert.ok(audit < readback && readback < validation && validation < returned);
  assert.doesNotMatch(source, /appendGovernanceReceipt/);
});

test("production caller guard finds no direct receipt bypass", () => {
  const roots = ["app", "db", "lib", "server"];
  const files: string[] = [];
  function walk(path: string) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory() && !["node_modules", ".next"].includes(entry.name)) walk(full);
      else if (entry.isFile() && /\.(ts|tsx|mjs)$/.test(entry.name)) files.push(full);
    }
  }
  for (const root of roots) {
    try { walk(root); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const callers = files.filter((file) => /appendGovernanceReceipt/.test(readFileSync(file, "utf8")));
  assert.deepEqual(callers.map((file) => file.replaceAll("\\", "/")), ["db/policy-receipt-repositories.ts"]);
});

test("governance action is generic and has no qualification branch", () => {
  assert.equal(CS1A_GOVERNANCE_AUDIT_ACTION, "CS1A_GOVERNANCE_DECISION_CONFIRMED");
  assert.doesNotMatch(CS1A_GOVERNANCE_AUDIT_ACTION, /INFORMATION_SYSTEMS_AUDITOR|ISMS|ISRM|SECURE_CODING/);
  const source = readFileSync("lib/services/cs1a-actor-audit-adapter.ts", "utf8");
  assert.doesNotMatch(source, /if\s*\([^)]*(ISMS|ISRM|INFORMATION_SYSTEMS_AUDITOR|SECURE_CODING)/);
});
