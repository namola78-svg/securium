import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { ProgressBar } from "@/components/progress-bar";
import { getIntegratedStatistics } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type IntegratedAnalytics = Awaited<ReturnType<typeof getIntegratedStatistics>>;

export default async function IntegratedAnalyticsPage() {
  const user = await requireCurrentAppUser("/analytics");
  const analytics = await getIntegratedStatistics(user.id);
  const topCourse = analytics.courses
    .slice()
    .sort((a, b) => a.stats.overallAccuracy - b.stats.overallAccuracy)[0];

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">학습 분석</p>
            <h1>통합 학습 분석</h1>
            <p>과정별 문제풀이, 이론 진도와 복습 기록을 모아 다음 학습 결정을 돕습니다.</p>
          </div>
          <ActionButton href={topCourse ? `/practice/${topCourse.courseSlug}?count=10` : "/practice"} variant="dark">
            문제풀이 시작
          </ActionButton>
        </header>

        <section className="analytics-overview-panel" aria-label="통합 학습 분석 요약">
          <div>
            <p className="eyebrow">학습 결과</p>
            <h2>{analytics.totalQuestions ? `전체 정답률 ${analytics.overallAccuracy}%` : "문제를 풀면 학습 결과가 정리됩니다"}</h2>
            <p>취약 영역을 발견하면 문제풀이와 복습으로 바로 이어갈 수 있습니다.</p>
          </div>
          <dl>
            <div><dt>수강 과정</dt><dd>{analytics.enrolledCourses}개</dd></div>
            <div><dt>학습 일수</dt><dd>{analytics.cumulativeStudyDays}일</dd></div>
            <div><dt>누적 문제</dt><dd>{analytics.totalQuestions}개</dd></div>
            <div><dt>학습 연속</dt><dd>{analytics.studyStreak}일</dd></div>
          </dl>
        </section>

        <section className="analytics-action-panel" aria-label="추천 분석 행동">
          <div>
            <p className="eyebrow">다음 추천 행동</p>
            <h2>가장 먼저 취약 영역을 확인하세요</h2>
            <p>{topCourse ? `${topCourse.courseName}의 정답률과 이론 진도를 확인하고 다음 문제로 이어가세요.` : "과정을 수강하고 문제를 풀면 우선 확인할 영역을 보여드립니다."}</p>
          </div>
          {topCourse ? (
            <div className="analytics-action-buttons">
              <ActionButton variant="dark" href={`/analytics/${topCourse.courseId}`}>과정 분석 보기</ActionButton>
              <ActionButton variant="ghost" href={`/practice/${topCourse.courseSlug}?count=10`}>문제 10개 풀기</ActionButton>
            </div>
          ) : <ActionButton href="/courses" variant="dark">과정 둘러보기</ActionButton>}
        </section>

        <section className="analytics-action-strip section-block" aria-label="분석 다음 행동">
          <Link className="analytics-action-card analytics-action-card-primary" href={topCourse ? `/analytics/${topCourse.courseId}` : "/courses"}>
            <span>01 · 취약 과정</span>
            <strong>{topCourse ? topCourse.courseName : "과정 선택"}</strong>
            <p>{topCourse ? "정답률과 이론 진도를 먼저 확인하세요." : "과정을 등록하면 분석을 시작할 수 있습니다."}</p>
          </Link>
          <Link className="analytics-action-card" href={topCourse ? `/practice/${topCourse.courseSlug}?count=10` : "/practice"}>
            <span>02 · 문제풀이</span>
            <strong>10문제로 취약 영역 찾기</strong>
            <p>문제 기록이 쌓일수록 분석이 구체화됩니다.</p>
          </Link>
          <Link className="analytics-action-card" href="/reviews">
            <span>03 · 복습</span>
            <strong>오답과 예정 복습 확인</strong>
            <p>분석에서 발견한 취약 영역을 복습 루틴으로 이어갑니다.</p>
          </Link>
        </section>

        <AnalyticsCourseActions analytics={analytics} />
      </div>
    </main>
  );
}

function AnalyticsCourseActions({ analytics }: { analytics: IntegratedAnalytics }) {
  return (
    <section className="section-block learner-analytics-panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">과정별 다음 행동</p>
          <h2>과정별 학습 상태</h2>
          <p>정답률, 단계 완료율과 이론 진도를 비교하고 과정별로 이동하세요.</p>
        </div>
        <span className="count-label">학습 연속 {analytics.studyStreak}일</span>
      </div>
      {analytics.courses.length ? (
        <div className="analytics-course-list">
          {analytics.courses.map((course) => (
            <article className="analytics-course-row" key={course.courseId}>
              <Link href={`/analytics/${course.courseId}`}>
                <strong>{course.courseName}</strong>
                <small>{course.stats.totalQuestions}문제 풀이</small>
              </Link>
              <ProgressBar value={course.stats.overallAccuracy} label={`${course.courseName} 정답률`} />
              <span>{course.stats.levelCompletionRate}% 단계 완료</span>
              <span>{course.stats.theoryProgressPercent}% 이론 학습</span>
              <div className="analytics-row-actions">
                <ActionButton variant="ghost" href={`/analytics/${course.courseId}`}>상세 보기</ActionButton>
                <ActionButton variant="dark" href={`/practice/${course.courseSlug}?count=10`}>문제 풀기</ActionButton>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>아직 분석할 학습 기록이 없습니다.</strong>
          <p>과정을 등록하고 문제풀이를 시작하면 학습 분석이 쌓입니다.</p>
          <ActionButton href="/courses" variant="dark">과정 둘러보기</ActionButton>
        </div>
      )}
    </section>
  );
}
