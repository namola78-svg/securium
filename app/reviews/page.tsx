import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { ProgressBar } from "@/components/progress-bar";
import { getReviewSummary } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "복습 | SECURIUM", description: "예정된 복습과 오답을 우선순위에 따라 다시 학습합니다." };

export default async function ReviewsPage() {
  const user = await requireCurrentAppUser("/reviews");
  const summary = await getReviewSummary(user.id);
  const hasDue = summary.dueCount > 0;
  const topItem = summary.items[0];
  const primaryCourse = summary.byCourse[0];
  return <main className="page-main dashboard-page"><div className="shell"><header className="dashboard-intro"><div><p className="eyebrow">오늘의 복습</p><h1>복습할 항목을 우선순위로 정리했습니다.</h1><p>오래된 오답과 반복해서 틀린 문제부터 다시 확인하고, 다음 학습으로 이어가세요.</p></div><ActionButton variant="ghost" href="/wrong-notes">오답노트 보기</ActionButton></header>
    <section className="review-overview-panel" aria-label="오늘의 복습 요약"><div><p className="eyebrow">복습 계획</p><h2>{hasDue ? `${summary.dueCount}개 항목을 먼저 복습해보세요.` : "오늘 예정된 복습이 없습니다."}</h2><p>{hasDue ? "복습 결과에 따라 다음 복습 간격이 자동으로 조정됩니다." : "문제를 풀면 오답과 취약 개념이 다음 복습 일정에 자동으로 추가됩니다."}</p></div><dl><div><dt>복습 예정</dt><dd>{summary.dueCount}개</dd></div><div><dt>기한 지남</dt><dd>{summary.overdueCount}개</dd></div><div><dt>예상 시간</dt><dd>{summary.estimatedMinutes}분</dd></div><div><dt>오늘 완료</dt><dd>{summary.completedToday}개</dd></div></dl></section>
    <section className="section-block"><ProgressBar value={summary.completionRate} label="오늘 복습 완료율" /></section>
    <section className="review-action-strip section-block" aria-label="복습 다음 행동"><Link className="review-action-card review-action-card-primary" href={primaryCourse ? `/practice/${primaryCourse.slug}?reviewOnly=1&count=50` : "/practice"}><span>01 · 오늘 복습</span><strong>{hasDue ? "예정된 항목부터 시작" : "문제를 풀어 복습 만들기"}</strong><p>{hasDue ? `${summary.dueCount}개 항목이 준비되어 있습니다.` : "문제를 풀면 결과에 따라 복습 일정이 생깁니다."}</p></Link><Link className="review-action-card" href="/wrong-notes"><span>02 · 오답 정리</span><strong>반복 오답 확인</strong><p>틀린 이유와 관련 개념을 다시 살펴봅니다.</p></Link><Link className="review-action-card" href="/practice"><span>03 · 문제 추가</span><strong>새 문제 풀기</strong><p>학습 기록을 쌓아 맞춤 복습을 만들어보세요.</p></Link></section>
    <section className="section-block" aria-labelledby="review-course-title"><div className="section-heading compact"><div><p className="eyebrow">과정별 복습</p><h2 id="review-course-title">과정별로 이어서 학습</h2></div></div>{summary.byCourse.length ? <div className="review-grid">{summary.byCourse.map((course) => <article className="review-card review-course-card" key={course.courseId}><div className="course-card-top"><span className="badge">{course.count}개 예정</span><span className="status-on">과정 복습</span></div><h3>{course.name}</h3><p>예정된 문제를 다시 풀고 취약 개념을 확인하세요.</p><ActionButton href={`/practice/${course.slug}?reviewOnly=1&count=50`} variant="dark" className="full-width">복습 시작</ActionButton></article>)}</div> : <div className="empty-state"><strong>아직 복습할 항목이 없습니다.</strong><p>문제를 풀면 틀린 문제와 취약 개념이 여기에 자동으로 정리됩니다.</p><ActionButton href="/practice" variant="dark">문제 풀기</ActionButton></div>}</section>
    {summary.items.length ? <section className="section-block review-priority-panel" aria-labelledby="review-priority-title"><div className="section-heading compact"><div><p className="eyebrow">복습 우선순위</p><h2 id="review-priority-title">먼저 확인할 항목</h2><p>반복 오답과 예정일이 가까운 항목을 최대 5개까지 보여줍니다.</p></div></div><div className="review-workspace"><div className="admin-record-list">{summary.items.slice(0, 5).map((item, index) => <article className="admin-record review-priority-item" key={item.id}><div><small>#{index + 1} · {item.courseName}</small><strong>{formatTitle(item)}</strong><small>예정일 {item.nextReviewAt.slice(0, 10)} · 반복 오답 {item.consecutiveWrong}회</small></div><span className="status-on">{formatType(item.targetType)}</span></article>)}</div><aside className="review-inspector" aria-label="복습 인스펙터"><p className="eyebrow">다음 복습</p><h2>바로 시작하기</h2>{topItem ? <><strong>{formatTitle(topItem)}</strong><p>{topItem.courseName} · 예정일 {topItem.nextReviewAt.slice(0, 10)}</p><ActionButton href={`/practice/${topItem.courseSlug}?reviewOnly=1&count=50`} variant="dark">복습 시작</ActionButton></> : <p>복습 항목이 생기면 다음 행동을 안내합니다.</p>}</aside></div></section> : null}
    {!hasDue && !summary.byCourse.length ? <div className="empty-state"><strong>오늘 예정된 복습이 없습니다.</strong><p>문제를 풀고 결과를 확인하면 다음 복습 일정이 자동으로 만들어집니다.</p><ActionButton variant="dark" href="/practice">문제 풀기</ActionButton></div> : null}</div></main>;
}

function formatType(type: string) { const labels: Record<string, string> = { QUESTION: "문제", WRONG_NOTE: "오답", MOCK_EXAM_WRONG: "모의고사 오답", CONTENT: "콘텐츠", TOPIC: "주제" }; return labels[type] ?? "학습 항목"; }
function formatTitle(item: { questionTitle: string | null; targetType: string }) { return item.questionTitle || `${formatType(item.targetType)} 복습 항목`; }
