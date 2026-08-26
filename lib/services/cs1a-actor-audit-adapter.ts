import { AppError } from "../errors.ts";
import { createAuditEvent, getAuditLogById } from "../../db/audit-repositories.ts";
import {
  assertCs1aGovernanceActor,
  CS1A_GOVERNANCE_AUDIT_ACTION,
  type Cs1aGovernanceActor,
  type Cs1aGovernanceAuditExpectation,
  validateCs1aGovernanceAuditEvent,
} from "../policy/cs1a-actor-audit.ts";

export { assertCs1aGovernanceActor, CS1A_GOVERNANCE_AUDIT_ACTION, validateCs1aGovernanceAuditEvent } from "../policy/cs1a-actor-audit.ts";
export type { Cs1aGovernanceActor, Cs1aGovernanceAuditExpectation } from "../policy/cs1a-actor-audit.ts";

/** Trusted server-side foundation; clients never provide actorAuditLogId. */
export async function createValidatedCs1aGovernanceAuditEvent(
  actor: Cs1aGovernanceActor | null | undefined,
  expected: Cs1aGovernanceAuditExpectation,
  request?: Request,
) {
  if (!actor?.id?.trim()) {
    throw new AppError("Authentication is required.", 401, "UNAUTHENTICATED");
  }
  try {
    assertCs1aGovernanceActor(actor);
  } catch (error) {
    throw new AppError((error as Error).message, 403, "CS1A_GOVERNANCE_FORBIDDEN");
  }
  const id = await createAuditEvent({
    actorUserId: actor.id,
    actorRoles: [...actor.roles],
    action: CS1A_GOVERNANCE_AUDIT_ACTION,
    resourceType: expected.resourceType,
    resourceId: expected.resourceId,
    metadata: { ...expected },
  }, request);
  const event = await getAuditLogById(id);
  if (!validateCs1aGovernanceAuditEvent(event, actor, expected)) {
    throw new AppError("Governance audit event read-back validation failed.", 409, "CS1A_GOVERNANCE_AUDIT_READBACK_INVALID");
  }
  return { actorAuditLogId: id, event };
}
