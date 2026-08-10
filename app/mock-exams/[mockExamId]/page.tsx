import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MockExamStart } from "@/components/mock-exam-start";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "모의고사 안내 | Securium", description: "모의고사 응시 안내와 시험 조건을 확인합니다." };

export default async function MockExamDetailPage({ params }: { params: Promise<{ mockExamId: string }> }) {
  const { mockExamId } = await params; const user = await requireCurrentAppUser(`/mock-exams/${mockExamId}`); const exam = (await listPublicMockExams(user.id)).find((item) => item.id === mockExamId); if (!exam) notFound(); const remainingAttempts = Math.max(0, exam.maxAttempts - exam.attemptCount);
  return <main className="page-main auth-main"><section className="auth-card exam-intro-card" aria-labelledby="exam-title"><p className="eyebrow">{exam.examType} · {exam.courseName}</p><h1 id="exam-title">{exam.title}</h1><p>{exam.description}</p><dl className="metric-list"><div><dt>문제 수</dt><dd>{exam.questionCount}문제</dd></div><div><dt>제한 시간</dt><dd>{exam.timeLimitMinutes}분</dd></div><div><dt>합격 기준</dt><dd>{exam.passingScore}%</dd></div><div><dt>남은 응시</dt><dd>{remainingAttempts}회</dd></div></dl><div className="notice warning" role="note">시험 중에는 정답과 해설이 공개되지 않습니다. 제출하거나 제한 시간이 끝나면 결과에서 과목별 분석과 복습 항목을 확인할 수 있습니다.</div>{remainingAttempts > 0 ? <MockExamStart mockExamId={exam.id} /> : <div className="notice" role="status">응시 가능 횟수를 모두 사용했습니다. 문제풀이에서 취약 영역을 복습해보세요.</div>}</section></main>;
}
