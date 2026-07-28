import {
  archiveLearningUnit,
  saveLearningUnit,
} from "@/db/lesson-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import {
  contentArchiveSchema,
  learningUnitSchema,
  parseInput,
} from "@/lib/validation";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertRateLimit(`admin-learning-units:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(
      learningUnitSchema,
      await readRequestInput(request),
    );
    const result = await saveLearningUnit(input, user.id);
    return successResponse(
      request,
      { id: result.id },
      undefined,
      input.id ? 200 : 201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    const input = parseInput(
      contentArchiveSchema,
      await readRequestInput(request),
    );
    return successResponse(
      request,
      await archiveLearningUnit(input.id, user.id),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
