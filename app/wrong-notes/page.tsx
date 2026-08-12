import type { Metadata } from "next";
import Link from "next/link";
import { WrongNoteCard } from "@/components/wrong-note-card";
import styles from "@/components/v2/review-v2.module.css";
import { listPublishedCourses, listSubjectsForCourse, listTopicsForSubject } from "@/db/repositories";
import { listWrongNotes } from "@/db/question-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "오답노트 | SECURIUM",
  description: "틀린 문제와 다시 확인할 개념을 한곳에서 관리합니다.",
};

export default async function WrongNotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCurrentAppUser("/wrong-notes");
  const query = await searchParams;
  const raw = (key: string) => typeof query[key] === "string" ? query[key] : undefined;
  const courseId = raw("courseId");
  const subjectId = raw("subjectId");
  const topicId = raw("topicId");
  const difficulty = raw("difficulty");
  const repeated = query.repeated === "1";
  const mastered = query.mastered === "1" ? true : query.mastered === "0" ? false : undefined;
  const [courses, allNotes] = await Promise.all([
    listPublishedCourses(),
    listWrongNotes(user.id, {}),
  ]);
  const validCourseId = courses.some((course) => course.id === courseId) ? courseId : undefined;
  const subjects = validCourseId ? await listSubjectsForCourse(validCourseId) : [];
  const validSubjectId = subjects.some((subject) => subject.id === subjectId) ? subjectId : undefined;
  const topics = validSubjectId ? await listTopicsForSubject(validSubjectId) : [];
  const validTopicId = topics.some((topic) => topic.id === topicId) ? topicId : undefined;
  const hasFilters = Boolean(validCourseId || validSubjectId || validTopicId || difficulty || repeated || mastered !== undefined);
  const notes = hasFilters
    ? await listWrongNotes(user.id, { courseId: validCourseId, subjectId: validSubjectId, topicId: validTopicId, difficulty, mastered, repeated })
    : allNotes;
  const selectedCourse = courses.find((course) => course.id === validCourseId);
  const repeatedCount = allNotes.filter((note) => note.wrongCount > 1).length;
  const recentCount = allNotes.filter((note) => isRecent(note.updatedAt)).length;

  return (
    <main className={styles.page} data-wrong-notes-v2="">
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>학습 기록</p>
            <h1>오답노트</h1>
            <p>틀린 문제와 다시 확인할 개념을 한곳에서 관리하세요.</p>
          </div>
          <Link className={styles.secondaryAction} href="/reviews">오늘의 복습 보기</Link>
        </header>

        <section className={styles.notesSummary} aria-labelledby="wrong-notes-summary-title">
          <div>
            <p className={styles.eyebrow}>오답 요약</p>
            <h2 id="wrong-notes-summary-title">{allNotes.length ? "반복해서 틀린 문제부터 확인하세요." : "저장된 오답이 없습니다."}</h2>
            <p>{allNotes.length ? "틀린 기록을 확인하고 필요한 문제를 바로 다시 풀 수 있습니다." : "문제를 풀고 틀린 항목이 생기면 이곳에 기록됩니다."}</p>
          </div>
          <dl className={styles.summaryMetrics} aria-label="오답 기록 요약">
            <div><dt>전체 오답</dt><dd>{allNotes.length}개</dd></div>
            <div><dt>반복 오답</dt><dd>{repeatedCount}개</dd></div>
            <div><dt>최근 추가</dt><dd>{recentCount}개</dd></div>
          </dl>
        </section>

        {allNotes.length ? (
          <>
            <details className={styles.filterDisclosure} open={hasFilters}>
              <summary><span><b>오답 필터</b><small>{hasFilters ? "선택한 조건이 적용되어 있습니다." : "과정과 학습 상태로 범위를 좁혀보세요."}</small></span><span aria-hidden="true">＋</span></summary>
              <form className={styles.filterForm} method="get">
                <label>과정<select name="courseId" defaultValue={courseId ?? ""}><option value="">전체 과정</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.shortName}</option>)}</select></label>
                <label>과목<select name="subjectId" defaultValue={subjectId ?? ""} disabled={!validCourseId}><option value="">전체 과목</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <label>주제<select name="topicId" defaultValue={topicId ?? ""} disabled={!validSubjectId}><option value="">전체 주제</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
                <label>난이도<select name="difficulty" defaultValue={difficulty ?? ""}><option value="">전체 난이도</option><option value="EASY">쉬움</option><option value="MEDIUM">보통</option><option value="HARD">어려움</option></select></label>
                <label>학습 상태<select name="mastered" defaultValue={typeof query.mastered === "string" ? query.mastered : ""}><option value="">전체 상태</option><option value="0">다시 확인</option><option value="1">학습 완료</option></select></label>
                <label className={styles.checkbox}><input name="repeated" type="checkbox" value="1" defaultChecked={repeated} /><span>반복 오답만</span></label>
                <button type="submit">필터 적용</button>
                {hasFilters ? <Link className={styles.resetAction} href="/wrong-notes">초기화</Link> : null}
              </form>
            </details>

            <section className={styles.section} aria-labelledby="wrong-note-list-title">
              <header className={styles.sectionHeader}>
                <div><p className={styles.eyebrow}>오답 목록</p><h2 id="wrong-note-list-title">{hasFilters ? `선택한 범위 ${notes.length}개` : `전체 ${notes.length}개`}</h2></div>
                {selectedCourse && notes.length ? <Link className={styles.primaryAction} href={`/practice/${selectedCourse.slug}?wrongOnly=1&count=50`}>선택한 오답 다시 풀기<span aria-hidden="true">→</span></Link> : null}
              </header>
              {notes.length ? (
                <ul className={styles.noteList}>
                  {notes.map((note) => <li key={note.id}><WrongNoteCard note={note} /></li>)}
                </ul>
              ) : (
                <div className={styles.inlineEmpty}><strong>선택한 조건의 오답이 없습니다.</strong><p>필터를 초기화해 다른 오답 기록을 확인하세요.</p><Link className={styles.resetAction} href="/wrong-notes">필터 초기화</Link></div>
              )}
            </section>
          </>
        ) : (
          <section className={styles.emptyState} aria-labelledby="wrong-note-empty-title">
            <span className={styles.emptyMark} aria-hidden="true">?</span>
            <h2 id="wrong-note-empty-title">아직 저장된 오답이 없습니다.</h2>
            <p>문제를 풀고 결과를 확인하면 틀린 문제를 이곳에서 다시 확인할 수 있습니다.</p>
            <Link className={styles.primaryAction} href="/practice">문제 풀기<span aria-hidden="true">→</span></Link>
          </section>
        )}
      </div>
    </main>
  );
}

function isRecent(value: string) {
  return Date.now() - new Date(value).getTime() <= 7 * 86_400_000;
}
