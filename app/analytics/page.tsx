import Link from "next/link";
import { Suspense } from "react";
import { ProgressBar } from "@/components/progress-bar";
import { getIntegratedStatistics } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntegratedAnalyticsPage() {
  const user = await requireCurrentAppUser("/analytics");
  const analyticsPromise = getIntegratedStatistics(user.id);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">학습분석</p>
            <h1>통합 학습분석</h1>
            <p>
              과정별 문제풀이, 이론 진도, 복습 기록을 모아 다음 학습 결정을
              돕습니다.
            </p>
          </div>
          <Link className="button button-dark" href="/practice">
            문제풀이 시작
          </Link>
        </header>
        <Suspense fallback={<AnalyticsMetricsFallback />}>
          <AnalyticsOverview analyticsPromise={analyticsPromise} />
        </Suspense>
        <Suspense fallback={<AnalyticsCourseActionsFallback />}>
          <AnalyticsCourseActions analyticsPromise={analyticsPromise} />
        </Suspense>
      </div>
    </main>
  );
}

type IntegratedAnalytics = Awaited<ReturnType<typeof getIntegratedStatistics>>;

async function AnalyticsOverview({
  analyticsPromise,
}: {
  analyticsPromise: Promise<IntegratedAnalytics>;
}) {
  const analytics = await analyticsPromise;
  const topCourse = analytics.courses
    .slice()
    .sort((a, b) => a.stats.overallAccuracy - b.stats.overallAccuracy)[0];

  return (
    <>
      <section className="analytics-overview-panel" aria-label="통합 학습분석 요약">
        <div>
          <p className="eyebrow">학습 신호</p>
          <h2>
            {analytics.totalQuestions
              ? `전체 정답률 ${analytics.overallAccuracy}%`
              : "학습 기록이 쌓이면 분석이 시작됩니다"}
          </h2>
          <p>
            분석은 과정별로 분리된 풀이 기록을 사용합니다. 취약 신호가 보이면
            바로 문제풀이와 복습으로 이어갈 수 있습니다.
          </p>
        </div>
        <dl>
          <div>
            <dt>수강 과정</dt>
            <dd>{analytics.enrolledCourses}개</dd>
          </div>
          <div>
            <dt>누적 학습일</dt>
            <dd>{analytics.cumulativeStudyDays}일</dd>
          </div>
          <div>
            <dt>누적 문제</dt>
            <dd>{analytics.totalQuestions}개</dd>
          </div>
          <div>
            <dt>연속 학습</dt>
            <dd>{analytics.studyStreak}일</dd>
          </div>
        </dl>
      </section>
      <section className="analytics-action-panel" aria-label="추천 분석 행동">
        <div>
          <p className="eyebrow">다음 추천 행동</p>
          <h2>가장 먼저 확인할 영역</h2>
          {topCourse ? (
            <p>
              {topCourse.courseName}의 정답률과 이론 진도를 확인하고 다음
              문제풀이로 이어가세요.
            </p>
          ) : (
            <p>과정을 수강하고 문제를 풀면 우선 확인할 영역을 보여줍니다.</p>
          )}
        </div>
        {topCourse ? (
          <div className="analytics-action-buttons">
            <Link
              className="button button-dark"
              href={`/analytics/${topCourse.courseId}`}
            >
              과정 분석 보기
            </Link>
            <Link
              className="button button-ghost"
              href={`/practice/${topCourse.courseSlug}?count=10`}
            >
              문제 10개 풀기
            </Link>
          </div>
        ) : (
          <Link className="button button-dark" href="/courses">
            과정 둘러보기
          </Link>
        )}
      </section>
      <section className="analytics-action-strip section-block" aria-label="학습분석 다음 행동">
        <Link
          className="analytics-action-card analytics-action-card-primary"
          href={topCourse ? `/analytics/${topCourse.courseId}` : "/courses"}
        >
          <span>01 · 취약 과정</span>
          <strong>{topCourse ? topCourse.courseName : "과정 선택"}</strong>
          <p>
            {topCourse
              ? "정답률과 이론 진도를 먼저 확인할 과정입니다."
              : "학습할 과정을 등록하면 분석이 시작됩니다."}
          </p>
        </Link>
        <Link
          className="analytics-action-card"
          href={topCourse ? `/practice/${topCourse.courseSlug}?count=10` : "/practice"}
        >
          <span>02 · 문제풀이</span>
          <strong>10문항으로 신호 만들기</strong>
          <p>새 풀이 기록이 쌓일수록 취약 영역 추천이 정교해집니다.</p>
        </Link>
        <Link className="analytics-action-card" href="/reviews">
          <span>03 · 복습</span>
          <strong>오답과 연체 복습 확인</strong>
          <p>분석에서 발견한 취약 신호를 복습 루틴으로 이어갑니다.</p>
        </Link>
      </section>
    </>
  );
}

function AnalyticsMetricsFallback() {
  return (
    <section className="analytics-overview-panel" aria-live="polite">
      <div>
        <p className="eyebrow">학습 신호</p>
        <h2>학습분석 정보를 불러오고 있습니다</h2>
        <p>과정별 학습 신호를 정리하는 중입니다.</p>
      </div>
      <dl aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div key={item}>
            <dt>불러오는 중</dt>
            <dd>-</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function AnalyticsCourseActions({
  analyticsPromise,
}: {
  analyticsPromise: Promise<IntegratedAnalytics>;
}) {
  const analytics = await analyticsPromise;
  return (
    <section className="section-block admin-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">과정별 다음 행동</p>
          <h2>과정별 학습 상태</h2>
          <p>
            정답률, 단계 완료율, 이론 진도율을 비교하고 과정별 분석 또는
            문제풀이로 이동합니다.
          </p>
        </div>
        <span className="count-label">연속 학습 {analytics.studyStreak}일</span>
      </div>
      {analytics.courses.length ? (
        <div className="analytics-course-list">
          {analytics.courses.map((course) => (
            <article className="analytics-course-row" key={course.courseId}>
              <Link href={`/analytics/${course.courseId}`}>
                <strong>{course.courseName}</strong>
                <small>{course.stats.totalQuestions}문제 풀이</small>
              </Link>
              <ProgressBar value={course.stats.overallAccuracy} label="정답률" />
              <span>{course.stats.levelCompletionRate}% 단계 완료</span>
              <span>{course.stats.theoryProgressPercent}% 이론 학습</span>
              <div className="analytics-row-actions">
                <Link
                  className="button button-ghost"
                  href={`/analytics/${course.courseId}`}
                >
                  자세히 보기
                </Link>
                <Link
                  className="button button-dark"
                  href={`/practice/${course.courseSlug}?count=10`}
                >
                  문제 풀기
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>아직 분석할 학습 기록이 없습니다.</strong>
          <p>관심 있는 과정을 등록하고 문제풀이를 시작해보세요.</p>
          <Link className="button button-dark" href="/courses">
            과정 둘러보기
          </Link>
        </div>
      )}
    </section>
  );
}

function AnalyticsCourseActionsFallback() {
  return (
    <section className="section-block admin-panel" aria-live="polite">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">과정별 다음 행동</p>
          <h2>과정별 학습 상태를 불러오고 있습니다</h2>
          <p>학습분석 정보를 준비하고 있습니다.</p>
        </div>
      </div>
      <div className="analytics-course-list" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <article className="analytics-course-row" key={item}>
            <div className="card-skeleton" />
          </article>
        ))}
      </div>
    </section>
  );
}
