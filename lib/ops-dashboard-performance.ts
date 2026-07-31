import { getTodayLearningPlanDiagnostics } from "@/db/phase3-repositories";
import { listDashboardUserEnrollments } from "@/lib/dashboard-enrollments";

type TimingResult<T> = {
  durationMs: number;
  ok: boolean;
  value: T | null;
};

export type DashboardPerformanceSnapshot = Awaited<
  ReturnType<typeof getDashboardPerformanceSnapshot>
>;

export async function getDashboardPerformanceSnapshot(userId: string) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const [enrollments, todayPlan] = await Promise.all([
    timeStep(() => listDashboardUserEnrollments(userId)),
    timeStep(() => getTodayLearningPlanDiagnostics(userId)),
  ]);
  const activeCourseIds =
    enrollments.value
      ?.filter((enrollment) => enrollment.status === "ACTIVE")
      .map((enrollment) => enrollment.courseId) ?? [];

  return {
    requestId,
    status: "ok" as const,
    durationMs: Date.now() - startedAt,
    runtime: "nodejs" as const,
    subject: "current-admin-dashboard" as const,
    counts: {
      enrollments: enrollments.value?.length ?? null,
      activeCourses: activeCourseIds.length,
      todayRecommendations: todayPlan.value?.plan.recommendations.length ?? null,
      theoryProgressRows:
        enrollments.value?.filter(
          (enrollment) =>
            enrollment.status === "ACTIVE" &&
            enrollment.theoryTotalLessons > 0,
        ).length ?? null,
    },
    timings: {
      listDashboardUserEnrollments: toPublicTiming(enrollments),
      getTodayLearningPlan: toPublicTiming(todayPlan),
    },
    details: {
      getTodayLearningPlan: todayPlan.value?.timings ?? null,
    },
  };
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
