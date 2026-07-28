import { saveLevelContent } from "@/db/phase3-repositories";
import { recordAudit } from "@/db/audit-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { levelContentSchema, parseInput } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertAdminActionRateLimit(user.id, "level-content");
    const input = parseInput(
      levelContentSchema,
      await readRequestInput(request),
    );
    await saveLevelContent(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: "LEVEL_CONTENT_LINKED",
      targetType: "LEVEL",
      targetId: input.levelId,
    }, request);
    return successResponse(request, { updated: true }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
