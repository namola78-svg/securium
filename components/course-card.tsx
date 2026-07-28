import Link from "next/link";
import type { CourseListItem } from "@/db/repositories";
import { publicCopy } from "@/lib/public-copy";

export function CourseCard({ course }: { course: CourseListItem }) {
  const description = publicCopy(course.description) || "과정 설명을 준비하고 있습니다.";
  const difficulty = difficultyLabel(course.difficulty);
  const recommendedFor = recommendedAudience(course.difficulty);
  const subjectCount = safeCount(course.subjectCount);
  const topicCount = safeCount(course.topicCount);
  const questionCount = safeCount(course.questionCount);
  const estimatedWeeks = estimateWeeks(course.totalLevels);
  const available =
    course.active &&
    course.published &&
    (subjectCount > 0 || topicCount > 0 || questionCount > 0);
  const status = available ? "학습 가능" : "개설 예정";

  return (
    <article className="course-card" aria-labelledby={`course-${course.id}`}>
      <div className="course-card-top">
        <span className="course-code" aria-label={`과정 코드 ${course.code}`}>
          {course.code}
        </span>
        <span className={`course-status ${status === "학습 가능" ? "available" : "planned"}`}>
          {status}
        </span>
      </div>
      <p className="eyebrow">{course.groupName}</p>
      <h3 id={`course-${course.id}`}>{course.name || course.shortName || "이름 없는 과정"}</h3>
      <p className="course-summary">{description}</p>
      <dl className="course-comparison-list">
        <div>
          <dt>추천 대상</dt>
          <dd>{recommendedFor}</dd>
        </div>
        <div>
          <dt>난이도</dt>
          <dd>{difficulty}</dd>
        </div>
        <div>
          <dt>학습 구성</dt>
          <dd>{subjectCount}개 과목 · {topicCount}개 주제</dd>
        </div>
        <div>
          <dt>예상 기간</dt>
          <dd>{estimatedWeeks}주</dd>
        </div>
        <div>
          <dt>문제</dt>
          <dd>{questionCount ? `${questionCount}문항` : "문항 업데이트 예정"}</dd>
        </div>
      </dl>
      {available ? (
        <Link className="button button-dark full-width course-card-cta" href={`/courses/${course.slug}`}>
          과정 자세히 보기
        </Link>
      ) : (
        <button className="button button-disabled full-width course-card-cta" type="button" disabled>
          개설 예정
        </button>
      )}
    </article>
  );
}

function safeCount(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

function difficultyLabel(value: string | null | undefined) {
  if (value === "BEGINNER") return "입문";
  if (value === "INTERMEDIATE") return "중급";
  if (value === "ADVANCED") return "심화";
  return "수준 안내 예정";
}

function recommendedAudience(value: string | null | undefined) {
  if (value === "BEGINNER") return "입문 학습자 · 실무 담당자";
  if (value === "INTERMEDIATE") return "자격 준비자 · 보안 담당자";
  if (value === "ADVANCED") return "심화 학습자 · 실무 리더";
  return "정보보호·개인정보보호 학습자";
}

function estimateWeeks(totalLevels: number | null | undefined) {
  const levels = safeCount(totalLevels);
  if (!levels) return 4;
  return Math.max(2, Math.min(12, Math.ceil(levels / 15)));
}
