import {
  getAdminOperationalStats,
  listAdminMockExams,
} from "@/db/phase3-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}) {
  await requireCatalogManager("/admin/analytics");
  const { courseId } = await searchParams;
  const [courses, exams, stats] = await Promise.all([
    listAllCourses(),
    listAdminMockExams(courseId),
    getAdminOperationalStats(courseId),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">OPERATIONS ANALYTICS</p>
        <h1>학습 운영 통계</h1>
        <p>개인정보를 노출하지 않는 집계값으로 응시 현황과 반복 오답을 확인합니다.</p>
      </header>
      <section className="admin-panel">
        <form method="get" className="filter-row">
          <select name="courseId" defaultValue={courseId ?? ""}>
            <option value="">전체 과정</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.shortName}</option>)}
          </select>
          <button className="button button-dark" type="submit">조회</button>
        </form>
      </section>
      <section className="stats-grid admin-stats">
        <div className="stat-card"><span>모의고사</span><strong>{exams.length}</strong></div>
        <div className="stat-card"><span>응시</span><strong>{stats.attemptCount}</strong></div>
        <div className="stat-card"><span>평균 점수</span><strong>{stats.averageScore}점</strong></div>
      </section>
      <section className="analytics-grid">
        <article className="admin-panel">
          <h2>점수 분포</h2>
          {stats.scoreDistribution.map((item) => (
            <div className="analytics-row" key={item.label}>
              <span>{item.label}</span>
              <div className="analytics-bar"><i style={{ width: `${stats.attemptCount ? (item.count / stats.attemptCount) * 100 : 0}%` }} /></div>
              <strong>{item.count}</strong>
            </div>
          ))}
        </article>
        <article className="admin-panel">
          <h2>많이 틀린 문제</h2>
          {stats.mostWrong.length ? stats.mostWrong.map((item) => (
            <div className="analytics-row" key={item.questionId}>
              <span>{item.title}</span><strong>{item.count}회</strong>
            </div>
          )) : <p>집계할 오답이 없습니다.</p>}
        </article>
        <article className="admin-panel">
          <h2>우선 복습 주제</h2>
          {stats.weakTopics.length ? stats.weakTopics.map((item) => (
            <div className="analytics-row" key={item.topicId}>
              <span>{item.subjectName} · {item.topicName}</span>
              <strong>{item.wrongCount}회</strong>
            </div>
          )) : <p>집계할 주제별 오답이 없습니다.</p>}
        </article>
      </section>
    </>
  );
}
