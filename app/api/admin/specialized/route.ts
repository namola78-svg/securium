import { recordAudit } from "@/db/audit-repositories";
import { saveSpecializedContent } from "@/db/specialized-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, specializedAdminSchema } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionAdministrator();
    await assertAdminActionRateLimit(user.id, "specialized-content");
    const input = parseInput(
      specializedAdminSchema,
      await readRequestInput(request),
    );
    const id = await saveSpecializedContent(user.id, input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action:
        input.entity === "LEGAL_ARTICLE"
          ? "LEGAL_ARTICLE_UPDATED"
          : input.entity === "ISMS_STANDARD"
            ? "ISMS_STANDARD_UPDATED"
            : `SPECIALIZED_${input.entity}_SAVED`,
      targetType: input.entity,
      targetId: id,
      courseId: "courseId" in input ? input.courseId : null,
      metadata:
        input.entity === "LEGAL_ARTICLE" ||
        input.entity === "ISMS_STANDARD"
          ? {
              version: input.version,
              contentDate: input.effectiveDate,
            }
          : undefined,
    }, request);
    return successResponse(request, { id }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
