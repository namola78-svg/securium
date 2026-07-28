import { requireApiUser } from "@/lib/auth";
import {
  assertSameOrigin,
  errorResponse,
  readRequestInput,
  successResponse,
} from "@/lib/http";
import { enrollmentSchema, parseInput } from "@/lib/validation";
import { createEnrollmentRepository } from "@/db/repositories";
import { enrollInCourse } from "@/lib/services/enrollment-service";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await assertRateLimit(`enroll:${user.id}`, { limit: 10, windowMs: 60_000 });
    const input = parseInput(
      enrollmentSchema,
      await readRequestInput(request),
    );
    const enrollment = await enrollInCourse(
      createEnrollmentRepository(),
      user.id,
      input.courseId,
    );
    return successResponse(request, { enrollment }, input.returnTo, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
