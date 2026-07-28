import { gradeWrittenQuestion } from "@/db/specialized-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, writtenGradeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      writtenGradeSchema,
      await readRequestInput(request),
    );
    const result = await gradeWrittenQuestion({ userId: user.id, ...input });
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
