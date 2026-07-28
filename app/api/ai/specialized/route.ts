import {
  generateSpecializedAI,
  getSpecializedAIRecord,
} from "@/db/ai-specialized-repositories";
import { getRuntimeAILimits, getRuntimeAIProvider } from "@/lib/ai/runtime-provider";
import { readLimitedAIJson } from "@/lib/ai/safety";
import { requireApiUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  assertSameOrigin,
  errorResponse,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  parseInput,
  specializedAIRequestSchema,
} from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const requestId = new URL(request.url).searchParams
      .get("requestId")
      ?.trim();
    if (!requestId || requestId.length > 100) {
      throw new AppError(
        "유효한 AI 요청 ID가 필요합니다.",
        400,
        "AI_REQUEST_ID_REQUIRED",
      );
    }
    const result = await getSpecializedAIRecord(user.id, requestId);
    if (!result) {
      throw new AppError(
        "AI 특화 결과를 찾을 수 없습니다.",
        404,
        "AI_SPECIALIZED_RESULT_NOT_FOUND",
      );
    }
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`ai-specialized:${user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    const target = parseInput(
      specializedAIRequestSchema,
      await readLimitedAIJson(request, 16_384),
    );
    const limits = getRuntimeAILimits();
    const result = await generateSpecializedAI({
      userId: user.id,
      target,
      provider: getRuntimeAIProvider(),
      dailyLimit: limits.dailyLimit,
      retentionDays: limits.retentionDays,
    });
    return successResponse(request, { result }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
