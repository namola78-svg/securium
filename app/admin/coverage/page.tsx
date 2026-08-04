import Link from "next/link";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import {
  getSecurityCertificationContentMapSummary,
  getSecurityCertificationDeepNodeCoverageSummary,
} from "@/lib/curriculum/security-certification-content-map";
import type { OfficialCurriculumNodeType } from "@/lib/curriculum/security-certification-standards";
import { requireCatalogManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

const nodeTypeLabels: Record<OfficialCurriculumNodeType, string> = {
  TRACK: "필기/실기",
  SUBJECT: "과목",
  PRACTICAL: "실기",
  MAJOR_ITEM: "주요항목",
  SUB_ITEM: "세부항목",
  STANDARD: "기준",
};

export default async function AdminCoveragePage() {
  await requireCatalogManager("/admin/coverage");

  const deepCoverage = getSecurityCertificationDeepNodeCoverageSummary();
  const contentSummary = getSecurityCertificationContentMapSummary();
  const contentGaps = deepCoverage.uncoveredRows.slice(0, 12);
  const questionGaps = deepCoverage.questionGapRows.slice(0, 12);
  const priorityRows = [
    ...deepCoverage.uncoveredRows.map((row) => ({
      ...row,
      gapType: "CONTENT_METADATA_GAP" as const,
      priority: "High",
      actionLabel: "콘텐츠 연결",
    })),
    ...deepCoverage.questionGapRows.map((row) => ({
      ...row,
      gapType: "QUESTION_GAP" as const,
      priority: "Medium",
      actionLabel: "문항 연결 확인",
    })),
  ].slice(0, 18);
  const ready =
    deepCoverage.uncoveredRows.length === 0 &&
    deepCoverage.questionGapRows.length === 0;

  return (
    <>
      <SectionHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Coverage", current: true },
        ]}
        eyebrow="COVERAGE OPERATIONS"
        title="커버리지 운영 검수"
        description={
          <>
            공식 정보보안기사·정보보안산업기사 커리큘럼 기준으로 콘텐츠 연결,
            문항 연결, 과정별 공백을 한 화면에서 점검합니다.
          </>
        }
      />

      <section className="stats-grid admin-stats" aria-label="커버리지 요약">
        <MetricCard
          label="전체 학습 노드"
          value={deepCoverage.nodeCount}
          description={`Content ${deepCoverage.contentLinkedCount} · Question ${deepCoverage.questionLinkedCount}`}
        />
        <MetricCard
          label="콘텐츠 커버리지"
          value={`${deepCoverage.contentCoveragePercent}%`}
          description={`미연결 ${deepCoverage.uncoveredRows.length}개`}
        />
        <MetricCard
          label="문항 커버리지"
          value={`${deepCoverage.questionCoveragePercent}%`}
          description={`문항 공백 ${deepCoverage.questionGapRows.length}개`}
        />
        <MetricCard
          label="과목 개요"
          value={`${contentSummary.rowsWithQuestionsCount}/${contentSummary.rowCount}`}
          description="과목·실기 항목 문항 연결"
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <Link className="button button-ghost" href="/admin/curriculum">
              Curriculum
            </Link>
            <Link className="button button-ghost" href="/admin/shared-content">
              Shared Content
            </Link>
            <Link className="button button-ghost" href="/admin/questions">
              Questions
            </Link>
          </>
        }
        primary={
          <Link className="button button-primary" href="/admin/coverage">
            Reset coverage view
          </Link>
        }
      >
        <span className="admin-toolbar-kicker">Coverage queue</span>
        <strong>
          {ready
            ? "공식 커리큘럼 콘텐츠·문항 커버리지가 준비되었습니다."
            : `${priorityRows.length}개 우선 검수 항목을 확인하세요.`}
        </strong>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <>
            <section className="admin-panel" aria-labelledby="coverage-queue-heading">
              <div className="admin-panel-header">
                <div>
                  <p className="eyebrow">PRIORITY QUEUE</p>
                  <h2 id="coverage-queue-heading">다음 커버리지 작업</h2>
                  <p>
                    콘텐츠가 없거나 문항 연결이 부족한 공식 커리큘럼 노드를
                    우선순위별로 검수합니다.
                  </p>
                </div>
                <StatusBadge compact tone={ready ? "success" : "warning"}>
                  {ready ? "Ready" : "Review needed"}
                </StatusBadge>
              </div>
              {priorityRows.length ? (
                <ol className="coverage-queue-list">
                  {priorityRows.map((row) => (
                    <li key={`${row.gapType}:${row.curriculumNodeId}`}>
                      <div className="coverage-queue-title">
                        <span className="status-badge compact">{row.priority}</span>
                        <strong>{row.title}</strong>
                        <StatusBadge
                          compact
                          tone={row.gapType === "CONTENT_METADATA_GAP" ? "warning" : "info"}
                        >
                          {row.gapType}
                        </StatusBadge>
                      </div>
                      <small>
                        {row.courseCode} · {nodeTypeLabels[row.nodeType]} ·{" "}
                        {row.officialLevel} · {row.stableKey}
                      </small>
                      <Link className="text-link" href={sharedContentHref(row)}>
                        {row.actionLabel}
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-state">
                  <strong>검수할 커버리지 공백이 없습니다.</strong>
                  <p>공식 커리큘럼 기준 콘텐츠와 문항 연결이 준비되어 있습니다.</p>
                </div>
              )}
            </section>

            <section className="coverage-gap-grid" aria-label="커버리지 공백 상세">
              <CoverageGapPanel
                title="콘텐츠 미연결 노드"
                description="학습 콘텐츠가 아직 연결되지 않은 공식 커리큘럼 노드입니다."
                rows={contentGaps}
                emptyText="콘텐츠 미연결 노드가 없습니다."
              />
              <CoverageGapPanel
                title="문항 공백 노드"
                description="콘텐츠는 있으나 샘플 문항 연결이 필요한 노드입니다."
                rows={questionGaps}
                emptyText="문항 공백 노드가 없습니다."
              />
            </section>
          </>
        }
        inspector={
          <InspectorPanel
            eyebrow="COVERAGE INSPECTOR"
            title={ready ? "운영 준비 완료" : "검수 필요"}
            description="공식 커리큘럼 기준으로 콘텐츠와 문항 커버리지의 운영 준비 상태를 요약합니다."
            badges={[
              {
                label: ready ? "Coverage ready" : "Coverage gaps",
                tone: ready ? "success" : "warning",
              },
              {
                label: "공식 기준",
                tone: "brand",
              },
            ]}
            meta={[
              { label: "Content gaps", value: deepCoverage.uncoveredRows.length },
              { label: "Question gaps", value: deepCoverage.questionGapRows.length },
              { label: "Content coverage", value: `${deepCoverage.contentCoveragePercent}%` },
              { label: "Question coverage", value: `${deepCoverage.questionCoveragePercent}%` },
            ]}
            actions={
              <>
                <Link className="button button-primary" href="/admin/curriculum">
                  Curriculum
                </Link>
                <Link className="button button-ghost" href="/admin/shared-content">
                  Content
                </Link>
              </>
            }
          >
            <p>
              이 화면은 Coverage Matrix의 첫 단계입니다. 이후에는 과정, 과목,
              노드 타입, gap 유형별 필터와 담당자 기반 action queue로 확장합니다.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}

function CoverageGapPanel({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: Array<{
    courseCode: string;
    nodeType: OfficialCurriculumNodeType;
    officialLevel: string;
    stableKey: string;
    title: string;
    curriculumNodeId: string;
    courseId: string;
  }>;
  emptyText: string;
}) {
  return (
    <article className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">GAP DETAIL</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <StatusBadge compact tone={rows.length ? "warning" : "success"}>
          {rows.length}개
        </StatusBadge>
      </div>
      {rows.length ? (
        <ul className="compact-list">
          {rows.map((row) => (
            <li key={row.curriculumNodeId}>
              <strong>{row.title}</strong>
              <small>
                {row.courseCode} · {nodeTypeLabels[row.nodeType]} ·{" "}
                {row.officialLevel} · {row.stableKey}
              </small>
              <Link className="text-link" href={sharedContentHref(row)}>
                연결 화면 열기
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-helper">{emptyText}</p>
      )}
    </article>
  );
}

function sharedContentHref(row: { courseId: string; curriculumNodeId: string }) {
  const params = new URLSearchParams({
    courseId: row.courseId,
    curriculumNodeId: row.curriculumNodeId,
  });
  return `/admin/shared-content?${params.toString()}`;
}
