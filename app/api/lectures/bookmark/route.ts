import { toggleLectureBookmark } from "@/db/lecture-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { lectureBookmarkSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      lectureBookmarkSchema,
      await readRequestInput(request),
    );
    const result = await toggleLectureBookmark(user.id, input.lectureId);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
