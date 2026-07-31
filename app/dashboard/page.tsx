import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { LearningSettingsForm } from "@/components/learning-settings-form";
import { requireCurrentAppUser } from "@/lib/auth";
import { listUserEnrollments } from "@/db/repositories";
import { getTodayLearningPlan } from "@/db/phase3-repositories";
import { listCourseTheoryProgress } from "@/db/lesson-repositories";

export const metadata: Metadata = { title: "통합 대시보드" };
export const dynamic = "force-dynamic";

type Enrollment = Awaited<ReturnType<typeof listUserEnrollments>>[number];
type TodayPlan = NonNullable<Awaited<ReturnType<typeof getTodayLearningPlan>>>;

export default async function DashboardPage() {
  const user = await requireCurrentAppUser("/dashboard");
  const enrollmentsPromise = safeDashboardData(
    () => listUserEnrollments(user.id),
    [],
  );
  const todayPlanPromise = safeDashboardData(
    async () => getTodayLearningPlan(user.id, await enrollmentsPromise),
    null,
  );

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <section className="dashboard-intro">
          <div>
            <p className="eyebrow">LEARNING OVERVIEW</p>
            <h1>{user.displayName}님의 통합 대시보드</h1>
            <p>과정별 학습 기록은 서로 섞이지 않고 독립적으로 집계됩니다.</p>
          </div>
          <Link className="button button-dark" href="/courses">
            새 과정 찾기
          </Link>
        </section>

        <section className="stats-grid">
          <Suspense fallback={<DashboardStatsFallback />}>
            <DashboardStats
              enrollmentsPromise={enrollmentsPromise}
              todayPlanPromise={todayPlanPromise}
            />
          </Suspense>
        </section>

        <Suspense fallback={<TodayPlanFallback />}>
          <TodayPlanSection planPromise={todayPlanPromise} />
        </Suspense>

        <Suspense fallback={<ActiveCoursesFallback />}>
          <ActiveCoursesSection
            enrollmentsPromise={enrollmentsPromise}
            userId={user.id}
          />
        </Suspense>
      </div>
    </main>
  );
}

async function DashboardStats({
  enrollmentsPromise,
  todayPlanPromise,
}: {
  enrollmentsPromise: Promise<Enrollment[]>;
  todayPlanPromise: Promise<TodayPlan | null>;
}) {
  const [enrollments, todayPlan] = await Promise.all([
    enrollmentsPromise,
    todayPlanPromise,
  ]);
  const activeEnrollments = enrollments.filter(
    (item) => item.status === "ACTIVE",
  );
  const plan = todayPlan ?? createEmptyTodayPlan();

  return (
    <>
      <div className="stat-card">
        <span>수강 중</span>
        <strong>{activeEnrollments.length}</strong>
        <small>ACTIVE 과정</small>
      </div>
      <div className="stat-card">
        <span>전체 등록</span>
        <strong>{enrollments.length}</strong>
        <small>동시 수강 가능</small>
      </div>
      <div className="stat-card">
        <span>오늘의 학습</span>
        <strong>{plan.completedQuestions}</strong>
        <small>
          목표 {plan.settings.dailyQuestionGoal}문제 · {plan.completionPercent}%
        </small>
      </div>
      <div className="stat-card">
        <span>오늘의 복습</span>
        <strong>{plan.reviewSummary.dueCount}</strong>
        <small>
          <Link href="/reviews">예정된 복습 시작</Link>
        </small>
      </div>
    </>
  );
}

function DashboardStatsFallback() {
  return (
    <>
      <div className="stat-card" aria-busy="true">
        <span>수강 중</span>
        <strong>--</strong>
        <small>수강 정보를 확인하고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>전체 등록</span>
        <strong>--</strong>
        <small>학습 기록을 불러오고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>오늘의 학습</span>
        <strong>--</strong>
        <small>학습 정보를 불러오고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>오늘의 복습</span>
        <strong>--</strong>
        <small>복습 일정을 확인하고 있습니다</small>
      </div>
    </>
  );
}

