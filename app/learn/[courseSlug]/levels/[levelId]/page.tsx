import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/state-ui";
import { LevelActions } from "@/components/level-actions";
import { PracticeSession } from "@/components/practice-session";
import { getAccessibleLevel, listLevelQuestionIds } from "@/db/phase3-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { listPublicQuestions } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "단계 학습 | Securium",
  description: "단계별 문제를 풀고 통과 기준과 다음 학습 범위를 확인하세요.",
};

const statusLabels: Record<string, string> = { LOCKED: "잠김", AVAILABLE: "학습 가능", IN_PROGRESS: "학습 중", COMPLETED: "완료", MASTERED: "마스터" };

export default async function LevelLearningPage({ params }: { params: Promise<{ courseSlug: string; levelId: string }> }) {
  const { courseSlug, levelId } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}/levels/${levelId}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let level;
  try {
    level = await getAccessibleLevel(user.id, levelId);
  } catch (error) {
    if (error instanceof AppError && error.code === "LEVEL_NOT_FOUND") notFound();
    if (error instanceof AppError && error.code === "LEVEL_LOCKED") redirect(`/learn/${courseSlug}?notice=level-locked`);
    throw error;
  }
  if (level.courseId !== course.id) notFound();
  const questionIds = await listLevelQuestionIds(levelId);
  const questions = await listPublicQuestions({ courseId: course.id, questionIds, limit: 50 });

  return <main className="page-main practice-page">
    <header className="page-hero"><div className="shell"><Link className="breadcrumb" href={`/learn/${course.slug}`}>학습 개요로 돌아가기</Link><p className="eyebrow">단계 {String(level.number).padStart(2, "0")} · {statusLabels[level.status] ?? "학습 단계"}</p><h1>{level.title}</h1><p>이 단계의 핵심 문제를 풀고 통과 기준을 확인해 다음 학습 범위를 열어보세요.</p><dl className="metric-list"><div><dt>통과 기준</dt><dd>{level.passingScore}점 이상</dd></div><div><dt>최고 점수</dt><dd>{level.bestScore}점</dd></div><div><dt>시도 횟수</dt><dd>{level.attemptCount}회</dd></div></dl><LevelActions levelId={level.id} status={level.status} /></div></header>
    <div className="shell level-practice">{questions.length ? <PracticeSession questions={questions} courseId={course.id} /> : <EmptyState title="이 단계에 연결된 문제가 없습니다" description="관리자가 문제를 준비하면 단계 학습을 시작할 수 있습니다. 과정 개요에서 다른 학습 경로를 선택해보세요." action={{ href: `/learn/${course.slug}`, label: "학습 개요로 이동" }} secondaryAction={{ href: `/practice/${course.slug}`, label: "문제풀이로 이동" }} />}</div>
  </main>;
}
