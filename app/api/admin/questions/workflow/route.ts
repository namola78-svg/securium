import { transitionQuestion } from "@/db/question-repositories";
import { recordAudit } from "@/db/audit-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, workflowSchema } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionAdministrator();
    await assertAdminActionRateLimit(user.id, "question-workflow");
    const input = parseInput(workflowSchema, await readRequestInput(request));
    const status = await transitionQuestion({
      ...input,
      actorUserId: user.id,
      actorRoles: user.roles,
    });
    await recordAudit(
      {
        actorUserId: user.id,
        actorRoles: user.roles,
        action:
          input.action === "APPROVE"
            ? "QUESTION_APPROVED"
            : input.action === "REJECT"
              ? "QUESTION_REJECTED"
              : input.action === "PUBLISH"
                ? "QUESTION_PUBLISHED"
                : `QUESTION_${input.action}`,
        targetType: "QUESTION",
        targetId: input.questionId,
        metadata: { toStatus: status },
      },
      request,
    );
    return successResponse(request, { status });
  } catch (error) {
    return errorResponse(error);
  }
}
