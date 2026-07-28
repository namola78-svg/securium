import { updateQuestionReport } from "@/db/question-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { z } from "zod";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

const reportUpdateSchema = z.object({
  id: z.string().trim().min(1).max(100),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]),
  resolutionNote: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionAdministrator();
    await assertAdminActionRateLimit(user.id, "question-report");
    const input = parseInput(
      reportUpdateSchema,
      await readRequestInput(request),
    );
    await updateQuestionReport({ ...input, actorUserId: user.id });
    return successResponse(request, { updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
