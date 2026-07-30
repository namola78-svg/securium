import { updateCourseLessonProgress } from "@/db/shared-content-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { courseLessonProgressSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`course-lesson-progress:${user.id}`, {
      limit: 120,
      windowMs: 60_000,
    });
    const input = parseInput(
      courseLessonProgressSchema,
      await readRequestInput(request),
    );
    const result = await updateCourseLessonProgress({
      userId: user.id,
      courseLessonId: input.courseLessonId,
      action: input.action,
      progressPercent: input.progressPercent,
      timeSpentSeconds: input.timeSpentSeconds,
    });
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
