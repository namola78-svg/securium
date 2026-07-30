import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { getIntegratedStatistics } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IntegratedAnalyticsPage() {
  const user = await requireCurrentAppUser("/analytics");
  const analytics = await getIntegratedStatistics(user.id);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">LEARNING ANALYTICS</p>
            <h1>통합 학습분석</h1>
            <p>
              수강 중인 과정의 문제풀이, 단계, 복습 기록을 모아 다음 학습
              행동으로 연결합니다.
            </p>
          </div>
          <Link className="button button-dark" href="/practice">
            문제풀이 시작
          </Link>
        </header>
        <section className="stats-grid">
          <Metric label="수강 과정" value={analytics.enrolledCourses} unit="개" />
          <Metric label="누적 학습일" value={analytics.cumulativeStudyDays} unit="일" />
          <Metric label="누적 문제" value={analytics.totalQuestions} unit="개" />
          <Metric label="전체 정답률" value={analytics.overallAccuracy} unit="%" />
        </section>
        <section className="section-block admin-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">COURSE ACTIONS</p>
              <h2>과정별 학습 상태</h2>
              <p>
                정답률과 단계 완료율을 확인하고, 바로 분석 또는 문제풀이로 이어갑니다.
              </p>
            </div>
            <span className="count-label">연속 학습 {analytics.studyStreak}일</span>
          </div>
          <div className="analytics-course-list">
            {analytics.courses.map((course) => (
              <article className="analytics-course-row" key={course.courseId}>
                <Link href={`/analytics/${course.courseId}`}>
                  <strong>{course.courseName}</strong>
                  <small>{course.stats.totalQuestions}문제 풀이</small>
                </Link>
                <ProgressBar
                  value={course.stats.overallAccuracy}
                  label="정답률"
                />
                <span>{course.stats.levelCompletionRate}% 단계 완료</span>
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
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}
