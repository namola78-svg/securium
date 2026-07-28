import { saveQuestion } from "@/db/question-repositories";
import { requireQuestionEditor } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, questionSchema } from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionEditor();
    await assertAdminActionRateLimit(user.id, "question");
    const input = parseInput(questionSchema, await readRequestInput(request));
    const id = await saveQuestion(input, user.id);
    return successResponse(request, { id }, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
