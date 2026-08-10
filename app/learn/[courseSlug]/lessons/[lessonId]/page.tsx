import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AudioLearningPlayer } from "@/components/audio-learning-player";
import { ContentVersionInfo } from "@/components/content-version-info";
import { LessonActions } from "@/components/lesson-actions";
import { SafeLessonContent } from "@/components/safe-lesson-content";
import { listPublishedAudioForLesson } from "@/db/audio-repositories";
import { getLatestPublishedRevision } from "@/db/content-revision-repositories";
import { getPublishedLessonForUser } from "@/db/lesson-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "학습 레슨 | Securium", description: "보안 학습 콘텐츠와 오디오 자료를 확인하고 학습을 이어가세요." };

export default async function LessonPage({ params }: { params: Promise<{ courseSlug: string; lessonId: string }> }) {
  const { courseSlug, lessonId } = await params; const user = await requireCurrentAppUser(`/learn/${courseSlug}/lessons/${lessonId}`); const course = await getPublicCourseBySlug(courseSlug); if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id); if (!enrollment) redirect(`/courses/${course.slug}`);
  const lesson = await getPublishedLessonForUser(user.id, course.id, lessonId); if (!lesson) notFound();
  const audioContents = await listPublishedAudioForLesson(user.id, course.id, lesson.id);
  const [lessonRevision, audioRevisions] = await Promise.all([getLatestPublishedRevision("LESSON", lesson.id), Promise.all(audioContents.map((audio) => getLatestPublishedRevision("AUDIO_CONTENT", audio.id))) ]);
  const sanitizedAudioContents = audioContents.map((audio) => ({ ...audio, title: publicCopy(audio.title), transcript: publicCopy(audio.transcript), transcriptSegments: audio.transcriptSegments.map((segment) => ({ ...segment, text: publicCopy(segment.text) })) }));
  return <main className="page-main"><section className="page-hero"><div className="shell narrow"><Link className="breadcrumb" href={`/learn/${course.slug}/subjects/${lesson.subjectId}`}>{publicCopy(lesson.subjectName)} 과목</Link><p className="eyebrow">핵심 이론</p><h1>{publicCopy(lesson.title)}</h1><p>{publicCopy(lesson.summary)}</p><div className="lesson-meta"><span>{publicCopy(lesson.learningUnitTitle)}</span><span>{publicCopy(lesson.topicName)}</span><span>예상 {lesson.estimatedMinutes}분</span><span>완료 조건: {formatCompletionPolicy(lesson.completionPolicy)}</span>{lesson.isSample ? <span>학습 공개 자료</span> : null}</div></div></section><section className="section"><article className="shell narrow lesson-reader"><SafeLessonContent content={publicCopy(lesson.content)} format={lesson.contentFormat} /><ContentVersionInfo revision={sanitizeRevision(lessonRevision)} />{audioRevisions.map((revision, index) => <ContentVersionInfo compact key={sanitizedAudioContents[index].id} revision={sanitizeRevision(revision)} />)}<AudioLearningPlayer items={sanitizedAudioContents} /><LessonActions lessonId={lesson.id} initialStatus={lesson.status} initialLastPosition={lesson.lastPosition} completionPolicy={lesson.completionPolicy} /><nav className="lesson-navigation" aria-label="레슨 이동">{lesson.previousLesson ? <Link className="button button-ghost" href={`/learn/${course.slug}/lessons/${lesson.previousLesson.id}`}>이전 · {publicCopy(lesson.previousLesson.title)}</Link> : <span />}{lesson.nextLesson ? <Link className="button button-dark" href={`/learn/${course.slug}/lessons/${lesson.nextLesson.id}`}>다음 · {publicCopy(lesson.nextLesson.title)}</Link> : <Link className="button button-dark" href={`/learn/${course.slug}`}>과정으로 돌아가기</Link>}</nav></article></section></main>;
}

function formatCompletionPolicy(policy: string) { if (policy === "MANUAL") return "직접 완료"; if (policy === "SCROLL_END") return "본문 끝까지 읽기"; return "최소 학습 조건"; }
type DisplayRevision = { id: string; contentDate: string; version: string; reviewedAt: string | null; revisionStatus: string; isLatest: boolean; changeSummary: string };
function sanitizeRevision(revision: (DisplayRevision & { title?: string; snapshotJson?: string }) | null): DisplayRevision | null { if (!revision) return revision; return { id: revision.id, contentDate: revision.contentDate, version: revision.version, reviewedAt: revision.reviewedAt, revisionStatus: revision.revisionStatus, isLatest: revision.isLatest, changeSummary: publicCopy(revision.changeSummary) }; }
