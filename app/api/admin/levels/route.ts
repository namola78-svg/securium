import { recordAudit } from "@/db/audit-repositories";
import { saveLevel } from "@/db/phase3-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { levelSchema, parseInput } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertAdminActionRateLimit(user.id, "level");
    const input = parseInput(levelSchema, await readRequestInput(request));
    const id = await saveLevel(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: input.id ? "LEVEL_UPDATED" : "LEVEL_CREATED",
      targetType: "LEVEL",
      targetId: id,
      courseId: input.courseId,
    }, request);
    return successResponse(request, { id }, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
