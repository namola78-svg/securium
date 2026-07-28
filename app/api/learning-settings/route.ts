import { saveLearningSettings } from "@/db/phase3-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { learningSettingsSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      learningSettingsSchema,
      await readRequestInput(request),
    );
    await saveLearningSettings({ userId: user.id, ...input });
    return successResponse(request, { updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}

