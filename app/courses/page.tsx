import type { Metadata } from "next";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/state-ui";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

export const metadata: Metadata = {
  title: "과정 목록",
  description:
    "DB에서 관리되는 정보보호·개인정보보호 전문 과정을 확인하세요.",
};
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublishedCoursesCached();
  const grouped = Map.groupBy(courses, (course) => course.groupName);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">COURSE DIRECTORY</p>
          <h1>과정 목록</h1>
          <p>
            정보보호·개인정보보호 전문 과정을 비교하고 현재 목표에 맞는 학습을
            시작하세요.
          </p>
        </div>
      </section>
      <div className="shell section-stack">
        {courses.length ? (
          Array.from(grouped.entries()).map(([groupName, groupCourses]) => (
            <section key={groupName} className="catalog-group">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">COURSE GROUP</p>
                  <h2>{groupName}</h2>
                </div>
                <span className="count-label">{groupCourses.length}개 과정</span>
              </div>
              <div className="course-grid">
                {groupCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title="공개된 과정이 없습니다"
            description="새 과정이 공개되면 이곳에서 바로 확인할 수 있습니다."
            action={{ href: "/", label: "홈으로 이동" }}
          />
        )}
      </div>
    </main>
  );
}
