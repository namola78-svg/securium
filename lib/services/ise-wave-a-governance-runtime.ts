import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import {
  findActiveContentReviewJudgments,
  type ContentReviewJudgmentRecord,
} from "../../db/content-review-judgment-repository.ts";
import {
  findActiveOwnerAttestation,
  saveIseWaveAOwnerAttestation,
} from "../../db/content-review-owner-attestation-repository.ts";
import type { AppUser } from "../auth.ts";
import { AppError } from "../errors.ts";
import {
  CONTENT_REVIEW_DOMAINS,
  type AuthenticatedContentReviewer,
  type ContentReviewFindingInput,
  type ContentReviewResult,
  type ContentReviewDomain,
} from "../policy/content-review-judgment.ts";
import {
  assertIseWaveAGovernanceDependencies,
  buildIseWaveAGovernanceContext,
} from "./ise-wave-a-reviewed-input-adapter.ts";
import { recordAuthenticatedIseWaveAReviewJudgment } from "./content-review-judgment-service.ts";
import { readCanonicalDatabaseIdentity } from "./canonical-database-identity.ts";

export const ISE_WAVE_A_GOVERNANCE_RESOURCE_TYPE =
  "CONTENT_REVISION_REGISTRATION" as const;

export const ISE_WAVE_A_GOVERNANCE_ROLES = Object.freeze([
  "CONTENT_REVIEWER",
  "ADMIN",
  "SUPER_ADMIN",
] as const);

export type IseWaveAGovernanceAction = "owner-attest" | "review-domain";

export function isIseWaveAGovernanceRole(role: string): boolean {
  return (ISE_WAVE_A_GOVERNANCE_ROLES as readonly string[]).includes(role);
}

export function assertIseWaveAGovernanceActor(
  actor: Pick<AppUser, "roles">,
): void {
  if (!actor.roles.some(isIseWaveAGovernanceRole)) {
    throw new AppError(
      "ISE Wave A governance role is required.",
      403,
      "ISE_GOVERNANCE_ROLE_REQUIRED",
    );
  }
}

export function toAuthenticatedContentReviewer(
  actor: AppUser,
): AuthenticatedContentReviewer {
  assertIseWaveAGovernanceActor(actor);
  return { id: actor.id, roles: [...actor.roles], status: "ACTIVE" };
}

export type IseWaveAGovernanceReadiness = Readonly<{
  status: "READY_FOR_BOUNDED_GOVERNANCE";
  canonicalIdentity: "SERVER_POSTGRES_CANONICAL_VERIFIED";
  resourceType: typeof ISE_WAVE_A_GOVERNANCE_RESOURCE_TYPE;
  resourceId: string;
  subjectCount: number;
  requiredDomains: readonly ContentReviewDomain[];
  currentnessAvailable: boolean;
  currentnessJudgmentPresent: boolean;
  ownerAttestationState: "ACTIVE" | "MISSING";
  completedDomainCount: number;
  distinctReviewerCount: number;
  actorEligibility: Readonly<{
    governanceRole: boolean;
    ownerAction: boolean;
    reviewAction: boolean;
  }>;
  nextAllowedAction:
    | "owner-attest"
    | "review-domain"
    | "final-authority-review"
    | "blocked";
}>;

