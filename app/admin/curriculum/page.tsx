import { AdminCurriculumManager } from "@/components/admin-curriculum-manager-client";
import Link from "next/link";
import {
  InspectorPanel,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getCurriculumTreeCoverage,
  listCurriculumLinkableContent,
  listCurriculumNodeOperationalStats,
  listCurriculumNodes,
  listCurriculumTrees,
  listUnlinkedCourseLessonsForCurriculumTree,
} from "@/db/curriculum-repositories";
import { listAllCourses } from "@/db/repositories";
import { listSharedContents } from "@/db/shared-content-repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  recommendLinkableContentForNode,
  recommendableContentKey,
} from "@/lib/curriculum/content-recommendations";
import {
  getSecurityCertificationOntologyCoverageSummaries,
  getSecurityCertificationOntologyGaps,
} from "@/lib/curriculum/security-certification-ontology";
import {
  getSecurityCertificationContentMapSummary,
  getSecurityCertificationDeepNodeCoverageSummary,
} from "@/lib/curriculum/security-certification-content-map";

export const dynamic = "force-dynamic";

type CurriculumNodes = Awaited<ReturnType<typeof listCurriculumNodes>>;
type CurriculumNodeStats = Awaited<
  ReturnType<typeof listCurriculumNodeOperationalStats>
>;
type CurriculumCoverage = NonNullable<
  Awaited<ReturnType<typeof getCurriculumTreeCoverage>>
>;
type UnlinkedCourseLessons = Awaited<
  ReturnType<typeof listUnlinkedCourseLessonsForCurriculumTree>
>;

function emptyCurriculumCoverage(
  treeId: string,
  courseId: string,
  status: string,
): CurriculumCoverage {
  return {
    treeId,
    courseId,
    status,
    nodeCount: 0,
    linkedNodeCount: 0,
    linkedNodePercent: 0,
    publishedCourseLessonCount: 0,
    courseLessonNodeCount: 0,
    courseLessonNodePercent: 0,
    unlinkedCourseLessonCount: 0,
    publishedQuestionCount: 0,
  };
}

function withAdminCurriculumTimeout<T>(promise: Promise<T>, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("ADMIN_CURRICULUM_DATA_TIMEOUT")),
        timeoutMs,
      );
    }),
  ]);
}

