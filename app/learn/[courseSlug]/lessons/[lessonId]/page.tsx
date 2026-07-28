import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LessonActions } from "@/components/lesson-actions";
import { AudioLearningPlayer } from "@/components/audio-learning-player";
import { ContentVersionInfo } from "@/components/content-version-info";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import { listPublishedAudioForLesson } from "@/db/audio-repositories";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getPublishedLessonForUser } from "@/db/lesson-repositories";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const user = await requireCurrentAppUser(
    `/learn/${courseSlug}/lessons/${lessonId}`,
  );
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);
  const lesson = await getPublishedLessonForUser(user.id, course.id, lessonId);
  if (!lesson) notFound();
  const audioContents = await listPublishedAudioForLesson(
    user.id,
    course.id,
    lesson.id,
  );
  const [lessonRevision, audioRevisions] = await Promise.all([
    getLatestPublishedRevision("LESSON", lesson.id),
    Promise.all(
      audioContents.map((audio) =>
        getLatestPublishedRevision("AUDIO_CONTENT", audio.id),
      ),
    ),
  ]);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell narrow">
          <Link
            className="breadcrumb"
            href={`/learn/${course.slug}/subjects/${lesson.subjectId}`}
          >
            ← {lesson.subjectName}
          </Link>
          <p className="eyebrow">THEORY LESSON</p>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
          <div className="lesson-meta">
            <span>{lesson.learningUnitTitle}</span>
            <span>{lesson.topicName}</span>
            <span>예상 {lesson.estimatedMinutes}분</span>
            <span>
              완료 정책{" "}
              {lesson.completionPolicy === "MANUAL"
                ? "직접 완료"
                : lesson.completionPolicy === "SCROLL_END"
                  ? "본문 하단 도달"
                  : "최소 학습 조건"}
            </span>
            {lesson.isSample ? <span>개발용 샘플</span> : null}
          </div>
        </div>
      </section>
      <section className="section">
        <article className="shell narrow lesson-reader">
          <SafeLessonContent
            content={lesson.content}
            format={lesson.contentFormat}
          />
          <ContentVersionInfo revision={lessonRevision} />
          {audioRevisions.map((revision, index) => (
            <ContentVersionInfo
              compact
              key={audioContents[index].id}
              revision={revision}
            />
          ))}
          <AudioLearningPlayer items={audioContents} />
          <LessonActions
            lessonId={lesson.id}
            initialStatus={lesson.status}
            initialLastPosition={lesson.lastPosition}
            completionPolicy={lesson.completionPolicy}
          />
          <nav className="lesson-navigation" aria-label="레슨 이동">
            {lesson.previousLesson ? (
              <Link
                className="button button-ghost"
                href={`/learn/${course.slug}/lessons/${lesson.previousLesson.id}`}
              >
                ← 이전 · {lesson.previousLesson.title}
              </Link>
            ) : (
              <span />
            )}
            {lesson.nextLesson ? (
              <Link
                className="button button-dark"
                href={`/learn/${course.slug}/lessons/${lesson.nextLesson.id}`}
              >
                다음 · {lesson.nextLesson.title} →
              </Link>
            ) : (
              <Link
                className="button button-dark"
                href={`/learn/${course.slug}`}
              >
                과정으로 돌아가기
              </Link>
            )}
          </nav>
        </article>
      </section>
    </main>
  );
}
