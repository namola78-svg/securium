import {
  listRiskRegister,
  saveRiskRegisterItem,
} from "@/db/specialized-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, riskRegisterSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    return successResponse(request, {
      items: await listRiskRegister(user.id),
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
      riskRegisterSchema,
      await readRequestInput(request),
    );
    const id = await saveRiskRegisterItem(user.id, input);
    return successResponse(request, { id }, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
