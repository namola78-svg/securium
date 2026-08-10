import Link from "next/link";
import { AdminSharedContentManager } from "@/components/admin-shared-content-manager";
import { InspectorPanel, MetricCard, PageToolbar, SectionHeader, StatusBadge, WorkspaceLayout } from "@/components/design-system-primitives";
import { listCourseLessons, listSharedContents, listSharedContentUsage } from "@/db/shared-content-repositories";
import { listCurriculumNodes, listCurriculumTrees } from "@/db/curriculum-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSharedContentPage({ searchParams }: { searchParams: Promise<{ courseId?: string; contentId?: string; courseLessonId?: string; curriculumNodeId?: string }> }) {
  await requireCatalogManager("/admin/shared-content");
  const query = await searchParams;
  const [courses, contents] = await Promise.all([listAllCourses(), listSharedContents()]);
  const selectedCourseId = query.courseId && courses.some((course) => course.id === query.courseId) ? query.courseId : courses[0]?.id ?? "";
  const requestedContentId = query.contentId && contents.some((content) => content.id === query.contentId) ? query.contentId : contents[0]?.id ?? "";
  const [courseLessons, curriculumTrees] = await Promise.all([selectedCourseId ? listCourseLessons(selectedCourseId) : [], selectedCourseId ? listCurriculumTrees(selectedCourseId) : []]);
  const selectedCourseLesson = query.courseLessonId ? courseLessons.find((lesson) => lesson.id === query.courseLessonId) ?? null : null;
  const selectedCourseLessonId = selectedCourseLesson?.id ?? "";
  const selectedContentId = selectedCourseLesson?.contentId ?? requestedContentId;
  const usage = selectedContentId ? await listSharedContentUsage(selectedContentId) : [];
  const activeTree = curriculumTrees.find((tree) => tree.status === "ACTIVE") ?? curriculumTrees[0] ?? null;
  const curriculumNodes = activeTree ? await listCurriculumNodes(activeTree.id) : [];
  const selectedCurriculumNodeId = query.curriculumNodeId && curriculumNodes.some((node) => node.id === query.curriculumNodeId) ? query.curriculumNodeId : "";
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedContent = contents.find((content) => content.id === selectedContentId) ?? null;
  const publishedCount = contents.filter((item) => item.status === "PUBLISHED").length;
  const requiredCount = courseLessons.filter((lesson) => lesson.isRequired).length;
  const linkedNodeCount = new Set(courseLessons.map((lesson) => lesson.curriculumNodeId).filter((id): id is string => Boolean(id))).size;

  return <><SectionHeader eyebrow="SHARED CONTENT" title="공통 콘텐츠 관리" description="하나의 공식 콘텐츠를 여러 과정에서 재사용하고, 과정별 표시·진도·시험 포인트를 분리해 관리합니다." breadcrumbs={[{ label: "관리자", href: "/admin" }, { label: "공통 콘텐츠", current: true }]} actions={<><Link className="button button-ghost" href="/admin/curriculum">커리큘럼 관리</Link><Link className="button button-primary" href="/admin/coverage">커버리지 확인</Link></>} /><section className="stats-grid admin-stats" aria-label="공통 콘텐츠 현황"><MetricCard label="공통 콘텐츠" value={contents.length} description={`게시 ${publishedCount}개`} /><MetricCard label="선택 과정 레슨" value={courseLessons.length} description={selectedCourse?.shortName ?? "선택된 과정 없음"} /><MetricCard label="커리큘럼 연결" value={curriculumNodes.length} description={activeTree ? `${activeTree.title} · ${activeTree.status}` : "트리 없음"} /></section><PageToolbar secondary={<><StatusBadge compact tone={activeTree?.status === "ACTIVE" ? "success" : "warning"}>{activeTree ? `커리큘럼 ${activeTree.status}` : "커리큘럼 없음"}</StatusBadge><StatusBadge compact tone={selectedContent ? "info" : "neutral"}>{selectedContent ? "콘텐츠 선택됨" : "콘텐츠 선택 필요"}</StatusBadge></>} primary={<Link className="button button-ghost" href="/admin/shared-content">선택 초기화</Link>}><strong>{selectedCourse?.name ?? "과정을 선택하세요"}</strong><span>필수 레슨 {requiredCount}개 · 연결 노드 {linkedNodeCount}개 · 사용처 {usage.length}개</span></PageToolbar><WorkspaceLayout main={<AdminSharedContentManager courses={courses.map((course) => ({ id: course.id, name: course.name, shortName: course.shortName, groupName: course.groupName }))} contents={contents} courseLessons={courseLessons} curriculumTrees={curriculumTrees} curriculumNodes={curriculumNodes} usage={usage} selectedCourseId={selectedCourseId} selectedContentId={selectedContentId} selectedCourseLessonId={selectedCourseLessonId} selectedCurriculumNodeId={selectedCurriculumNodeId} />} inspector={<InspectorPanel eyebrow="CONTENT INSPECTOR" title={selectedContent?.title ?? "콘텐츠를 선택하세요"} description={selectedContent ? "선택한 콘텐츠의 과정별 사용처와 커리큘럼 연결 상태를 확인합니다." : "콘텐츠 또는 CourseLesson을 선택하면 상세 정보가 표시됩니다."} badges={[{ label: selectedContent?.status === "PUBLISHED" ? "게시됨" : selectedContent?.status ?? "미선택", tone: selectedContent?.status === "PUBLISHED" ? "success" : "neutral" }, { label: activeTree?.status ?? "트리 없음", tone: activeTree?.status === "ACTIVE" ? "success" : "warning" }]} meta={[{ label: "선택 과정", value: selectedCourse?.name ?? "없음" }, { label: "CourseLesson", value: selectedCourseLessonId || "선택 안 됨" }, { label: "CurriculumNode", value: selectedCurriculumNodeId || "선택 안 됨" }, { label: "사용처", value: `${usage.length}개` }, { label: "게시 콘텐츠", value: `${publishedCount}/${contents.length}` }]} actions={<><Link className="button button-ghost" href="/admin/curriculum">커리큘럼으로 이동</Link><Link className="button button-ghost" href="/admin/coverage">커버리지 보기</Link></>}><div className="admin-card-meta"><span>공통 콘텐츠는 원본 학습 내용을 관리합니다.</span><span>CourseLesson은 과정별 표시·진도·필수 여부를 관리합니다.</span><span>연결 전에는 게시 상태와 공식 근거를 확인하세요.</span></div></InspectorPanel>} /></>;
}
