import { submitMockExam } from "@/db/phase3-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { examSubmitSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(examSubmitSchema, await readRequestInput(request));
    const result = await submitMockExam(user.id, input.attemptId);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