export default async function AdminCurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ treeId?: string }>;
}) {
  await requireCatalogManager("/admin/curriculum");
  const { treeId } = await searchParams;
  let courses;
  let trees;
  try {
    [courses, trees] = await withAdminCurriculumTimeout(
      Promise.all([listAllCourses(), listCurriculumTrees()]),
    );
  } catch {
    return (
      <>
        <SectionHeader
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Curriculum", current: true },
          ]}
          eyebrow="OFFICIAL CURRICULUM"
          title="커리큘럼 트리 관리"
          description="커리큘럼 저장소를 확인하는 중 문제가 발생했습니다. 운영 데이터와 migration 상태를 먼저 확인해주세요."
        />
        <section className="admin-panel section-block" role="alert">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">CURRICULUM STORAGE CHECK</p>
              <h2>커리큘럼 데이터를 불러오지 못했습니다</h2>
            </div>
          </div>
          <p>
            민감한 내부 오류는 화면에 표시하지 않습니다. Vercel Function Logs와
            운영 데이터베이스의 curriculum 테이블 및 migration 상태를 확인한 뒤
            다시 시도해주세요.
          </p>
          <Link className="button button-ghost" href="/admin">
            관리자 대시보드로 이동
          </Link>
        </section>
      </>
    );
  }
  const sharedContents = await withAdminCurriculumTimeout(
    listSharedContents("PUBLISHED"),
  ).catch(() => []);
  const selectedTreeId =
    treeId && trees.some((tree) => tree.id === treeId)
      ? treeId
      : trees[0]?.id ?? "";
  const selectedTree = trees.find((tree) => tree.id === selectedTreeId) ?? null;
  const fallbackCoverage = selectedTree
    ? emptyCurriculumCoverage(
        selectedTree.id,
        selectedTree.courseId,
        selectedTree.status,
      )
    : null;
  const [nodes, nodeStats, coverage, unlinkedCourseLessons]: [
    CurriculumNodes,
    CurriculumNodeStats,
    CurriculumCoverage | null,
    UnlinkedCourseLessons,
  ] = selectedTreeId
    ? await Promise.all([
        withAdminCurriculumTimeout(listCurriculumNodes(selectedTreeId)).catch(
          () => [] as CurriculumNodes,
        ),
        withAdminCurriculumTimeout(
          listCurriculumNodeOperationalStats(selectedTreeId),
        ).catch(() => [] as CurriculumNodeStats),
        withAdminCurriculumTimeout(
          getCurriculumTreeCoverage(selectedTreeId),
        ).then(
          (result) => result ?? fallbackCoverage,
          () => fallbackCoverage,
        ),
        withAdminCurriculumTimeout(
          listUnlinkedCourseLessonsForCurriculumTree(selectedTreeId, 8),
        ).catch(
          () => [] as UnlinkedCourseLessons,
        ),
      ])
    : [[], [], fallbackCoverage, []];
  const linkableContent = selectedTree
    ? await withAdminCurriculumTimeout(
        listCurriculumLinkableContent(selectedTree.courseId),
      ).catch(() => [])
    : [];
  const ontologyCoverageSummaries =
    getSecurityCertificationOntologyCoverageSummaries();
  const selectedOntologyGaps = selectedTreeId
    ? getSecurityCertificationOntologyGaps(selectedTreeId)
    : [];
  const securityCertificationContentSummary =
    getSecurityCertificationContentMapSummary();
  const securityCertificationDeepCoverage =
    getSecurityCertificationDeepNodeCoverageSummary();
  const selectedCertificationCoverage =
    selectedTree?.courseId && selectedTree.courseId in securityCertificationDeepCoverage.byCourse
      ? securityCertificationDeepCoverage.byCourse[selectedTree.courseId]
      : null;
  const staticCertificationCoverageReady =
    securityCertificationDeepCoverage.uncoveredRows.length === 0 &&
    securityCertificationDeepCoverage.questionGapRows.length === 0;
  const selectedTreeActive = selectedTree?.status === "ACTIVE";
  const operationalCoverageReady =
    Boolean(coverage) && Number(coverage?.unlinkedCourseLessonCount ?? 0) === 0;
  const activationReadinessReady =
    selectedTreeActive && operationalCoverageReady && staticCertificationCoverageReady;
  const sharedContentRecommendationSources = sharedContents.map((content, index) => ({
    type: "CONTENT" as const,
    id: content.id,
    title: content.title,
    subtitle: [content.summary, content.canonicalKey, content.version]
      .filter(Boolean)
      .join(" · "),
    active: content.status !== "ARCHIVED",
    published: content.status === "PUBLISHED",
    displayOrder: index,
  }));
  function contentRecommendationsForCoverageRow(row: {
    title: string;
    nodeType: string;
    stableKey: string;
    contentIds: string[];
  }) {
    return recommendLinkableContentForNode({
      node: {
        nodeType: row.nodeType,
        title: row.title,
        officialCode: row.stableKey,
        path: row.stableKey,
      },
      linkableContent: sharedContentRecommendationSources,
      linkedKeys: row.contentIds.map((contentId) =>
        recommendableContentKey({ type: "CONTENT", id: contentId }),
      ),
      limit: 3,
      minScore: 8,
    });
  }
  const uncoveredCertificationRows =
    securityCertificationDeepCoverage.uncoveredRows.slice(0, 8).map((row) => ({
      ...row,
      contentRecommendations: contentRecommendationsForCoverageRow(row),
    }));
  const questionGapCertificationRows =
    securityCertificationDeepCoverage.questionGapRows.slice(0, 8).map((row) => ({
      ...row,
      contentRecommendations: contentRecommendationsForCoverageRow(row),
    }));
  const selectedSharedContentHref = selectedTree?.courseId
    ? `/admin/shared-content?courseId=${selectedTree.courseId}`
    : "/admin/shared-content";
  function sharedContentNodeHref(row: {
    courseId: string;
    contentIds: string[];
    curriculumNodeId: string;
  }) {
    const params = new URLSearchParams({ courseId: row.courseId });
    if (row.contentIds[0]) {
      params.set("contentId", row.contentIds[0]);
    }
    params.set("curriculumNodeId", row.curriculumNodeId);
    return `/admin/shared-content?${params.toString()}`;
  }
  function sharedContentRecommendationHref(row: {
    courseId: string;
    curriculumNodeId: string;
    contentRecommendations: Array<{ id: string }>;
  }) {
    const recommendedContentId = row.contentRecommendations[0]?.id;
    if (!recommendedContentId) return sharedContentNodeHref({ ...row, contentIds: [] });
    const params = new URLSearchParams({
      courseId: row.courseId,
      contentId: recommendedContentId,
      curriculumNodeId: row.curriculumNodeId,
    });
    return `/admin/shared-content?${params.toString()}`;
  }
  const coverageActionItems = [
    ...(!selectedTreeActive && selectedTree
      ? [
          {
            id: `tree-status:${selectedTree.id}`,
            badge: "TREE_STATUS",
            title: selectedTree.title,
            detail:
              "공식 커리큘럼 트리가 아직 ACTIVE가 아닙니다. 읽기 전용 체크가 clean이면 별도 승인 후 운영 전환을 요청하세요.",
            href: `/admin/curriculum?treeId=${selectedTree.id}`,
            action: "선택 트리 확인",
          },
        ]
      : []),
    ...unlinkedCourseLessons.slice(0, 3).map((lesson) => {
      const params = new URLSearchParams({
        courseId: lesson.courseId,
        contentId: lesson.contentId,
        courseLessonId: lesson.id,
      });
      return {
        id: `course-lesson:${lesson.id}`,
        badge: "CourseLesson gap",
        title: lesson.displayTitle,
        detail: `공개 레슨이지만 공식 CurriculumNode가 비어 있습니다. Content: ${lesson.contentTitle}`,
        href: `/admin/shared-content?${params.toString()}`,
        action: "노드 연결",
      };
    }),
    ...uncoveredCertificationRows.slice(0, 3).map((row) => ({
      id: `content:${row.curriculumNodeId}`,
      badge: "Content gap",
      title: row.title,
      detail: `${row.courseCode} · ${row.nodeType} · 추천 후보 ${row.contentRecommendations.length}개`,
      href: row.contentRecommendations.length
        ? sharedContentRecommendationHref(row)
        : sharedContentNodeHref(row),
      action: row.contentRecommendations.length ? "추천 후보 연결" : "Content 연결",
    })),
    ...questionGapCertificationRows.slice(0, 3).map((row) => ({
      id: `question:${row.curriculumNodeId}`,
      badge: "Question gap",
      title: row.title,
      detail: `${row.courseCode} · 연결 Content ${row.contentIds.length}개 · 추천 후보 ${row.contentRecommendations.length}개`,
      href: row.contentRecommendations.length
        ? sharedContentRecommendationHref(row)
        : sharedContentNodeHref(row),
      action: row.contentRecommendations.length ? "추가 후보 연결" : "문항 연결 확인",
    })),
  ].slice(0, 6);
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
  const coverageReadinessChecklist = [
    {
      label: "TREE_STATUS",
      ready: selectedTreeActive,
      detail: selectedTree
        ? selectedTreeActive
          ? "Selected official curriculum tree is ACTIVE."
          : `Selected official curriculum tree is ${selectedTree.status}. Run read-only checks and request explicit production activation before learner rollout.`
        : "Select an operational curriculum tree before activation review.",
    },
    {
      label: "COURSELESSON_LINK_GAP",
      ready: operationalCoverageReady,
      detail: operationalCoverageReady
        ? "Published CourseLessons are linked to CurriculumNodes."
        : `${coverage?.unlinkedCourseLessonCount ?? 0} published CourseLesson links still need review.`,
    },
    {
      label: "CONTENT_METADATA_GAP",
      ready: staticCertificationCoverageReady,
      detail:
        "Check curriculum_nodes.metadata.linkedContent separately from the static content map.",
    },
  ];

  return (
    <>
      <SectionHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Curriculum", current: true },
        ]}
        eyebrow="공식 커리큘럼 아키텍처"
        title="커리큘럼 트리 관리"
        description={
          <>
            과정별 공식·실무 커리큘럼 버전과 계층 노드를 관리합니다. 기존
            과목, 주제, 학습 단위, 레슨 데이터는 삭제하지 않고 필요한 노드에
            연결해 운영 통계와 콘텐츠 커버리지를 함께 확인합니다.
          </>
        }
      />
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
            활성 트리 {trees.filter((tree) => tree.status === "ACTIVE").length}
          </small>
        </div>
        <div className="stat-card">
          <span>선택 트리 노드</span>
          <strong>{nodes.length}</strong>
          <small>보관 처리로 삭제 이력 보호</small>
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
      <PageToolbar
        secondary={
          <>
            <Link className="button button-ghost" href={selectedSharedContentHref}>
              콘텐츠 연결
            </Link>
            <Link className="button button-ghost" href="/admin/ontology">
              Ontology 확인
            </Link>
          </>
        }
        primary={
          <Link className="button button-primary" href="/admin/curriculum">
            트리 새로고침
          </Link>
        }
      >
        <span className="admin-toolbar-kicker">선택 트리</span>
        <strong>
          {selectedTree
            ? `${selectedTree.title} · ${selectedTree.status}`
            : "운영할 커리큘럼 트리를 선택하세요."}
        </strong>
      </PageToolbar>
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
      {coverage ? (
        <section
          className="admin-panel"
          aria-labelledby="operational-unlinked-course-lessons-heading"
        >
          <div className="admin-panel-header">
            <div>
              <p className="eyebrow">OPERATIONAL COURSELESSON GAPS</p>
              <h2 id="operational-unlinked-course-lessons-heading">
                운영 미연결 CourseLesson
              </h2>
              <p>
                운영 DB에서 공개 상태지만 커리큘럼 노드에 아직 연결되지 않은
                CourseLesson입니다. 학습자 노출 데이터는 유지하면서 관리자에서
                적절한 공식 노드에 연결하세요.
              </p>
            </div>
            <span className="status-badge compact">
              {coverage.unlinkedCourseLessonCount}개
            </span>
          </div>
          {unlinkedCourseLessons.length ? (
            <ul className="compact-list">
              {unlinkedCourseLessons.map((lesson) => {
                const params = new URLSearchParams({
                  courseId: lesson.courseId,
                  contentId: lesson.contentId,
                  courseLessonId: lesson.id,
                });
                return (
                  <li key={lesson.id}>
                    <strong>{lesson.displayTitle}</strong>
                    <small>
                      Content: {lesson.contentTitle} · 정렬 {lesson.sortOrder} ·{" "}
                      {lesson.status}
                    </small>
                    <Link
                      className="text-link"
                      href={`/admin/shared-content?${params.toString()}`}
                    >
                      커리큘럼 노드 연결하기
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="admin-helper">
              운영 DB 기준으로 커리큘럼 노드가 비어 있는 공개 CourseLesson이
              없습니다.
            </p>
          )}
        </section>
      ) : null}
      <section
        className="admin-panel"
        aria-labelledby="security-certification-coverage-heading"
      >
        <div className="admin-panel-header">
          <div>
            <p className="eyebrow">SECURITY CERTIFICATION COVERAGE</p>
            <h2 id="security-certification-coverage-heading">
              기사·산업기사 공식 커리큘럼 커버리지
            </h2>
            <p>
              로컬 seed와 정식 커리큘럼 매핑 기준으로 Content와 샘플 문항의
              연결 상태를 요약합니다. 운영 DB 활성화 여부는 위 선택 트리
              커버리지와 함께 확인하세요.
            </p>
          </div>
          <span className="status-badge status-badge-success">
            {securityCertificationDeepCoverage.uncoveredRows.length === 0 &&
            securityCertificationDeepCoverage.questionGapRows.length === 0
              ? "100% 준비"
              : "확인 필요"}
          </span>
        </div>
        <div className="stats-grid admin-stats">
          <div className="stat-card">
            <span>전체 학습 노드</span>
            <strong>{securityCertificationDeepCoverage.nodeCount}</strong>
            <small>
              Content {securityCertificationDeepCoverage.contentLinkedCount}/
              {securityCertificationDeepCoverage.nodeCount} · 문항{" "}
              {securityCertificationDeepCoverage.questionLinkedCount}/
              {securityCertificationDeepCoverage.nodeCount}
            </small>
          </div>
          <div className="stat-card">
            <span>Content 연결률</span>
            <strong>
              {securityCertificationDeepCoverage.contentCoveragePercent}%
            </strong>
            <small>
              미연결 {securityCertificationDeepCoverage.uncoveredRows.length}개
            </small>
          </div>
          <div className="stat-card">
            <span>문항 연결률</span>
            <strong>
              {securityCertificationDeepCoverage.questionCoveragePercent}%
            </strong>
            <small>
              문항 공백 {securityCertificationDeepCoverage.questionGapRows.length}
              개
            </small>
          </div>
          <div className="stat-card">
            <span>과목 개요 커버리지</span>
            <strong>
              {securityCertificationContentSummary.rowsWithQuestionsCount}/
              {securityCertificationContentSummary.rowCount}
            </strong>
            <small>
              상위 과목·실기 항목 샘플 문항 연결 상태
            </small>
          </div>
          <div className="stat-card">
            <span>Operational readiness</span>
            <strong>{activationReadinessReady ? "OK" : "Check"}</strong>
            <small>
              Tree {selectedTreeActive ? "ACTIVE" : "Check"} · Static map{" "}
              {staticCertificationCoverageReady ? "OK" : "Check"} ·
              CourseLesson gaps {coverage?.unlinkedCourseLessonCount ?? 0}
            </small>
          </div>
          {selectedCertificationCoverage ? (
            <div className="stat-card">
              <span>선택 과정 기준</span>
              <strong>{selectedCertificationCoverage.questionCoveragePercent}%</strong>
              <small>
                {selectedCertificationCoverage.questionLinkedCount}/
                {selectedCertificationCoverage.nodeCount}개 노드에 문항 연결
              </small>
            </div>
          ) : null}
        </div>
        <div
          className="admin-record-list"
          aria-label="운영 DB와 정식 seed 커버리지 비교"
        >
          <article className="admin-record">
            <div className="admin-record-summary">
              <span>
                <strong>운영 DB 선택 트리</strong>
                <small>
                  {coverage
                    ? `노드 ${coverage.linkedNodeCount}/${coverage.nodeCount} · 레슨 ${coverage.courseLessonNodePercent}% · 공개 문제 ${coverage.publishedQuestionCount}개`
                    : "선택된 운영 트리 커버리지 없음"}
                </small>
              </span>
              <span className="status-badge compact">
                {coverage ? `${coverage.linkedNodePercent}%` : "미선택"}
              </span>
            </div>
          </article>
          <article className="admin-record">
            <div className="admin-record-summary">
              <span>
                <strong>정식 seed 기준</strong>
                <small>
                  노드 {securityCertificationDeepCoverage.contentLinkedCount}/
                  {securityCertificationDeepCoverage.nodeCount} · 문항{" "}
                  {securityCertificationDeepCoverage.questionCoveragePercent}% ·
                  과목 개요 {securityCertificationContentSummary.rowsWithQuestionsCount}/
                  {securityCertificationContentSummary.rowCount}
                </small>
              </span>
              <span className="status-badge compact">
                {securityCertificationDeepCoverage.contentCoveragePercent}%
              </span>
            </div>
          </article>
          <article className="admin-record">
            <div className="admin-record-summary">
              <span>
                <strong>운영 반영 확인 포인트</strong>
                <small>
                  운영 DB는 실제 활성 트리와 공개 레슨 기준이며, seed 기준은
                  정식 커리큘럼 매핑 완성도를 검증합니다.
                </small>
              </span>
              <span className="status-badge compact">
                비교 기준 분리
              </span>
            </div>
          </article>
          <article className="admin-record">
            <div className="admin-record-summary">
              <span>
                <strong>Operational coverage checklist</strong>
                <small>
                  Review these read-only signals before requesting production activation.
                </small>
              </span>
              <span className="status-badge compact">
                {coverageReadinessChecklist.filter((item) => item.ready).length}/
                {coverageReadinessChecklist.length} ready
              </span>
            </div>
            <ul className="compact-list">
              {coverageReadinessChecklist.map((item) => (
                <li key={item.label}>
                  <span
                    className={
                      item.ready
                        ? "status-badge status-badge-success compact"
                        : "status-badge compact"
                    }
                  >
                    {item.ready ? "Ready" : "Review"}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </li>
              ))}
            </ul>
          </article>
        </div>
        <div className="admin-record-list" aria-label="공식 커리큘럼 커버리지 상세">
          <section
            className="admin-panel nested-panel"
            aria-labelledby="coverage-action-queue-heading"
          >
            <div className="admin-panel-header">
              <div>
                <p className="eyebrow">COVERAGE ACTION QUEUE</p>
                <h3 id="coverage-action-queue-heading">다음 커버리지 작업</h3>
                <p>
                  운영 반영 전에 먼저 처리하면 좋은 CourseLesson, Content, Question
                  연결 작업을 한곳에 모았습니다.
                </p>
              </div>
              <span className="status-badge compact">
                {coverageActionItems.length}개
              </span>
            </div>
            {coverageActionItems.length ? (
              <ol className="compact-list">
                {coverageActionItems.map((item) => (
                  <li key={item.id}>
                    <span className="status-badge compact">{item.badge}</span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                    <Link className="text-link" href={item.href}>
                      {item.action}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-helper">
                현재 우선 처리할 커버리지 액션이 없습니다. 세부 목록에서 신규 gap이
                생기면 자동으로 표시됩니다.
              </p>
            )}
          </section>
          <details className="admin-record">
            <summary>
              <span>
                <strong>Content 미연결 노드</strong>
                <small>
                  {securityCertificationDeepCoverage.uncoveredRows.length === 0
                    ? "공식 커리큘럼 학습 노드에 Content가 모두 연결되었습니다."
                    : `${securityCertificationDeepCoverage.uncoveredRows.length}개 노드 확인 필요`}
                </small>
              </span>
              <span className="status-badge compact">
                {securityCertificationDeepCoverage.uncoveredRows.length}개
              </span>
            </summary>
            {uncoveredCertificationRows.length > 0 ? (
              <ul className="compact-list">
                {uncoveredCertificationRows.map((row) => (
                  <li key={row.curriculumNodeId}>
                    <strong>{row.title}</strong>
                    <small>
                      {row.courseCode} · {row.nodeType} · {row.stableKey}
                    </small>
                    <small>
                      추천 후보 {row.contentRecommendations.length}개
                      {row.contentRecommendations[0]
                        ? ` · 최우선: ${row.contentRecommendations[0].title}`
                        : " · 자동 추천 없음"}
                    </small>
                    <Link
                      className="text-link"
                      href={
                        row.contentRecommendations.length
                          ? sharedContentRecommendationHref(row)
                          : sharedContentNodeHref(row)
                      }
                    >
                      {row.contentRecommendations.length
                        ? "최우선 후보로 연결 준비"
                        : "공통 콘텐츠 관리로 이동"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-helper">
                미연결 Content 노드가 없습니다.{" "}
                <Link className="text-link" href={selectedSharedContentHref}>
                  공통 콘텐츠 관리로 이동
                </Link>
                . gap이 생기면 추천 후보 수와 최우선 후보가 함께 표시되고,
                최우선 후보로 연결 준비 링크를 제공합니다.
              </p>
            )}
          </details>
          <details className="admin-record">
            <summary>
              <span>
                <strong>문항 공백 노드</strong>
                <small>
                  {securityCertificationDeepCoverage.questionGapRows.length === 0
                    ? "Content가 연결된 노드에 샘플 문항이 모두 연결되었습니다."
                    : `${securityCertificationDeepCoverage.questionGapRows.length}개 노드 확인 필요`}
                </small>
              </span>
              <span className="status-badge compact">
                {securityCertificationDeepCoverage.questionGapRows.length}개
              </span>
            </summary>
            {questionGapCertificationRows.length > 0 ? (
              <ul className="compact-list">
                {questionGapCertificationRows.map((row) => (
                  <li key={row.curriculumNodeId}>
                    <strong>{row.title}</strong>
                    <small>
                      {row.courseCode} · {row.nodeType} · {row.stableKey}
                    </small>
                    <small>
                      연결 Content {row.contentIds.length}개 · 추가 추천{" "}
                      {row.contentRecommendations.length}개
                      {row.contentRecommendations[0]
                        ? ` · 최우선: ${row.contentRecommendations[0].title}`
                        : ""}
                    </small>
                    <Link
                      className="text-link"
                      href={
                        row.contentRecommendations.length
                          ? sharedContentRecommendationHref(row)
                          : sharedContentNodeHref(row)
                      }
                    >
                      {row.contentRecommendations.length
                        ? "추가 후보로 연결 준비"
                        : "연결 Content 확인"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-helper">
                문항 공백 노드가 없습니다.{" "}
                <Link className="text-link" href={selectedSharedContentHref}>
                  공통 콘텐츠 관리로 이동
                </Link>
                . gap이 생기면 연결 Content와 추가 추천 후보가 함께 표시되고,
                추가 후보로 연결 준비 링크를 제공합니다.
              </p>
            )}
          </details>
        </div>
      </section>
      <WorkspaceLayout
        main={
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
            ontologyCoverageSummaries={ontologyCoverageSummaries}
            ontologyGaps={selectedOntologyGaps}
            selectedTreeId={selectedTreeId}
          />
        }
        inspector={
          <InspectorPanel
            eyebrow="CURRICULUM INSPECTOR"
            title={selectedTree?.title ?? "선택된 트리 없음"}
            description={
              selectedTree
                ? "선택한 커리큘럼 트리의 운영 준비 상태와 연결 상태를 확인합니다."
                : "먼저 관리할 커리큘럼 트리를 선택하세요."
            }
            badges={[
              {
                label: selectedTree?.status ?? "NO TREE",
                tone: selectedTreeActive ? "success" : "warning",
              },
              {
                label: activationReadinessReady ? "운영 준비" : "검수 필요",
                tone: activationReadinessReady ? "success" : "info",
              },
            ]}
            meta={[
              { label: "노드", value: nodes.length },
              {
                label: "연결 가능 콘텐츠",
                value: linkableContent.length,
              },
              {
                label: "CourseLesson gap",
                value: coverage?.unlinkedCourseLessonCount ?? 0,
              },
              {
                label: "Ontology gap",
                value: selectedOntologyGaps.length,
              },
            ]}
            actions={
              <>
                <Link className="button button-primary" href={selectedSharedContentHref}>
                  콘텐츠 연결
                </Link>
                <Link className="button button-ghost" href="/admin/ontology">
                  Ontology
                </Link>
              </>
            }
          >
            <div>
              <StatusBadge compact tone={operationalCoverageReady ? "success" : "warning"}>
                {operationalCoverageReady ? "CourseLesson 연결 완료" : "CourseLesson 연결 검수"}
              </StatusBadge>
            </div>
            <p>
              이 패널은 앞으로 선택한 CurriculumNode의 공식 순번, stable key, 출처,
              콘텐츠 연결, 문제 연결, 온톨로지 커버리지를 보여주는 우측 Inspector로
              확장됩니다.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
