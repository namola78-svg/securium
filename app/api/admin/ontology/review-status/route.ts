import {
  getOntologyReviewTarget,
  updateOntologyReviewStatus,
} from "@/db/ontology-repositories";
import {
  recordAudit,
  recordAuditFailureSafely,
} from "@/db/audit-repositories";
import { requireOntologyAdministrator, type AppUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  ontologyReviewStatusSchema,
  parseInput,
} from "@/lib/validation";
import {
  validateOntologyReviewTransition,
  type OntologyReviewRole,
} from "@/lib/services/ontology-service";

export async function POST(request: Request) {
  let actor: AppUser | null = null;
  let auditContext: {
    action: string;
    targetType: string;
    targetId: string;
  } | null = null;

  try {
    assertSameOrigin(request);
    const user = await requireOntologyAdministrator();
    actor = user;
    await assertRateLimit(`admin-ontology:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });

    const input = parseInput(
      ontologyReviewStatusSchema,
      await readRequestInput(request),
    );
    const target = await getOntologyReviewTarget({
      targetType: input.targetType,
      targetId: input.targetId,
    });
    const transition = validateOntologyReviewTransition({
      currentStatus: target.status,
      nextStatus: input.nextStatus,
      actorRoles: toOntologyReviewRoles(user.roles),
      evidence: input.evidence,
      changeSummary: input.changeSummary,
    });

    auditContext = {
      action: transition.auditAction,
      targetType: `ONTOLOGY_${target.targetType}`,
      targetId: target.id,
    };

    const updated = await updateOntologyReviewStatus({
      targetType: target.targetType,
      targetId: target.id,
      status: input.nextStatus,
    });

    await recordAudit(
      {
        actorUserId: user.id,
        actorRoles: user.roles,
        action: transition.auditAction,
        targetType: `ONTOLOGY_${target.targetType}`,
        targetId: target.id,
        requestId: request.headers.get("cf-ray"),
        metadata: {
          targetType: target.targetType,
          fromStatus: transition.from,
          toStatus: transition.to,
          evidenceCount: input.evidence.length,
          summaryLength: input.changeSummary?.length ?? 0,
        },
      },
      request,
    );

    return successResponse(
      request,
      {
        id: updated.id,
        key: updated.key,
        targetType: updated.targetType,
        previousStatus: updated.previousStatus,
        status: updated.status,
        updatedAt: updated.updatedAt,
      },
      input.returnTo,
    );
  } catch (error) {
    if (actor && auditContext) {
      await recordAuditFailureSafely(
        {
          actorUserId: actor.id,
          actorRoles: actor.roles,
          action: auditContext.action,
          resourceType: auditContext.targetType,
          resourceId: auditContext.targetId,
        },
        error,
        request,
      );
    }
    return errorResponse(error, request);
  }
}

function toOntologyReviewRoles(roles: string[]): OntologyReviewRole[] {
  const allowed = new Set<OntologyReviewRole>([
    "CONTENT_EDITOR",
    "CONTENT_REVIEWER",
    "COURSE_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ]);
  return roles.filter((role): role is OntologyReviewRole =>
    allowed.has(role as OntologyReviewRole),
  );
}
