import {
  listAdminSpecializedAIRecords,
  reviewSpecializedAI,
} from "@/db/ai-specialized-repositories";
import { recordAudit } from "@/db/audit-repositories";
import { requireQuestionReviewer } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  parseInput,
  specializedAIReviewSchema,
} from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    await requireQuestionReviewer();
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
    return successResponse(request, {
      records: await listAdminSpecializedAIRecords(limit),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionReviewer();
    await assertAdminActionRateLimit(user.id, "ai-review");
    const input = parseInput(
      specializedAIReviewSchema,
      await readRequestInput(request),
    );
    const result = await reviewSpecializedAI({
      reviewerId: user.id,
      ...input,
    });
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: `AI_SPECIALIZED_${input.action}`,
      targetType: "AI_SPECIALIZED_GENERATION",
      targetId: input.generationId,
      requestId: result.reviewId,
    }, request);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
