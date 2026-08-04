"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { AIExplainabilityTraceSource } from "@/lib/ai/explainability";

type FeedbackState =
  | { status: "idle"; message: "" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function AdminAIExplainabilityFeedbackForm({
  traceId,
  traceSource,
}: {
  traceId: string;
  traceSource: AIExplainabilityTraceSource;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    status: "idle",
    message: "",
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback({ status: "idle", message: "" });

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/ai-explainability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          traceId,
          traceSource,
          rating: formData.get("rating"),
          issueType: formData.get("issueType"),
          note: formData.get("note"),
        }),
      });
      if (!response.ok) {
        setFeedback({
          status: "error",
          message:
            "피드백을 저장하지 못했습니다. 권한과 입력값을 확인한 뒤 다시 시도해 주세요.",
        });
        return;
      }
      event.currentTarget.reset();
      setFeedback({
        status: "success",
        message: "AI 검토 피드백을 저장했습니다.",
      });
    } catch {
      setFeedback({
        status: "error",
        message: "네트워크 문제로 피드백을 저장하지 못했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="ai-feedback-form" onSubmit={onSubmit}>
      <div className="ai-feedback-form-grid">
        <label>
          평가
          <select name="rating" defaultValue="HELPFUL" disabled={submitting}>
            <option value="HELPFUL">도움 됨</option>
            <option value="NOT_HELPFUL">도움 부족</option>
            <option value="NEEDS_REVIEW">추가 검수 필요</option>
          </select>
        </label>
        <label>
          이슈 유형
          <select name="issueType" defaultValue="NONE" disabled={submitting}>
            <option value="NONE">이슈 없음</option>
            <option value="LOW_QUALITY_CONTEXT">근거 품질 낮음</option>
            <option value="MISSING_CITATION">인용 누락</option>
            <option value="WRONG_CONCEPT">개념 매핑 오류</option>
            <option value="PROMPT_ISSUE">프롬프트 개선 필요</option>
            <option value="SENSITIVE_CONTENT_RISK">민감정보 위험</option>
            <option value="OTHER">기타</option>
          </select>
        </label>
      </div>
      <label>
        검수 메모
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          placeholder="관리자 검수 의견을 입력하세요. 민감정보나 답안 원문은 저장하지 마세요."
          disabled={submitting}
        />
      </label>
      <button className="button button-dark" type="submit" disabled={submitting}>
        {submitting ? "저장 중..." : "피드백 저장"}
      </button>
      {feedback.message ? (
        <p
          className={
            feedback.status === "success" ? "inline-success" : "inline-error"
          }
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
