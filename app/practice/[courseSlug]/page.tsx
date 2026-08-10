import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PracticeSession } from "@/components/practice-session";
import { ActionButton } from "@/components/design-system-primitives";
import { EmptyState } from "@/components/state-ui";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { listQuestionFilterSubjectsForCourse, listQuestionFilterTopicsForSubject, listPublicQuestions, listWrongQuestionIds } from "@/db/question-repositories";
import { listDueReviews } from "@/db/phase3-repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";
import { formatDifficultyLabel, formatQuestionTypeLabel } from "@/lib/question-display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "과정별 문제풀이 | Securium",
  description: "과목과 난이도를 선택해 문제를 풀고 채점 결과와 복습으로 이어가세요.",
};

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
    return <main className="page-main"><div className="shell section"><EmptyState title="수강 중인 과정이 없습니다" description="수강 신청 후 이 과정의 문제풀이를 시작할 수 있습니다." action={{ href: `/courses/${course.slug}`, label: "과정 확인" }} secondaryAction={{ href: "/courses", label: "과정 목록" }} /></div></main>;
  }

  const subjects = await listQuestionFilterSubjectsForCourse(course.id);
  const requestedSubjectId = typeof query.subjectId === "string" ? query.subjectId : undefined;
  const subjectId = subjects.some((subject) => subject.id === requestedSubjectId) ? requestedSubjectId : undefined;
  const topics = subjectId ? await listQuestionFilterTopicsForSubject(course.id, subjectId) : [];
  const requestedTopicId = typeof query.topicId === "string" ? query.topicId : undefined;
  const topicId = topics.some((topic) => topic.id === requestedTopicId) ? requestedTopicId : undefined;
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const wrongQuestionIds = query.wrongOnly === "1" ? await listWrongQuestionIds(user.id, course.id) : undefined;
  const reviewQuestionIds = query.reviewOnly === "1"
    ? (await listDueReviews(user.id, course.id)).filter((item) => ["QUESTION", "MOCK_EXAM_QUESTION"].includes(item.targetType)).map((item) => item.targetId)
    : undefined;
  const requestedQuestionId = typeof query.questionId === "string" ? query.questionId : undefined;
  const count = Math.min(50, Math.max(1, Number(typeof query.count === "string" ? query.count : 10)));
  const questions = await listPublicQuestions({
    courseId: course.id,
    subjectId,
    topicId,
    type: typeof query.type === "string" ? query.type : undefined,
    difficulty: typeof query.difficulty === "string" ? query.difficulty : undefined,
    random: query.random === "1",
    questionIds: requestedQuestionId ? [requestedQuestionId] : reviewQuestionIds ?? wrongQuestionIds,
    limit: count,
  });
  const sanitizedQuestions = questions.map((question) => ({
    ...question,
    title: publicCopy(question.title),
    content: publicCopy(question.content),
    choices: question.choices.map((choice) => ({ ...choice, content: publicCopy(choice.content) })),
  }));

  return (
    <main className="page-main practice-page">
      <header className="page-hero"><div className="shell"><p className="eyebrow">문제풀이</p><h1>{course.shortName} 문제풀이</h1><p>문제를 풀며 핵심 개념을 확인하고, 채점 결과를 바로 오답 복습으로 연결하세요.</p></div></header>
      <div className="shell">
        <section className="practice-layout">
          <section className="practice-filter-shell">
            <details className="practice-filter-shell__details" open>
              <summary>문제 조건</summary>
              <form className="practice-filter" method="get">
                <label>과목<select name="subjectId" defaultValue={subjectId ?? ""}><option value="">전체 과목</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <label>주제<select name="topicId" defaultValue={topicId ?? ""}><option value="">전체 주제</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
                <label>문제 유형<select name="type" defaultValue={typeof query.type === "string" ? query.type : ""}><option value="">전체 유형</option><option value="TRUE_FALSE">OX</option><option value="SINGLE_CHOICE">단일 선택</option><option value="MULTIPLE_CHOICE">복수 선택</option><option value="SHORT_ANSWER">단답형</option><option value="ESSAY" disabled>서술형 준비 중</option><option value="CALCULATION" disabled>계산형 준비 중</option></select></label>
                <label>난이도<select name="difficulty" defaultValue={typeof query.difficulty === "string" ? query.difficulty : ""}><option value="">전체 난이도</option><option value="EASY">쉬움</option><option value="MEDIUM">보통</option><option value="HARD">어려움</option></select></label>
                <label>문제 수<select name="count" defaultValue={String(count)}><option value="5">5개</option><option value="10">10개</option><option value="20">20개</option><option value="50">50개</option></select></label>
                <label className="check-label"><input type="checkbox" name="random" value="1" defaultChecked={query.random === "1"} /> 무작위 문제</label>
                <ActionButton variant="dark" type="submit" className="full-width">조건 적용</ActionButton>
              </form>
            </details>
          </section>
          <section className="practice-main-stack">
            <PracticeContextSummary courseSlug={course.slug} count={count} difficulty={typeof query.difficulty === "string" ? query.difficulty : undefined} questionCount={sanitizedQuestions.length} questionType={typeof query.type === "string" ? query.type : undefined} random={query.random === "1"} reviewOnly={query.reviewOnly === "1"} selectedSubjectName={selectedSubject?.name} selectedTopicName={selectedTopic?.name} wrongOnly={query.wrongOnly === "1"} />
            {sanitizedQuestions.length ? <PracticeSession questions={sanitizedQuestions} courseId={course.id} /> : <EmptyState title="조건에 맞는 문제가 없습니다" description="필터를 초기화하거나 과정 상세에서 제공 콘텐츠를 확인해보세요." action={{ href: `/practice/${course.slug}`, label: "전체 문제 보기" }} secondaryAction={{ href: `/courses/${course.slug}`, label: "과정 상세 보기" }} />}
          </section>
        </section>
      </div>
    </main>
  );
}

function PracticeContextSummary({
  courseSlug, count, difficulty, questionCount, questionType, random, reviewOnly, selectedSubjectName, selectedTopicName, wrongOnly,
}: {
  courseSlug: string; count: number; difficulty?: string; questionCount: number; questionType?: string; random: boolean; reviewOnly: boolean; selectedSubjectName?: string; selectedTopicName?: string; wrongOnly: boolean;
}) {
  const filters = [
    selectedSubjectName ? `과목: ${selectedSubjectName}` : "전체 과목",
    selectedTopicName ? `주제: ${selectedTopicName}` : "전체 주제",
    questionType ? `문제 유형: ${formatQuestionTypeLabel(questionType)}` : "전체 유형",
    difficulty ? `난이도: ${formatDifficultyLabel(difficulty)}` : "전체 난이도",
    random ? "무작위" : "순서대로",
    wrongOnly ? "오답 우선" : null,
    reviewOnly ? "복습 우선" : null,
    `문제 수: ${count}개`,
  ].filter((item): item is string => Boolean(item));

  return <section className="practice-context-card" aria-label="현재 문제풀이 요약"><div><p className="eyebrow">현재 설정</p><h2>학습 문제 {questionCount}개</h2><p>선택한 조건으로 {questionCount}문제를 준비했습니다. 제출 후 해설과 복습 흐름을 확인하세요.</p><p className="practice-context-note">정답 개수보다 각 문제의 근거를 확인하는 것이 중요합니다.</p></div><div className="practice-context-tags" aria-label="선택한 필터">{filters.map((filter) => <span key={filter}>{filter}</span>)}</div><Link className="text-link" href={`/practice/${courseSlug}`}>조건 다시 설정</Link></section>;
}
