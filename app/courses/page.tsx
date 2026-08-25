import type { Metadata } from "next";
import Link from "next/link";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/state-ui";
import { listPublishedCoursesCached } from "@/lib/cached-catalog";
import { courseAudienceLabel, courseDescription, courseTypeLabel } from "@/lib/course-display";

export const metadata: Metadata = {
  title: "과정 둘러보기",
  description: "정보보안과 개인정보보호 전문 과정을 비교하고 나에게 맞는 학습 경로를 선택하세요.",
};
export const dynamic = "force-dynamic";

type CoursesPageProps = {
  searchParams: Promise<{ q?: string | string[]; path?: string | string[]; status?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isCertificationCourse(course: Awaited<ReturnType<typeof listPublishedCoursesCached>>[number]) {
  return courseTypeLabel(course) === "자격시험" || course.groupName.includes("국가기술자격");
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const courses = await listPublishedCoursesCached();
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const path = firstParam(params.path) || "all";
  const status = firstParam(params.status) || "all";
  const normalizedQuery = query.toLocaleLowerCase("ko-KR");
  const filteredCourses = courses.filter((course) => {
    const searchable = [course.name, course.shortName, course.groupName, courseDescription(course.description), courseAudienceLabel(course)]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesPath = path === "all" || (path === "certification" ? isCertificationCourse(course) : !isCertificationCourse(course));
    const available = course.active && course.published;
    const matchesStatus = status === "all" || (status === "available" ? available : !available);
    return matchesQuery && matchesPath && matchesStatus;
  });
  const grouped = Map.groupBy(filteredCourses, (course) => course.groupName);
  const hasFilters = Boolean(query || path !== "all" || status !== "all");

  return (
    <main className="page-main catalog-page">
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">학습 경로 탐색</p>
          <h1>과정과 학습 목표를 찾아보세요</h1>
          <p>공개된 과정 정보로 자격증 과정과 전문·실무 학습을 비교하고, 지금의 목표에 맞는 학습을 시작하세요.</p>
        </div>
      </section>
      <div className="shell section-stack">
        <section className="notice" aria-labelledby="course-discovery-title">
          <div className="section-heading compact">
            <div><p className="eyebrow">공개 과정 탐색</p><h2 id="course-discovery-title">원하는 방식으로 과정을 둘러보세요</h2></div>
            <span className="count-label">{filteredCourses.length}개 과정</span>
          </div>
          <nav aria-label="과정 탐색 경로" className="button-row">
            {[["all", "모든 과정"], ["certification", "자격증 과정"], ["professional", "전문·실무 과정"]].map(([value, label]) => (
              <Link className={path === value ? "button button-primary" : "button button-secondary"} href={value === "all" ? "/courses" : `/courses?path=${value}`} key={value} aria-current={path === value ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
          <form action="/courses" className="filter-row" method="get">
            <label className="ds-control-label">과정 검색<input className="ds-input" name="q" placeholder="과정명, 주제, 학습 대상 검색" type="search" defaultValue={query} /></label>
            <label className="ds-control-label">탐색 경로<select className="ds-select" defaultValue={path} name="path"><option value="all">모든 과정</option><option value="certification">자격증 과정</option><option value="professional">전문·실무 과정</option></select></label>
            <label className="ds-control-label">공개 상태<select className="ds-select" defaultValue={status} name="status"><option value="all">전체 상태</option><option value="available">학습 가능</option><option value="planned">개설 예정</option></select></label>
            <button className="button button-primary" type="submit">검색·필터 적용</button>
          </form>
          {hasFilters ? <Link className="text-link" href="/courses">조건 초기화</Link> : null}
        </section>
        {filteredCourses.length ? (
          Array.from(grouped.entries()).map(([groupName, groupCourses]) => (
            <section key={groupName} className="catalog-group">
              <div className="section-heading compact">
                <div><p className="eyebrow">과정 분류</p><h2>{groupName}</h2></div>
                <span className="count-label">{groupCourses.length}개 과정</span>
              </div>
              <div className="course-grid">
                {groupCourses.map((course) => <CourseCard key={course.id} course={course} />)}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title={hasFilters ? "조건에 맞는 과정이 없습니다" : "아직 공개된 과정이 없습니다"}
            description={hasFilters ? "검색어와 탐색 경로를 바꾸거나 조건을 초기화해 보세요." : "과정이 공개되면 이곳에서 목표별 학습 경로와 제공 콘텐츠를 확인할 수 있습니다."}
            action={{ href: "/courses", label: hasFilters ? "조건 초기화" : "과정 목록 새로고침" }}
          />
        )}
      </div>
    </main>
  );
}
