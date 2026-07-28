import {
  getAudioProgressForUser,
  updateAudioProgress,
} from "@/db/audio-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { audioProgressSchema, parseInput } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const audioContentId = new URL(request.url).searchParams
      .get("audioContentId")
      ?.trim();
    if (!audioContentId || audioContentId.length > 100) {
      throw new AppError(
        "오디오 콘텐츠 ID가 필요합니다.",
        400,
        "AUDIO_CONTENT_ID_REQUIRED",
      );
    }
    const result = await getAudioProgressForUser(
      user.id,
      audioContentId,
    );
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`audio-progress:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(
      audioProgressSchema,
      await readRequestInput(request),
    );
    const result = await updateAudioProgress({
      userId: user.id,
      ...input,
    });
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
