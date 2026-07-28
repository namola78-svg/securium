import { requireCatalogManager } from "@/lib/auth";
import {
  recordAudit,
  recordAuditFailureSafely,
} from "@/db/audit-repositories";
import { saveCourse } from "@/db/repositories";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { courseSchema, parseInput } from "@/lib/validation";
import { assertRateLimit } from "@/lib/rate-limit";
import type { AppUser } from "@/lib/auth";

export async function POST(request: Request) {
  let actor: AppUser | null = null;
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    actor = user;
    await assertRateLimit(`admin-catalog:${user.id}`, { limit: 60, windowMs: 60_000 });
    const input = parseInput(courseSchema, await readRequestInput(request));
    const id = await saveCourse(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: input.id && !input.active
        ? "COURSE_DEACTIVATED"
        : input.id
          ? "COURSE_UPDATED"
          : "COURSE_CREATED",
      targetType: "COURSE",
      targetId: id,
      courseId: id,
      requestId: request.headers.get("cf-ray"),
      metadata: input.id
        ? { changedFields: ["catalog"] }
        : { courseCode: input.code },
    }, request);
    return successResponse(request, { id }, input.returnTo, input.id ? 200 : 201);
  } catch (error) {
    if (actor) {
      await recordAuditFailureSafely(
        {
          actorUserId: actor.id,
          actorRoles: actor.roles,
          action: "COURSE_UPDATED",
          resourceType: "COURSE",
          resourceId: "unknown",
        },
        error,
        request,
      );
    }
    return errorResponse(error);
  }
}
