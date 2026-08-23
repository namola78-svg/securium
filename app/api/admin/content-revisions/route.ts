import {
  archiveContentRevision,
  createContentRevisionDraft,
  publishContentRevision,
} from "@/db/content-revision-repositories";
import { saveGovernedTheoryRevision } from "@/db/content-revision-governance-repositories";
import { getDatabaseProvider } from "@/db";
import {
  recordAudit,
  recordAuditFailureSafely,
} from "@/db/audit-repositories";
import {
  requireQuestionAdministrator,
  requireQuestionPublisher,
} from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  contentRevisionAdminSchema,
  parseInput,
} from "@/lib/validation";
import type { AppUser } from "@/lib/auth";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  let actor: AppUser | null = null;
  let auditAction = "CONTENT_REVISION_WRITE";
  let resourceId = "unknown";
  try {
    assertSameOrigin(request);
    const raw = await readRequestInput(request);
    const input = parseInput(contentRevisionAdminSchema, raw);
    const user =
      input.operation === "CREATE_DRAFT" || input.operation === "SAVE_GOVERNED_THEORY"
        ? await requireQuestionAdministrator()
        : await requireQuestionPublisher();
    await assertAdminActionRateLimit(user.id, "content-revision");
    actor = user;
    auditAction =
      input.operation === "CREATE_DRAFT"
        ? "CONTENT_REVISION_DRAFT_CREATED"
        : input.operation === "PUBLISH"
          ? "CONTENT_REVISION_PUBLISHED"
          : "CONTENT_REVISION_ARCHIVED";
    resourceId =
      input.operation === "CREATE_DRAFT"
        ? input.contentId
        : input.operation === "SAVE_GOVERNED_THEORY"
          ? input.canonicalKey
        : input.revisionId;

    if (input.operation === "SAVE_GOVERNED_THEORY") {
      const result = await saveGovernedTheoryRevision(
        input,
        user.id,
        await getDatabaseProvider(),
      );
      await recordAudit({
        actorUserId: user.id,
        actorRoles: user.roles,
        action: `THEORY_REVISION_${result.outcome}`,
        targetType: "THEORY_REVISION",
        targetId: result.revisionId,
        courseId: null,
        metadata: { canonicalKey: result.canonicalKey, semanticHash: result.semanticHash },
      }, request);
      return successResponse(request, result, input.returnTo, result.outcome === "NEW_SUCCESS" ? 201 : 200);
    }

    if (input.operation === "CREATE_DRAFT") {
      const id = await createContentRevisionDraft({
        ...input,
        userId: user.id,
      });
      await recordAudit({
        actorUserId: user.id,
        actorRoles: user.roles,
        action: "CONTENT_REVISION_DRAFT_CREATED",
        targetType: input.contentType,
        targetId: input.contentId,
        courseId: null,
        metadata: { version: input.version },
      }, request);
      return successResponse(request, { id }, input.returnTo, 201);
    }

    if (input.operation === "PUBLISH") {
      const id = await publishContentRevision(input.revisionId, user.id);
      await recordAudit({
        actorUserId: user.id,
        actorRoles: user.roles,
        action: "CONTENT_REVISION_PUBLISHED",
        targetType: "CONTENT_REVISION",
        targetId: id,
        courseId: null,
      }, request);
      return successResponse(request, { id }, input.returnTo);
    }

    await archiveContentRevision(input.revisionId);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: "CONTENT_REVISION_ARCHIVED",
      targetType: "CONTENT_REVISION",
      targetId: input.revisionId,
      courseId: null,
    }, request);
    return successResponse(request, { id: input.revisionId }, input.returnTo);
  } catch (error) {
    if (actor) {
      await recordAuditFailureSafely(
        {
          actorUserId: actor.id,
          actorRoles: actor.roles,
          action: auditAction,
          resourceType: "CONTENT_REVISION",
          resourceId,
        },
        error,
        request,
      );
    }
    return errorResponse(error);
  }
}
