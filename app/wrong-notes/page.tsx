import Link from "next/link";
import { WrongNoteCard } from "@/components/wrong-note-card";
import {
  listPublishedCourses,
  listSubjectsForCourse,
  listTopicsForSubject,
} from "@/db/repositories";
import { listWrongNotes } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WrongNotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentAppUser("/wrong-notes");
  const query = await searchParams;
  const courseId =
    typeof query.courseId === "string" ? query.courseId : undefined;
  const subjectId =
    typeof query.subjectId === "string" ? query.subjectId : undefined;
  const topicId = typeof query.topicId === "string" ? query.topicId : undefined;
  const [courses, subjects, topics, notes] = await Promise.all([
    listPublishedCourses(),
    courseId ? listSubjectsForCourse(courseId) : Promise.resolve([]),
    subjectId ? listTopicsForSubject(subjectId) : Promise.resolve([]),
    listWrongNotes(user.id, {
      courseId,
      subjectId,
      topicId,
      difficulty:
        typeof query.difficulty === "string" ? query.difficulty : undefined,
      mastered:
        query.mastered === "1"
          ? true
          : query.mastered === "0"
            ? false
            : undefined,
      repeated: query.repeated === "1",
    }),
  ]);
  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">WRONG ANSWER REVIEW</p>
            <h1>오답노트</h1>
            <p>반복 오답은 한 행에서 횟수와 마지막 기록을 갱신합니다.</p>
          </div>
          <Link className="button button-dark" href="/my-courses">
            과정별 다시 풀기
          </Link>
        </header>
        <form className="filter-row" method="get">
          <select name="courseId" defaultValue={courseId ?? ""}>
            <option value="">전체 과정</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.shortName}
              </option>
            ))}
          </select>
          <select name="subjectId" defaultValue={subjectId ?? ""}>
            <option value="">전체 과목</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select name="topicId" defaultValue={topicId ?? ""}>
            <option value="">전체 주제</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
          <select
            name="difficulty"
            defaultValue={
              typeof query.difficulty === "string" ? query.difficulty : ""
            }
          >
            <option value="">전체 난이도</option>
            <option value="EASY">쉬움</option>
            <option value="MEDIUM">보통</option>
            <option value="HARD">어려움</option>
          </select>
          <label className="check-label">
            <input
              name="repeated"
              type="checkbox"
              value="1"
              defaultChecked={query.repeated === "1"}
            />
            반복 오답만
          </label>
          <select
            name="mastered"
            defaultValue={
              typeof query.mastered === "string" ? query.mastered : ""
            }
          >
            <option value="">전체 숙지 상태</option>
            <option value="0">미숙지</option>
            <option value="1">숙지 완료</option>
          </select>
          <button className="button button-ghost" type="submit">
            필터 적용
          </button>
        </form>
        {notes.length ? (
          <div className="review-grid">
            {notes.map((note) => (
              <WrongNoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>저장된 오답이 없습니다.</strong>
            <p>문제를 틀리면 이곳에 자동으로 누적됩니다.</p>
          </div>
        )}
      </div>
    </main>
  );
}
