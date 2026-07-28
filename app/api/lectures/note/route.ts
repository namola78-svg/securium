import { saveLectureNote } from "@/db/lecture-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { lectureNoteSchema, parseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      lectureNoteSchema,
      await readRequestInput(request),
    );
    const result = await saveLectureNote(
      user.id,
      input.lectureId,
      input.content,
    );
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}
