import { z } from "zod";
import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import type { AppUser } from "../auth.ts";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "../http.ts";
import { AppError } from "../errors.ts";
import { parseInput } from "../validation.ts";
import type {
  ContentReviewDomain,
  ContentReviewFindingInput,
  ContentReviewResult,
} from "../policy/content-review-judgment.ts";

const findingSchema = z.object({
  subjectIdentity: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().min(1).max(120),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
  disposition: z.enum(["OPEN", "REMEDIATED", "ACCEPTED", "NOT_APPLICABLE"]),
  materialFacts: z.record(z.string(), z.unknown()),
}).strict();

export const iseWaveAGovernanceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("owner-attest"),
    idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,100}$/),
    supersedesAttestationId: z.string().trim().max(100).nullable().optional(),
  }).strict(),
  z.object({
    action: z.literal("review-domain"),
    reviewDomain: z.enum([
      "TECHNICAL",
      "SAFETY_SECURITY_CONTENT",
      "COPYRIGHT_RIGHTS",
      "CURRENTNESS",
      "SUPPORT_QUALIFICATION",
    ]),
    result: z.enum(["REVIEW_PERFORMED_PASS", "REVIEW_PERFORMED_FAIL"]),
    findings: z.array(findingSchema).max(100).default([]),
    idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{1,100}$/),
    expectedReviewedInputIdentity: z.string().trim().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict(),
]);

export type IseWaveAGovernanceRouteDependencies = Readonly<{
  requireUser: () => Promise<AppUser>;
  getDatabase: () => Promise<DatabaseProvider>;
  assertActor: (actor: AppUser) => void;
  rateLimit: (key: string, options: { limit: number; windowMs: number }) => Promise<unknown>;
  readReadiness: (database: DatabaseProvider, actor: AppUser) => Promise<unknown>;
  ownerAttest: (database: DatabaseProvider, actor: AppUser, input: { idempotencyKey: string; supersedesAttestationId?: string | null }) => Promise<{
    outcome: string;
    attestation: { resourceType: string; resourceId: string; reviewedInputIdentity: string };
  }>;
  reviewDomain: (database: DatabaseProvider, actor: AppUser, input: {
    reviewDomain: ContentReviewDomain;
    result: ContentReviewResult;
    findings: readonly ContentReviewFindingInput[];
    idempotencyKey: string;
    expectedReviewedInputIdentity?: string;
  }) => Promise<{
    outcome: string;
    judgment: { reviewDomain: string; reviewedInputIdentity: string; result: string };
  }>;
}>;

export async function handleIseWaveAGovernanceRequest(
  method: string,
  request: Request,
  dependencies: IseWaveAGovernanceRouteDependencies,
): Promise<Response> {
  try {
    const actor = await dependencies.requireUser();
    dependencies.assertActor(actor);
    if (method === "GET") {
      await dependencies.rateLimit(`ise-wave-a-governance-readiness:${actor.id}`, { limit: 30, windowMs: 60_000 });
      const readiness = await dependencies.readReadiness(await dependencies.getDatabase(), actor);
      return successResponse(request, readiness);
    }
    if (method !== "POST") throw new AppError("Method not allowed.", 405, "METHOD_NOT_ALLOWED");
    assertSameOrigin(request);
    await dependencies.rateLimit(`ise-wave-a-governance-action:${actor.id}`, { limit: 10, windowMs: 60_000 });
    const input = parseInput(iseWaveAGovernanceActionSchema, await readRequestInput(request));
    const database = await dependencies.getDatabase();
    if (input.action === "owner-attest") {
      const result = await dependencies.ownerAttest(database, actor, {
        idempotencyKey: input.idempotencyKey,
        supersedesAttestationId: input.supersedesAttestationId,
      });
      return successResponse(request, {
        action: input.action,
        outcome: result.outcome,
        resourceType: result.attestation.resourceType,
        resourceId: result.attestation.resourceId,
        reviewedInputIdentity: result.attestation.reviewedInputIdentity,
      }, undefined, result.outcome === "NEW_ATTESTATION" ? 201 : 200);
    }
    const result = await dependencies.reviewDomain(database, actor, {
      reviewDomain: input.reviewDomain,
      result: input.result,
      findings: input.findings,
      idempotencyKey: input.idempotencyKey,
      expectedReviewedInputIdentity: input.expectedReviewedInputIdentity,
    });
    return successResponse(request, {
      action: input.action,
      outcome: result.outcome,
      reviewDomain: result.judgment.reviewDomain,
      reviewedInputIdentity: result.judgment.reviewedInputIdentity,
      result: result.judgment.result,
    }, undefined, result.outcome === "NEW_JUDGMENT" ? 201 : 200);
  } catch (error) {
    return errorResponse(error, request);
  }
}
