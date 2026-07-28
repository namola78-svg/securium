import Link from "next/link";
import { getIntegratedStatistics } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { ProgressBar } from "@/components/progress-bar";

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
            <p>실제 풀이·복습·단계·모의고사 기록만 집계합니다.</p>
          </div>
        </header>
        <section className="stats-grid">
          <Metric label="수강 과정" value={analytics.enrolledCourses} unit="개" />
          <Metric label="누적 학습일" value={analytics.cumulativeStudyDays} unit="일" />
          <Metric label="누적 문제" value={analytics.totalQuestions} unit="개" />
          <Metric label="전체 정답률" value={analytics.overallAccuracy} unit="%" />
        </section>
        <section className="section-block admin-panel">
          <h2>연속 학습일 {analytics.studyStreak}일</h2>
          <div className="analytics-course-list">
            {analytics.courses.map((course) => (
              <Link
                className="analytics-course-row"
                href={`/analytics/${course.courseId}`}
                key={course.courseId}
              >
                <div>
                  <strong>{course.courseName}</strong>
                  <small>{course.stats.totalQuestions}문제 풀이</small>
                </div>
                <ProgressBar
                  value={course.stats.overallAccuracy}
                  label="정답률"
                />
                <span>{course.stats.levelCompletionRate}% 단계 완료</span>
              </Link>
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

