import { ActionButton } from "@/components/design-system-primitives";
import type { CourseListItem } from "@/db/repositories";
import type { PublicCourseAvailability } from "@/lib/services/course-availability";
import { courseAudienceLabel, courseDescription, courseTypeLabel, estimateWeeks, safeCount } from "@/lib/course-display";
import { getPublicCourseAvailabilityState } from "@/lib/services/course-availability";

export function CourseCard({ course, availability }: { course: CourseListItem; availability: PublicCourseAvailability | null | undefined }) {
  const description = courseDescription(course.description);
  const recommendedFor = courseAudienceLabel(course);
  const subjectCount = safeCount(course.subjectCount);
  const topicCount = safeCount(course.topicCount);
  const questionCount = safeCount(course.questionCount);
  const estimatedWeeks = estimateWeeks(course.totalLevels);
  const typeLabel = courseTypeLabel(course);
  const availabilityState = getPublicCourseAvailabilityState(availability);
  const contentMissing = availabilityState === "NO_PUBLISHED_LEARNER_CONTENT";
  const status = availabilityLabel(availabilityState);
  const courseName = course.name || course.shortName || "이름 없는 과정";

  return (
    <article className="course-card v2-course-card" aria-labelledby={`course-${course.id}`}>
      <div className="course-card-top"><span className="course-code">{typeLabel}</span><span className={`course-status ${contentMissing ? "planned" : "available"}`}>{status}</span></div>
      <p className="eyebrow">{course.groupName} · {typeLabel}</p>
      <h3 id={`course-${course.id}`}>{courseName}</h3>
      <p className="course-summary">{description}</p>
      <dl aria-label={`${courseName} 과정 정보`} className="course-comparison-list">
        <div><dt>추천 대상</dt><dd>{recommendedFor}</dd></div>
        <div><dt>과정 구성</dt><dd>{subjectCount}개 과목 · {topicCount}개 주제</dd></div>
        <div><dt>예상 기간</dt><dd>{estimatedWeeks}주</dd></div>
        <div><dt>연결 문제</dt><dd>{questionCount ? `${questionCount}문항` : "연결 문제 없음"}</dd></div>
      </dl>
      <ActionButton href={`/courses/${course.slug}`} variant={contentMissing ? "secondary" : "dark"} className="full-width course-card-cta">과정 상세 보기</ActionButton>
    </article>
  );
}

function availabilityLabel(state: ReturnType<typeof getPublicCourseAvailabilityState>) {
  switch (state) {
    case "THEORY_CONTENT": return "이론 콘텐츠 있음";
    case "QUESTION_CONTENT": return "문제 콘텐츠 있음";
    case "THEORY_AND_QUESTION_CONTENT": return "이론·문제 콘텐츠 있음";
    case "NO_PUBLISHED_LEARNER_CONTENT": return "콘텐츠 준비 중";
  }
}
