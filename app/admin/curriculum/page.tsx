import { AdminCurriculumManager } from "@/components/admin-curriculum-manager";
import Link from "next/link";
import {
  getCurriculumTreeCoverage,
  listCurriculumLinkableContent,
  listCurriculumNodeOperationalStats,
  listCurriculumNodes,
  listCurriculumTrees,
} from "@/db/curriculum-repositories";
import { listAllCourses } from "@/db/repositories";
import { requireCatalogManager } from "@/lib/auth";
import {
  getSecurityCertificationOntologyCoverageSummaries,
  getSecurityCertificationOntologyGaps,
} from "@/lib/curriculum/security-certification-ontology";
import {
  getSecurityCertificationContentMapSummary,
  getSecurityCertificationDeepNodeCoverageSummary,
} from "@/lib/curriculum/security-certification-content-map";

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
  const uncoveredCertificationRows =
    securityCertificationDeepCoverage.uncoveredRows.slice(0, 8);
  const questionGapCertificationRows =
    securityCertificationDeepCoverage.questionGapRows.slice(0, 8);
  const selectedSharedContentHref = selectedTree?.courseId
    ? `/admin/shared-content?courseId=${selectedTree.courseId}`
    : "/admin/shared-content";
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
        <p className="eyebrow">공식 커리큘럼 아키텍처</p>
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
        </div>
        <div className="admin-record-list" aria-label="공식 커리큘럼 커버리지 상세">
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
                    <Link
                      className="text-link"
                      href={`/admin/shared-content?courseId=${row.courseId}`}
                    >
                      공통 콘텐츠 관리로 이동
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
                    <Link
                      className="text-link"
                      href={
                        row.contentIds[0]
                          ? `/admin/shared-content?courseId=${row.courseId}&contentId=${row.contentIds[0]}`
                          : `/admin/shared-content?courseId=${row.courseId}`
                      }
                    >
                      연결 Content 확인
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
              </p>
            )}
          </details>
        </div>
      </section>
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
    </>
  );
}
