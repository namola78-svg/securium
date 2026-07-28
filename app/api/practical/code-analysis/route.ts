import { submitCodeAnalysis } from "@/db/practical-specialization-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  codeAnalysisSubmissionSchema,
  parseInput,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      codeAnalysisSubmissionSchema,
      await readRequestInput(request),
    );
    return successResponse(
      request,
      await submitCodeAnalysis(user.id, input),
      undefined,
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
