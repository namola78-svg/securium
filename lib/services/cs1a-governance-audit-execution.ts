import { AppError } from "../errors.ts";
import {
  verifyCs1aGovernanceExecution,
  type Cs1aServerApplicationUser,
  type VerifiedCs1aGovernanceExecutionContext,
} from "./cs1a-governance-execution.ts";
import type { Cs1aGovernanceAuditExpectation } from "./cs1a-actor-audit-adapter.ts";
import type { Cs1aHumanDecisionSubject } from "../policy/cs1a-human-decision.ts";

type Cs1aAuditCreator = (
  actor: Readonly<{ id: string; roles: readonly string[] }>,
  expectation: Cs1aGovernanceAuditExpectation,
  request?: Request,
  context?: VerifiedCs1aGovernanceExecutionContext,
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
    context?: VerifiedCs1aGovernanceExecutionContext,
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
      "DUPLICATE_EXACT_GOVERNANCE_DECISION",
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
    context,
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
  context?: VerifiedCs1aGovernanceExecutionContext,
): Promise<boolean> {
  if (!context) return false;
  const { getDatabaseProvider } = await import("../../db/index.ts");
  const { readCs1aGovernanceDecision } = await import("../../db/cs1a-governance-identity-repository.ts");
  return Boolean(await readCs1aGovernanceDecision(await getDatabaseProvider(), context.semantic.contractVersion, context.semantic.humanDecisionHash));
}

async function defaultCreateAudit(
  actor: Readonly<{ id: string; roles: readonly string[] }>,
  expectation: Cs1aGovernanceAuditExpectation,
  request?: Request,
  context?: VerifiedCs1aGovernanceExecutionContext,
) {
  if (!context) throw new AppError("Verified governance context is required.", 500, "CS1A_VERIFIED_CONTEXT_REQUIRED");
  const { getDatabaseProvider } = await import("../../db/index.ts");
  const { persistCs1aGovernanceDecision } = await import("../../db/cs1a-governance-identity-repository.ts");
  const persisted = await persistCs1aGovernanceDecision({
    database: await getDatabaseProvider(),
    actor,
    contractVersion: context.semantic.contractVersion,
    humanDecisionHash: context.semantic.humanDecisionHash,
    subjects: context.semantic.projection.subjects as unknown as readonly Cs1aHumanDecisionSubject[],
    decision: context.semantic.decision,
    reasonCode: context.semantic.reasonCodes[0] ?? expectation.reasonCode,
    publicationAuthority: context.semantic.publicationAuthority,
  });
  return {
    actorAuditLogId: persisted.actorAuditLogId,
    event: {
      id: persisted.actorAuditLogId,
      actorUserId: actor.id,
      action: "CS1A_GOVERNANCE_DECISION_CONFIRMED",
      result: "SUCCESS",
      metadata: expectation,
    },
  };
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
