import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/design-system-primitives";
import { EmptyState } from "@/components/state-ui";
import { listUserEnrollments } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 학습 | SECURIUM", description: "학습 과정과 최근 활동, 다음 학습 행동을 확인합니다." };

export default async function MyLearningPage() {
  const user = await requireCurrentAppUser("/my-learning");
  const enrollments = await listUserEnrollments(user.id);
  const visible = enrollments.filter((item) => item.status !== "CANCELLED");
  const active = visible.filter((item) => item.status !== "COMPLETED");
  const completed = visible.filter((item) => item.status === "COMPLETED");
  return <main className="page-main dashboard-page"><div className="shell"><header className="dashboard-intro"><div><p className="eyebrow">내 학습</p><h1>학습 현황을 한곳에서 확인하세요.</h1><p>진행 중인 과정, 문제풀이, 오답 복습과 학습 분석으로 다음 행동을 이어갑니다.</p></div></header><section className="stats-grid" aria-label="내 학습 요약"><Stat label="전체 과정" value={visible.length} /><Stat label="진행 중" value={active.length} /><Stat label="학습 완료" value={completed.length} /></section><section className="section-block" aria-labelledby="next-actions-title"><div className="section-heading compact"><div><p className="eyebrow">주요 진입점</p><h2 id="next-actions-title">다음 학습 행동</h2></div></div><div className="my-learning-grid"><QuickLink href="/my-courses" eyebrow="내 과정" title="과정 이어가기" description="진행 중인 과정과 진도를 확인하세요." /><QuickLink href="/practice" eyebrow="문제풀이" title="문제 풀기" description="학습한 내용을 문제로 확인하세요." /><QuickLink href="/reviews" eyebrow="복습" title="복습 시작" description="예정된 복습 항목부터 다시 학습하세요." /><QuickLink href="/wrong-notes" eyebrow="오답 복습" title="오답노트" description="반복해서 틀린 문제와 개념을 확인하세요." /><QuickLink href="/analytics" eyebrow="성과 분석" title="학습 분석" description="취약 주제와 학습 패턴을 확인하세요." /><QuickLink href="/bookmarks" eyebrow="학습 자료" title="북마크" description="저장한 문제와 콘텐츠를 다시 보세요." /><QuickLink href="/practical" eyebrow="실무" title="실무 연습" description="보안 사례와 진단 과제를 연습하세요." /><QuickLink href="/ai-tutor" eyebrow="AI" title="AI 튜터" description="현재 학습 상태에 맞는 참고 설명을 받아보세요." /></div></section><section className="section-block" aria-labelledby="enrollment-title"><div className="section-heading compact"><div><p className="eyebrow">수강 상태</p><h2 id="enrollment-title">내 학습 과정</h2></div></div>{visible.length ? <div className="course-grid">{visible.slice(0, 6).map((item) => { const done = item.status === "COMPLETED"; return <article className="course-card" key={item.id}><div className="course-card-top"><span className="course-code">{item.groupName}</span><span className={`course-status ${done ? "completed" : "available"}`}>{statusLabel(item.status)}</span></div><h3>{item.courseName}</h3><p className="course-summary">현재 진도 {item.progressPercent}% · 최근 학습 {formatLastStudied(item.lastStudiedAt)}</p><ActionButton href={done ? `/practice/${item.courseSlug}?mode=review` : `/learn/${item.courseSlug}`} variant="dark" className="full-width">{done ? "복습하기" : "학습 이어가기"}</ActionButton></article>; })}</div> : <EmptyState title="진행 중인 과정이 없습니다." description="과정 목록에서 학습할 과정을 선택하면 진도와 문제풀이를 바로 시작할 수 있습니다." action={{ href: "/courses", label: "과정 둘러보기" }} />}</section></div></main>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>현재 학습 기준</small></div>; }
function QuickLink({ href, eyebrow, title, description }: { href: string; eyebrow: string; title: string; description: string }) { return <Link className="learning-quick-card" href={href}><span className="eyebrow">{eyebrow}</span><strong>{title}</strong><p>{description}</p></Link>; }
function statusLabel(status: string) { if (status === "COMPLETED") return "학습 완료"; if (status === "PAUSED") return "학습 일시정지"; return "학습 중"; }
function formatLastStudied(value: string | null) { if (!value) return "기록 없음"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "기록 없음" : date.toLocaleDateString("ko-KR"); }
