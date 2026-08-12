import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AudioLearningPlayer } from "@/components/audio-learning-player";
import { ContentVersionInfo } from "@/components/content-version-info";
import { LessonActions } from "@/components/lesson-actions";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import styles from "@/components/v2/learn-experience.module.css";
import { listPublishedAudioForLesson } from "@/db/audio-repositories";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getPublishedLessonForUser } from "@/db/lesson-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "학습 레슨 | Securium",
  description: "핵심 개념과 공식 근거를 읽고 문제로 학습 내용을 확인하세요.",
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}/lessons/${lessonId}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);
  const lesson = await getPublishedLessonForUser(user.id, course.id, lessonId);
  if (!lesson) notFound();

  const audioContents = await listPublishedAudioForLesson(user.id, course.id, lesson.id);
  const [lessonRevision, audioRevisions] = await Promise.all([
    getLatestPublishedRevision("LESSON", lesson.id),
    Promise.all(audioContents.map((audio) => getLatestPublishedRevision("AUDIO_CONTENT", audio.id))),
  ]);
  const sanitizedAudioContents = audioContents.map((audio) => ({
    ...audio,
    title: publicCopy(audio.title),
    transcript: publicCopy(audio.transcript),
    transcriptSegments: audio.transcriptSegments.map((segment) => ({
      ...segment,
      text: publicCopy(segment.text),
    })),
  }));

  return (
    <main className={styles.page} data-learn-lesson-v2="">
      <div className={styles.readingContainer}>
        <nav className={styles.breadcrumbs} aria-label="현재 위치">
          <Link href={`/learn/${course.slug}`}>{course.shortName}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/learn/${course.slug}/subjects/${lesson.subjectId}`}>
            {publicCopy(lesson.subjectName)}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">현재 레슨</span>
        </nav>

        <header className={styles.lessonHeader}>
          <p className={styles.eyebrow}>핵심 개념</p>
          <h1>{publicCopy(lesson.title)}</h1>
          <p>{publicCopy(lesson.summary)}</p>
          <div className={styles.lessonHeaderMeta}>
            <span>{publicCopy(lesson.topicName)}</span>
            <span>예상 {lesson.estimatedMinutes}분</span>
            <span>{formatCompletionPolicy(lesson.completionPolicy)}</span>
          </div>
        </header>

        <div className={styles.readingLayout}>
          <article className={styles.article}>
            <section id="learning-content" aria-labelledby="learning-content-title">
              <p className={styles.eyebrow}>학습</p>
              <h2 id="learning-content-title" className={styles.visuallyHidden}>레슨 본문</h2>
              <SafeLessonContent content={publicCopy(lesson.content)} format={lesson.contentFormat} />
            </section>

            {sanitizedAudioContents.length ? (
              <section className={styles.supportSection} aria-labelledby="audio-title">
                <h2 id="audio-title">함께 듣는 자료</h2>
                <AudioLearningPlayer items={sanitizedAudioContents} />
              </section>
            ) : null}

            <details className={styles.sourceDisclosure} id="source-evidence">
              <summary>
                <span>
                  <b>공식 근거와 검수 정보</b>
                  <small>기준일, 버전, 검수 상태를 확인합니다.</small>
                </span>
              </summary>
              <div>
                <ContentVersionInfo revision={sanitizeRevision(lessonRevision)} />
                {audioRevisions.map((revision, index) => (
                  <ContentVersionInfo
                    compact
                    key={sanitizedAudioContents[index].id}
                    revision={sanitizeRevision(revision)}
                  />
                ))}
              </div>
            </details>

            <section className={styles.practiceCallout} aria-labelledby="practice-title">
              <div>
                <p className={styles.eyebrow}>문제 확인</p>
                <h2 id="practice-title">배운 내용을 문제로 확인하세요</h2>
                <p>현재 과정의 문제를 풀며 핵심 개념을 다시 확인합니다.</p>
              </div>
              <Link className={styles.primaryButton} href={`/practice/${course.slug}?count=5`}>
                5문제로 확인하기
              </Link>
            </section>

            <LessonNavigation
              courseSlug={course.slug}
              previousLesson={lesson.previousLesson}
              nextLesson={lesson.nextLesson}
            />
          </article>

          <aside className={styles.lessonOutline} aria-label="레슨 진행">
            <p className={styles.eyebrow}>현재 레슨</p>
            <strong>{publicCopy(lesson.learningUnitTitle)}</strong>
            <nav aria-label="레슨 내 이동">
              <a href="#learning-content">학습 본문</a>
              <a href="#source-evidence">공식 근거</a>
              <a href="#practice-title">문제 확인</a>
            </nav>
            <LessonActions
              lessonId={lesson.id}
              initialStatus={lesson.status}
              initialLastPosition={lesson.lastPosition}
              completionPolicy={lesson.completionPolicy}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function LessonNavigation({
  courseSlug,
  previousLesson,
  nextLesson,
}: {
  courseSlug: string;
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
}) {
  return (
    <nav className={styles.lessonNavigation} aria-label="이전 및 다음 레슨">
      {previousLesson ? (
        <Link href={`/learn/${courseSlug}/lessons/${previousLesson.id}`}>
          <span>이전 레슨</span>
          <strong>{publicCopy(previousLesson.title)}</strong>
        </Link>
      ) : <span />}
      {nextLesson ? (
        <Link href={`/learn/${courseSlug}/lessons/${nextLesson.id}`}>
          <span>다음 학습</span>
          <strong>{publicCopy(nextLesson.title)}</strong>
        </Link>
      ) : (
        <Link href={`/learn/${courseSlug}`}>
          <span>과정 탐색</span>
          <strong>과정으로 돌아가기</strong>
        </Link>
      )}
    </nav>
  );
}

function formatCompletionPolicy(policy: string) {
  if (policy === "MANUAL") return "직접 완료";
  if (policy === "SCROLL_END") return "본문 끝까지 읽기";
  return "최소 학습 조건";
}

type DisplayRevision = {
  id: string;
  contentDate: string;
  version: string;
  reviewedAt: string | null;
  revisionStatus: string;
  isLatest: boolean;
  changeSummary: string;
};

function sanitizeRevision(
  revision: (DisplayRevision & { title?: string; snapshotJson?: string }) | null,
): DisplayRevision | null {
  if (!revision) return revision;
  return {
    id: revision.id,
    contentDate: revision.contentDate,
    version: revision.version,
    reviewedAt: revision.reviewedAt,
    revisionStatus: revision.revisionStatus,
    isLatest: revision.isLatest,
    changeSummary: publicCopy(revision.changeSummary),
  };
}
