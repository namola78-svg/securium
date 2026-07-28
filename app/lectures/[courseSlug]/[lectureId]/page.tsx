import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { LecturePlayer } from "@/components/lecture-player";
import { ContentVersionInfo } from "@/components/content-version-info";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getPublishedLecture } from "@/db/lecture-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { getCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lectureId: string }>;
}) {
  const { courseSlug, lectureId } = await params;
  const [user, course] = await Promise.all([
    getCurrentAppUser(),
    getPublicCourseBySlug(courseSlug),
  ]);
  if (!course) notFound();
  const lecture = await getPublishedLecture(
    course.id,
    lectureId,
    user?.id ?? null,
  );
  if (!lecture) notFound();
  if (!lecture.accessAllowed) {
    const returnTo = `/lectures/${course.slug}/${lecture.id}`;
    if (!user) redirect(chatGPTSignInPath(returnTo));
    redirect(`/courses/${course.slug}?notice=lecture-enrollment-required`);
  }
  if (!lecture.embed) notFound();
  const revision = await getLatestPublishedRevision("LECTURE", lecture.id);

  return (
    <main className="page-main">
      <section className="page-hero lecture-detail-hero">
        <div className="shell narrow">
          <Link
            className="breadcrumb"
            href={`/lectures/${course.slug}`}
          >
            ← 강의 목록
          </Link>
          <div className="course-card-top">
            <span className="badge">
              {lecture.free ? "무료 강의" : "수강 전용"}
            </span>
            {lecture.isSample ? (
              <span className="sample-label">강의 영상</span>
            ) : null}
          </div>
          <h1>{lecture.title}</h1>
          <p>{lecture.description}</p>
          <div className="lesson-meta">
            <span>{lecture.subjectName}</span>
            <span>{lecture.topicName}</span>
            <span>{lecture.instructorName || "강사 정보 없음"}</span>
            <span>{Math.ceil(lecture.durationSeconds / 60)}분</span>
            <span>{lecture.embed.providerLabel}</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="shell narrow">
          <LecturePlayer
            lectureId={lecture.id}
            title={lecture.title}
            durationSeconds={lecture.durationSeconds}
            embed={lecture.embed}
            authenticated={Boolean(user)}
            initialPosition={lecture.currentPositionSeconds}
            initialCompleted={lecture.completed}
            initialBookmarked={lecture.bookmarked}
            initialNote={lecture.note ?? ""}
          />
          <ContentVersionInfo revision={revision} />

          <div className="lecture-related-grid section-block">
            <section className="side-card">
              <p className="eyebrow">RELATED THEORY</p>
              <h2>관련 이론</h2>
              {lecture.relatedTheory.length ? (
                <ul className="plain-list">
                  {lecture.relatedTheory.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/learn/${course.slug}/lessons/${lesson.id}`}
                      >
                        {lesson.title}
                      </Link>
                      <p>{lesson.summary}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>연결된 공개 이론 레슨이 없습니다.</p>
              )}
            </section>
            <section className="side-card">
              <p className="eyebrow">RELATED QUESTIONS</p>
              <h2>관련 문제</h2>
              {lecture.relatedQuestions.length ? (
                <ul className="plain-list">
                  {lecture.relatedQuestions.map((question) => (
                    <li key={question.id}>
                      <Link
                        href={`/practice/${course.slug}?questionId=${question.id}`}
                      >
                        {question.title}
                      </Link>
                      <p>
                        {question.type} · {question.difficulty}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>연결된 공개 문제가 없습니다.</p>
              )}
            </section>
          </div>

          <nav className="lesson-navigation" aria-label="강의 이동">
            <Link
              className="button button-ghost"
              href={`/lectures/${course.slug}`}
            >
              강의 목록
            </Link>
            {lecture.nextLecture ? (
              <Link
                className="button button-dark"
                href={`/lectures/${course.slug}/${lecture.nextLecture.id}`}
              >
                다음 추천 · {lecture.nextLecture.title} →
              </Link>
            ) : (
              <Link
                className="button button-dark"
                href={`/learn/${course.slug}`}
              >
                과정 학습으로
              </Link>
            )}
          </nav>
        </div>
      </section>
    </main>
  );
}
