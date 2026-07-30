import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourseLessonActions } from "@/components/course-lesson-actions";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import { getPublishedCourseLessonForUser } from "@/db/shared-content-repositories";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
} from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";

export default async function CourseLessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; courseLessonId: string }>;
}) {
  const { courseSlug, courseLessonId } = await params;
  const user = await requireCurrentAppUser(
    `/learn/${courseSlug}/course-lessons/${courseLessonId}`,
  );
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

  const title = publicCopy(lesson.title);
  const summary = publicCopy(lesson.summary);
  const body = publicCopy(lesson.body);
  const supplementalSections = [
    ["시험 포인트", lesson.examPoints],
    ["실무 메모", lesson.practicalNotes],
    ["법령 메모", lesson.legalNotes],
    ["기준 메모", lesson.standardNotes],
    ["증적 메모", lesson.evidenceNotes],
    ["자주 하는 실수", lesson.commonMistakes],
  ] as const;

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell narrow">
          <Link className="breadcrumb" href={`/learn/${course.slug}`}>
            ← {course.shortName} 학습
          </Link>
          <p className="eyebrow">SHARED THEORY LESSON</p>
          <h1>{title}</h1>
          <p>{summary}</p>
          <div className="lesson-meta">
            <span>공통 콘텐츠</span>
            <span>v{lesson.version}</span>
            <span>예상 {lesson.estimatedMinutes}분</span>
            <span>{lesson.isRequired ? "필수 학습" : "선택 학습"}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <article className="shell narrow lesson-reader">
          <SafeLessonContent content={body} format={lesson.bodyFormat} />

          {supplementalSections.some(([, value]) =>
            Array.isArray(value) ? value.length > 0 : Boolean(value),
          ) ? (
            <aside className="course-lesson-supplement">
              <p className="eyebrow">COURSE CONTEXT</p>
              <h2>이 과정에서 함께 볼 내용</h2>
              {supplementalSections.map(([label, value]) => {
                if (Array.isArray(value)) {
                  return value.length ? (
                    <section key={label}>
                      <h3>{label}</h3>
                      <ul>
                        {value.map((item) => (
                          <li key={item}>{publicCopy(item)}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null;
                }
                return value ? (
                  <section key={label}>
                    <h3>{label}</h3>
                    <p>{publicCopy(value)}</p>
                  </section>
                ) : null;
              })}
            </aside>
          ) : null}

          <CourseLessonActions
            courseLessonId={lesson.id}
            initialStatus={lesson.status}
            initialProgressPercent={lesson.progressPercent}
            completionRule={lesson.completionRule}
          />

          <nav className="lesson-navigation" aria-label="공통 레슨 이동">
            {lesson.previousLesson ? (
              <Link
                className="button button-ghost"
                href={`/learn/${course.slug}/course-lessons/${lesson.previousLesson.id}`}
              >
                ← 이전 · {publicCopy(lesson.previousLesson.title)}
              </Link>
            ) : (
              <span />
            )}
            {lesson.nextLesson ? (
              <Link
                className="button button-dark"
                href={`/learn/${course.slug}/course-lessons/${lesson.nextLesson.id}`}
              >
                다음 · {publicCopy(lesson.nextLesson.title)} →
              </Link>
            ) : (
              <Link className="button button-dark" href={`/learn/${course.slug}`}>
                과정으로 돌아가기
              </Link>
            )}
          </nav>
        </article>
      </section>
    </main>
  );
}
