import { notFound } from "next/navigation";
import { PracticeSession } from "@/components/practice-session";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
  listSubjectsForCourse,
  listTopicsForSubject,
} from "@/db/repositories";
import {
  listPublicQuestions,
  listWrongQuestionIds,
} from "@/db/question-repositories";
import { listDueReviews } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseSlug } = await params;
  const query = await searchParams;
  const user = await requireCurrentAppUser(`/practice/${courseSlug}`);
  const course = await getPublicCourseBySlug(courseSlug);
  if (!course) notFound();
  const enrollment = await getEnrollmentForCourse(user.id, course.id);
  if (!enrollment) {
    return (
      <main className="page-main dashboard-page">
        <div className="shell empty-state">
          <strong>수강 등록이 필요합니다.</strong>
          <p>과정 상세에서 수강을 시작한 뒤 문제를 풀 수 있습니다.</p>
        </div>
      </main>
    );
  }
  const subjects = await listSubjectsForCourse(course.id);
  const subjectId =
    typeof query.subjectId === "string" ? query.subjectId : undefined;
  const topics = subjectId ? await listTopicsForSubject(subjectId) : [];
  const wrongQuestionIds =
    query.wrongOnly === "1"
      ? await listWrongQuestionIds(user.id, course.id)
      : undefined;
  const reviewQuestionIds =
    query.reviewOnly === "1"
      ? (await listDueReviews(user.id, course.id))
          .filter((item) =>
            ["QUESTION", "MOCK_EXAM_QUESTION"].includes(item.targetType),
          )
          .map((item) => item.targetId)
      : undefined;
  const limit = Math.min(
    50,
    Math.max(1, Number(typeof query.count === "string" ? query.count : 10)),
  );
  const questions = await listPublicQuestions({
    courseId: course.id,
    subjectId,
    topicId: typeof query.topicId === "string" ? query.topicId : undefined,
    type: typeof query.type === "string" ? query.type : undefined,
    difficulty:
      typeof query.difficulty === "string" ? query.difficulty : undefined,
    random: query.random === "1",
    questionIds: reviewQuestionIds ?? wrongQuestionIds,
    limit,
  });

  return (
    <main className="page-main practice-page">
      <header className="page-hero">
        <div className="shell">
          <p className="eyebrow">PRACTICE MODE</p>
          <h1>{course.shortName} 문제풀이</h1>
          <p>
            제출 즉시 서버에서 채점하고 해설을 제공합니다. 정답 데이터는 제출
            전 응답에 포함되지 않습니다.
          </p>
        </div>
      </header>
      <div className="shell practice-layout">
        <aside className="practice-filter">
          <h2>문제 구성</h2>
          <form method="get">
            <label>
              과목
              <select name="subjectId" defaultValue={subjectId ?? ""}>
                <option value="">전체 과목</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              주제
              <select
                name="topicId"
                defaultValue={
                  typeof query.topicId === "string" ? query.topicId : ""
                }
              >
                <option value="">전체 주제</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              문제 유형
              <select
                name="type"
                defaultValue={typeof query.type === "string" ? query.type : ""}
              >
                <option value="">전체 유형</option>
                <option value="TRUE_FALSE">OX</option>
                <option value="SINGLE_CHOICE">단일선택형</option>
                <option value="MULTIPLE_CHOICE">복수선택형</option>
                <option value="SHORT_ANSWER">단답형</option>
                <option value="ESSAY" disabled>서술형 · 개설 예정</option>
                <option value="CALCULATION" disabled>계산형 · 개설 예정</option>
              </select>
            </label>
            <label>
              난이도
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
            </label>
            <label>
              문제 수
              <select name="count" defaultValue={String(limit)}>
                <option value="5">5개</option>
                <option value="10">10개</option>
                <option value="20">20개</option>
                <option value="50">50개</option>
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="random"
                value="1"
                defaultChecked={query.random === "1"}
              />
              무작위 출제
            </label>
            <button className="button button-dark full-width" type="submit">
              문제 구성 적용
            </button>
          </form>
        </aside>
        <PracticeSession questions={questions} courseId={course.id} />
      </div>
    </main>
  );
}
