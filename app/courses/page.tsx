import type { Metadata } from "next";
import { CourseCard } from "@/components/course-card";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

export const metadata: Metadata = {
  title: "과정 목록",
  description: "DB에서 조회한 정보보호·개인정보보호 전문 과정을 확인하세요.",
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
            과정 정보는 데이터베이스에서 관리됩니다. 새로운 과정도 같은 템플릿과
            라우트에 자동으로 연결됩니다.
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
          <div className="empty-state">
            <strong>현재 공개된 과정이 없습니다.</strong>
            <p>관리자가 공개한 과정만 표시됩니다.</p>
          </div>
        )}
      </div>
    </main>
  );
}
