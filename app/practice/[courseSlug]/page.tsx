import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PracticeSession } from "@/components/practice-session";
import { EmptyState } from "@/components/state-ui";
import styles from "@/components/v2/practice-v2.module.css";
import { listDueReviews } from "@/db/phase3-repositories";
import {
  listQuestionFilterSubjectsForCourse,
  listQuestionFilterTopicsForSubject,
  listPublicQuestions,
  listWrongQuestionIds,
} from "@/db/question-repositories";
import { getEnrollmentForCourse, getPublicCourseBySlug } from "@/db/repositories";
import { requireCurrentAppUser } from "@/lib/auth";
import { publicCopy } from "@/lib/public-copy";
import { formatDifficultyLabel, formatQuestionTypeLabel } from "@/lib/question-display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "과정별 문제풀이 | Securium",
  description: "문제에 집중하고 제출 후 공식 해설과 복습 흐름을 확인하세요.",
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
    return (
      <main className={styles.focusPage} data-practice-focus-v2="">
        <div className={styles.emptyPage}>
          <EmptyState
            title="수강 중인 과정이 없습니다"
            description="수강 신청 후 이 과정의 문제풀이를 시작할 수 있습니다."
            action={{ href: `/courses/${course.slug}`, label: "과정 확인" }}
            secondaryAction={{ href: "/courses", label: "과정 목록" }}
          />
        </div>
      </main>
    );
  }

  const subjects = await listQuestionFilterSubjectsForCourse(course.id);
  const requestedSubjectId = typeof query.subjectId === "string" ? query.subjectId : undefined;
  const subjectId = subjects.some((subject) => subject.id === requestedSubjectId)
    ? requestedSubjectId
    : undefined;
  const topics = subjectId
    ? await listQuestionFilterTopicsForSubject(course.id, subjectId)
    : [];
  const requestedTopicId = typeof query.topicId === "string" ? query.topicId : undefined;
  const topicId = topics.some((topic) => topic.id === requestedTopicId)
    ? requestedTopicId
    : undefined;
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);
  const selectedTopic = topics.find((topic) => topic.id === topicId);
  const wrongQuestionIds = query.wrongOnly === "1"
    ? await listWrongQuestionIds(user.id, course.id)
    : undefined;
  const reviewQuestionIds = query.reviewOnly === "1"
    ? (await listDueReviews(user.id, course.id))
        .filter((item) => ["QUESTION", "MOCK_EXAM_QUESTION"].includes(item.targetType))
        .map((item) => item.targetId)
    : undefined;
  const requestedQuestionId = typeof query.questionId === "string" ? query.questionId : undefined;
  const count = Math.min(
    50,
    Math.max(1, Number(typeof query.count === "string" ? query.count : 10)),
  );
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
    choices: question.choices.map((choice) => ({
      ...choice,
      content: publicCopy(choice.content),
    })),
  }));
  const mode = query.reviewOnly === "1"
    ? "복습 문제"
    : query.wrongOnly === "1"
      ? "오답 다시 풀기"
      : query.random === "1"
        ? "무작위 문제"
        : "문제 연습";

  return (
    <main className={styles.focusPage} data-practice-focus-v2="">
      <div className={styles.focusContainer}>
        <header className={styles.focusHeader}>
          <Link href={`/learn/${course.slug}`} aria-label={`${course.shortName} 학습으로 돌아가기`}>
            <span aria-hidden="true">←</span> 학습으로
          </Link>
          <div>
            <span>{mode}</span>
            <strong>{course.shortName}</strong>
          </div>
          <Link href="/practice">과정 변경</Link>
        </header>

        <details className={styles.filterDisclosure}>
          <summary>
            <span><b>문제 조건</b><small>과목, 유형, 난이도, 문제 수 변경</small></span>
            <strong>{sanitizedQuestions.length}개 문제</strong>
          </summary>
          <form className={styles.filterForm} method="get">
            <label>과목<select name="subjectId" defaultValue={subjectId ?? ""}><option value="">전체 과목</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label>주제<select name="topicId" defaultValue={topicId ?? ""}><option value="">전체 주제</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
            <label>문제 유형<select name="type" defaultValue={typeof query.type === "string" ? query.type : ""}><option value="">전체 유형</option><option value="TRUE_FALSE">OX</option><option value="SINGLE_CHOICE">단일 선택</option><option value="MULTIPLE_CHOICE">복수 선택</option><option value="SHORT_ANSWER">단답형</option><option value="ESSAY" disabled>서술형 준비 중</option><option value="CALCULATION" disabled>계산형 준비 중</option></select></label>
            <label>난이도<select name="difficulty" defaultValue={typeof query.difficulty === "string" ? query.difficulty : ""}><option value="">전체 난이도</option><option value="EASY">쉬움</option><option value="MEDIUM">보통</option><option value="HARD">어려움</option></select></label>
            <label>문제 수<select name="count" defaultValue={String(count)}><option value="5">5개</option><option value="10">10개</option><option value="20">20개</option><option value="50">50개</option></select></label>
            <label className={styles.checkLabel}><input type="checkbox" name="random" value="1" defaultChecked={query.random === "1"} /> 무작위 문제</label>
            <button type="submit">조건 적용</button>
          </form>
        </details>

        <PracticeContextSummary
          difficulty={typeof query.difficulty === "string" ? query.difficulty : undefined}
          questionCount={sanitizedQuestions.length}
          questionType={typeof query.type === "string" ? query.type : undefined}
          reviewOnly={query.reviewOnly === "1"}
          selectedSubjectName={selectedSubject?.name}
          selectedTopicName={selectedTopic?.name}
          wrongOnly={query.wrongOnly === "1"}
        />

        {sanitizedQuestions.length ? (
          <PracticeSession
            questions={sanitizedQuestions}
            courseId={course.id}
            courseName={course.shortName}
          />
        ) : (
          <EmptyState
            title="조건에 맞는 문제가 없습니다"
            description="필터를 초기화하거나 과정 상세에서 제공 콘텐츠를 확인해보세요."
            action={{ href: `/practice/${course.slug}`, label: "전체 문제 보기" }}
            secondaryAction={{ href: `/learn/${course.slug}`, label: "학습으로 돌아가기" }}
          />
        )}
      </div>
    </main>
  );
}

function PracticeContextSummary({
  difficulty,
  questionCount,
  questionType,
  reviewOnly,
  selectedSubjectName,
  selectedTopicName,
  wrongOnly,
}: {
  difficulty?: string;
  questionCount: number;
  questionType?: string;
  reviewOnly: boolean;
  selectedSubjectName?: string;
  selectedTopicName?: string;
  wrongOnly: boolean;
}) {
  const filters = [
    selectedSubjectName,
    selectedTopicName,
    questionType ? formatQuestionTypeLabel(questionType) : null,
    difficulty ? formatDifficultyLabel(difficulty) : null,
    wrongOnly ? "오답 우선" : null,
    reviewOnly ? "복습 우선" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <section className={styles.contextSummary} aria-label="현재 문제풀이 요약">
      <span>총 {questionCount}문제</span>
      {filters.length ? <ul>{filters.map((filter) => <li key={filter}>{filter}</li>)}</ul> : <p>전체 범위</p>}
    </section>
  );
}
