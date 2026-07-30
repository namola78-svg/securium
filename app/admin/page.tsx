import Link from "next/link";
import { listCurriculumTrees } from "@/db/curriculum-repositories";
import { listAllCourseGroups, listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export default async function AdminPage() {
  await requireCatalogManager("/admin");
  const [groups, courses, curriculumTrees] = await Promise.all([
    listAllCourseGroups(),
    listAllCourses(),
    listCurriculumTrees(),
  ]);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">OVERVIEW</p>
        <h1>관리자 대시보드</h1>
        <p>
          과정 구조, 커리큘럼 트리, 콘텐츠 공개 상태를 관리합니다. 중요한
          관리자 작업은 감사로그에 기록됩니다.
        </p>
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
          <span>커리큘럼 트리</span>
          <strong>{curriculumTrees.length}</strong>
          <small>
            ACTIVE{" "}
            {curriculumTrees.filter((tree) => tree.status === "ACTIVE").length}
          </small>
        </div>
      </section>
      <section className="admin-actions-grid">
        <Link href="/admin/course-groups" className="admin-action-card">
          <span>01</span>
          <h2>과정군 관리</h2>
          <p>국가기술자격과 독립 전문과정 분류를 관리합니다.</p>
        </Link>
        <Link href="/admin/courses" className="admin-action-card">
          <span>02</span>
          <h2>과정 관리</h2>
          <p>과정 등록, 공개, 활성화, 정렬 순서를 관리합니다.</p>
        </Link>
        <Link href="/admin/curriculum" className="admin-action-card">
          <span>03</span>
          <h2>커리큘럼 트리 관리</h2>
          <p>
            과정별 커리큘럼 버전과 계층형 노드를 기존 학습 데이터와 분리해
            관리합니다.
          </p>
        </Link>
      </section>
    </>
  );
}
