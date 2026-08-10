import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/state-ui";
import { ProgressBar } from "@/components/progress-bar";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";
import { getSubjectTheoryProgress, listPublishedLearningUnitsForSubject } from "@/db/lesson-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug, getSubjectById, listTopicsForSubject } from "@/db/repositories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "과목 학습 | Securium",
  description: "과목의 주제와 레슨을 순서대로 학습하고 이론 진도를 이어가세요.",
};
type PageProps = { params: Promise<{ courseSlug: string; subjectId: string }> };

export default async function SubjectPage({ params }: PageProps) {
  const { courseSlug, subjectId } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}/subjects/${subjectId}`);
  const [course, subject] = await Promise.all([getPublicCourseBySlug(courseSlug), getSubjectById(subjectId)]);
  if (!course || !subject || subject.courseId !== course.id) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);
  const [topics, learningUnits, theoryProgress] = await Promise.all([listTopicsForSubject(subject.id), listPublishedLearningUnitsForSubject(user.id, course.id, subject.id), getSubjectTheoryProgress(user.id, course.id, subject.id)]);
  const allLessons = learningUnits.flatMap((unit) => unit.lessons);
  const nextLesson = allLessons.find((lesson) => lesson.status !== "COMPLETED") ?? allLessons[0];
  const nextLessonLabel = nextLesson?.status === "IN_PROGRESS"
    ? "이어서 학습"
    : allLessons.length > 0 && allLessons.every((lesson) => lesson.status === "COMPLETED")
      ? "레슨 다시 보기"
      : "첫 레슨 시작";

  return <main className="page-main">
    <section className="page-hero"><div className="shell"><Link className="breadcrumb" href={`/learn/${course.slug}`}>{course.shortName} 학습 개요</Link><p className="eyebrow">과목 학습</p><h1>{subject.name}</h1><p>{publicCopy(subject.description) || "이 과목의 주제와 핵심 이론을 순서대로 학습해보세요."}</p><p className="course-summary">이론 진도 {theoryProgress.progressPercent}% · {theoryProgress.completedLessons}/{theoryProgress.totalLessons} 레슨 완료</p><div className="button-row">{nextLesson ? <Link className="button button-dark" href={`/learn/${course.slug}/lessons/${nextLesson.id}`}>{nextLessonLabel}</Link> : <Link className="button button-outline" href={`/practice/${course.slug}`}>문제풀이로 이동</Link>}</div></div></section>
    <section className="section"><div className="shell narrow">
      <section aria-labelledby="topics-title"><div className="section-heading compact"><div><p className="eyebrow">주제 목록</p><h2 id="topics-title">이 과목에서 다루는 범위</h2></div><span className="count-label">{topics.length}개 주제</span></div>{topics.length ? <div className="topic-grid">{topics.map((topic, index) => <article className="topic-card" key={topic.id}><span className="topic-number">{String(index + 1).padStart(2, "0")}</span><h3>{topic.name}</h3><p>{publicCopy(topic.description) || "핵심 개념을 문제와 함께 확인합니다."}</p><span className="sample-label">{topic.isSample ? "공개 예정 범위" : "학습 주제"}</span></article>)}</div> : <p className="empty-inline">아직 공개된 주제가 없습니다.</p>}</section>
      <section className="section-block" aria-labelledby="theory-title"><div className="section-heading compact"><div><p className="eyebrow">이론 학습</p><h2 id="theory-title">레슨 순서대로 학습하기</h2></div><span className="count-label">{theoryProgress.completedLessons}/{theoryProgress.totalLessons} 완료</span></div><ProgressBar value={theoryProgress.progressPercent} label="과목 이론 진도" />{learningUnits.length ? <div className="learning-unit-list">{learningUnits.map((unit, unitIndex) => <section className="learning-unit-card" key={unit.id}><header><span className="lesson-list-number">{String(unitIndex + 1).padStart(2, "0")}</span><div><small>{unit.topicName ?? "과목 공통"}</small><h3>{publicCopy(unit.title)}</h3><p>{publicCopy(unit.description)}</p></div><strong>{unit.progressPercent}%</strong></header>{unit.lessons.length ? <div className="lesson-list">{unit.lessons.map((lesson, lessonIndex) => <Link className="lesson-list-item" href={`/learn/${course.slug}/lessons/${lesson.id}`} key={lesson.id}><span className="lesson-list-number">{String(lessonIndex + 1).padStart(2, "0")}</span><div><h4>{publicCopy(lesson.title)}</h4><p>{publicCopy(lesson.summary)}</p></div><div className="lesson-list-meta"><span>{lesson.estimatedMinutes}분</span><strong>{lesson.status === "COMPLETED" ? "완료" : lesson.status === "IN_PROGRESS" ? `학습 중 ${lesson.progressPercent}%` : "시작 전"}</strong></div></Link>)}</div> : <p className="empty-inline">이 학습 단위에 공개된 레슨이 없습니다.</p>}</section>)}</div> : <EmptyState title="아직 공개된 이론 콘텐츠가 없습니다" description="콘텐츠가 준비되면 이곳에서 학습 순서와 레슨을 확인할 수 있습니다. 문제풀이에서 먼저 학습을 시작할 수도 있습니다." action={{ href: `/practice/${course.slug}`, label: "문제풀이로 이동" }} secondaryAction={{ href: `/learn/${course.slug}`, label: "학습 개요로 이동" }} />}</section>
    </div></section>
  </main>;
}
