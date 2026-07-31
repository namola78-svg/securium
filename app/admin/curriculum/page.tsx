import { AdminCurriculumManager } from "@/components/admin-curriculum-manager";
import {
  getCurriculumTreeCoverage,
  listCurriculumLinkableContent,
  listCurriculumNodeOperationalStats,
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
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) ?? null;
  const [nodes, nodeStats, coverage] = selectedTreeId
    ? await Promise.all([
        listCurriculumNodes(selectedTreeId),
        listCurriculumNodeOperationalStats(selectedTreeId),
        getCurriculumTreeCoverage(selectedTreeId),
      ])
    : [[], [], null];
  const linkableContent = selectedTree
    ? await listCurriculumLinkableContent(selectedTree.courseId)
    : [];
  const operationalSummary = nodeStats.reduce(
    (summary, stat) => ({
      questionCount: summary.questionCount + stat.questionCount,
      attemptCount: summary.attemptCount + stat.attemptCount,
      wrongAttemptCount: summary.wrongAttemptCount + stat.wrongAttemptCount,
      dueReviewCount: summary.dueReviewCount + stat.dueReviewCount,
    }),
    {
      questionCount: 0,
      attemptCount: 0,
      wrongAttemptCount: 0,
      dueReviewCount: 0,
    },
  );

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">CURRICULUM ARCHITECTURE</p>
        <h1>커리큘럼 트리 관리</h1>
        <p>
          과정별 공식·실무 커리큘럼 버전과 계층 노드를 관리합니다. 기존
          과목, 주제, 학습 단위, 레슨 데이터는 삭제하지 않고 필요한 노드에
          연결해 운영 통계와 콘텐츠 커버리지를 함께 확인합니다.
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
          <small>
            ACTIVE {trees.filter((tree) => tree.status === "ACTIVE").length}
          </small>
        </div>
        <div className="stat-card">
          <span>선택 트리 노드</span>
          <strong>{nodes.length}</strong>
          <small>soft delete: ARCHIVED</small>
        </div>
        <div className="stat-card">
          <span>연결 가능 콘텐츠</span>
          <strong>{linkableContent.length}</strong>
          <small>과목·주제·학습 단위·레슨</small>
        </div>
        <div className="stat-card">
          <span>운영 통계</span>
          <strong>{operationalSummary.questionCount}</strong>
          <small>
            응시 {operationalSummary.attemptCount} · 오답{" "}
            {operationalSummary.wrongAttemptCount} · 복습{" "}
            {operationalSummary.dueReviewCount}
          </small>
        </div>
      </section>
      {coverage ? (
        <section className="stats-grid admin-stats" aria-label="커리큘럼 콘텐츠 커버리지">
          <div className="stat-card">
            <span>노드 연결률</span>
            <strong>{coverage.linkedNodePercent}%</strong>
            <small>
              {coverage.linkedNodeCount}/{coverage.nodeCount}개 노드에 기존 콘텐츠 연결
            </small>
          </div>
          <div className="stat-card">
            <span>레슨 연결률</span>
            <strong>{coverage.courseLessonNodePercent}%</strong>
            <small>
              공개 레슨 {coverage.publishedCourseLessonCount}개 · 미연결{" "}
              {coverage.unlinkedCourseLessonCount}개
            </small>
          </div>
          <div className="stat-card">
            <span>공개 문제</span>
            <strong>{coverage.publishedQuestionCount}</strong>
            <small>선택 과정에 연결된 공개 문제 수</small>
          </div>
        </section>
      ) : null}
      <AdminCurriculumManager
        key={selectedTreeId}
        courses={courses.map((course) => ({
          id: course.id,
          name: course.name,
          shortName: course.shortName,
          groupName: course.groupName,
        }))}
        trees={trees}
        nodes={nodes}
        nodeStats={nodeStats}
        linkableContent={linkableContent}
        selectedTreeId={selectedTreeId}
      />
    </>
  );
}
