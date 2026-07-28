import Link from "next/link";
import { listAdminQuestions } from "@/db/question-repositories";
import { requireQuestionReviewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  await requireQuestionReviewer("/admin/reviews");
  const [requested, reviewing] = await Promise.all([
    listAdminQuestions({ status: "REVIEW_REQUESTED", limit: 100 }),
    listAdminQuestions({ status: "IN_REVIEW", limit: 100 }),
  ]);
  const rows = [...requested, ...reviewing];
  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">REVIEW QUEUE</p>
        <h1>문제 검수</h1>
        <p>작성자와 검수자를 분리하고 승인·반려 의견을 버전 이력에 남깁니다.</p>
      </header>
      <section className="admin-panel">
        {rows.length ? (
          <div className="admin-table">
            {rows.map((question) => (
              <Link
                className="admin-question-row"
                href={`/admin/questions/${question.id}`}
                key={question.id}
              >
                <strong>{question.title}</strong>
                <span className="badge">{question.status}</span>
                <span>{question.type}</span>
                <span>{question.createdBy}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>검수 대기 문제가 없습니다.</strong>
            <p>작성자가 검수를 요청하면 이곳에 표시됩니다.</p>
          </div>
        )}
      </section>
    </>
  );
}

