import { saveMockExamAnswer } from "@/db/phase3-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { examAnswerSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(examAnswerSchema, await readRequestInput(request));
    const result = await saveMockExamAnswer({ userId: user.id, ...input });
    return successResponse(request, result);
  } catch (error) {
    return errorResponse(error);
  }
}

