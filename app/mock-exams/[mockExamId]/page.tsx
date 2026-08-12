import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MockExamStart } from "@/components/mock-exam-start";
import styles from "@/components/v2/mock-exam-v2.module.css";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "모의고사 안내 | Securium", description: "모의고사 응시 안내와 시험 조건을 확인합니다." };

export default async function MockExamDetailPage({ params }: { params: Promise<{ mockExamId: string }> }) {
  const { mockExamId } = await params;
  const user = await requireCurrentAppUser(`/mock-exams/${mockExamId}`);
  const exam = (await listPublicMockExams(user.id)).find((item) => item.id === mockExamId);
  if (!exam) notFound();
  const remaining = Math.max(0, exam.maxAttempts - exam.attemptCount);
  return (
    <main className={styles.page} data-mock-exam-instructions-v2="">
      <div className={styles.instructionContainer}>
        <Link className={styles.backLink} href="/mock-exams"><span aria-hidden="true">←</span> 모의고사 목록</Link>
        <section className={styles.instructionCard} aria-labelledby="exam-title">
          <div className={styles.instructionLead}><p className={styles.eyebrow}>{exam.courseName}</p><h1 id="exam-title">{exam.title}</h1><p>{exam.description}</p></div>
          <dl className={styles.instructionMetrics}><div><dt>문항 수</dt><dd>{exam.questionCount}문항</dd></div><div><dt>제한 시간</dt><dd>{exam.timeLimitMinutes}분</dd></div><div><dt>합격 기준</dt><dd>{exam.passingScore}점</dd></div><div><dt>남은 응시</dt><dd>{remaining}회</dd></div></dl>
          <section className={styles.rules} aria-labelledby="exam-rules-title"><h2 id="exam-rules-title">응시 전 확인</h2><ul><li>시험 중에는 정답과 해설이 표시되지 않습니다.</li><li>선택한 답안은 문항마다 자동으로 저장됩니다.</li><li>제출 후 총점과 과목별 결과, 오답 해설을 확인할 수 있습니다.</li></ul></section>
          <div className={styles.startActions}>{remaining > 0 ? <MockExamStart mockExamId={exam.id} /> : <p className={styles.statusNotice} role="status">응시 가능 횟수를 모두 사용했습니다.</p>}<Link className={styles.secondaryAction} href="/mock-exams">돌아가기</Link></div>
        </section>
      </div>
    </main>
  );
}
