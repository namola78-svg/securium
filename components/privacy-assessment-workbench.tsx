"use client";

import { useState } from "react";
import { publicCopy } from "@/lib/public-copy";
import { SpecializedAIReview } from "./specialized-ai-review";

type AssessmentItem = { id: string; code: string; category: string; title: string; checkPoints: string };
type PreviousAnswer = { id: string; targetDecision: string; selectedAssessmentItems: string[]; identifiedRisks: string; improvementPlan: string; score: number } | null;

export function PrivacyAssessmentWorkbench({ courseId, scenarioId, items, previousAnswer }: { courseId: string; scenarioId: string; items: AssessmentItem[]; previousAnswer: PreviousAnswer }) {
  const [targetDecision, setTargetDecision] = useState(previousAnswer?.targetDecision ?? "REVIEW_NEEDED");
  const [selectedItems, setSelectedItems] = useState<string[]>(previousAnswer?.selectedAssessmentItems ?? []);
  const [identifiedRisks, setIdentifiedRisks] = useState(previousAnswer?.identifiedRisks ?? "");
  const [improvementPlan, setImprovementPlan] = useState(previousAnswer?.improvementPlan ?? "");
  const [result, setResult] = useState<{ answerId: string; score: number; modelImprovementPlan: string; error?: { message?: string } } | null>(null);
  const [savedAnswerId, setSavedAnswerId] = useState(previousAnswer?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  function toggleItem(id: string) {
    setSelectedItems((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/practical/privacy-assessment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, targetDecision, selectedAssessmentItems: selectedItems, identifiedRisks, improvementPlan }) });
      const payload = (await response.json()) as NonNullable<typeof result>;
      setResult(payload);
      if (!payload.error && payload.answerId) setSavedAnswerId(payload.answerId);
    } catch {
      setResult({ answerId: savedAnswerId, score: 0, modelImprovementPlan: "", error: { message: "네트워크 오류로 답안을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요." } });
    } finally { setSubmitting(false); }
  }

  return <section className="privacy-assessment-form" aria-labelledby="privacy-answer-title">
    <div className="section-heading compact"><div><p className="eyebrow">YOUR ASSESSMENT</p><h2 id="privacy-answer-title">영향평가 답안 작성</h2><p>판단을 고르고 근거를 작성한 다음, 참고 채점 결과와 개선 방향을 확인하세요.</p></div></div>
    <fieldset><legend>영향평가 대상 판단</legend><div className="choice-row">{[["REQUIRED", "평가 필요"], ["NOT_REQUIRED", "평가 불필요"], ["REVIEW_NEEDED", "추가 검토 필요"]].map(([value, label]) => <label key={value}><input type="radio" name="targetDecision" value={value} checked={targetDecision === value} onChange={() => setTargetDecision(value)} />{label}</label>)}</div></fieldset>
    <fieldset className="assessment-checklist"><legend>평가 항목과 체크포인트 연결</legend><div className="assessment-items">{items.map((item) => <label key={item.id}><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleItem(item.id)} /><span><strong>{item.code} · {publicCopy(item.title)}</strong><small>{publicCopy(item.category)} · {publicCopy(item.checkPoints)}</small></span></label>)}</div></fieldset>
    <div className="analysis-form-grid"><label>식별한 위험과 판단 근거<textarea value={identifiedRisks} onChange={(event) => setIdentifiedRisks(event.target.value)} rows={7} placeholder="어떤 위험이 있고, 그렇게 판단한 근거는 무엇인지 작성하세요." /></label><label>개선 계획<textarea value={improvementPlan} onChange={(event) => setImprovementPlan(event.target.value)} rows={9} placeholder="우선순위와 구체적인 개선 조치를 작성하세요." /></label></div>
    <button className="button button-primary" type="button" disabled={submitting} onClick={submit}>{submitting ? "제출하고 있습니다…" : "답안 제출 및 참고 채점"}</button>
    {result?.error ? <p className="form-message error-state" role="alert">{result.error.message}</p> : null}
    {result && !result.error ? <section className="analysis-result" aria-live="polite"><p className="eyebrow">REFERENCE RESULT</p><h3>참고 점수 {result.score}/100</h3><p className="sample-notice">학습 보조용 참고 점수이며 공식 영향평가 결과가 아닙니다.</p><p><strong>개선 방향:</strong> {publicCopy(result.modelImprovementPlan)}</p><SpecializedAIReview request={{ targetType: "PRIVACY_ASSESSMENT", courseId, answerId: result.answerId }} /></section> : previousAnswer ? <><p className="sample-notice">이전에 저장한 참고 점수: {previousAnswer.score}/100</p><SpecializedAIReview request={{ targetType: "PRIVACY_ASSESSMENT", courseId, answerId: savedAnswerId }} disabled={!savedAnswerId} /></> : null}
  </section>;
}
