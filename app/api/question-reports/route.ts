import { createQuestionReport } from "@/db/question-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, questionReportSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      questionReportSchema,
      await readRequestInput(request),
    );
    const id = await createQuestionReport({ userId: user.id, ...input });
    return successResponse(request, { id }, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

