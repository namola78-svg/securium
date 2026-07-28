import { cloneQuestion } from "@/db/question-repositories";
import { requireQuestionEditor } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { z } from "zod";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

const cloneSchema = z.object({
  questionId: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionEditor();
    await assertAdminActionRateLimit(user.id, "question-clone");
    const input = parseInput(cloneSchema, await readRequestInput(request));
    const id = await cloneQuestion(input.questionId, user.id);
    return successResponse(request, { id }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
