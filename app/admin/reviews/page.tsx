import Link from "next/link";

import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  type Tone,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAdminQuestions } from "@/db/question-repositories";
import { requireQuestionReviewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "미지정";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "미지정";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    REVIEW_REQUESTED: "검수 요청",
    IN_REVIEW: "검토 중",
    APPROVED: "승인",
    PUBLISHED: "게시",
    REJECTED: "반려",
    DRAFT: "초안",
    ARCHIVED: "보관",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): Tone {
  if (status === "REVIEW_REQUESTED") return "warning";
  if (status === "IN_REVIEW") return "info";
  if (status === "APPROVED" || status === "PUBLISHED") return "success";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export default async function ReviewQueuePage() {
  await requireQuestionReviewer("/admin/reviews");
  const [requested, reviewing] = await Promise.all([
    listAdminQuestions({ status: "REVIEW_REQUESTED", limit: 100 }),
    listAdminQuestions({ status: "IN_REVIEW", limit: 100 }),
  ]);
  const rows = [...requested, ...reviewing].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const latestQuestion = rows[0];
  const sampleCount = rows.filter((question) => question.isSample).length;

  return (
    <>
      <SectionHeader
        eyebrow="REVIEW QUEUE"
        title="문제 검수 대기열"
        description="작성자와 검수자의 역할을 분리하고, 승인 전 문제 품질과 해설·정답 근거를 확인합니다."
        breadcrumbs={[
          { label: "관리자", href: "/admin" },
          { label: "문제 검수", current: true },
        ]}
        actions={
          <>
            <StatusBadge tone="warning">검수 요청 {requested.length}</StatusBadge>
            <StatusBadge tone="info">검토 중 {reviewing.length}</StatusBadge>
          </>
        }
      />

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={rows.length ? "warning" : "success"}>
              {rows.length ? "검수 필요" : "대기열 비어 있음"}
            </StatusBadge>
            <StatusBadge compact tone="neutral">
              샘플 문제 {sampleCount}
            </StatusBadge>
          </>
        }
        primary={
          <>
            <Link className="button ghost" href="/admin/questions">
              전체 문제
            </Link>
            <Link className="button ghost" href="/admin/questions/new">
              문제 등록
            </Link>
          </>
        }
      >
        <span>승인되지 않은 문제는 일반 사용자에게 노출되지 않도록 검수 상태를 먼저 확인하세요.</span>
      </PageToolbar>

      <section className="stats-grid admin-stats" aria-label="문제 검수 현황">
        <MetricCard
          label="전체 대기열"
          value={rows.length}
          description="검수 요청과 검토 중 문제"
        />
        <MetricCard
          label="검수 요청"
          value={requested.length}
          description="검수자가 확인해야 하는 신규 요청"
        />
        <MetricCard
          label="검토 중"
          value={reviewing.length}
          description="현재 검토가 시작된 문제"
        />
        <MetricCard
          label="개발용 샘플"
          value={sampleCount}
          description="운영 콘텐츠와 구분해 확인"
        />
      </section>

      <WorkspaceLayout
        main={
          <section className="admin-panel">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">QUESTION WORKFLOW</p>
                <h2>검수 대상 문제</h2>
              </div>
              <StatusBadge compact tone={rows.length ? "warning" : "success"}>
                {rows.length}건
              </StatusBadge>
            </div>

            {rows.length ? (
              <div className="admin-table" role="list" aria-label="검수 대상 문제 목록">
                {rows.map((question) => (
                  <Link
                    className="admin-question-row"
                    href={`/admin/questions/${question.id}`}
                    key={question.id}
                    role="listitem"
                  >
                    <strong>{question.title}</strong>
                    <StatusBadge compact tone={statusTone(question.status)}>
                      {statusLabel(question.status)}
                    </StatusBadge>
                    <span>{question.type}</span>
                    <span>{question.difficulty}</span>
                    <span>{formatDate(question.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>검수 대기 중인 문제가 없습니다.</strong>
                <p>작성자가 검수를 요청하거나 검토를 시작하면 이 화면에 표시됩니다.</p>
                <Link className="button ghost" href="/admin/questions">
                  문제 목록 보기
                </Link>
              </div>
            )}
          </section>
        }
        inspector={
          <InspectorPanel
            eyebrow="INSPECTOR"
            title={latestQuestion?.title ?? "검수 대기열 없음"}
            description="가장 최근에 갱신된 검수 대상 문제의 상태와 검토 기준을 빠르게 확인합니다."
            badges={
              latestQuestion
                ? [
                    {
                      label: statusLabel(latestQuestion.status),
                      tone: statusTone(latestQuestion.status),
                    },
                    { label: latestQuestion.type, tone: "neutral" },
                  ]
                : [{ label: "정상", tone: "success" }]
            }
            meta={
              latestQuestion
                ? [
                    { label: "난이도", value: latestQuestion.difficulty },
                    { label: "버전", value: `v${latestQuestion.version}` },
                    { label: "작성자", value: latestQuestion.createdBy },
                    { label: "검수자", value: latestQuestion.reviewedBy ?? "미지정" },
                    { label: "최근 수정", value: formatDate(latestQuestion.updatedAt) },
                  ]
                : []
            }
            actions={
              latestQuestion ? (
                <Link
                  className="button ghost"
                  href={`/admin/questions/${latestQuestion.id}`}
                >
                  문제 상세 검수
                </Link>
              ) : (
                <Link className="button ghost" href="/admin/questions">
                  전체 문제 확인
                </Link>
              )
            }
          >
            <div className="admin-record-list compact">
              <div className="admin-record">
                <span>검수 기준</span>
                <strong>정답, 해설, 오답 해설, 연결 근거 확인</strong>
                <small>승인 전 문제는 일반 사용자에게 노출되지 않습니다.</small>
              </div>
              <div className="admin-record">
                <span>권한 정책</span>
                <strong>CONTENT_REVIEWER 이상만 승인·반려 가능</strong>
                <small>작성자와 검수자의 역할 분리를 유지합니다.</small>
              </div>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
