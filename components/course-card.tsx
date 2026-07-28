import Link from "next/link";
import type { CourseListItem } from "@/db/repositories";

export function CourseCard({ course }: { course: CourseListItem }) {
  return (
    <article className="course-card">
      <div className="course-card-top">
        <span className="course-code">{course.code}</span>
      </div>
      <p className="eyebrow">{course.groupName}</p>
      <h3>{course.name}</h3>
      <p>{course.description}</p>
      <div className="course-meta">
        <span>{course.totalLevels}단계</span>
        <span>권장 통과 {course.passingScore}점</span>
        {course.isSample ? <span className="sample-label">개발용 샘플</span> : null}
      </div>
      <Link className="text-link" href={`/courses/${course.slug}`}>
        과정 살펴보기 <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
