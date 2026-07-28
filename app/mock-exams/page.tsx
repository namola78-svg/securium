import Link from "next/link";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MockExamsPage() {
  const user = await requireCurrentAppUser("/mock-exams");
  const exams = await listPublicMockExams(user.id);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">모의고사</p>
            <h1>모의고사</h1>
            <p>서버 기준 제한시간과 제출 상태로 실력을 점검합니다.</p>
          </div>
        </header>
        <div className="review-grid">
          {exams.map((exam) => (
            <article className="review-card" key={exam.id}>
              <div className="course-card-top">
                <span className="badge">{exam.examType}</span>
                <span>{exam.courseName}</span>
              </div>
              <h2>{exam.title}</h2>
              <p>{exam.description}</p>
              <dl className="metric-list">
                <div><dt>문제</dt><dd>{exam.questionCount}개</dd></div>
                <div><dt>제한시간</dt><dd>{exam.timeLimitMinutes}분</dd></div>
                <div><dt>최고점수</dt><dd>{exam.bestScore}점</dd></div>
                <div><dt>응시</dt><dd>{exam.attemptCount} / {exam.maxAttempts}</dd></div>
              </dl>
              <Link className="button button-dark" href={`/mock-exams/${exam.id}`}>
                시험 안내
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
