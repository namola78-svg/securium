import { toggleContentBookmark } from "@/db/specialized-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { contentBookmarkSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      contentBookmarkSchema,
      await readRequestInput(request),
    );
    return successResponse(request, {
      result: await toggleContentBookmark({ userId: user.id, ...input }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
