import { saveMockExamSection } from "@/db/phase3-repositories";
import { recordAudit } from "@/db/audit-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { mockExamSectionSchema, parseInput } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertAdminActionRateLimit(user.id, "mock-exam-section");
    const input = parseInput(
      mockExamSectionSchema,
      await readRequestInput(request),
    );
    const id = await saveMockExamSection(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: input.id ? "MOCK_EXAM_SECTION_UPDATED" : "MOCK_EXAM_SECTION_CREATED",
      targetType: "MOCK_EXAM_SECTION",
      targetId: id,
    }, request);
    return successResponse(request, { id }, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
