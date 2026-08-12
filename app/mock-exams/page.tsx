import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/v2/mock-exam-v2.module.css";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = { title: "모의고사 | Securium", description: "실전처럼 시간을 정해 문제를 풀고 과목별 결과를 확인하세요." };
export const dynamic = "force-dynamic";

export default async function MockExamsPage() {
  const user = await requireCurrentAppUser("/mock-exams");
  const exams = await listPublicMockExams(user.id);
  return (
    <main className={styles.page} data-mock-exam-entry-v2="">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <div><p className={styles.eyebrow}>실전 점검</p><h1>모의고사</h1><p>실전처럼 시간을 정해 문제를 풀고 과목별 결과를 확인하세요.</p></div>
          <Link className={styles.secondaryAction} href="/practice">문제풀이로 이동</Link>
        </header>
        {exams.length ? (
          <section className={styles.examSection} aria-labelledby="available-exams-title">
            <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>응시 가능한 시험</p><h2 id="available-exams-title">시험을 선택하세요</h2></div><p>{exams.length}개의 시험이 준비되어 있습니다.</p></header>
            <ul className={styles.examList}>
              {exams.map((exam) => {
                const remaining = Math.max(0, exam.maxAttempts - exam.attemptCount);
                return (
                  <li key={exam.id}>
                    <article className={styles.examCard}>
                      <div className={styles.examCopy}><div className={styles.meta}><span>{formatExamType(exam.examType)}</span><span>{exam.courseName}</span></div><h3>{exam.title}</h3><p>{exam.description}</p></div>
                      <dl className={styles.examMetrics}><div><dt>문항</dt><dd>{exam.questionCount}개</dd></div><div><dt>제한 시간</dt><dd>{exam.timeLimitMinutes}분</dd></div><div><dt>합격 기준</dt><dd>{exam.passingScore}점</dd></div><div><dt>남은 응시</dt><dd>{remaining}회</dd></div></dl>
                      <Link className={remaining > 0 ? styles.primaryAction : styles.secondaryAction} href={`/mock-exams/${exam.id}`}>{remaining > 0 ? "응시 안내" : "응시 상태 확인"}<span aria-hidden="true">→</span></Link>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className={styles.emptyState} aria-labelledby="mock-exam-empty-title"><span aria-hidden="true">✓</span><h2 id="mock-exam-empty-title">등록된 모의고사가 없습니다.</h2><p>문제풀이와 복습으로 학습을 이어가세요.</p><Link className={styles.primaryAction} href="/practice">문제 풀기</Link></section>
        )}
      </div>
    </main>
  );
}

function formatExamType(value: string) {
  return ({ QUICK: "빠른 모의고사", SUBJECT: "과목별", REALISTIC: "실전", WRONG_ANSWER: "오답", WEAK_AREA: "취약 영역", MANAGED: "지정 시험" } as Record<string, string>)[value] ?? "모의고사";
}
