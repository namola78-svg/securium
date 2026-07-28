"use client";

import { useState } from "react";
import { SpecializedAIReview } from "./specialized-ai-review";

type AssessmentItem = {
  id: string;
  code: string;
  category: string;
  title: string;
  checkPoints: string;
};

type PreviousAnswer = {
  id: string;
  targetDecision: string;
  selectedAssessmentItems: string[];
  identifiedRisks: string;
  improvementPlan: string;
  score: number;
} | null;

export function PrivacyAssessmentWorkbench({
  courseId,
  scenarioId,
  items,
  previousAnswer,
}: {
  courseId: string;
  scenarioId: string;
  items: AssessmentItem[];
  previousAnswer: PreviousAnswer;
}) {
  const [targetDecision, setTargetDecision] = useState(
    previousAnswer?.targetDecision ?? "REVIEW_NEEDED",
  );
  const [selectedItems, setSelectedItems] = useState<string[]>(
    previousAnswer?.selectedAssessmentItems ?? [],
  );
  const [identifiedRisks, setIdentifiedRisks] = useState(
    previousAnswer?.identifiedRisks ?? "",
  );
  const [improvementPlan, setImprovementPlan] = useState(
    previousAnswer?.improvementPlan ?? "",
  );
  const [result, setResult] = useState<{
    answerId: string;
    score: number;
    breakdown: Record<string, number>;
    missedItems: string[];
    modelImprovementPlan: string;
    error?: { message?: string };
  } | null>(null);
  const [savedAnswerId, setSavedAnswerId] = useState(
    previousAnswer?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  function toggleItem(id: string) {
    setSelectedItems((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function submit() {
    setSubmitting(true);
    const response = await fetch("/api/practical/privacy-assessment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId,
        targetDecision,
        selectedAssessmentItems: selectedItems,
        identifiedRisks,
        improvementPlan,
      }),
    });
    const payload = await response.json() as NonNullable<typeof result>;
    setSubmitting(false);
    setResult(payload);
    if (!payload.error && payload.answerId) {
      setSavedAnswerId(payload.answerId);
    }
  }

  return (
    <section className="privacy-assessment-form" aria-labelledby="privacy-answer-title">
      <h2 id="privacy-answer-title">평가보고서형 답안</h2>
      <fieldset>
        <legend>영향평가 대상 판단</legend>
        {[
          ["REQUIRED", "대상"],
          ["NOT_REQUIRED", "비대상"],
          ["REVIEW_NEEDED", "추가 검토 필요"],
        ].map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="targetDecision"
              checked={targetDecision === value}
              onChange={() => setTargetDecision(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="assessment-checklist">
        <legend>평가항목과 침해요인 매핑</legend>
        {items.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selectedItems.includes(item.id)}
              onChange={() => toggleItem(item.id)}
            />
            <span><strong>{item.code} · {item.title}</strong><small>{item.category} · {item.checkPoints}</small></span>
          </label>
        ))}
      </fieldset>
      <label>
        식별한 침해요인
        <textarea value={identifiedRisks} onChange={(event) => setIdentifiedRisks(event.target.value)} rows={7} />
      </label>
      <label>
        개선방안
        <textarea value={improvementPlan} onChange={(event) => setImprovementPlan(event.target.value)} rows={9} />
      </label>
      <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>
        {submitting ? "저장·채점 중…" : "답안 저장 및 참고 채점"}
      </button>
      {result?.error ? <p className="form-message error-state" role="alert">{result.error.message}</p> : null}
      {result && !result.error ? (
        <section className="analysis-result" aria-live="polite">
          <h3>참고 점수 {result.score}/100</h3>
          <p className="sample-notice">개발용 규칙 기반 학습 보조 점수이며 공식 영향평가 결과가 아닙니다.</p>
          <p><strong>모범 개선방안:</strong> {result.modelImprovementPlan}</p>
          <SpecializedAIReview
            request={{
              targetType: "PRIVACY_ASSESSMENT",
              courseId,
              answerId: result.answerId,
            }}
          />
        </section>
      ) : previousAnswer ? (
        <>
          <p>이전에 저장한 참고 점수: {previousAnswer.score}/100</p>
          <SpecializedAIReview
            request={{
              targetType: "PRIVACY_ASSESSMENT",
              courseId,
              answerId: savedAnswerId,
            }}
            disabled={!savedAnswerId}
          />
        </>
      ) : null}
    </section>
  );
}
