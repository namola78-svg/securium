import {
  getLectureUserData,
  updateLectureProgress,
} from "@/db/lecture-repositories";
import { requireApiUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { lectureProgressSchema, parseInput } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const lectureId = new URL(request.url).searchParams
      .get("lectureId")
      ?.trim();
    if (!lectureId || lectureId.length > 100) {
      throw new AppError(
        "강의 ID가 필요합니다.",
        400,
        "LECTURE_ID_REQUIRED",
      );
    }
    const result = await getLectureUserData(user.id, lectureId);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`lecture-progress:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(
      lectureProgressSchema,
      await readRequestInput(request),
    );
    const result = await updateLectureProgress({
      userId: user.id,
      ...input,
    });
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
