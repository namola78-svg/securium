"use client";

import { useState } from "react";

type AdminAIRecord = {
  id: string;
  targetType: string;
  targetId: string;
  courseName: string;
  userEmail: string;
  provider: string;
  model: string;
  generationStatus: string;
  reviewStatus: string;
  originalResult: Record<string, unknown>;
  disclaimer: string;
  generatedAt: string;
  deletedAt: string | null;
  reviews: Array<{
    id: string;
    revision: number;
    action: string;
    reviewerEmail: string;
    reviewNote: string;
    editedResult: Record<string, unknown>;
    createdAt: string;
  }>;
};

export function AdminAIReviewConsole({
  initialRecords,
}: {
  initialRecords: AdminAIRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);

  function updateStatus(id: string, status: string) {
    setRecords((current) =>
      current.map((record) =>
        record.id === id
          ? {
              ...record,
              reviewStatus: status,
              deletedAt:
                status === "DELETED"
                  ? new Date().toISOString()
                  : record.deletedAt,
            }
          : record,
      ),
    );
  }

  return (
    <div className="admin-ai-review-list">
      {records.length ? (
        records.map((record) => (
          <AdminAIReviewCard
            key={record.id}
            record={record}
            onReviewed={updateStatus}
          />
        ))
      ) : (
        <div className="empty-state">
          <strong>검수할 AI 결과가 없습니다.</strong>
          <p>학습자가 과정 특화 AI 보조 기능을 사용하면 이곳에 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}

function AdminAIReviewCard({
  record,
  onReviewed,
}: {
  record: AdminAIRecord;
  onReviewed: (id: string, status: string) => void;
}) {
  const [editedJson, setEditedJson] = useState(
    JSON.stringify(record.originalResult, null, 2),
  );
  const [reviewNote, setReviewNote] = useState("");
  const [title, setTitle] = useState(
    `${record.courseName} ${targetLabel(record.targetType)} 검수 콘텐츠`,
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function review(
    action:
      | "REVIEWED"
      | "APPROVED_WITH_EDITS"
      | "REJECTED"
      | "DELETED"
      | "COPIED",
  ) {
    let editedResult: Record<string, unknown> = {};
    if (action === "APPROVED_WITH_EDITS" || action === "COPIED") {
      try {
        editedResult = JSON.parse(editedJson) as Record<string, unknown>;
      } catch {
        setMessage("관리자 수정본 JSON 형식을 확인하세요.");
        return;
      }
    }
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/admin/ai-reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationId: record.id,
        action,
        reviewNote,
        editedResult,
        reviewedContentTitle: action === "COPIED" ? title : "",
      }),
    });
    const payload = (await response.json()) as {
      result?: { status: string };
      error?: string;
    };
    setSubmitting(false);
    if (!response.ok || !payload.result) {
      setMessage(payload.error ?? "AI 결과를 검수하지 못했습니다.");
      return;
    }
    onReviewed(record.id, payload.result.status);
    setMessage(`검수 상태를 ${payload.result.status}(으)로 변경했습니다.`);
  }

  return (
    <article className="admin-panel admin-ai-review-card">
      <header>
        <div>
          <p className="eyebrow">{record.targetType.replaceAll("_", " ")}</p>
          <h2>
            {record.courseName} · {targetLabel(record.targetType)}
          </h2>
          <p>
            {record.userEmail} · {record.generatedAt}
          </p>
        </div>
        <div className="admin-ai-badges">
          <span className="status-badge">
            {record.provider === "mock" ? "모의 AI" : record.provider}
          </span>
          <span className="status-badge">{record.reviewStatus}</span>
        </div>
      </header>
      <p className="ai-disclaimer">{record.disclaimer}</p>
      <div className="admin-ai-original">
        <h3>AI 원본</h3>
        <pre>{JSON.stringify(record.originalResult, null, 2)}</pre>
      </div>
      <label>
        관리자 수정본
        <textarea
          className="admin-ai-json"
          value={editedJson}
          onChange={(event) => setEditedJson(event.target.value)}
          rows={16}
        />
      </label>
      <label>
        검수 의견
        <textarea
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          rows={4}
          maxLength={4000}
        />
      </label>
      <label>
        검수 콘텐츠 제목
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={300}
        />
      </label>
      <div className="admin-ai-actions">
        <button
          type="button"
          className="button button-ghost"
          disabled={submitting}
          onClick={() => void review("REVIEWED")}
        >
          검수 완료
        </button>
        <button
          type="button"
          className="button button-dark"
          disabled={submitting}
          onClick={() => void review("APPROVED_WITH_EDITS")}
        >
          수정 후 승인
        </button>
        <button
          type="button"
          className="button button-ghost"
          disabled={submitting}
          onClick={() => void review("REJECTED")}
        >
          반려
        </button>
        <button
          type="button"
          className="button button-ghost"
          disabled={submitting}
          onClick={() => void review("DELETED")}
        >
          삭제
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={submitting || !title.trim()}
          onClick={() => void review("COPIED")}
        >
          검수 콘텐츠로 복사
        </button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
      {record.reviews.length ? (
        <details className="ai-source-details">
          <summary>검수 이력 {record.reviews.length}건</summary>
          <ol>
            {record.reviews.map((reviewItem) => (
              <li key={reviewItem.id}>
                v{reviewItem.revision} · {reviewItem.action} ·{" "}
                {reviewItem.reviewerEmail}
                {reviewItem.reviewNote ? ` · ${reviewItem.reviewNote}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  );
}

function targetLabel(targetType: string) {
  const labels: Record<string, string> = {
    WRITTEN_ANSWER: "서술형 보조채점",
    RISK_SCENARIO: "위험 시나리오",
    PRIVACY_ASSESSMENT: "개인정보 영향평가",
    SECURE_CODE: "보안약점 코드 설명",
  };
  return labels[targetType] ?? targetType;
}
