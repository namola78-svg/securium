import Link from "next/link";
import { WrongNoteCard } from "@/components/wrong-note-card";
import {
  listPublishedCourses,
  listSubjectsForCourse,
  listTopicsForSubject,
} from "@/db/repositories";
import { listWrongNotes } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { formatDifficultyLabel } from "@/lib/question-display";

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
  const difficulty =
    typeof query.difficulty === "string" ? query.difficulty : undefined;
  const repeated = query.repeated === "1";
  const mastered =
    query.mastered === "1" ? true : query.mastered === "0" ? false : undefined;

  const [courses, subjects, topics, notes] = await Promise.all([
    listPublishedCourses(),
    courseId ? listSubjectsForCourse(courseId) : Promise.resolve([]),
    subjectId ? listTopicsForSubject(subjectId) : Promise.resolve([]),
    listWrongNotes(user.id, {
      courseId,
      subjectId,
      topicId,
      difficulty,
      mastered,
      repeated,
    }),
  ]);

  const selectedCourse = courses.find((course) => course.id === courseId);
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const repeatedCount = notes.filter((note) => note.wrongCount > 1).length;
  const unresolvedCount = notes.filter((note) => !note.mastered).length;
  const highestWrongCount = notes.reduce(
    (max, note) => Math.max(max, note.wrongCount),
    0,
  );

  return (
    <main className="page-main dashboard-page">
      <div className="shell">
        <header className="dashboard-intro">
          <div>
            <p className="eyebrow">오답 복습</p>
            <h1>오답노트</h1>
            <p>
              반복 오답과 나의 메모를 과정별로 분리해 관리하고, 필요한 문제만
              다시 풀 수 있습니다.
            </p>
          </div>
          <Link className="button button-dark" href="/my-courses">
            내 과정으로 이동
          </Link>
        </header>

        <section className="review-overview-panel" aria-label="오답노트 요약">
          <div>
            <p className="eyebrow">오답 인사이트</p>
            <h2>
              {notes.length
                ? `${notes.length}개의 오답 기록을 확인하세요`
                : "저장된 오답이 없습니다"}
            </h2>
            <p>
              필터를 사용해 과정, 과목, 주제, 난이도별 취약 영역을 좁혀 볼 수
              있습니다.
            </p>
          </div>
          <dl>
            <div>
              <dt>전체 오답</dt>
              <dd>{notes.length}개</dd>
            </div>
            <div>
              <dt>반복 오답</dt>
              <dd>{repeatedCount}개</dd>
            </div>
            <div>
              <dt>미숙지</dt>
              <dd>{unresolvedCount}개</dd>
            </div>
          </dl>
        </section>

        <form className="filter-row wrong-note-filter" method="get">
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
          <select name="difficulty" defaultValue={difficulty ?? ""}>
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
              defaultChecked={repeated}
            />
            반복 오답만
          </label>
          <select
            name="mastered"
            defaultValue={typeof query.mastered === "string" ? query.mastered : ""}
          >
            <option value="">전체 학습 상태</option>
            <option value="0">미숙지</option>
            <option value="1">학습 완료</option>
          </select>
          <button className="button button-ghost" type="submit">
            필터 적용
          </button>
        </form>

        <WrongNoteFilterSummary
          courseSlug={selectedCourse?.slug}
          difficulty={difficulty}
          highestWrongCount={highestWrongCount}
          mastered={formatMastered(mastered)}
          noteCount={notes.length}
          repeated={repeated}
          repeatedCount={repeatedCount}
          selectedCourseName={selectedCourse?.shortName ?? selectedCourse?.name}
          selectedSubjectName={selectedSubject?.name}
          selectedTopicName={selectedTopic?.name}
          unresolvedCount={unresolvedCount}
        />

        {notes.length ? (
          <div className="review-grid wrong-note-grid">
            {notes.map((note) => (
              <WrongNoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>저장된 오답이 없습니다.</strong>
            <p>문제를 풀고 틀린 항목이 생기면 여기서 바로 다시 볼 수 있습니다.</p>
            <Link className="button button-dark" href="/practice">
              문제풀이 시작
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function WrongNoteFilterSummary({
  courseSlug,
  difficulty,
  highestWrongCount,
  mastered,
  noteCount,
  repeated,
  repeatedCount,
  selectedCourseName,
  selectedSubjectName,
  selectedTopicName,
  unresolvedCount,
}: {
  courseSlug?: string;
  difficulty?: string;
  highestWrongCount: number;
  mastered?: string;
  noteCount: number;
  repeated: boolean;
  repeatedCount: number;
  selectedCourseName?: string;
  selectedSubjectName?: string;
  selectedTopicName?: string;
  unresolvedCount: number;
}) {
  const filters = [
    selectedCourseName ? `과정: ${selectedCourseName}` : "전체 과정",
    selectedSubjectName ? `과목: ${selectedSubjectName}` : "전체 과목",
    selectedTopicName ? `주제: ${selectedTopicName}` : "전체 주제",
    difficulty ? `난이도: ${formatDifficultyLabel(difficulty)}` : "전체 난이도",
    repeated ? "반복 오답" : null,
    mastered ? `상태: ${mastered}` : "전체 학습 상태",
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="review-context-card" aria-label="다시 볼 오답 범위">
      <div>
        <p className="eyebrow">다시 볼 오답</p>
        <h2>다시 풀 오답 범위</h2>
        <p>
          {noteCount}개의 오답 기록을 불러왔습니다. 반복 오답과 미숙지 항목을
          먼저 확인하고, 필요한 문제만 다시 풀어 취약 영역을 줄이세요.
        </p>
      </div>
      <ol className="wrong-note-action-flow" aria-label="오답 복습 흐름">
        <li>
          <span>01</span>
          <strong>반복 오답 확인</strong>
        </li>
        <li>
          <span>02</span>
          <strong>필요한 문제 다시 풀기</strong>
        </li>
        <li>
          <span>03</span>
          <strong>학습 완료로 정리</strong>
        </li>
      </ol>
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
      <div className="wrong-note-insight-grid" aria-label="오답 우선순위 요약">
        <div>
          <span>반복 오답</span>
          <strong>{repeatedCount}개</strong>
          <p>두 번 이상 틀린 문제를 먼저 확인하세요.</p>
        </div>
        <div>
          <span>미숙지</span>
          <strong>{unresolvedCount}개</strong>
          <p>아직 학습 완료로 표시하지 않은 항목입니다.</p>
        </div>
        <div>
          <span>최대 오답 횟수</span>
          <strong>{highestWrongCount}회</strong>
          <p>가장 많이 틀린 문제는 별도 메모를 남기는 것이 좋습니다.</p>
        </div>
      </div>
    </section>
  );
}

function formatMastered(mastered?: boolean) {
  if (mastered === true) return "학습 완료";
  if (mastered === false) return "미숙지";
  return undefined;
}
