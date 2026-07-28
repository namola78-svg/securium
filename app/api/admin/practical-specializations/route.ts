import { savePracticalSpecializedContent } from "@/db/practical-specialization-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  parseInput,
  practicalSpecializedAdminSchema,
} from "@/lib/validation";
import { assertAdminActionRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireQuestionAdministrator();
    await assertAdminActionRateLimit(user.id, "practical-content");
    const input = parseInput(
      practicalSpecializedAdminSchema,
      await readRequestInput(request),
    );
    const id = await savePracticalSpecializedContent(user.id, input);
    return successResponse(request, { id }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
