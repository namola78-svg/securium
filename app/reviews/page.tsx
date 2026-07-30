import Link from "next/link";
import { getReviewSummary } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { ProgressBar } from "@/components/progress-bar";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const user = await requireCurrentAppUser("/reviews");
  const summary = await getReviewSummary(user.id);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">SMART REVIEW</p>
            <h1>오늘의 복습</h1>
            <p>오답 결과에 따라 다음 복습일과 간격을 자동 조정합니다.</p>
          </div>
          <Link className="button button-ghost" href="/wrong-notes">
            전체 오답노트
          </Link>
        </header>
        <section className="stats-grid">
          <div className="stat-card">
            <span>복습 예정</span>
            <strong>{summary.dueCount}</strong>
            <small>문제</small>
          </div>
          <div className="stat-card">
            <span>연체 복습</span>
            <strong>{summary.overdueCount}</strong>
            <small>1일 이상 경과</small>
          </div>
          <div className="stat-card">
            <span>예상 시간</span>
            <strong>{summary.estimatedMinutes}</strong>
            <small>분</small>
          </div>
          <div className="stat-card">
            <span>오늘 완료</span>
            <strong>{summary.completedToday}</strong>
            <small>{summary.completionRate}% 완료</small>
          </div>
        </section>
        <section className="section-block">
          <ProgressBar value={summary.completionRate} label="오늘의 복습 완료율" />
        </section>
        <section className="section-block review-grid">
          {summary.byCourse.map((course) => (
            <article className="review-card" key={course.courseId}>
              <span className="badge">{course.count}개 예정</span>
              <h2>{course.name}</h2>
              <p>예정일이 빠른 문제부터 복습합니다.</p>
              <Link
                className="button button-dark"
                href={`/practice/${course.slug}?reviewOnly=1&count=50`}
              >
                복습 시작
              </Link>
            </article>
          ))}
        </section>
        {summary.items.length ? (
          <section className="section-block review-priority-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">REVIEW PRIORITY</p>
                <h2>우선 복습 항목</h2>
                <p>예정일이 빠른 순서로 최대 5개 항목을 보여줍니다.</p>
              </div>
            </div>
            <div className="admin-record-list">
              {summary.items.slice(0, 5).map((item) => (
                <article className="admin-record review-priority-item" key={item.id}>
                  <summary>
                    <span>
                      <strong>
                        {item.questionTitle ?? `${item.targetType} ${item.targetId}`}
                      </strong>
                      <small>
                        {item.courseName} · 예정일 {item.nextReviewAt.slice(0, 10)} ·
                        반복 오답 {item.consecutiveWrong}회
                      </small>
                    </span>
                    <span className="status-on">{item.targetType}</span>
                  </summary>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {!summary.dueCount ? (
          <div className="empty-state">
            <strong>오늘 예정된 복습이 없습니다.</strong>
            <p>새 문제를 풀면 결과에 따라 복습 일정이 생성됩니다.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
