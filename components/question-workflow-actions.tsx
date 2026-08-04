"use client";

import { useState } from "react";

const labels: Record<string, string> = {
  REQUEST_REVIEW: "검수 요청",
  START_REVIEW: "검토 시작",
  APPROVE: "승인",
  REJECT: "반려",
  PUBLISH: "게시",
  ARCHIVE: "보관",
};

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  REVIEW_REQUESTED: "검수 요청",
  IN_REVIEW: "검토 중",
  APPROVED: "승인",
  PUBLISHED: "게시",
  REJECTED: "반려",
  ARCHIVED: "보관",
};

const actionsByStatus: Record<string, string[]> = {
  DRAFT: ["REQUEST_REVIEW", "ARCHIVE"],
  REVIEW_REQUESTED: ["START_REVIEW", "APPROVE", "REJECT"],
  IN_REVIEW: ["APPROVE", "REJECT"],
  APPROVED: ["PUBLISH", "ARCHIVE"],
  PUBLISHED: ["ARCHIVE"],
  REJECTED: ["REQUEST_REVIEW", "ARCHIVE"],
  ARCHIVED: [],
};

export function QuestionWorkflowActions({
  questionId,
  status,
}: {
  questionId: string;
  status: string;
}) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");

  async function transition(action: string) {
    const response = await fetch("/api/admin/questions/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, action, comment }),
    });
    const payload = (await response.json()) as {
      error?: { message?: string };
    };
    if (!response.ok) {
      setMessage(payload.error?.message ?? "상태를 변경하지 못했습니다.");
      return;
    }
    window.location.reload();
  }

  async function clone() {
    const response = await fetch("/api/admin/questions/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    const payload = (await response.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      setMessage(payload.error?.message ?? "문제를 복제하지 못했습니다.");
      return;
    }
    window.location.href = `/admin/questions/${payload.id}`;
  }

  return (
    <section className="admin-panel">
      <h2>검수 및 게시</h2>
      <p>
        현재 상태 <span className="badge">{statusLabels[status] ?? status}</span>
      </p>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={2000}
        placeholder="검수 의견 또는 반려 사유"
      />
      <div className="button-row">
        {(actionsByStatus[status] ?? []).map((action) => (
          <button
            className="button button-dark"
            type="button"
            key={action}
            onClick={() => transition(action)}
          >
            {labels[action]}
          </button>
        ))}
        <button className="button button-ghost" type="button" onClick={clone}>
          문제 복제
        </button>
      </div>
      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
