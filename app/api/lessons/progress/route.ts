import { updateLessonProgress } from "@/db/lesson-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { lessonProgressSchema, parseInput } from "@/lib/validation";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`lesson-progress:${user.id}`, {
      limit: 120,
      windowMs: 60_000,
    });
    const input = parseInput(
      lessonProgressSchema,
      await readRequestInput(request),
    );
    const result = await updateLessonProgress({
      userId: user.id,
      lessonId: input.lessonId,
      action: input.action,
      lastPosition: input.lastPosition,
    });
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
