import { calculateRiskWithMethod } from "@/db/specialized-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, riskCalculationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireApiUser();
    const input = parseInput(
      riskCalculationSchema,
      await readRequestInput(request),
    );
    return successResponse(request, {
      result: await calculateRiskWithMethod(input),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
