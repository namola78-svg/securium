import { getCourseStatistics } from "@/db/phase3-repositories";
import { getCourseById, getEnrollmentForCourse } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CourseAnalyticsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const user = await requireCurrentAppUser(`/analytics/${courseId}`);
  const [course, enrollment] = await Promise.all([
    getCourseById(courseId),
    getEnrollmentForCourse(user.id, courseId),
  ]);
  if (!course || !enrollment) notFound();
  const stats = await getCourseStatistics(user.id, courseId);
  const weakTopics = [...stats.byTopic]
    .filter((item) => item.id !== "UNMAPPED")
    .sort((a, b) => a.accuracy - b.accuracy);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">COURSE ANALYTICS</p>
            <h1>{course.name} 학습분석</h1>
            <p>정답률 분모가 0인 항목은 안전하게 0%로 표시합니다.</p>
          </div>
        </header>
        <section className="stats-grid">
          <Metric label="전체 정답률" value={stats.overallAccuracy} unit="%" />
          <Metric label="최근 7일" value={stats.recent7Days} unit="문제" />
          <Metric label="평균 응답" value={Math.round(stats.averageResponseTime / 1000)} unit="초" />
          <Metric label="모의고사 평균" value={stats.mockExamAverageScore} unit="점" />
        </section>
        <section className="analytics-grid section-block">
          <Breakdown title="난이도별 정답률" rows={stats.byDifficulty} />
          <Breakdown title="문제 유형별 정답률" rows={stats.byType} />
          <Breakdown title="과목별 정답률" rows={stats.bySubject} />
          <Breakdown title="주제별 우선 복습 영역" rows={weakTopics} />
        </section>
        <section className="stats-grid section-block">
          <Metric label="최근 30일" value={stats.recent30Days} unit="문제" />
          <Metric label="반복 오답" value={stats.repeatedWrongCount} unit="문제" />
          <Metric label="복습 성공률" value={stats.reviewSuccessRate} unit="%" />
          <Metric label="단계 완료율" value={stats.levelCompletionRate} unit="%" />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{unit}</small></div>;
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; total: number; accuracy: number }>;
}) {
  return (
    <section className="admin-panel analytics-panel">
      <h2>{title}</h2>
      {rows.length ? rows.map((row) => (
        <div className="bar-row" key={row.id}>
          <div><strong>{row.id}</strong><span>{row.total}문제 · {row.accuracy}%</span></div>
          <div className="progress-track"><span style={{ width: `${row.accuracy}%` }} /></div>
        </div>
      )) : <p>집계할 학습 기록이 없습니다.</p>}
    </section>
  );
}
