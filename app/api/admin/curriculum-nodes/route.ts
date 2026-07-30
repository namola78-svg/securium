import { requireCatalogManager } from "@/lib/auth";
import {
  archiveCurriculumNode,
  getCurriculumNodeTree,
  listCurriculumNodes,
  saveCurriculumNode,
} from "@/db/curriculum-repositories";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  curriculumNodeArchiveSchema,
  curriculumNodeSchema,
  parseInput,
} from "@/lib/validation";
import { AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await requireCatalogManager();
    const url = new URL(request.url);
    const treeId = url.searchParams.get("treeId");
    if (!treeId) {
      throw new AppError(
        "treeId가 필요합니다.",
        400,
        "CURRICULUM_TREE_ID_REQUIRED",
      );
    }
    const asTree = url.searchParams.get("tree") !== "false";
    const nodes = asTree
      ? await getCurriculumNodeTree(treeId)
      : await listCurriculumNodes(treeId);
    return successResponse(request, { nodes });
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
    const rawInput = await readRequestInput(request);
    const action =
      typeof rawInput === "object" &&
      rawInput !== null &&
      "action" in rawInput &&
      rawInput.action === "archive"
        ? "archive"
        : "save";

    if (action === "archive") {
      const input = parseInput(curriculumNodeArchiveSchema, rawInput);
      const result = await archiveCurriculumNode(input, user.id);
      return successResponse(request, result, undefined, 200);
    }

    const input = parseInput(curriculumNodeSchema, rawInput);
    const result = await saveCurriculumNode(input, user.id);
    return successResponse(request, result, undefined, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertRateLimit(`admin-curriculum:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(
      curriculumNodeArchiveSchema,
      await readRequestInput(request),
    );
    return successResponse(
      request,
      await archiveCurriculumNode(input, user.id),
      undefined,
      200,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
