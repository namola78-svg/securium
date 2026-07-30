import { AdminCurriculumManager } from "@/components/admin-curriculum-manager";
import {
  listCurriculumNodes,
  listCurriculumTrees,
} from "@/db/curriculum-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ treeId?: string }>;
}) {
  await requireCatalogManager("/admin/curriculum");
  const { treeId } = await searchParams;
  const [courses, trees] = await Promise.all([
    listAllCourses(),
    listCurriculumTrees(),
  ]);
  const selectedTreeId =
    treeId && trees.some((tree) => tree.id === treeId)
      ? treeId
      : trees[0]?.id ?? "";
  const nodes = selectedTreeId
    ? await listCurriculumNodes(selectedTreeId)
    : [];

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">CURRICULUM ARCHITECTURE</p>
        <h1>커리큘럼 트리 관리</h1>
        <p>
          과정별 커리큘럼 버전과 계층형 노드를 관리합니다. 이 화면은 새
          Curriculum Tree 기반을 준비하는 관리자 도구이며, 기존
          과목·주제·레슨·진도 데이터는 변경하지 않습니다.
        </p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card">
          <span>관리 과정</span>
          <strong>{courses.length}</strong>
          <small>기존 과정 URL 유지</small>
        </div>
        <div className="stat-card">
          <span>커리큘럼 트리</span>
          <strong>{trees.length}</strong>
          <small>ACTIVE {trees.filter((tree) => tree.status === "ACTIVE").length}</small>
        </div>
        <div className="stat-card">
          <span>선택 트리 노드</span>
          <strong>{nodes.length}</strong>
          <small>soft delete: ARCHIVED</small>
        </div>
      </section>
      <AdminCurriculumManager
        courses={courses.map((course) => ({
          id: course.id,
          name: course.name,
          shortName: course.shortName,
          groupName: course.groupName,
        }))}
        trees={trees}
        nodes={nodes}
        selectedTreeId={selectedTreeId}
      />
    </>
  );
}
