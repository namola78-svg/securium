import { AdminSharedContentManager } from "@/components/admin-shared-content-manager";
import {
  listCourseLessons,
  listSharedContents,
  listSharedContentUsage,
} from "@/db/shared-content-repositories";
import {
  listCurriculumNodes,
  listCurriculumTrees,
} from "@/db/curriculum-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSharedContentPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; contentId?: string }>;
}) {
  await requireCatalogManager("/admin/shared-content");
  const query = await searchParams;
  const [courses, contents] = await Promise.all([
    listAllCourses(),
    listSharedContents(),
  ]);
  const selectedCourseId =
    query.courseId && courses.some((course) => course.id === query.courseId)
      ? query.courseId
      : courses[0]?.id ?? "";
  const selectedContentId =
    query.contentId &&
    contents.some((content) => content.id === query.contentId)
      ? query.contentId
      : contents[0]?.id ?? "";

  const [courseLessons, curriculumTrees, usage] = await Promise.all([
    selectedCourseId ? listCourseLessons(selectedCourseId) : [],
    selectedCourseId ? listCurriculumTrees(selectedCourseId) : [],
    selectedContentId ? listSharedContentUsage(selectedContentId) : [],
  ]);
  const activeTree =
    curriculumTrees.find((tree) => tree.status === "ACTIVE") ??
    curriculumTrees[0] ??
    null;
  const curriculumNodes = activeTree
    ? await listCurriculumNodes(activeTree.id)
    : [];

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">SHARED CONTENT</p>
        <h1>공통 콘텐츠 공유 관리</h1>
        <p>
          하나의 이론 원문을 여러 과정에서 재사용하고, 과정별 표시 제목과
          시험 포인트·실무 메모는 CourseLesson과 Extension으로 분리해
          관리합니다. 기존 Lesson과 사용자 진도는 삭제하거나 변경하지 않습니다.
        </p>
      </header>
      <section className="stats-grid admin-stats">
        <div className="stat-card">
          <span>공통 Content</span>
          <strong>{contents.length}</strong>
          <small>
            PUBLISHED{" "}
            {contents.filter((item) => item.status === "PUBLISHED").length}
          </small>
        </div>
        <div className="stat-card">
          <span>선택 과정 레슨</span>
          <strong>{courseLessons.length}</strong>
          <small>
            {courses.find((course) => course.id === selectedCourseId)
              ?.shortName ?? "없음"}
          </small>
        </div>
        <div className="stat-card">
          <span>커리큘럼 노드</span>
          <strong>{curriculumNodes.length}</strong>
          <small>
            {activeTree ? `${activeTree.title} · ${activeTree.status}` : "트리 없음"}
          </small>
        </div>
      </section>
      <AdminSharedContentManager
        courses={courses.map((course) => ({
          id: course.id,
          name: course.name,
          shortName: course.shortName,
          groupName: course.groupName,
        }))}
        contents={contents}
        courseLessons={courseLessons}
        curriculumTrees={curriculumTrees}
        curriculumNodes={curriculumNodes}
        usage={usage}
        selectedCourseId={selectedCourseId}
        selectedContentId={selectedContentId}
      />
    </>
  );
}
