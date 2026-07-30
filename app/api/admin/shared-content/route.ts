import { requireCatalogManager } from "@/lib/auth";
import {
  listCourseLessons,
  listSharedContents,
  listSharedContentUsage,
  saveCourseLesson,
  saveCourseLessonExtension,
  saveSharedContent,
} from "@/db/shared-content-repositories";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { sharedContentAdminSchema, parseInput } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await requireCatalogManager();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "contents";
    if (scope === "contents") {
      return successResponse(request, {
        contents: await listSharedContents(
          url.searchParams.get("status") ?? undefined,
        ),
      });
    }
    if (scope === "courseLessons") {
      const courseId = url.searchParams.get("courseId");
      if (!courseId) {
        throw new AppError("courseId가 필요합니다.", 400, "COURSE_ID_REQUIRED");
      }
      return successResponse(request, {
        courseLessons: await listCourseLessons(courseId),
      });
    }
    if (scope === "usage") {
      const contentId = url.searchParams.get("contentId");
      if (!contentId) {
        throw new AppError(
          "contentId가 필요합니다.",
          400,
          "CONTENT_ID_REQUIRED",
        );
      }
      return successResponse(request, {
        usage: await listSharedContentUsage(contentId),
      });
    }
    throw new AppError("지원하지 않는 조회 범위입니다.", 400, "SCOPE_INVALID");
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertRateLimit(`admin-shared-content:${user.id}`, {
      limit: 60,
      windowMs: 60_000,
    });
    const input = parseInput(sharedContentAdminSchema, await readRequestInput(request));
    if (input.operation === "saveContent") {
      return successResponse(
        request,
        await saveSharedContent(input.content, user.id),
        undefined,
        input.content.id ? 200 : 201,
      );
    }
    if (input.operation === "saveCourseLesson") {
      return successResponse(
        request,
        await saveCourseLesson(input.courseLesson, user.id),
        undefined,
        input.courseLesson.id ? 200 : 201,
      );
    }
    return successResponse(
      request,
      await saveCourseLessonExtension(input.extension, user.id),
      undefined,
      input.extension.id ? 200 : 201,
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
