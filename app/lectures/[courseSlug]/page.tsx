import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublishedLectures } from "@/db/lecture-repositories";
import {
  getPublicCourseBySlug,
  listCurriculum,
} from "@/db/repositories";
import { getCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LectureListPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{
    subjectId?: string;
    topicId?: string;
    query?: string;
  }>;
}) {
  const [{ courseSlug }, filters, user] = await Promise.all([
    params,
    searchParams,
    getCurrentAppUser(),
  ]);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const [curriculum, items] = await Promise.all([
    listCurriculum(course.id),
    listPublishedLectures(course.id, user?.id ?? null, filters),
  ]);
  const recent = items
    .filter((item) => item.lastPlayedAt)
    .sort((a, b) =>
      String(b.lastPlayedAt).localeCompare(String(a.lastPlayedAt)),
    )
    .slice(0, 3);
  const recommended =
    items.find((item) => item.accessAllowed && !item.completed) ?? null;

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <Link className="breadcrumb" href={`/courses/${course.slug}`}>
            ← {course.name}
          </Link>
          <p className="eyebrow">LECTURES</p>
          <h1>{course.name} 강의</h1>
          <p>
            과정·과목·주제별 공개 강의를 조회하고 이어보기와 개인 메모를
            관리합니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <form className="lecture-filters" method="get">
            <label>
              검색
              <input
                name="query"
                maxLength={100}
                defaultValue={filters.query ?? ""}
                placeholder="강의명, 설명, 강사명"
              />
            </label>
            <label>
              과목
              <select
                name="subjectId"
                defaultValue={filters.subjectId ?? ""}
              >
                <option value="">전체 과목</option>
                {curriculum.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              주제
              <select name="topicId" defaultValue={filters.topicId ?? ""}>
                <option value="">전체 주제</option>
                {curriculum.flatMap((subject) =>
                  subject.topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {subject.name} · {topic.name}
                    </option>
                  )),
                )}
              </select>
            </label>
            <button className="button button-dark" type="submit">
              조회
            </button>
          </form>

          {recommended ? (
            <section className="lecture-recommendation">
              <div>
                <span className="eyebrow">NEXT RECOMMENDED</span>
                <h2>다음 추천 강의</h2>
                <p>
                  현재 조건에서 시청 가능하고 아직 완료하지 않은 첫
                  강의입니다.
                </p>
              </div>
              <Link
                className="button button-dark"
                href={`/lectures/${course.slug}/${recommended.id}`}
              >
                {recommended.title}
              </Link>
            </section>
          ) : null}

          {recent.length ? (
            <section className="section-block">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">RECENT</p>
                  <h2>최근 시청</h2>
                </div>
              </div>
              <div className="lecture-card-grid compact">
                {recent.map((lecture) => (
                  <LectureCard
                    key={`recent-${lecture.id}`}
                    courseSlug={course.slug}
                    lecture={lecture}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="section-heading compact section-block">
            <div>
              <p className="eyebrow">CATALOG</p>
              <h2>강의 목록</h2>
            </div>
            <span className="count-label">{items.length}개</span>
          </div>
          {items.length ? (
            <div className="lecture-card-grid">
              {items.map((lecture) => (
                <LectureCard
                  key={lecture.id}
                  courseSlug={course.slug}
                  lecture={lecture}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              조건에 맞는 공개 강의가 없습니다.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function LectureCard({
  courseSlug,
  lecture,
}: {
  courseSlug: string;
  lecture: {
    id: string;
    title: string;
    description: string;
    instructorName: string;
    subjectName: string;
    topicName: string;
    providerLabel: string;
    durationSeconds: number;
    free: boolean;
    isSample: boolean;
    accessAllowed: boolean;
    currentPositionSeconds: number;
    completed: boolean;
    bookmarked: boolean;
  };
}) {
  return (
    <article className="lecture-card">
      <div className="lecture-thumbnail" aria-hidden="true">
        <span>{lecture.providerLabel}</span>
      </div>
      <div className="lecture-card-body">
        <div className="course-card-top">
          <span className="badge">{lecture.free ? "무료" : "수강 전용"}</span>
          {lecture.isSample ? (
            <span className="sample-label">Mock 개발용 영상</span>
          ) : null}
          {lecture.bookmarked ? <span aria-label="즐겨찾기">★</span> : null}
        </div>
        <p className="lecture-scope">
          {lecture.subjectName} · {lecture.topicName}
        </p>
        <h3>{lecture.title}</h3>
        <p>{lecture.description}</p>
        <p>
          {lecture.instructorName || "강사 정보 없음"} ·{" "}
          {Math.ceil(lecture.durationSeconds / 60)}분
        </p>
        {lecture.currentPositionSeconds > 0 ? (
          <progress
            max={lecture.durationSeconds}
            value={lecture.currentPositionSeconds}
            aria-label={`${lecture.title} 시청 진행률`}
          />
        ) : null}
        {lecture.accessAllowed ? (
          <Link
            className="button button-dark full-width"
            href={`/lectures/${courseSlug}/${lecture.id}`}
          >
            {lecture.completed
              ? "다시 보기"
              : lecture.currentPositionSeconds
                ? "이어보기"
                : "강의 보기"}
          </Link>
        ) : (
          <Link
            className="button button-soft full-width"
            href={`/courses/${courseSlug}`}
          >
            수강 등록 필요
          </Link>
        )}
      </div>
    </article>
  );
}
