import Link from "next/link";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export default async function AdminPage() {
  await requireCatalogManager("/admin");
  const [groups, courses] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">OVERVIEW</p>
        <h1>관리자 대시보드</h1>
        <p>과정 구조와 공개 상태를 관리합니다. 관리자 쓰기 작업은 감사로그 대상입니다.</p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card">
          <span>과정군</span>
          <strong>{groups.length}</strong>
          <small>활성 {groups.filter((group) => group.active).length}</small>
        </div>
        <div className="stat-card">
          <span>전체 과정</span>
          <strong>{courses.length}</strong>
          <small>공개 {courses.filter((course) => course.published).length}</small>
        </div>
        <div className="stat-card">
          <span>비활성 과정</span>
          <strong>{courses.filter((course) => !course.active).length}</strong>
          <small>학습기록은 보존</small>
        </div>
      </section>
      <section className="admin-actions-grid">
        <Link href="/admin/course-groups" className="admin-action-card">
          <span>01</span>
          <h2>과정군 관리</h2>
          <p>국가기술자격과 독립 전문과정의 분류를 관리합니다.</p>
        </Link>
        <Link href="/admin/courses" className="admin-action-card">
          <span>02</span>
          <h2>과정 관리</h2>
          <p>과정 등록, 공개, 활성화, 정렬순서를 관리합니다.</p>
        </Link>
      </section>
    </>
  );
}
