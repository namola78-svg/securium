import { completeLevel, startLevel } from "@/db/phase3-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { levelActionSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(levelActionSchema, await readRequestInput(request));
    const result =
      input.action === "START"
        ? await startLevel(user.id, input.levelId)
        : await completeLevel(user.id, input.levelId);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

