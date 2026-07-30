import { requireCatalogManager } from "@/lib/auth";
import {
  getActiveCurriculumTreeForCourse,
  getCurriculumTreeById,
  listCurriculumTrees,
  saveCurriculumTree,
} from "@/db/curriculum-repositories";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { curriculumTreeSchema, parseInput } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireCatalogManager();
    const url = new URL(request.url);
    const treeId = url.searchParams.get("id");
    const courseId = url.searchParams.get("courseId") ?? undefined;
    const active = url.searchParams.get("active") === "true";
    if (treeId) {
      const tree = await getCurriculumTreeById(treeId);
      return successResponse(request, { tree });
    }
    if (active && courseId) {
      const tree = await getActiveCurriculumTreeForCourse(courseId);
      return successResponse(request, { tree });
    }
    const trees = await listCurriculumTrees(courseId);
    return successResponse(request, { trees });
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertRateLimit(`admin-curriculum:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(
      curriculumTreeSchema,
      await readRequestInput(request),
    );
    const result = await saveCurriculumTree(input, user.id);
    return successResponse(request, result, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error, request);
  }
}
