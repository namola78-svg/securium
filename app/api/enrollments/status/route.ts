import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { enrollmentStatusSchema, parseInput } from "@/lib/validation";
import { createEnrollmentRepository } from "@/db/repositories";
import { changeEnrollmentStatus } from "@/lib/services/enrollment-service";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`enrollment-status:${user.id}`);
    const input = parseInput(
      enrollmentStatusSchema,
      await readRequestInput(request),
    );
    const enrollment = await changeEnrollmentStatus(
      createEnrollmentRepository(),
      user.id,
      input.enrollmentId,
      input.status,
    );
    return successResponse(request, { enrollment }, input.returnTo);
  } catch (error) {
    return errorResponse(error);
  }
}
