import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { ReportAdminActions } from "@/components/report-admin-actions";
import { listQuestionReports } from "@/db/question-repositories";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  OPEN: "접수",
  IN_REVIEW: "검토 중",
  RESOLVED: "처리 완료",
  REJECTED: "반려",
};

const statusTones: Record<
  string,
  "neutral" | "success" | "warning" | "danger" | "info" | "brand"
> = {
  OPEN: "warning",
  IN_REVIEW: "info",
  RESOLVED: "success",
  REJECTED: "danger",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function QuestionReportsPage() {
  await requireQuestionAdministrator("/admin/question-reports");
  const reports = await listQuestionReports();
  const openCount = reports.filter((report) => report.status === "OPEN").length;
  const inReviewCount = reports.filter(
    (report) => report.status === "IN_REVIEW",
  ).length;
  const resolvedCount = reports.filter(
    (report) => report.status === "RESOLVED",
  ).length;
  const rejectedCount = reports.filter(
    (report) => report.status === "REJECTED",
  ).length;
  const latestReport = reports[0];
  const reasonCount = new Set(reports.map((report) => report.reason)).size;
  const activeCount = openCount + inReviewCount;

  return (
    <>
      <SectionHeader
        eyebrow="QUESTION REPORTS"
        title="문제 신고 관리"
        description="정답 오류, 해설 오류, 오탈자, 오래된 기준, 중복 문제 신고를 검토하고 처리 상태를 관리합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "문제 관리", href: "/admin/questions" },
          { label: "신고 관리", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/questions">
              문제은행
            </Link>
            <Link className="button button-secondary" href="/admin/audit-logs">
              감사로그 확인
            </Link>
          </>
        }
      />

      <section className="admin-stat-grid" aria-label="문제 신고 처리 현황">
        <MetricCard
          label="활성 신고"
          value={activeCount}
          description={`${openCount}건 접수 · ${inReviewCount}건 검토 중`}
        />
        <MetricCard
          label="처리 완료"
          value={resolvedCount}
          description={`반려 ${rejectedCount}건 포함 별도 추적`}
        />
        <MetricCard
          label="신고 유형"
          value={reasonCount}
          description="정답·해설·기준·중복 이슈 분류"
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge tone={activeCount ? "warning" : "success"}>
              {activeCount ? "검토 필요" : "대기 없음"}
            </StatusBadge>
            <StatusBadge tone="info">사용자 신고</StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/question-reports">
            새로고침
          </Link>
        }
      >
        <strong>신고 큐</strong>
        <span>
          일반 사용자 신고를 문제 검수·콘텐츠 개정 흐름과 연결해 처리합니다.
        </span>
      </PageToolbar>

      <WorkspaceLayout
        main={
          <section className="admin-panel">
            {reports.length ? (
              <div className="admin-record-list">
                {reports.map((report) => (
                  <article
                    className="admin-record report-record"
                    key={report.id}
                  >
                    <div>
                      <StatusBadge
                        compact
                        tone={statusTones[report.status] ?? "neutral"}
                      >
                        {statusLabels[report.status] ?? report.status}
                      </StatusBadge>
                      <strong>{report.questionTitle}</strong>
                      <small>
                        {report.reason} · {formatDate(report.createdAt)}
                      </small>
                      <p>{report.content || "상세 내용이 없습니다."}</p>
                    </div>
                    <ReportAdminActions
                      id={report.id}
                      currentStatus={report.status}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>접수된 문제 신고가 없습니다.</strong>
                <p>사용자 신고가 들어오면 이곳에서 상태를 검토할 수 있습니다.</p>
              </div>
            )}
          </section>
        }
        inspector={
          <InspectorPanel
            eyebrow="REPORT INSPECTOR"
            title={
              latestReport
                ? latestReport.questionTitle
                : "검토할 신고가 없습니다"
            }
            description={
              latestReport
                ? "가장 최근 접수된 신고를 기준으로 처리 우선순위를 확인합니다."
                : "새 신고가 들어오면 신고 유형과 문제 연결 정보를 확인할 수 있습니다."
            }
            badges={
              latestReport
                ? [
                    {
                      label:
                        statusLabels[latestReport.status] ?? latestReport.status,
                      tone: statusTones[latestReport.status] ?? "neutral",
                    },
                    { label: latestReport.reason, tone: "info" },
                  ]
                : [{ label: "EMPTY", tone: "neutral" }]
            }
            meta={
              latestReport
                ? [
                    { label: "신고 ID", value: latestReport.id },
                    { label: "문제 ID", value: latestReport.questionId },
                    { label: "접수 일시", value: formatDate(latestReport.createdAt) },
                  ]
                : [
                    { label: "활성 신고", value: activeCount },
                    { label: "처리 완료", value: resolvedCount },
                  ]
            }
            actions={
              latestReport ? (
                <Link
                  className="button button-secondary"
                  href={`/admin/questions/${latestReport.questionId}`}
                >
                  문제 상세 열기
                </Link>
              ) : (
                <Link className="button button-secondary" href="/admin/questions">
                  문제은행으로 이동
                </Link>
              )
            }
          >
            <p>
              신고 처리는 문제 본문 수정, AI 해설 검수, 콘텐츠 버전 개정 여부와
              함께 판단해야 합니다. 사용자 신고 원문은 필요한 범위에서만 표시하고,
              처리 이력은 감사로그와 함께 확인하세요.
            </p>
          </InspectorPanel>
        }
      />
    </>
  );
}
