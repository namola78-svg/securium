import type { Metadata } from "next";
import { ActionButton } from "@/components/design-system-primitives";
import { listPublicMockExams } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = { title: "모의고사 | Securium", description: "실전처럼 모의고사를 풀고 과목별 결과와 취약 영역을 확인하세요." };
export const dynamic = "force-dynamic";

export default async function MockExamsPage() {
  const user = await requireCurrentAppUser("/mock-exams"); const exams = await listPublicMockExams(user.id);
  return <main className="page-main dashboard-page"><div className="shell"><header className="dashboard-intro"><div><p className="eyebrow">시험 준비</p><h1>모의고사</h1><p>실제 시험처럼 제한 시간 안에 문제를 풀고 종료 후 과목별 점수와 취약 영역을 확인하세요.</p></div><ActionButton variant="ghost" href="/practice">문제풀이로 이동</ActionButton></header>{exams.length ? <div className="review-grid">{exams.map((exam) => { const remainingAttempts = Math.max(0, exam.maxAttempts - exam.attemptCount); return <article className="review-card" key={exam.id}><div className="course-card-top"><span className="badge">{exam.examType}</span><span>{exam.courseName}</span></div><h2>{exam.title}</h2><p>{exam.description}</p><dl className="metric-list"><div><dt>문제 수</dt><dd>{exam.questionCount}문제</dd></div><div><dt>제한 시간</dt><dd>{exam.timeLimitMinutes}분</dd></div><div><dt>최고 점수</dt><dd>{exam.bestScore}점</dd></div><div><dt>남은 응시</dt><dd>{remainingAttempts}회</dd></div></dl><ActionButton variant="dark" href={`/mock-exams/${exam.id}`}>{remainingAttempts > 0 ? "시험 안내 보기" : "결과와 복습 안내 보기"}</ActionButton></article>; })}</div> : <section className="empty-state" aria-live="polite"><h2>현재 응시 가능한 모의고사가 없습니다</h2><p>문제풀이로 학습을 이어가거나 새 모의고사가 공개될 때까지 복습을 진행해보세요.</p><ActionButton href="/practice" variant="dark">문제풀이 시작</ActionButton></section>}</div></main>;
}
