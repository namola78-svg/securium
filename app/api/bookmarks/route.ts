import { toggleBookmark } from "@/db/question-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { bookmarkSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(bookmarkSchema, await readRequestInput(request));
    const result = await toggleBookmark({ userId: user.id, ...input });
    return successResponse(request, result);
  } catch (error) {
    return errorResponse(error);
  }
}

