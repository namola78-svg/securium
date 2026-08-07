import { notFound } from "next/navigation";
import { PracticeSession } from "@/components/practice-session";
import { EmptyState } from "@/components/state-ui";
import {
  getEnrollmentForCourse,
  getPublicCourseBySlug,
} from "@/db/repositories";
import {
  listQuestionFilterSubjectsForCourse,
  listQuestionFilterTopicsForSubject,
  listPublicQuestions,
  listWrongQuestionIds,
} from "@/db/question-repositories";
import { listDueReviews } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";
import {
  formatDifficultyLabel,
  formatQuestionTypeLabel,
} from "@/lib/question-display";

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
        <div className="shell section">
          <EmptyState
            title="수강 등록이 필요합니다"
            description="과정 상세에서 내 학습에 추가한 뒤 문제풀이를 시작할 수 있습니다."
            action={{
              href: `/courses/${course.slug}`,
              label: "과정 자세히 보기",
            }}
            secondaryAction={{ href: "/courses", label: "과정 둘러보기" }}
          />
        </div>
      </main>
    );
  }

  const subjects = await listQuestionFilterSubjectsForCourse(course.id);
  const requestedSubjectId =
    typeof query.subjectId === "string" ? query.subjectId : undefined;
  const subjectId = subjects.some((subject) => subject.id === requestedSubjectId)
    ? requestedSubjectId
    : undefined;
  const topics = subjectId
    ? await listQuestionFilterTopicsForSubject(course.id, subjectId)
    : [];
  const requestedTopicId =
    typeof query.topicId === "string" ? query.topicId : undefined;
  const topicId = topics.some((topic) => topic.id === requestedTopicId)
    ? requestedTopicId
    : undefined;
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
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
    topicId,
    type: typeof query.type === "string" ? query.type : undefined,
    difficulty:
      typeof query.difficulty === "string" ? query.difficulty : undefined,
    random: query.random === "1",
    questionIds: reviewQuestionIds ?? wrongQuestionIds,
    limit,
  });
  const sanitizedQuestions = questions.map((question) => ({
    ...question,
    title: publicCopy(question.title),
    content: publicCopy(question.content),
    choices: question.choices.map((choice) => ({
      ...choice,
      content: publicCopy(choice.content),
    })),
  }));

  return (
    <main className="page-main practice-page">
      <header className="page-hero">
        <div className="shell">
          <p className="eyebrow">문제풀이</p>
          <h1>{course.shortName} 문제풀이</h1>
          <p>
            답안을 제출하면 자동 채점 결과와 기준 해설, AI 참고 해설로
            다음 복습 방향을 확인할 수 있습니다. 정답은 제출 전 화면에
            표시되지 않습니다.
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
              <select name="topicId" defaultValue={topicId ?? ""}>
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
                <option value="SINGLE_CHOICE">단일 선택</option>
                <option value="MULTIPLE_CHOICE">복수 선택</option>
                <option value="SHORT_ANSWER">단답형</option>
                <option value="ESSAY" disabled>
                  서술형 · 개설 예정
                </option>
                <option value="CALCULATION" disabled>
                  계산형 · 개설 예정
                </option>
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
        <div className="practice-main-stack">
          <PracticeContextSummary
            courseSlug={course.slug}
            count={limit}
            difficulty={
              typeof query.difficulty === "string"
                ? query.difficulty
                : undefined
            }
            questionCount={sanitizedQuestions.length}
            questionType={typeof query.type === "string" ? query.type : undefined}
            random={query.random === "1"}
            reviewOnly={query.reviewOnly === "1"}
            selectedSubjectName={selectedSubject?.name}
            selectedTopicName={selectedTopic?.name}
            wrongOnly={query.wrongOnly === "1"}
          />
          <PracticeSession questions={sanitizedQuestions} courseId={course.id} />
        </div>
      </div>
    </main>
  );
}

function PracticeContextSummary({
  courseSlug,
  count,
  difficulty,
  questionCount,
  questionType,
  random,
  reviewOnly,
  selectedSubjectName,
  selectedTopicName,
  wrongOnly,
}: {
  courseSlug: string;
  count: number;
  difficulty?: string;
  questionCount: number;
  questionType?: string;
  random: boolean;
  reviewOnly: boolean;
  selectedSubjectName?: string;
  selectedTopicName?: string;
  wrongOnly: boolean;
}) {
  const filters = [
    selectedSubjectName ? `과목: ${selectedSubjectName}` : "전체 과목",
    selectedTopicName ? `주제: ${selectedTopicName}` : "전체 주제",
    questionType
      ? `유형: ${formatQuestionTypeLabel(questionType)}`
      : "전체 유형",
    difficulty ? `난이도: ${formatDifficultyLabel(difficulty)}` : "전체 난이도",
    random ? "무작위 출제" : "기본 순서",
    wrongOnly ? "오답만" : null,
    reviewOnly ? "복습 예정" : null,
    `최대 ${count}문항`,
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="practice-context-card" aria-label="현재 문제풀이 조건">
      <div>
        <p className="eyebrow">현재 조건</p>
        <h2>이번 문제풀이 구성</h2>
        <p>
          {questionCount}개 문항을 불러왔습니다. 선택한 과목과 주제에 맞춰
          지금 풀 문제를 구성했습니다.
        </p>
        <p className="practice-context-note">
          채점 후에는 기준 해설을 먼저 확인하고, 필요한 경우 AI 근거 해설로
          관련 기준과 개념을 이어서 확인하세요.
        </p>
      </div>
      <div className="practice-context-tags" aria-label="적용된 필터">
        {filters.map((filter) => (
          <span key={filter}>{filter}</span>
        ))}
      </div>
      <a className="text-link" href={`/practice/${courseSlug}`}>
        필터 초기화
      </a>
    </section>
  );
}
