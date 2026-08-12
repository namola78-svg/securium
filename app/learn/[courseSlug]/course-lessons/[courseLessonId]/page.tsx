import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourseLessonActions } from "@/components/course-lesson-actions";
import { ProgressBar } from "@/components/progress-bar";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import styles from "@/components/v2/learn-experience.module.css";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { getPublishedCourseLessonForUser } from "@/db/shared-content-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "핵심 레슨 | Securium",
  description: "핵심 개념, 시험 포인트, 공식 근거를 읽고 문제로 확인하세요.",
};

export default async function CourseLessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; courseLessonId: string }>;
}) {
  const { courseSlug, courseLessonId } = await params;
  const user = await requireCurrentAppUser(`/learn/${courseSlug}/course-lessons/${courseLessonId}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) redirect(`/courses/${course.slug}`);
  const lesson = await getPublishedCourseLessonForUser({
    userId: user.id,
    courseId: course.id,
    courseLessonId,
  });
  if (!lesson) notFound();

  const hasEvidence = Boolean(lesson.legalNotes || lesson.standardNotes || lesson.evidenceNotes);

  return (
    <main className={styles.page} data-learn-lesson-v2="" data-course-lesson-v2="">
      <div className={styles.readingContainer}>
        <nav className={styles.breadcrumbs} aria-label="현재 위치">
          <Link href="/dashboard">대시보드</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/learn/${course.slug}`}>{course.shortName}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">현재 레슨</span>
        </nav>

        <header className={styles.lessonHeader}>
          <p className={styles.eyebrow}>핵심 개념</p>
          <h1>{publicCopy(lesson.title)}</h1>
          <p>{publicCopy(lesson.summary)}</p>
          <div className={styles.lessonHeaderMeta}>
            <span>공통 학습 콘텐츠</span>
            <span>예상 {lesson.estimatedMinutes}분</span>
            <span>{lesson.isRequired ? "필수 학습" : "선택 학습"}</span>
            <span>버전 {lesson.version}</span>
          </div>
          <div className={styles.headerProgress}>
            <ProgressBar value={lesson.progressPercent} label="레슨 읽기 진도" />
          </div>
        </header>

        <div className={styles.readingLayout}>
          <article className={styles.article}>
            <section id="learning-content" aria-labelledby="learning-content-title">
              <p className={styles.eyebrow}>학습</p>
              <h2 id="learning-content-title" className={styles.visuallyHidden}>레슨 본문</h2>
              <SafeLessonContent content={publicCopy(lesson.body)} format={lesson.bodyFormat} />
            </section>

            {lesson.examPoints ? (
              <section className={styles.examPoints} id="exam-points" aria-labelledby="exam-points-title">
                <p className={styles.eyebrow}>개념 정리</p>
                <h2 id="exam-points-title">시험 포인트</h2>
                <ContentValueList value={lesson.examPoints} />
              </section>
            ) : null}

            {lesson.commonMistakes ? (
              <section className={styles.confusion} aria-labelledby="confusion-title">
                <h2 id="confusion-title">헷갈리기 쉬운 포인트</h2>
                <ContentValueList value={lesson.commonMistakes} />
              </section>
            ) : null}

            {lesson.practicalNotes ? (
              <section className={styles.supportSection} aria-labelledby="practical-title">
                <h2 id="practical-title">실무에서는 이렇게 연결됩니다</h2>
                <p>{publicCopy(lesson.practicalNotes)}</p>
              </section>
            ) : null}

            {hasEvidence ? (
              <details className={styles.sourceDisclosure} id="source-evidence">
                <summary>
                  <span>
                    <b>공식 근거 보기</b>
                    <small>법령, 기준, 입증 메모를 확인합니다.</small>
                  </span>
                </summary>
                <div className={styles.evidenceList}>
                  <EvidenceSection title="관련 법령" value={lesson.legalNotes} />
                  <EvidenceSection title="참고 기준" value={lesson.standardNotes} />
                  <EvidenceSection title="입증 메모" value={lesson.evidenceNotes} />
                </div>
              </details>
            ) : null}

            <section className={styles.practiceCallout} aria-labelledby="practice-title">
              <div>
                <p className={styles.eyebrow}>문제 확인</p>
                <h2 id="practice-title">배운 내용을 문제로 확인하세요</h2>
                <p>현재 과정의 문제 5개로 핵심 개념을 점검합니다.</p>
              </div>
              <Link className={styles.primaryButton} href={`/practice/${course.slug}?count=5`}>
                5문제로 확인하기
              </Link>
            </section>

            <CourseLessonNavigation
              courseSlug={course.slug}
              previousLesson={lesson.previousLesson}
              nextLesson={lesson.nextLesson}
            />
          </article>

          <aside className={styles.lessonOutline} aria-label="레슨 진행">
            <p className={styles.eyebrow}>현재 위치</p>
            <strong>{publicCopy(lesson.title)}</strong>
            <nav aria-label="레슨 내 이동">
              <a href="#learning-content">핵심 개념</a>
              {lesson.examPoints ? <a href="#exam-points">시험 포인트</a> : null}
              {hasEvidence ? <a href="#source-evidence">공식 근거</a> : null}
              <a href="#practice-title">문제 확인</a>
            </nav>
            <CourseLessonActions
              courseLessonId={lesson.id}
              initialStatus={lesson.status}
              initialProgressPercent={lesson.progressPercent}
              completionRule={lesson.completionRule}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function EvidenceSection({ title, value }: { title: string; value: string | string[] | null }) {
  if (!value || (Array.isArray(value) && !value.length)) return null;
  return (
    <section>
      <h3>{title}</h3>
      {Array.isArray(value) ? (
        <ul>{value.map((item) => <li key={item}>{publicCopy(item)}</li>)}</ul>
      ) : (
        <p>{publicCopy(value)}</p>
      )}
    </section>
  );
}

function ContentValueList({ value }: { value: string | string[] }) {
  const items = Array.isArray(value) ? value : value.split(/\r?\n/).filter(Boolean);
  return <ul>{items.map((item) => <li key={item}>{publicCopy(item)}</li>)}</ul>;
}

function CourseLessonNavigation({
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
        <Link href={`/learn/${courseSlug}/course-lessons/${previousLesson.id}`}>
          <span>이전 레슨</span>
          <strong>{publicCopy(previousLesson.title)}</strong>
        </Link>
      ) : <span />}
      {nextLesson ? (
        <Link href={`/learn/${courseSlug}/course-lessons/${nextLesson.id}`}>
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
