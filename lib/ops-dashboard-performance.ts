import { listCourseTheoryProgress } from "@/db/lesson-repositories";
import { getTodayLearningPlanDiagnostics } from "@/db/phase3-repositories";
import { listUserEnrollments } from "@/db/repositories";

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
  const enrollments = await timeStep(() => listUserEnrollments(userId));
  const activeCourseIds =
    enrollments.value
      ?.filter((enrollment) => enrollment.status === "ACTIVE")
      .map((enrollment) => enrollment.courseId) ?? [];
  const activeEnrollments =
    enrollments.value?.filter((enrollment) => enrollment.status === "ACTIVE") ??
    [];
  const [todayPlan, theoryProgress] = await Promise.all([
    timeStep(() => getTodayLearningPlanDiagnostics(userId, activeEnrollments)),
    timeStep(() => listCourseTheoryProgress(userId, activeCourseIds)),
  ]);

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
      theoryProgressRows: theoryProgress.value?.length ?? null,
    },
    timings: {
      listUserEnrollments: toPublicTiming(enrollments),
      getTodayLearningPlan: toPublicTiming(todayPlan),
      listCourseTheoryProgress: toPublicTiming(theoryProgress),
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