export async function readIseWaveAGovernanceReadiness(
  database: DatabaseProvider,
  actor: AppUser,
): Promise<IseWaveAGovernanceReadiness> {
  assertIseWaveAGovernanceActor(actor);
  await assertCanonicalPostgresRuntime(database);

  const context = await buildIseWaveAGovernanceContext(database);
  assertIseWaveAGovernanceDependencies(context);
  const reviewed = context.reviewedInput;
  const owner = await findActiveOwnerAttestation(
    reviewed.reviewedInputIdentity,
    database,
  );
  const perDomain = await Promise.all(
    context.requiredDomains.map(async (domain) => ({
      domain,
      judgments: await findActiveContentReviewJudgments(
        reviewed.reviewedInputIdentity,
        domain,
        database,
      ),
    })),
  );
  const completeDomains = perDomain.filter(({ judgments }) =>
    isDomainComplete(judgments, context.requiredReviewerCount),
  ).length;
  const distinctReviewers = new Set(
    perDomain.flatMap(({ judgments }) =>
      judgments.map((judgment) => judgment.reviewerUserId),
    ),
  );
  const currentnessJudgments = perDomain.find(
    ({ domain }) => domain === "CURRENTNESS",
  )?.judgments ?? [];
  const governanceRole = actor.roles.some(isIseWaveAGovernanceRole);
  const ownerAttestationState = owner ? "ACTIVE" : "MISSING";
  const allDomainsComplete = completeDomains === context.requiredDomains.length;

  return {
    status: "READY_FOR_BOUNDED_GOVERNANCE",
    canonicalIdentity: "SERVER_POSTGRES_CANONICAL_VERIFIED",
    resourceType: reviewed.resourceType,
    resourceId: reviewed.resourceId,
    subjectCount: reviewed.subjects.length,
    requiredDomains: [...context.requiredDomains],
    currentnessAvailable: reviewed.currentnessStatus === "CURRENTNESS_AVAILABLE",
    currentnessJudgmentPresent: currentnessJudgments.length > 0,
    ownerAttestationState,
    completedDomainCount: completeDomains,
    distinctReviewerCount: distinctReviewers.size,
    actorEligibility: {
      governanceRole,
      ownerAction: governanceRole,
      reviewAction: governanceRole,
    },
    nextAllowedAction: !owner
      ? "owner-attest"
      : !allDomainsComplete
        ? "review-domain"
        : "final-authority-review",
  };
}

export async function executeIseWaveAOwnerAttestation(
  database: DatabaseProvider,
  actor: AppUser,
  input: Readonly<{
    idempotencyKey: string;
    supersedesAttestationId?: string | null;
  }>,
) {
  const reviewer = toAuthenticatedContentReviewer(actor);
  await assertCanonicalPostgresRuntime(database);
  return saveIseWaveAOwnerAttestation(input, reviewer, database);
}

export async function executeIseWaveAReviewDomain(
  database: DatabaseProvider,
  actor: AppUser,
  input: Readonly<{
    reviewDomain: ContentReviewDomain;
    result: ContentReviewResult;
    findings: readonly ContentReviewFindingInput[];
    idempotencyKey: string;
    expectedReviewedInputIdentity?: string;
  }>,
) {
  const reviewer = toAuthenticatedContentReviewer(actor);
  await assertCanonicalPostgresRuntime(database);
  return recordAuthenticatedIseWaveAReviewJudgment(
    {
      reviewDomain: input.reviewDomain,
      result: input.result,
      findings: [...input.findings],
      idempotencyKey: input.idempotencyKey,
      expectedReviewedInputIdentity: input.expectedReviewedInputIdentity,
    },
    reviewer,
    database,
  );
}

export async function assertCanonicalPostgresRuntime(
  database: DatabaseProvider,
): Promise<void> {
  if (database.kind !== "supabase") throw new AppError("ISE governance requires the server PostgreSQL provider.", 503, "ISE_CANONICAL_POSTGRES_REQUIRED");
  let healthy = false;
  try {
    healthy = await database.healthCheck();
  } catch {
    healthy = false;
  }
  if (!healthy) {
    throw new AppError(
      "The canonical governance database is unavailable.",
      503,
      "ISE_CANONICAL_RUNTIME_UNAVAILABLE",
    );
  }
  const identity = await readCanonicalDatabaseIdentity(database);
  if (identity.state !== "CANONICAL_VERIFIED") throw new AppError("The canonical governance database identity is not verified.", 503, identity.blockerCode ?? "ISE_CANONICAL_IDENTITY_UNVERIFIED");
}

function isDomainComplete(
  judgments: readonly ContentReviewJudgmentRecord[],
  requiredReviewerCount: 1 | 2,
): boolean {
  if (
    judgments.length === 0 ||
    judgments.some((judgment) => judgment.result !== "REVIEW_PERFORMED_PASS")
  ) {
    return false;
  }
  return (
    new Set(judgments.map((judgment) => judgment.reviewerUserId)).size >=
    requiredReviewerCount
  );
}

export function isApprovedIseWaveADomain(
  value: unknown,
): value is ContentReviewDomain {
  return (
    typeof value === "string" &&
    CONTENT_REVIEW_DOMAINS.includes(value as ContentReviewDomain)
  );
}
