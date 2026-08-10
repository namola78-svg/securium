"use client";

import { useState } from "react";

const labels: Record<string, string> = { REQUEST_REVIEW: "검수 요청", START_REVIEW: "검수 시작", APPROVE: "승인", REJECT: "반려", PUBLISH: "게시", ARCHIVE: "보관" };
const statusLabels: Record<string, string> = { DRAFT: "초안", REVIEW_REQUESTED: "검수 요청", IN_REVIEW: "검수 중", APPROVED: "승인됨", PUBLISHED: "게시됨", REJECTED: "반려됨", ARCHIVED: "보관됨" };
const actionsByStatus: Record<string, string[]> = { DRAFT: ["REQUEST_REVIEW", "ARCHIVE"], REVIEW_REQUESTED: ["START_REVIEW", "APPROVE", "REJECT"], IN_REVIEW: ["APPROVE", "REJECT"], APPROVED: ["PUBLISH", "ARCHIVE"], PUBLISHED: ["ARCHIVE"], REJECTED: ["REQUEST_REVIEW", "ARCHIVE"], ARCHIVED: [] };

export function QuestionWorkflowActions({ questionId, status }: { questionId: string; status: string }) {
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function transition(action: string) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/questions/workflow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId, action, comment }) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) { setMessage(payload.error?.message ?? "상태를 변경하지 못했습니다. 입력과 권한을 확인해주세요."); return; }
      window.location.reload();
    } catch { setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요."); } finally { setBusy(false); }
  }

  async function clone() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/questions/clone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionId }) });
      const payload = await response.json() as { id?: string; error?: { message?: string } };
      if (!response.ok || !payload.id) { setMessage(payload.error?.message ?? "문제를 복제하지 못했습니다."); return; }
      window.location.href = `/admin/questions/${payload.id}`;
    } catch { setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요."); } finally { setBusy(false); }
  }

  return <section className="admin-panel" aria-labelledby="question-workflow-title"><h2 id="question-workflow-title">검수 및 게시</h2><p>현재 상태 <span className="badge">{statusLabels[status] ?? status}</span></p><label htmlFor="workflow-comment">검수 의견 <span className="muted">(선택)</span></label><textarea id="workflow-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} placeholder="승인 또는 반려 사유를 입력하세요." disabled={busy} /><small className="form-helper">최대 2,000자 · 반려 시 구체적인 수정 방향을 남겨주세요.</small><div className="button-row">{(actionsByStatus[status] ?? []).map((action) => <button className={`button ${action === "REJECT" ? "button-danger" : "button-dark"}`} type="button" key={action} onClick={() => transition(action)} disabled={busy}>{busy ? "처리 중…" : labels[action]}</button>)}<button className="button button-ghost" type="button" onClick={clone} disabled={busy}>문제 복제</button></div>{message ? <p className="form-message" role="alert">{message}</p> : null}</section>;
}
