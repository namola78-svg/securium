import Link from "next/link";

import { AdminAIReviewConsole } from "@/components/admin-ai-review-console";
import {
  InspectorPanel,
  MetricCard,
  PageToolbar,
  SectionHeader,
  StatusBadge,
  WorkspaceLayout,
} from "@/components/design-system-primitives";
import { listAdminSpecializedAIRecords } from "@/db/ai-specialized-repositories";
import { requireQuestionReviewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAIReviewsPage() {
  await requireQuestionReviewer("/admin/ai-reviews");
  const records = await listAdminSpecializedAIRecords(100);
  const pendingCount = records.filter((record) =>
    ["PENDING", "GENERATED", "generated"].includes(record.reviewStatus),
  ).length;
  const reviewedCount = records.filter((record) =>
    ["REVIEWED", "APPROVED_WITH_EDITS", "COPIED"].includes(record.reviewStatus),
  ).length;
  const rejectedCount = records.filter((record) =>
    ["REJECTED", "DELETED"].includes(record.reviewStatus),
  ).length;
  const mockCount = records.filter((record) => record.provider === "mock").length;
  const latestRecord = records[0] ?? null;
  const targetTypes = new Set(records.map((record) => record.targetType));
  const affectedCourses = new Set(records.map((record) => record.courseName));

  return (
    <>
      <SectionHeader
        eyebrow="AI REVIEW"
        title="과정 특화 AI 결과 검수"
        description="AI 원본과 관리자 수정본, 승인·반려·삭제·검수 콘텐츠 복사 이력을 분리해 관리합니다."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI Reviews", current: true },
        ]}
        actions={
          <>
            <Link className="button button-ghost" href="/admin/ai-explainability">
              AI Trace
            </Link>
            <Link className="button button-primary" href="/admin/questions">
              문제은행
            </Link>
          </>
        }
      />

      <section className="stats-grid admin-stats">
        <MetricCard
          label="검수 대상"
          value={records.length}
          description={`과정 ${affectedCourses.size}개 · 유형 ${targetTypes.size}개`}
        />
        <MetricCard
          label="검수 완료"
          value={reviewedCount}
          description={`대기 ${pendingCount}개`}
        />
        <MetricCard
          label="반려·삭제"
          value={rejectedCount}
          description={`Mock AI ${mockCount}개`}
        />
      </section>

      <PageToolbar
        secondary={
          <>
            <StatusBadge compact tone={pendingCount ? "warning" : "success"}>
              PENDING {pendingCount}
            </StatusBadge>
            <StatusBadge compact tone={mockCount ? "info" : "neutral"}>
              MOCK {mockCount}
            </StatusBadge>
          </>
        }
        primary={
          <Link className="button button-ghost" href="/admin/ai-reviews">
            새로고침
          </Link>
        }
      >
        <strong>AI 원본과 관리자 검수본 분리</strong>
        <span>공식 점수나 관리자 채점 결과를 자동으로 변경하지 않습니다.</span>
      </PageToolbar>

      <WorkspaceLayout
        main={<AdminAIReviewConsole initialRecords={records} />}
        inspector={
          <InspectorPanel
            eyebrow="REVIEW INSPECTOR"
            title={latestRecord ? "최근 AI 검수 항목" : "검수할 AI 결과가 없습니다"}
            description={
              latestRecord
                ? "가장 최근 생성된 AI 결과의 과정, 대상, 모델, 검수 상태를 요약합니다."
                : "학습자가 과정 특화 AI 보조 기능을 사용하면 이곳에 검수 큐가 표시됩니다."
            }
            badges={[
              {
                label: latestRecord?.reviewStatus ?? "EMPTY",
                tone: pendingCount ? "warning" : "success",
              },
              {
                label: latestRecord?.provider === "mock" ? "MOCK AI" : latestRecord?.provider ?? "NO PROVIDER",
                tone: latestRecord?.provider === "mock" ? "info" : "neutral",
              },
            ]}
            meta={[
              { label: "최근 과정", value: latestRecord?.courseName ?? "-" },
              { label: "대상 유형", value: latestRecord?.targetType ?? "-" },
              { label: "모델", value: latestRecord?.model ?? "-" },
              { label: "생성 상태", value: latestRecord?.generationStatus ?? "-" },
              { label: "기존 검수 이력", value: `${latestRecord?.reviews.length ?? 0}건` },
              { label: "삭제 여부", value: latestRecord?.deletedAt ? "삭제됨" : "활성" },
            ]}
            actions={
              <>
                <Link className="button button-ghost" href="/admin/ai-explainability">
                  Trace 확인
                </Link>
                <Link className="button button-ghost" href="/admin/shared-content">
                  근거 콘텐츠
                </Link>
              </>
            }
          >
            <div className="admin-card-meta">
              <span>AI 생성 결과는 참고용이며 공식 기준·법령·채점 결과가 아닙니다.</span>
              <span>관리자 수정본은 AI 원본과 분리해 보존합니다.</span>
              <span>답안 원문, 토큰, API Key 등 민감정보는 저장하지 않습니다.</span>
            </div>
          </InspectorPanel>
        }
      />
    </>
  );
}
