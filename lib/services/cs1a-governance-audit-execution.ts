import { AppError } from "../errors.ts";
import {
  verifyCs1aGovernanceExecution,
  type Cs1aServerApplicationUser,
  type VerifiedCs1aGovernanceExecutionContext,
} from "./cs1a-governance-execution.ts";
import type { Cs1aGovernanceAuditExpectation } from "./cs1a-actor-audit-adapter.ts";

type Cs1aAuditCreator = (
  actor: Readonly<{ id: string; roles: readonly string[] }>,
  expectation: Cs1aGovernanceAuditExpectation,
  request?: Request,
) => Promise<Readonly<{ actorAuditLogId: string; event: Readonly<Record<string, unknown>> | null }>>;

export type Cs1aExplicitConfirmation = Readonly<{
  confirmed: boolean;
  humanDecisionHash: string;
}>;

export type Cs1aGovernanceAuditExecutionInput = Readonly<{
  verification: Parameters<typeof verifyCs1aGovernanceExecution>[0];
  confirmation: Cs1aExplicitConfirmation;
  request?: Request;
}>;

export type Cs1aGovernanceAuditExecutionResult = Readonly<{
  context: VerifiedCs1aGovernanceExecutionContext;
  actorAuditLogId: string;
  event: Readonly<Record<string, unknown>>;
}>;

export type Cs1aGovernanceAuditExecutionDependencies = Readonly<{
  verifyExecution?: (
    input: Cs1aGovernanceAuditExecutionInput["verification"],
  ) => Promise<VerifiedCs1aGovernanceExecutionContext>;
  findDuplicate?: (
    actor: Cs1aServerApplicationUser,
    expectation: Cs1aGovernanceAuditExpectation,
  ) => Promise<boolean>;
  createAudit?: Cs1aAuditCreator;
  buildAuditExpectation?: (
    context: VerifiedCs1aGovernanceExecutionContext,
  ) => Cs1aGovernanceAuditExpectation;
}>;

/**
 * Server-only CS-1A execution boundary. It is intentionally the only place
 * that consumes explicit confirmation before calling the server-owned audit
 * adapter. No receipt or canonical persistence is reachable from this path.
 */
export async function executeCs1aGovernanceAudit(
  input: Cs1aGovernanceAuditExecutionInput,
  dependencies: Cs1aGovernanceAuditExecutionDependencies = {},
): Promise<Cs1aGovernanceAuditExecutionResult> {
  const context = await (dependencies.verifyExecution ?? ((verification) =>
    verifyCs1aGovernanceExecution(verification)))(input.verification);

  assertExplicitConfirmation(input.confirmation, context);

  if (!dependencies.buildAuditExpectation) {
    throw new AppError(
      "A server-owned audit expectation is required.",
      500,
      "CS1A_AUDIT_EXPECTATION_REQUIRED",
    );
  }
  const expectation = dependencies.buildAuditExpectation(context);
  if (expectation.humanDecisionHash !== context.semantic.humanDecisionHash) {
    throw new AppError(
      "Governance audit expectation does not match the verified decision.",
      409,
      "CS1A_AUDIT_EXPECTATION_MISMATCH",
    );
  }

  const duplicate = await (dependencies.findDuplicate ?? defaultFindDuplicate)(
    context.applicationUser,
    expectation,
  );
  if (duplicate) {
    throw new AppError(
      "The exact governance confirmation audit already exists.",
      409,
      "CS1A_GOVERNANCE_AUDIT_DUPLICATE",
    );
  }

  const createAudit = dependencies.createAudit ?? defaultCreateAudit;
  const audit = await createAudit(
    {
      id: context.applicationUser.id,
      roles: context.authorizedRoles,
    },
    expectation,
    input.request,
  );
  if (!audit.event) {
    throw new AppError(
      "Governance audit read-back was not found.",
      409,
      "CS1A_GOVERNANCE_AUDIT_READBACK_MISSING",
    );
  }

  return Object.freeze({
    context,
    actorAuditLogId: audit.actorAuditLogId,
    event: audit.event,
  });
}

async function defaultFindDuplicate(
  actor: Cs1aServerApplicationUser,
  expectation: Cs1aGovernanceAuditExpectation,
): Promise<boolean> {
  const { hasExactCs1aGovernanceAudit } = await import("../../db/audit-repositories.ts");
  return hasExactCs1aGovernanceAudit(actor.id, expectation);
}

async function defaultCreateAudit(
  actor: Readonly<{ id: string; roles: readonly string[] }>,
  expectation: Cs1aGovernanceAuditExpectation,
  request?: Request,
) {
  const { createValidatedCs1aGovernanceAuditEvent } = await import("./cs1a-actor-audit-adapter.ts");
  return createValidatedCs1aGovernanceAuditEvent(actor, expectation, request);
}

function assertExplicitConfirmation(
  confirmation: Cs1aExplicitConfirmation,
  context: VerifiedCs1aGovernanceExecutionContext,
): void {
  if (confirmation?.confirmed !== true) {
    throw new AppError(
      "Explicit human governance confirmation is required.",
      400,
      "CS1A_EXPLICIT_CONFIRMATION_REQUIRED",
    );
  }
  if (
    typeof confirmation.humanDecisionHash !== "string" ||
    confirmation.humanDecisionHash !== context.semantic.humanDecisionHash
  ) {
    throw new AppError(
      "Explicit confirmation does not match the verified governance decision.",
      409,
      "CS1A_CONFIRMATION_HASH_MISMATCH",
    );
  }
}
