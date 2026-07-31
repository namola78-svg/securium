import { listCourseTheoryProgress } from "@/db/lesson-repositories";
import { getTodayLearningPlan } from "@/db/phase3-repositories";
import { listUserEnrollments } from "@/db/repositories";
import { requireAuditViewer } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TimingResult<T> = {
  durationMs: number;
  ok: boolean;
  value: T | null;
};

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const user = await requireAuditViewer();
    const enrollments = await timeStep(() => listUserEnrollments(user.id));
    const activeCourseIds =
      enrollments.value
        ?.filter((enrollment) => enrollment.status === "ACTIVE")
        .map((enrollment) => enrollment.courseId) ?? [];
    const [todayPlan, theoryProgress] = await Promise.all([
      timeStep(() => getTodayLearningPlan(user.id)),
      timeStep(() => listCourseTheoryProgress(user.id, activeCourseIds)),
    ]);

    return Response.json(
      {
        requestId,
        status: "ok",
        durationMs: Date.now() - startedAt,
        runtime: "nodejs",
        subject: "current-admin-dashboard",
        counts: {
          enrollments: enrollments.value?.length ?? null,
          activeCourses: activeCourseIds.length,
          todayRecommendations: todayPlan.value?.recommendations.length ?? null,
          theoryProgressRows: theoryProgress.value?.length ?? null,
        },
        timings: {
          listUserEnrollments: toPublicTiming(enrollments),
          getTodayLearningPlan: toPublicTiming(todayPlan),
          listCourseTheoryProgress: toPublicTiming(theoryProgress),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

async function timeStep<T>(loader: () => Promise<T>): Promise<TimingResult<T>> {
  const startedAt = Date.now();
  try {
    const value = await loader();
    return {
      durationMs: Date.now() - startedAt,
      ok: true,
      value,
    };
  } catch {
    return {
      durationMs: Date.now() - startedAt,
      ok: false,
      value: null,
    };
  }
}

function toPublicTiming<T>(result: TimingResult<T>) {
  return {
    durationMs: result.durationMs,
    ok: result.ok,
  };
}
