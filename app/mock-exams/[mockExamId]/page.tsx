import { notFound } from "next/navigation";
import { MockExamStart } from "@/components/mock-exam-start";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MockExamDetailPage({
  params,
}: {
  params: Promise<{ mockExamId: string }>;
}) {
  const { mockExamId } = await params;
  const user = await requireCurrentAppUser(`/mock-exams/${mockExamId}`);
  const exam = (await listPublicMockExams(user.id)).find(
    (item) => item.id === mockExamId,
  );
  if (!exam) notFound();
  return (
    <main className="page-main auth-main">
      <section className="auth-card exam-intro-card">
        <p className="eyebrow">{exam.examType}</p>
        <h1>{exam.title}</h1>
        <p>{exam.description}</p>
        <dl className="metric-list">
          <div><dt>문제 수</dt><dd>{exam.questionCount}개</dd></div>
          <div><dt>제한시간</dt><dd>{exam.timeLimitMinutes}분</dd></div>
          <div><dt>통과점수</dt><dd>{exam.passingScore}점</dd></div>
          <div><dt>응시 가능</dt><dd>{exam.maxAttempts - exam.attemptCount}회</dd></div>
        </dl>
        <div className="notice warning">
          시험 중 정답과 해설은 표시되지 않습니다. 시간 종료 시 서버가 자동
          제출하고, 제출한 답안은 변경할 수 없습니다.
        </div>
        <MockExamStart mockExamId={exam.id} />
      </section>
    </main>
  );
}

