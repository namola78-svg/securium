import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublishedLectures } from "@/db/lecture-repositories";
import { getPublicCourseBySlug, listCurriculum } from "@/db/repositories";
import { getCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "보안 강의 | Securium",
  description: "과정별 보안 강의를 찾고 시청 진도와 메모를 이어가세요.",
};

export default async function LectureListPage({ params, searchParams }: { params: Promise<{ courseSlug: string }>; searchParams: Promise<{ subjectId?: string; topicId?: string; query?: string }> }) {
  const [{ courseSlug }, filters, user] = await Promise.all([params, searchParams, getCurrentAppUser()]);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const [curriculum, items] = await Promise.all([listCurriculum(course.id), listPublishedLectures(course.id, user?.id ?? null, filters)]);
  const displayItems = items.map(sanitizeLecture);
  const recent = displayItems.filter((item) => item.lastPlayedAt).sort((a, b) => String(b.lastPlayedAt).localeCompare(String(a.lastPlayedAt))).slice(0, 3);
  const recommended = displayItems.find((item) => item.accessAllowed && !item.completed);

  return <main className="page-main"><section className="page-hero"><div className="shell"><Link className="breadcrumb" href={`/courses/${course.slug}`}>{publicCopy(course.name)} 과정</Link><p className="eyebrow">LECTURES</p><h1>{publicCopy(course.name)} 강의</h1><p>과목과 주제로 공개 강의를 찾고, 시청 위치·북마크·메모를 이어서 관리하세요.</p></div></section><section className="section"><div className="shell"><form className="lecture-filters" method="get"><label>검색<input name="query" maxLength={100} defaultValue={filters.query ?? ""} placeholder="강의명, 설명, 강사명" /></label><label>과목<select name="subjectId" defaultValue={filters.subjectId ?? ""}><option value="">전체 과목</option>{curriculum.map((subject) => <option key={subject.id} value={subject.id}>{publicCopy(subject.name)}</option>)}</select></label><label>주제<select name="topicId" defaultValue={filters.topicId ?? ""}><option value="">전체 주제</option>{curriculum.flatMap((subject) => subject.topics.map((topic) => <option key={topic.id} value={topic.id}>{publicCopy(subject.name)} · {publicCopy(topic.name)}</option>))}</select></label><button className="button button-dark" type="submit">강의 찾기</button></form>{recommended ? <section className="lecture-recommendation"><div><span className="eyebrow">추천 강의</span><h2>다음으로 볼 강의</h2><p>시청을 시작했고 아직 완료하지 않은 강의입니다.</p></div><Link className="button button-dark" href={`/lectures/${course.slug}/${recommended.id}`}>{recommended.title}</Link></section> : null}{recent.length ? <section className="section-block"><div className="section-heading compact"><div><p className="eyebrow">RECENT</p><h2>최근 시청</h2></div></div><div className="lecture-card-grid compact">{recent.map((lecture) => <LectureCard key={`recent-${lecture.id}`} courseSlug={course.slug} lecture={lecture} />)}</div></section> : null}<div className="section-heading compact section-block"><div><p className="eyebrow">CATALOG</p><h2>강의 목록</h2></div><span className="count-label">{displayItems.length}개</span></div>{displayItems.length ? <div className="lecture-card-grid">{displayItems.map((lecture) => <LectureCard key={lecture.id} courseSlug={course.slug} lecture={lecture} />)}</div> : <div className="empty-state"><strong>조건에 맞는 공개 강의가 없습니다.</strong><p>검색 조건을 바꾸거나 과정 개요에서 이론 학습을 선택해보세요.</p><Link className="button button-dark" href={`/learn/${course.slug}`}>학습 개요로 이동</Link></div>}</div></section></main>;
}

function sanitizeLecture<T extends { title: string; description: string; instructorName: string; subjectName: string; topicName: string; providerLabel: string }>(lecture: T): T { return { ...lecture, title: publicCopy(lecture.title), description: publicCopy(lecture.description), instructorName: publicCopy(lecture.instructorName), subjectName: publicCopy(lecture.subjectName), topicName: publicCopy(lecture.topicName), providerLabel: publicCopy(lecture.providerLabel) }; }

function LectureCard({ courseSlug, lecture }: { courseSlug: string; lecture: { id: string; title: string; description: string; instructorName: string; subjectName: string; topicName: string; providerLabel: string; durationSeconds: number; free: boolean; isSample: boolean; accessAllowed: boolean; currentPositionSeconds: number; completed: boolean; bookmarked: boolean } }) {
  return <article className="lecture-card"><div className="lecture-thumbnail" aria-hidden="true"><span>{lecture.providerLabel}</span></div><div className="lecture-card-body"><div className="course-card-top"><span className="badge">{lecture.free ? "무료" : "수강생 전용"}</span>{lecture.isSample ? <span className="sample-label">강의 영상</span> : null}{lecture.bookmarked ? <span aria-label="북마크 저장됨">북마크</span> : null}</div><p className="lecture-scope">{lecture.subjectName} · {lecture.topicName}</p><h3>{lecture.title}</h3><p>{lecture.description}</p><p>{lecture.instructorName || "강사 정보 없음"} · {Math.ceil(lecture.durationSeconds / 60)}분</p>{lecture.currentPositionSeconds > 0 ? <progress max={lecture.durationSeconds} value={lecture.currentPositionSeconds} aria-label={`${lecture.title} 시청 진행률`} /> : null}{lecture.accessAllowed ? <Link className="button button-dark full-width" href={`/lectures/${courseSlug}/${lecture.id}`}>{lecture.completed ? "다시 보기" : lecture.currentPositionSeconds ? "이어서 보기" : "강의 보기"}</Link> : <Link className="button button-soft full-width" href={`/courses/${courseSlug}`}>수강 등록 필요</Link>}</div></article>;
}
