import { updateWrongNote } from "@/db/question-repositories";
import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, wrongNoteUpdateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = parseInput(
      wrongNoteUpdateSchema,
      await readRequestInput(request),
    );
    await updateWrongNote({ userId: user.id, ...input });
    return successResponse(request, { updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}

