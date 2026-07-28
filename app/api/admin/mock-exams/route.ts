import { recordAudit } from "@/db/audit-repositories";
import { saveMockExam } from "@/db/phase3-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { mockExamSchema, parseInput } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertAdminActionRateLimit(user.id, "mock-exam");
    const input = parseInput(mockExamSchema, await readRequestInput(request));
    const id = await saveMockExam(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: input.published
        ? "MOCK_EXAM_PUBLISHED"
        : input.id
          ? "MOCK_EXAM_UPDATED"
          : "MOCK_EXAM_CREATED",
      targetType: "MOCK_EXAM",
      targetId: id,
      courseId: input.courseId,
    }, request);
    return successResponse(request, { id }, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
