export const CS1A_GOVERNANCE_AUDIT_ACTION = "CS1A_GOVERNANCE_DECISION_CONFIRMED" as const;
export const CS1A_GOVERNANCE_ACTOR_ROLES = ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"] as const;

export type Cs1aGovernanceActor = Readonly<{ id: string; roles: readonly string[] }>;
export type Cs1aGovernanceAuditExpectation = Readonly<{
  resourceType: string; resourceId: string; resourceRevisionId: string; revisionHash: string;
  policyVersion: string; sourceSetHash: string; humanDecisionHash: string; decision: string;
  reasonCode: string; rightsDisposition: string; currentnessDisposition: string;
  contentClass: string; publicationAuthority: string;
}>;

export function assertCs1aGovernanceActor(actor: Cs1aGovernanceActor | null | undefined): asserts actor is Cs1aGovernanceActor {
  if (!actor?.id?.trim()) throw new Error("Authentication is required.");
  if (!actor.roles.some((role) => CS1A_GOVERNANCE_ACTOR_ROLES.includes(role as never))) {
    throw new Error("Governance authorization is required.");
  }
}

export function validateCs1aGovernanceAuditEvent(
  event: Readonly<{ id: string; actorUserId: string; action: string; resourceType: string; resourceId: string; result: string; metadata: Record<string, unknown> }> | null,
  actor: Cs1aGovernanceActor,
  expected: Cs1aGovernanceAuditExpectation,
) {
  if (!event || event.actorUserId !== actor.id || event.action !== CS1A_GOVERNANCE_AUDIT_ACTION || event.result !== "SUCCESS") return false;
  if (event.resourceType !== expected.resourceType || event.resourceId !== expected.resourceId) return false;
  const fields = ["resourceRevisionId", "revisionHash", "policyVersion", "sourceSetHash", "humanDecisionHash", "decision", "reasonCode", "rightsDisposition", "currentnessDisposition", "contentClass", "publicationAuthority"] as const;
  return fields.every((field) => event.metadata[field] === expected[field]);
}
