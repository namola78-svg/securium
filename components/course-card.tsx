import Link from "next/link";
import type { CourseListItem } from "@/db/repositories";
import {
  courseAudienceLabel,
  courseDescription,
  courseTypeLabel,
  estimateWeeks,
  safeCount,
} from "@/lib/course-display";

export function CourseCard({ course }: { course: CourseListItem }) {
  const description = courseDescription(course.description);
  const recommendedFor = courseAudienceLabel(course);
  const subjectCount = safeCount(course.subjectCount);
  const topicCount = safeCount(course.topicCount);
  const questionCount = safeCount(course.questionCount);
  const estimatedWeeks = estimateWeeks(course.totalLevels);
  const typeLabel = courseTypeLabel(course);
  const available =
    course.active &&
    course.published &&
    (subjectCount > 0 || topicCount > 0 || questionCount > 0);
  const status = available ? "학습 가능" : "개설 예정";

  return (
    <article className="course-card" aria-labelledby={`course-${course.id}`}>
      <div className="course-card-top">
        <span className="course-code">{typeLabel}</span>
        <span
          className={`course-status ${
            status === "학습 가능" ? "available" : "planned"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="eyebrow">{course.groupName}</p>
      <h3 id={`course-${course.id}`}>
        {course.name || course.shortName || "이름 없는 과정"}
      </h3>
      <p className="course-summary">{description}</p>
      <dl className="course-comparison-list">
        <div>
          <dt>추천 대상</dt>
          <dd>{recommendedFor}</dd>
        </div>
        <div>
          <dt>학습 구성</dt>
          <dd>
            {subjectCount}개 과목 · {topicCount}개 주제
          </dd>
        </div>
        <div>
          <dt>예상 기간</dt>
          <dd>{estimatedWeeks}주</dd>
        </div>
        <div>
          <dt>문제</dt>
          <dd>{questionCount ? `${questionCount}문항` : "문제 콘텐츠 준비 중"}</dd>
        </div>
      </dl>
      {available ? (
        <Link
          className="button button-dark full-width course-card-cta"
          href={`/courses/${course.slug}`}
        >
          과정 자세히 보기
        </Link>
      ) : (
        <button
          className="button button-disabled full-width course-card-cta"
          type="button"
          disabled
        >
          개설 예정
        </button>
      )}
    </article>
  );
}
