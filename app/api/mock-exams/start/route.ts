import { startMockExam } from "@/db/phase3-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { examStartSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(examStartSchema, await readRequestInput(request));
    const attempt = await startMockExam(user.id, input.mockExamId);
    return successResponse(request, { attempt }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