async function TodayPlanSection({
  planPromise,
}: {
  planPromise: Promise<TodayPlan | null>;
}) {
  const plan = (await planPromise) ?? createEmptyTodayPlan();

  return (
    <section className="section-block today-plan">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">TODAY PLAN</p>
          <h2>오늘의 추천 학습</h2>
        </div>
        <Link className="text-link" href="/analytics">
          통합 학습분석 →
        </Link>
      </div>
      <div className="today-plan-grid">
        <div className="admin-panel">
          <ProgressBar value={plan.completionPercent} label="오늘 문제 목표" />
          <LearningSettingsForm
            dailyQuestionGoal={plan.settings.dailyQuestionGoal}
            dailyStudyMinutes={plan.settings.dailyStudyMinutes}
          />
        </div>
        <div className="recommendation-list">
          {plan.recommendations.slice(0, 5).map((item) => (
            <Link
              className="recommendation-card"
              href={item.href}
              key={`${item.kind}-${item.id}`}
            >
              <span className="badge">{item.kind}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
              </div>
              <small>약 {item.estimatedMinutes}분 →</small>
            </Link>
          ))}
          {!plan.recommendations.length ? (
            <div className="empty-state">
              <strong>추천을 만들 학습 기록이 없습니다.</strong>
              <p>과정의 첫 단계를 시작하면 실제 기록을 기반으로 추천합니다.</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TodayPlanFallback() {
  return (
    <section className="section-block today-plan" aria-busy="true">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">TODAY PLAN</p>
          <h2>오늘의 추천 학습</h2>
        </div>
        <Link className="text-link" href="/analytics">
          통합 학습분석 →
        </Link>
      </div>
      <div className="empty-state">
        <strong>학습 정보를 불러오고 있습니다</strong>
        <p>추천 학습과 복습 일정을 확인하는 중입니다.</p>
      </div>
    </section>
  );
}

async function ActiveCoursesSection({
  enrollmentsPromise,
  userId,
}: {
  enrollmentsPromise: Promise<Enrollment[]>;
  userId: string;
}) {
  const enrollments = await enrollmentsPromise;
  const activeEnrollments = enrollments.filter(
    (item) => item.status === "ACTIVE",
  );
  const theoryProgress = await safeDashboardData(
    () =>
      listCourseTheoryProgress(
        userId,
        activeEnrollments.map((enrollment) => enrollment.courseId),
      ),
    [],
  );

  return (
    <section className="section-block">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MY ACTIVE COURSES</p>
          <h2>진행 중인 과정</h2>
        </div>
        <Link className="text-link" href="/my-courses">
          전체 수강 관리 →
        </Link>
      </div>
      {activeEnrollments.length ? (
        <div className="enrollment-grid">
          {activeEnrollments.map((enrollment) => (
            <article className="enrollment-card" key={enrollment.id}>
              <div className="course-card-top">
                <span className="course-code">{enrollment.groupName}</span>
                <span className="badge">{enrollment.status}</span>
              </div>
              <h3>{enrollment.courseName}</h3>
              <ProgressBar
                value={enrollment.progressPercent}
                label="과정 진도"
              />
              <dl className="metric-list">
                <div>
                  <dt>현재 단계</dt>
                  <dd>
                    {enrollment.currentLevel} / {enrollment.totalLevels}
                  </dd>
                </div>
                <div>
                  <dt>정답률</dt>
                  <dd>
                    {enrollment.accuracy === null
                      ? "데이터 없음"
                      : `${enrollment.accuracy}%`}
                  </dd>
                </div>
                <div>
                  <dt>최근 학습</dt>
                  <dd>
                    {enrollment.lastStudiedAt
                      ? new Date(enrollment.lastStudiedAt).toLocaleDateString(
                          "ko-KR",
                        )
                      : "아직 없음"}
                  </dd>
                </div>
                <div>
                  <dt>이론 진도</dt>
                  <dd>
                    {theoryProgress.find(
                      (item) => item.courseId === enrollment.courseId,
                    )?.progressPercent ?? 0}
                    %
                  </dd>
                </div>
              </dl>
              <div className="card-actions">
                <Link
                  className="button button-dark"
                  href={`/practice/${enrollment.courseSlug}?random=1&count=10`}
                >
                  문제 풀기
                </Link>
                <Link
                  className="button button-ghost"
                  href={`/learn/${enrollment.courseSlug}`}
                >
                  과정 대시보드
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>진행 중인 과정이 없습니다.</strong>
          <p>과정 목록에서 관심 있는 과정을 수강해 보세요.</p>
          <Link className="button button-dark" href="/courses">
            과정 둘러보기
          </Link>
        </div>
      )}
    </section>
  );
}

function ActiveCoursesFallback() {
  return (
    <section className="section-block" aria-busy="true">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">MY ACTIVE COURSES</p>
          <h2>진행 중인 과정</h2>
        </div>
        <Link className="text-link" href="/my-courses">
          전체 수강 관리 →
        </Link>
      </div>
      <div className="empty-state">
        <strong>수강 중인 과정을 불러오고 있습니다</strong>
        <p>과정별 진도와 최근 학습 기록을 확인하는 중입니다.</p>
      </div>
    </section>
  );
}

async function safeDashboardData<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function createEmptyTodayPlan() {
  return {
    settings: {
      dailyQuestionGoal: 10,
      dailyStudyMinutes: 30,
    },
    completedQuestions: 0,
    completionPercent: 0,
    reviewSummary: {
      dueCount: 0,
      overdueCount: 0,
      estimatedMinutes: 0,
      completionPercent: 0,
      byCourse: [],
    },
    recommendations: [],
  };
}
