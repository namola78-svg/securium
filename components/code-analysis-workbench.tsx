"use client";

import { useMemo, useRef, useState } from "react";
import { SpecializedAIReview } from "./specialized-ai-review";

type WeaknessOption = { id: string; code: string; name: string; cweCode: string; language: string };
type GradeResult = { attemptId: string; score: number; maximumScore: number; expectedLines: number[]; secureCode: string; explanation: string; weaknessName: string; cweCode: string; remediationGuide: string; error?: { message?: string } };

function highlightLine(line: string, language: string) {
  const pattern = language === "Java" ? /\b(public|private|class|static|void|new|return|if|else|try|catch|String|int|boolean)\b/g : /\b(int|char|void|return|if|else|struct|malloc|free|sizeof|NULL|const)\b/g;
  const keywords = new Set((language === "Java" ? ["public", "private", "class", "static", "void", "new", "return", "if", "else", "try", "catch", "String", "int", "boolean"] : ["int", "char", "void", "return", "if", "else", "struct", "malloc", "free", "sizeof", "NULL", "const"]));
  return line.split(pattern).map((part, index) => keywords.has(part) ? <span className="code-keyword" key={`${part}-${index}`}>{part}</span> : part);
}

export function CodeAnalysisWorkbench({ courseId, sample, weaknesses }: { courseId: string; sample: { id: string; title: string; language: string; vulnerableCode: string; falsePositivePossible: boolean; callRelation: string; executionFlow: string }; weaknesses: WeaknessOption[] }) {
  const lines = useMemo(() => sample.vulnerableCode.split(/\r?\n/), [sample.vulnerableCode]);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [weaknessId, setWeaknessId] = useState(weaknesses[0]?.id ?? "");
  const [cweCode, setCweCode] = useState(weaknesses[0]?.cweCode ?? "");
  const [truePositive, setTruePositive] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [remediationCode, setRemediationCode] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(0);

  function toggleLine(line: number) { if (!startedAt.current) startedAt.current = Date.now(); setSelectedLines((current) => current.includes(line) ? current.filter((value) => value !== line) : [...current, line].sort((a, b) => a - b)); }
  async function submit() {
    if (!startedAt.current) startedAt.current = Date.now(); setSubmitting(true); setMessage("");
    try {
      const response = await fetch("/api/practical/code-analysis", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId, sampleId: sample.id, selectedLines, weaknessId, selectedCweCode: cweCode, truePositive, userExplanation: explanation, remediationCode, responseTime: Date.now() - startedAt.current, idempotencyKey: crypto.randomUUID() }) });
      const payload = (await response.json()) as GradeResult;
      if (!response.ok) { setMessage(payload.error?.message ?? "답안을 채점하지 못했습니다. 입력을 확인하고 다시 시도해 주세요."); return; }
      setResult(payload);
    } catch { setMessage("네트워크 오류로 답안을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요."); } finally { setSubmitting(false); }
  }

  return <section className="code-workbench" aria-labelledby="code-analysis-title">
    <div className="section-heading compact"><div><p className="eyebrow">{sample.language} CODE REVIEW</p><h2 id="code-analysis-title">{sample.title}</h2><p>취약하다고 판단한 줄을 선택하고, 문제 유형과 수정 근거를 작성하세요. 코드는 실행되지 않습니다.</p></div></div>
    <div className="code-listbox" role="listbox" aria-label="취약하다고 판단한 코드 줄 선택" aria-multiselectable="true">{lines.map((line, index) => { const number = index + 1; const selected = selectedLines.includes(number); return <button className={selected ? "code-line selected" : "code-line"} type="button" role="option" aria-selected={selected} onClick={() => toggleLine(number)} key={number}><span className="code-line-number" aria-hidden="true">{number}</span><code>{highlightLine(line || " ", sample.language)}</code></button>; })}</div>
    <div className="analysis-form-grid">
      <label>보안 약점 유형<select value={weaknessId} onChange={(event) => { const next = weaknesses.find((item) => item.id === event.target.value); setWeaknessId(event.target.value); setCweCode(next?.cweCode ?? ""); }}>{weaknesses.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label>CWE 코드<input value={cweCode} onChange={(event) => setCweCode(event.target.value)} /></label>
      <fieldset><legend>취약점 판단</legend><div className="choice-row"><label><input type="radio" name="true-positive" checked={truePositive} onChange={() => setTruePositive(true)} />취약점 맞음</label><label><input type="radio" name="true-positive" checked={!truePositive} onChange={() => setTruePositive(false)} />오탐 가능성</label></div>{sample.falsePositivePossible ? <small>이 사례는 오탐 가능성도 함께 검토해야 합니다.</small> : null}</fieldset>
      <label className="wide">판단 근거와 조치 방향<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={6} placeholder="왜 취약하다고 판단했는지, 어떤 조치가 필요한지 작성하세요." /></label>
      <label className="wide">수정 코드<textarea className="code-input" value={remediationCode} onChange={(event) => setRemediationCode(event.target.value)} rows={10} spellCheck={false} placeholder="안전한 수정 예시를 작성하세요." /></label>
    </div>
    <button className="button button-primary" type="button" disabled={submitting || !weaknessId} onClick={submit}>{submitting ? "채점 중…" : "분석 답안 제출"}</button>
    {message ? <p className="form-message error-state" role="alert">{message}</p> : null}
    <div className="explanation-panels"><section><h3>호출 관계</h3><p>{sample.callRelation || "등록된 호출 관계 설명이 없습니다."}</p></section><section><h3>실행 흐름</h3><p>{sample.executionFlow || "등록된 실행 흐름 설명이 없습니다."}</p></section></div>
    {result ? <section className="analysis-result" aria-live="polite"><p className="eyebrow">REFERENCE RESULT</p><h2>참고 채점 결과 {result.score}/{result.maximumScore}</h2><p className="sample-notice">학습 보조용 참고 채점이며 공식 보안 진단 결과가 아닙니다.</p><p>{result.explanation}</p><p><strong>정답 취약 라인:</strong> {result.expectedLines.join(", ") || "없음"}</p><p><strong>보안 약점:</strong> {result.weaknessName} · {result.cweCode}</p><p><strong>권장 조치:</strong> {result.remediationGuide}</p><div className="code-diff" aria-label="취약 코드와 안전한 코드 비교"><div><h3>제출한 코드</h3><pre><code>{sample.vulnerableCode}</code></pre></div><div><h3>안전한 예시</h3><pre><code>{result.secureCode}</code></pre></div></div><SpecializedAIReview request={{ targetType: "SECURE_CODE", courseId, attemptId: result.attemptId }} /></section> : null}
  </section>;
}
