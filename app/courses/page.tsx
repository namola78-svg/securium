import type { Metadata } from "next";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/state-ui";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";

export const metadata: Metadata = {
  title: "과정 둘러보기",
  description:
    "정보보호·개인정보보호 전문과정을 비교하고 나에게 맞는 학습 경로를 선택하세요.",
};
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await listPublishedCoursesCached();
  const grouped = Map.groupBy(courses, (course) => course.groupName);

  return (
    <main className="page-main">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">학습 경로 선택</p>
          <h1>나에게 맞는 과정을 찾아보세요</h1>
          <p>
            자격시험, 관리체계, 개인정보보호, 실무 역량 과정을 비교하고 지금
            준비하는 목표에 맞는 학습을 시작하세요.
          </p>
        </div>
      </section>
      <div className="shell section-stack">
        {courses.length ? (
          Array.from(grouped.entries()).map(([groupName, groupCourses]) => (
            <section key={groupName} className="catalog-group">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">과정 분류</p>
                  <h2>{groupName}</h2>
                </div>
                <span className="count-label">
                  {groupCourses.length}개 과정
                </span>
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
            title="아직 공개된 과정이 없습니다"
            description="과정이 공개되면 이곳에서 목표별 학습 경로를 바로 확인할 수 있습니다."
            action={{ href: "/", label: "홈으로 돌아가기" }}
          />
        )}
      </div>
    </main>
  );
}
