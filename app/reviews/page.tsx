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
              <ReviewStartLink courseId={course.courseId} />
            </article>
          ))}
        </section>
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

async function ReviewStartLink({ courseId }: { courseId: string }) {
  const { getCourseById } = await import("@/db/repositories");
  const course = await getCourseById(courseId);
  if (!course) return null;
  return (
    <Link
      className="button button-dark"
      href={`/practice/${course.slug}?reviewOnly=1&count=50`}
    >
      복습 시작
    </Link>
  );
}
