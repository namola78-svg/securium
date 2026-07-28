import { submitQuestionAttempt } from "@/db/question-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { parseInput, questionAttemptSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`attempt:${user.id}`, { limit: 120, windowMs: 60_000 });
    const input = parseInput(
      questionAttemptSchema,
      await readRequestInput(request),
    );
    const result = await submitQuestionAttempt({ userId: user.id, ...input });
    return successResponse(request, { result }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
