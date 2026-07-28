import {
  getPrivacyAssessmentAnswer,
  savePrivacyAssessmentAnswer,
} from "@/db/practical-specialization-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  parseInput,
  privacyAssessmentAnswerSchema,
} from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const answerId = new URL(request.url).searchParams.get("answerId") ?? "";
    return successResponse(request, {
      answer: await getPrivacyAssessmentAnswer(user.id, answerId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      privacyAssessmentAnswerSchema,
      await readRequestInput(request),
    );
    return successResponse(
      request,
      await savePrivacyAssessmentAnswer(user.id, input),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
