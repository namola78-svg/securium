import { requireCatalogManager } from "@/lib/auth";
import { recordAudit } from "@/db/audit-repositories";
import { saveSubject } from "@/db/repositories";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { parseInput, subjectSchema } from "@/lib/validation";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireCatalogManager();
    await assertRateLimit(`admin-catalog:${user.id}`, { limit: 60, windowMs: 60_000 });
    const input = parseInput(subjectSchema, await readRequestInput(request));
    const id = await saveSubject(input);
    await recordAudit({
      actorUserId: user.id,
      actorRoles: user.roles,
      action: input.id ? "SUBJECT_UPDATED" : "SUBJECT_CREATED",
      targetType: "SUBJECT",
      targetId: id,
      courseId: input.courseId,
      requestId: request.headers.get("cf-ray"),
    }, request);
    return successResponse(request, { id }, input.returnTo, input.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}
