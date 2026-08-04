import Link from "next/link";

import { AdminSharedContentManager } from "@/components/admin-shared-content-manager";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
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
  searchParams: Promise<{
    courseId?: string;
    contentId?: string;
    courseLessonId?: string;
    curriculumNodeId?: string;
  }>;
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
  const requestedContentId =
    query.contentId &&
    contents.some((content) => content.id === query.contentId)
      ? query.contentId
      : contents[0]?.id ?? "";

  const [courseLessons, curriculumTrees] = await Promise.all([
    selectedCourseId ? listCourseLessons(selectedCourseId) : [],
    selectedCourseId ? listCurriculumTrees(selectedCourseId) : [],
  ]);
  const selectedCourseLesson =
    query.courseLessonId &&
    courseLessons.find((lesson) => lesson.id === query.courseLessonId)
      ? courseLessons.find((lesson) => lesson.id === query.courseLessonId)!
      : null;
  const selectedCourseLessonId = selectedCourseLesson?.id ?? "";
  const selectedContentId = selectedCourseLesson?.contentId ?? requestedContentId;
  const usage = selectedContentId
    ? await listSharedContentUsage(selectedContentId)
    : [];
  const activeTree =
    curriculumTrees.find((tree) => tree.status === "ACTIVE") ??
    curriculumTrees[0] ??
    null;
  const curriculumNodes = activeTree
    ? await listCurriculumNodes(activeTree.id)
    : [];
  const selectedCurriculumNodeId =
    query.curriculumNodeId &&
    curriculumNodes.some((node) => node.id === query.curriculumNodeId)
      ? query.curriculumNodeId
      : "";
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedContent =
    contents.find((content) => content.id === selectedContentId) ?? null;
  const publishedContentCount = contents.filter(
    (item) => item.status === "PUBLISHED",
  ).length;
  const requiredLessonCount = courseLessons.filter((lesson) => lesson.isRequired).length;
  const linkedNodeCount = new Set(
    courseLessons
      .map((lesson) => lesson.curriculumNodeId)
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
  ).size;

  return (
    <>
      <SectionHeader
        eyebrow="SHARED CONTENT"
        title="공통 콘텐츠 공유 관리"
        description={
          <>
            하나의 이론 원문을 여러 과정에서 재사용하고, 과정별 표시 제목과
            시험 포인트·실무 메모는 CourseLesson과 Extension으로 분리해
            관리합니다. 기존 Lesson과 사용자 진도는 삭제하거나 변경하지 않습니다.
          </>
        }
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Shared Content", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/curriculum">
              Curriculum
            </Link>
            <Link className="button button-primary" href="/admin/coverage">
              Coverage 확인
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats">
        <MetricCard
          label="공통 Content"
          value={contents.length}
          description={`PUBLISHED ${publishedContentCount}`}
        />
        <MetricCard
          label="선택 과정 레슨"
          value={courseLessons.length}
          description={selectedCourse?.shortName ?? "선택 과정 없음"}
        />
        <MetricCard
          label="커리큘럼 노드"
          value={curriculumNodes.length}
          description={activeTree ? `${activeTree.title} · ${activeTree.status}` : "트리 없음"}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={activeTree?.status === "ACTIVE" ? "success" : "warning"}>
              {activeTree?.status ?? "NO TREE"}
            </StatusBadge>
            <StatusBadge compact tone={selectedContent ? "info" : "neutral"}>
              {selectedContent ? "CONTENT SELECTED" : "NO CONTENT"}
            </StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/shared-content">
            선택 초기화
          </Link>
        }
      >
        <strong>{selectedCourse?.name ?? "과정 선택 필요"}</strong>
        <span>
          필수 레슨 {requiredLessonCount}개 · 연결 노드 {linkedNodeCount}개 · 사용처{" "}
          {usage.length}개
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
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
            selectedCourseLessonId={selectedCourseLessonId}
            selectedCurriculumNodeId={selectedCurriculumNodeId}
          />
        }
        inspector={
          <InspectorPanel
            eyebrow="CONTENT INSPECTOR"
            title={selectedContent?.title ?? "콘텐츠를 선택하세요"}
            description={
              selectedContent
                ? "선택한 공통 콘텐츠의 과정별 사용처와 커리큘럼 연결 상태를 확인합니다."
                : "공통 콘텐츠 또는 CourseLesson을 선택하면 상세 요약이 표시됩니다."
            }
            badges={[
              {
                label: selectedContent?.status ?? "UNSELECTED",
                tone: selectedContent?.status === "PUBLISHED" ? "success" : "neutral",
              },
              {
                label: activeTree?.status ?? "NO TREE",
                tone: activeTree?.status === "ACTIVE" ? "success" : "warning",
              },
            ]}
            meta={[
              { label: "선택 과정", value: selectedCourse?.name ?? "없음" },
              { label: "CourseLesson", value: selectedCourseLessonId || "선택 안 됨" },
              { label: "CurriculumNode", value: selectedCurriculumNodeId || "선택 안 됨" },
              { label: "사용처", value: `${usage.length}개` },
              { label: "공개 콘텐츠", value: `${publishedContentCount}/${contents.length}` },
            ]}
            actions={
              <>
                <Link className="button button-ghost" href="/admin/curriculum">
                  커리큘럼으로 이동
                </Link>
                <Link className="button button-ghost" href="/admin/coverage">
                  Coverage 보기
                </Link>
              </>
            }
          >
            <div className="admin-card-meta">
              <span>공통 Content는 원문 재사용을 담당합니다.</span>
              <span>CourseLesson은 과정별 표시·진도·필수 여부를 분리합니다.</span>
              <span>Extension은 과정별 시험 포인트와 실무 메모를 보강합니다.</span>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
