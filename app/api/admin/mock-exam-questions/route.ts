import { saveMockExamQuestion } from "@/db/phase3-repositories";
import { recordAudit } from "@/db/audit-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { mockExamQuestionSchema, parseInput } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertAdminActionRateLimit(user.id, "mock-exam-question");
    const input = parseInput(
      mockExamQuestionSchema,
      await readRequestInput(request),
    );
    await saveMockExamQuestion(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: "MOCK_EXAM_QUESTION_ASSIGNED",
      targetType: "MOCK_EXAM",
      targetId: input.mockExamId,
    }, request);
    return successResponse(request, { updated: true }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
