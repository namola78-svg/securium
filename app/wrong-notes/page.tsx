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
  const selectedCourse = courses.find((course) => course.id === courseId);
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const difficulty =
    typeof query.difficulty === "string" ? query.difficulty : undefined;
  const mastered =
    query.mastered === "1"
      ? "숙지 완료"
      : query.mastered === "0"
        ? "미숙지"
        : undefined;

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
        <WrongNoteFilterSummary
          courseSlug={selectedCourse?.slug}
          difficulty={difficulty}
          mastered={mastered}
          noteCount={notes.length}
          repeated={query.repeated === "1"}
          selectedCourseName={selectedCourse?.shortName ?? selectedCourse?.name}
          selectedSubjectName={selectedSubject?.name}
          selectedTopicName={selectedTopic?.name}
        />
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

function WrongNoteFilterSummary({
  courseSlug,
  difficulty,
  mastered,
  noteCount,
  repeated,
  selectedCourseName,
  selectedSubjectName,
  selectedTopicName,
}: {
  courseSlug?: string;
  difficulty?: string;
  mastered?: string;
  noteCount: number;
  repeated: boolean;
  selectedCourseName?: string;
  selectedSubjectName?: string;
  selectedTopicName?: string;
}) {
  const filters = [
    selectedCourseName ? `과정: ${selectedCourseName}` : "전체 과정",
    selectedSubjectName ? `과목: ${selectedSubjectName}` : "전체 과목",
    selectedTopicName ? `주제: ${selectedTopicName}` : "전체 주제",
    difficulty ? `난이도: ${formatDifficulty(difficulty)}` : "전체 난이도",
    repeated ? "반복 오답" : null,
    mastered ? `상태: ${mastered}` : "전체 숙지 상태",
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="review-context-card" aria-label="현재 오답노트 조건">
      <div>
        <p className="eyebrow">CURRENT WRONG NOTES</p>
        <h2>현재 오답노트 조건</h2>
        <p>
          {noteCount}개 오답 기록을 불러왔습니다. 과정·과목·주제 기준으로
          필터링해 취약 영역을 좁혀볼 수 있습니다.
        </p>
      </div>
      <div className="practice-context-tags" aria-label="적용된 오답 필터">
        {filters.map((filter) => (
          <span key={filter}>{filter}</span>
        ))}
      </div>
      <div className="card-actions">
        {courseSlug ? (
          <Link
            className="button button-dark"
            href={`/practice/${courseSlug}?wrongOnly=1&count=50`}
          >
            이 조건으로 다시 풀기
          </Link>
        ) : null}
        <Link className="button button-ghost" href="/wrong-notes">
          필터 초기화
        </Link>
      </div>
    </section>
  );
}

function formatDifficulty(difficulty: string) {
  const labels: Record<string, string> = {
    EASY: "쉬움",
    MEDIUM: "보통",
    HARD: "어려움",
  };
  return labels[difficulty] ?? difficulty;
}
