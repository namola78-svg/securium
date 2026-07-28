import { notFound, redirect } from "next/navigation";
import { LevelActions } from "@/components/level-actions";
import { PracticeSession } from "@/components/practice-session";
import {
  getAccessibleLevel,
  listLevelQuestionIds,
} from "@/db/phase3-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { listPublicQuestions } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function LevelLearningPage({
  params,
}: {
  params: Promise<{ courseSlug: string; levelId: string }>;
}) {
  const { courseSlug, levelId } = await params;
  const user = await requireCurrentAppUser(
    `/learn/${courseSlug}/levels/${levelId}`,
  );
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  let level;
  try {
    level = await getAccessibleLevel(user.id, levelId);
  } catch (error) {
    if (error instanceof AppError && error.code === "LEVEL_NOT_FOUND") {
      notFound();
    }
    if (error instanceof AppError && error.code === "LEVEL_LOCKED") {
      redirect(`/learn/${courseSlug}?notice=level-locked`);
    }
    throw error;
  }
  const questionIds = await listLevelQuestionIds(levelId);
  if (level.courseId !== course.id) notFound();
  const questions = await listPublicQuestions({
    courseId: course.id,
    questionIds,
    limit: 50,
  });
  return (
    <main className="page-main practice-page">
      <header className="page-hero">
        <div className="shell">
          <p className="eyebrow">
            LEVEL {String(level.number).padStart(2, "0")} · {level.status}
          </p>
          <h1>{level.title}</h1>
          <p>
            통과점수 {level.passingScore}점 · 최고점수 {level.bestScore}점 ·
            시도 {level.attemptCount}회
          </p>
          <LevelActions levelId={level.id} status={level.status} />
        </div>
      </header>
      <div className="shell level-practice">
        <PracticeSession questions={questions} courseId={course.id} />
      </div>
    </main>
  );
}
