import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { ContentVersionInfo } from "@/components/content-version-info";
import { LecturePlayer } from "@/components/lecture-player";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getPublishedLecture } from "@/db/lecture-repositories";
import { getPublicCourseBySlug } from "@/db/repositories";
import { getCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "강의 시청 | Securium", description: "보안 강의를 시청하고 진도와 즐겨찾기, 메모를 이어가세요." };

export default async function LectureDetailPage({ params }: { params: Promise<{ courseSlug: string; lectureId: string }> }) {
  const { courseSlug, lectureId } = await params;
  const [user, course] = await Promise.all([getCurrentAppUser(), getPublicCourseBySlug(courseSlug)]);
  if (!course) notFound();
  const lecture = await getPublishedLecture(course.id, lectureId, user?.id ?? null);
  if (!lecture) notFound();
  if (!lecture.accessAllowed) { const returnTo = `/lectures/${course.slug}/${lecture.id}`; if (!user) redirect(chatGPTSignInPath(returnTo)); redirect(`/courses/${course.slug}?notice=lecture-enrollment-required`); }
  if (!lecture.embed) notFound();
  const revision = await getLatestPublishedRevision("LECTURE", lecture.id);
  return <main className="page-main"><section className="page-hero lecture-detail-hero"><div className="shell narrow"><Link className="breadcrumb" href={`/lectures/${course.slug}`}>← 강의 목록</Link><div className="course-card-top"><span className="badge">{lecture.free ? "무료 강의" : "수강 전용"}</span>{lecture.isSample ? <span className="sample-label">강의 영상</span> : null}</div><h1>{publicCopy(lecture.title)}</h1><p>{publicCopy(lecture.description)}</p><div className="lesson-meta"><span>{publicCopy(lecture.subjectName)}</span><span>{publicCopy(lecture.topicName)}</span><span>{publicCopy(lecture.instructorName) || "강사 정보 없음"}</span><span>{Math.ceil(lecture.durationSeconds / 60)}분</span><span>{publicCopy(lecture.embed.providerLabel)}</span></div></div></section><section className="section"><div className="shell narrow"><LecturePlayer lectureId={lecture.id} title={publicCopy(lecture.title)} durationSeconds={lecture.durationSeconds} embed={lecture.embed} authenticated={Boolean(user)} initialPosition={lecture.currentPositionSeconds} initialCompleted={lecture.completed} initialBookmarked={lecture.bookmarked} initialNote={lecture.note ?? ""} /><ContentVersionInfo revision={revision} /><div className="lecture-related-grid section-block"><RelatedSection title="관련 이론" items={lecture.relatedTheory.map((lesson) => ({ id: lesson.id, title: publicCopy(lesson.title), description: publicCopy(lesson.summary), href: `/learn/${course.slug}/lessons/${lesson.id}` }))} empty="연결된 이론 자료가 없습니다." /><RelatedSection title="관련 문제" items={lecture.relatedQuestions.map((question) => ({ id: question.id, title: publicCopy(question.title), description: `${question.type} · ${question.difficulty}`, href: `/practice/${course.slug}?questionId=${question.id}` }))} empty="연결된 문제가 없습니다." /></div><nav className="lesson-navigation" aria-label="강의 이동"><Link className="button button-ghost" href={`/lectures/${course.slug}`}>강의 목록</Link>{lecture.nextLecture ? <Link className="button button-dark" href={`/lectures/${course.slug}/${lecture.nextLecture.id}`}>다음 강의 · {publicCopy(lecture.nextLecture.title)}</Link> : <Link className="button button-dark" href={`/learn/${course.slug}`}>과정 학습으로</Link>}</nav></div></section></main>;
}

function RelatedSection({ title, items, empty }: { title: string; items: Array<{ id: string; title: string; description: string; href: string }>; empty: string }) {
  return <section className="side-card"><p className="eyebrow">RELATED LEARNING</p><h2>{title}</h2>{items.length ? <ul className="plain-list">{items.map((item) => <li key={item.id}><Link href={item.href}>{item.title}</Link><p>{item.description}</p></li>)}</ul> : <p>{empty}</p>}</section>;
}
