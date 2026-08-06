import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LearningSettingsForm } from "@/components/learning-settings-form";
import { ProgressBar } from "@/components/progress-bar";
import { getTodayLearningPlan } from "@/db/phase3-repositories";
import { listDashboardUserEnrollments } from "@/lib/dashboard-enrollments";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = { title: "내 학습 대시보드" };
export const dynamic = "force-dynamic";

type Enrollment = Awaited<ReturnType<typeof listDashboardUserEnrollments>>[number];
type TodayPlan = NonNullable<Awaited<ReturnType<typeof getTodayLearningPlan>>>;
type DashboardPlan = TodayPlan | ReturnType<typeof createEmptyTodayPlan>;

export default async function DashboardPage() {
  const user = await requireCurrentAppUser("/dashboard");
  const enrollmentsPromise = safeDashboardData(
    () => listDashboardUserEnrollments(user.id),
    [],
  );
  const todayPlanPromise = safeDashboardData(
    () => getTodayLearningPlan(user.id),
    null,
  );

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <Suspense fallback={<DashboardHeroFallback displayName={user.displayName} />}>
          <DashboardHero
            displayName={user.displayName}
            enrollmentsPromise={enrollmentsPromise}
            todayPlanPromise={todayPlanPromise}
          />
        </Suspense>

        <Suspense fallback={<TodayPlanFallback />}>
          <TodayPlanSection planPromise={todayPlanPromise} />
        </Suspense>

        <Suspense fallback={<ActiveCoursesFallback />}>
          <ActiveCoursesSection enrollmentsPromise={enrollmentsPromise} />
        </Suspense>

        <section className="section-block dashboard-summary-section">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">기록 요약</p>
              <h2>학습 기록은 아래에서 가볍게 확인하세요</h2>
              <p>오늘 할 일을 먼저 정한 뒤, 필요한 수치만 확인합니다.</p>
            </div>
            <Link className="text-link" href="/analytics">
              자세히 분석하기 →
            </Link>
          </div>
          <div className="stats-grid">
            <Suspense fallback={<DashboardStatsFallback />}>
              <DashboardStats
                enrollmentsPromise={enrollmentsPromise}
                todayPlanPromise={todayPlanPromise}
              />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

async function DashboardHero({
  displayName,
  enrollmentsPromise,
  todayPlanPromise,
}: {
  displayName: string;
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
  const currentCourse = activeEnrollments
    .slice()
    .sort((left, right) => {
      const leftTime = left.lastStudiedAt
        ? new Date(left.lastStudiedAt).getTime()
        : 0;
      const rightTime = right.lastStudiedAt
        ? new Date(right.lastStudiedAt).getTime()
        : 0;
      return rightTime - leftTime;
    })[0];
  const plan = todayPlan ?? createEmptyTodayPlan();
  const remainingQuestions = Math.max(
    plan.settings.dailyQuestionGoal - plan.completedQuestions,
    0,
  );
  const primaryHref = currentCourse
    ? `/learn/${currentCourse.courseSlug}`
    : "/courses";
  const primaryLabel = currentCourse ? "이어서 학습" : "과정 선택";
  const nextAction = getDashboardNextAction(currentCourse, plan);
  const nextLearningLabel = currentCourse
    ? `${currentCourse.courseName} · ${currentCourse.progressPercent}%`
    : "과정 선택 전";
  const examReadinessLabel = currentCourse
    ? `${currentCourse.currentLevel}/${currentCourse.totalLevels}단계 진행`
    : "첫 과정 선택 필요";

  return (
    <section className="dashboard-intro dashboard-hero">
      <div>
        <p className="eyebrow">오늘의 학습 홈</p>
        <h1>{displayName}님, 오늘은 이것부터 하면 됩니다</h1>
        <p>
          {currentCourse
            ? `${currentCourse.courseName}의 이어서 학습, 복습, 문제풀이를 한 화면에서 정리했습니다.`
            : "관심 있는 과정을 선택하면 오늘 할 학습, 복습, 취약 영역을 자동으로 정리합니다."}
        </p>
        <dl className="dashboard-action-rail" aria-label="오늘의 학습 판단 기준">
          <div>
            <dt>어디까지 했지?</dt>
            <dd>{nextLearningLabel}</dd>
          </div>
          <div>
            <dt>다음은?</dt>
            <dd>{nextAction.title}</dd>
          </div>
          <div>
            <dt>시험 준비는?</dt>
            <dd>{examReadinessLabel}</dd>
          </div>
          <div>
            <dt>약한 부분은?</dt>
            <dd>{plan.reviewSummary.dueCount}개 복습 예정</dd>
          </div>
        </dl>
        <div className="dashboard-next-action">
          <span className="badge">추천 다음 행동</span>
          <div>
            <strong>{nextAction.title}</strong>
            <p>{nextAction.reason}</p>
          </div>
          <Link className="button button-lime" href={nextAction.href}>
            {nextAction.cta}
          </Link>
        </div>
        <div className="dashboard-hero-actions">
          <Link className="button button-dark" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="button button-ghost" href="/reviews">
            오늘의 복습 보기
          </Link>
        </div>
      </div>
      <aside className="dashboard-focus-card" aria-label="오늘의 학습 요약">
        <span className="badge">오늘의 초점</span>
        <strong>{currentCourse?.courseName ?? "학습 과정 선택"}</strong>
        <p>
          {currentCourse
            ? "학습, 복습, 문제풀이를 한 과정 안에서 이어갑니다."
            : "첫 과정을 선택하면 개인화된 학습 흐름이 시작됩니다."}
        </p>
        <dl className="dashboard-focus-list">
          <div>
            <dt>오늘 남은 문제</dt>
            <dd>{remainingQuestions}문제</dd>
          </div>
          <div>
            <dt>복습 예정</dt>
            <dd>{plan.reviewSummary.dueCount}개</dd>
          </div>
          <div>
            <dt>전체 진도</dt>
            <dd>{currentCourse ? `${currentCourse.progressPercent}%` : "대기 중"}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

function DashboardHeroFallback({ displayName }: { displayName: string }) {
  return (
    <section className="dashboard-intro dashboard-hero" aria-busy="true">
      <div>
        <p className="eyebrow">오늘의 학습 홈</p>
        <h1>{displayName}님의 오늘 할 일을 불러오고 있습니다</h1>
        <p>이어서 학습, 복습, 문제풀이 후보를 확인하는 중입니다.</p>
      </div>
      <aside className="dashboard-focus-card" aria-label="오늘의 학습 요약">
        <span className="badge">확인 중</span>
        <strong>학습 요약을 불러오고 있습니다</strong>
        <p>잠시 후 오늘의 추천 행동과 과정별 진도를 표시합니다.</p>
      </aside>
    </section>
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
        <span>학습 중</span>
        <strong>{activeEnrollments.length}</strong>
        <small>이어갈 수 있는 과정</small>
      </div>
      <div className="stat-card">
        <span>등록 과정</span>
        <strong>{enrollments.length}</strong>
        <small>과정별로 따로 관리</small>
      </div>
      <div className="stat-card">
        <span>오늘 완료</span>
        <strong>{plan.completedQuestions}</strong>
        <small>
          목표 {plan.settings.dailyQuestionGoal}문제 · {plan.completionPercent}%
        </small>
      </div>
      <div className="stat-card">
        <span>복습 대기</span>
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
        <span>학습 중</span>
        <strong>--</strong>
        <small>수강 정보를 확인하고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>등록 과정</span>
        <strong>--</strong>
        <small>학습 기록을 불러오고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>오늘 완료</span>
        <strong>--</strong>
        <small>학습 정보를 불러오고 있습니다</small>
      </div>
      <div className="stat-card" aria-busy="true">
        <span>복습 대기</span>
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
  const primaryRecommendation = plan.recommendations[0];
  const remainingQuestions = Math.max(
    plan.settings.dailyQuestionGoal - plan.completedQuestions,
    0,
  );

  return (
    <section className="section-block today-plan">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">오늘의 학습 계획</p>
          <h2>오늘 할 학습</h2>
          <p>복습 예정, 취약 영역, 최근 학습 흐름을 기준으로 지금 할 일을 정리합니다.</p>
        </div>
        <Link className="text-link" href="/reviews">
          복습 전체 보기 →
        </Link>
      </div>
      <div className="today-plan-grid">
        <article className="today-plan-card today-plan-card-primary">
          <span className="badge">오늘 목표</span>
          <h3>{remainingQuestions ? `${remainingQuestions}문제 남았습니다` : "오늘 목표를 완료했습니다"}</h3>
          <ProgressBar value={plan.completionPercent} label="오늘 문제 목표" />
          <p>
            목표 {plan.settings.dailyQuestionGoal}문제 중 {plan.completedQuestions}문제를
            완료했습니다. 실제 풀이 기록을 기준으로 표시합니다.
          </p>
          <Link className="button button-dark" href={primaryRecommendation?.href ?? "/practice"}>
            문제풀이 시작하기
          </Link>
        </article>
        <article className="today-plan-card">
          <span className="badge">복습</span>
          <h3>{plan.reviewSummary.dueCount}개 복습 예정</h3>
          <p>
            오답, 취약 개념, 반복 학습 기록을 기준으로 오늘 다시 볼 항목을 모았습니다.
          </p>
          <Link className="text-link" href="/reviews">
            복습 시작하기 →
          </Link>
        </article>
        <article className="today-plan-card">
          <span className="badge">AI 추천</span>
          <h3>{primaryRecommendation?.title ?? "첫 학습 기록을 만들어보세요"}</h3>
          <p>
            {primaryRecommendation?.reason ??
              "문제풀이와 이론 학습 기록이 쌓이면 AI가 다음 학습 후보를 더 정확하게 정리합니다."}
          </p>
          <Link className="text-link" href={primaryRecommendation?.href ?? "/courses"}>
            추천 학습 열기 →
          </Link>
        </article>
        <article className="today-plan-card today-plan-settings-card">
          <span className="badge">학습 설정</span>
          <h3>하루 목표 조정</h3>
          <p>문제 수와 학습 시간을 내 페이스에 맞춰 조정합니다.</p>
          <LearningSettingsForm
            dailyQuestionGoal={plan.settings.dailyQuestionGoal}
            dailyStudyMinutes={plan.settings.dailyStudyMinutes}
          />
        </article>
      </div>
      <div className="today-recommendation-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">추천 학습</p>
            <h3>바로 이어갈 학습</h3>
          </div>
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
              <strong>아직 추천할 학습 기록이 충분하지 않습니다.</strong>
              <p>
                과정을 선택하고 첫 문제풀이 또는 이론 학습을 시작하면 실제 기록을
                기반으로 추천합니다.
              </p>
              <Link className="button button-dark" href="/courses">
                과정 둘러보기
              </Link>
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
          <p className="eyebrow">오늘의 학습 계획</p>
          <h2>오늘 할 학습</h2>
        </div>
        <Link className="text-link" href="/reviews">
          복습 전체 보기 →
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
}: {
  enrollmentsPromise: Promise<Enrollment[]>;
}) {
  const enrollments = await enrollmentsPromise;
  const activeEnrollments = enrollments.filter(
    (item) => item.status === "ACTIVE",
  );

  return (
    <section className="section-block">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">이어서 학습</p>
          <h2>진행 중인 과정</h2>
        </div>
        <Link className="text-link" href="/my-courses">
          내 학습 전체 보기 →
        </Link>
      </div>
      {activeEnrollments.length ? (
        <div className="enrollment-grid">
          {activeEnrollments.map((enrollment) => (
            <article className="enrollment-card" key={enrollment.id}>
              <div className="course-card-top">
                <span className="course-code">{enrollment.groupName}</span>
                <span className="badge">
                  {getEnrollmentStatusLabel(enrollment.status)}
                </span>
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
                      ? "풀이 기록 없음"
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
                      : "시작 전"}
                  </dd>
                </div>
                <div>
                  <dt>이론 진도</dt>
                  <dd>{enrollment.theoryProgressPercent ?? 0}%</dd>
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
                  이어서 학습
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
          <p className="eyebrow">이어서 학습</p>
          <h2>이어서 학습</h2>
        </div>
        <Link className="text-link" href="/my-courses">
          내 학습 전체 보기 →
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

function getDashboardNextAction(
  currentCourse: Enrollment | undefined,
  plan: DashboardPlan,
) {
  const firstRecommendation = plan.recommendations[0];
  if (firstRecommendation) {
    return {
      href: firstRecommendation.href,
      title: firstRecommendation.title,
      reason: firstRecommendation.reason,
      cta: "추천 학습 열기",
    };
  }

  if (plan.reviewSummary.dueCount > 0) {
    return {
      href: "/reviews",
      title: "오늘 예정된 복습부터 시작하세요",
      reason: `${plan.reviewSummary.dueCount}개의 복습 항목이 기다리고 있습니다.`,
      cta: "복습 시작",
    };
  }

  if (currentCourse) {
    return {
      href: `/learn/${currentCourse.courseSlug}`,
      title: `${currentCourse.courseName} 학습을 이어가세요`,
      reason: `현재 과정 진도는 ${currentCourse.progressPercent}%입니다.`,
      cta: "이어서 학습",
    };
  }

  return {
    href: "/courses",
    title: "첫 학습 과정을 선택하세요",
    reason: "과정을 추가하면 진도, 복습, 추천 학습이 과정별로 관리됩니다.",
    cta: "과정 선택",
  };
}

function getEnrollmentStatusLabel(status: Enrollment["status"]) {
  switch (status) {
    case "ACTIVE":
      return "학습 중";
    case "COMPLETED":
      return "완료";
    case "CANCELLED":
      return "수강 취소";
    default:
      return "학습 상태";
  }
}
