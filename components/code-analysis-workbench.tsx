"use client";

import { useMemo, useRef, useState } from "react";
import { SpecializedAIReview } from "./specialized-ai-review";

type WeaknessOption = {
  id: string;
  code: string;
  name: string;
  cweCode: string;
  language: string;
};

type GradeResult = {
  attemptId: string;
  score: number;
  maximumScore: number;
  breakdown: Record<string, number>;
  expectedLines: number[];
  matchedKeywords: string[];
  secureCode: string;
  explanation: string;
  weaknessName: string;
  cweCode: string;
  remediationGuide: string;
  error?: { message?: string };
};

function highlightedLine(line: string, language: string) {
  const keywords =
    language === "Java"
      ? /\b(public|private|class|static|void|new|return|if|else|try|catch|String|int|boolean)\b/g
      : /\b(int|char|void|return|if|else|struct|malloc|free|sizeof|NULL|const)\b/g;
  const keywordSet = new Set(
    language === "Java"
      ? ["public", "private", "class", "static", "void", "new", "return", "if", "else", "try", "catch", "String", "int", "boolean"]
      : ["int", "char", "void", "return", "if", "else", "struct", "malloc", "free", "sizeof", "NULL", "const"],
  );
  return line.split(keywords).map((part, index) =>
    keywordSet.has(part) ? (
      <span className="code-keyword" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function CodeAnalysisWorkbench({
  courseId,
  sample,
  weaknesses,
}: {
  courseId: string;
  sample: {
    id: string;
    title: string;
    language: string;
    vulnerableCode: string;
    falsePositivePossible: boolean;
    callRelation: string;
    executionFlow: string;
  };
  weaknesses: WeaknessOption[];
}) {
  const lines = useMemo(() => sample.vulnerableCode.split(/\r?\n/), [sample]);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [weaknessId, setWeaknessId] = useState(weaknesses[0]?.id ?? "");
  const selectedWeakness = weaknesses.find((item) => item.id === weaknessId);
  const [cweCode, setCweCode] = useState(selectedWeakness?.cweCode ?? "");
  const [truePositive, setTruePositive] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [remediationCode, setRemediationCode] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(0);

  function toggleLine(line: number) {
    if (startedAt.current === 0) startedAt.current = Date.now();
    setSelectedLines((current) =>
      current.includes(line)
        ? current.filter((value) => value !== line)
        : [...current, line].sort((left, right) => left - right),
    );
  }

  async function submit() {
    if (startedAt.current === 0) startedAt.current = Date.now();
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/practical/code-analysis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courseId,
        sampleId: sample.id,
        selectedLines,
        weaknessId,
        selectedCweCode: cweCode,
        truePositive,
        userExplanation: explanation,
        remediationCode,
        responseTime: Date.now() - startedAt.current,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const payload = (await response.json()) as GradeResult;
    setSubmitting(false);
    if (!response.ok) {
      setMessage(payload.error?.message ?? "답안을 채점하지 못했습니다.");
      return;
    }
    setResult(payload);
  }

  return (
    <section className="code-workbench" aria-labelledby="code-analysis-title">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">{sample.language} 코드 분석 실습</p>
          <h2 id="code-analysis-title">{sample.title}</h2>
          <p>취약하다고 판단한 줄을 선택하세요. 코드는 표시만 하며 실행하지 않습니다.</p>
        </div>
      </div>

      <div className="code-listbox" role="listbox" aria-label="취약 라인 선택" aria-multiselectable="true">
        {lines.map((line, index) => {
          const number = index + 1;
          const selected = selectedLines.includes(number);
          return (
            <button
              className={selected ? "code-line selected" : "code-line"}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => toggleLine(number)}
              key={number}
            >
              <span className="code-line-number" aria-hidden="true">{number}</span>
              <code>{highlightedLine(line || " ", sample.language)}</code>
            </button>
          );
        })}
      </div>

      <div className="analysis-form-grid">
        <label>
          보안약점 유형
          <select
            value={weaknessId}
            onChange={(event) => {
              const next = weaknesses.find((item) => item.id === event.target.value);
              setWeaknessId(event.target.value);
              setCweCode(next?.cweCode ?? "");
            }}
          >
            {weaknesses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          CWE
          <input value={cweCode} onChange={(event) => setCweCode(event.target.value)} />
        </label>
        <fieldset>
          <legend>정탐·오탐 판단</legend>
          <label><input type="radio" checked={truePositive} onChange={() => setTruePositive(true)} /> 정탐</label>
          <label><input type="radio" checked={!truePositive} onChange={() => setTruePositive(false)} /> 오탐</label>
          {sample.falsePositivePossible ? <small>이 사례는 오탐 가능성 검토가 포함됩니다.</small> : null}
        </fieldset>
        <label className="wide">
          판단 근거와 조치방안
          <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={6} />
        </label>
        <label className="wide">
          수정 코드
          <textarea
            className="code-input"
            value={remediationCode}
            onChange={(event) => setRemediationCode(event.target.value)}
            rows={10}
            spellCheck={false}
          />
        </label>
      </div>
      <button className="button button-primary" type="button" disabled={submitting || !weaknessId} onClick={submit}>
        {submitting ? "채점 중…" : "분석 답안 제출"}
      </button>
      {message ? <p className="form-message error-state" role="alert">{message}</p> : null}

      <div className="explanation-panels">
        <section><h3>호출 관계</h3><p>{sample.callRelation || "등록된 호출 관계 설명이 없습니다."}</p></section>
        <section><h3>실행 흐름</h3><p>{sample.executionFlow || "등록된 실행 흐름 설명이 없습니다."}</p></section>
      </div>

      {result ? (
        <section className="analysis-result" aria-live="polite">
          <h2>참고용 채점 결과 {result.score}/{result.maximumScore}</h2>
          <p className="sample-notice">학습 보조 채점이며 공식 평가 결과가 아닙니다.</p>
          <p>{result.explanation}</p>
          <p><strong>정답 취약 라인:</strong> {result.expectedLines.join(", ") || "없음"}</p>
          <p><strong>보안약점:</strong> {result.weaknessName} · {result.cweCode}</p>
          <p><strong>모범 조치방안:</strong> {result.remediationGuide}</p>
          <div className="code-diff" aria-label="취약 코드와 안전한 코드 비교">
            <div><h3>수정 전</h3><pre><code>{sample.vulnerableCode}</code></pre></div>
            <div><h3>안전한 예시</h3><pre><code>{result.secureCode}</code></pre></div>
          </div>
          <SpecializedAIReview
            request={{
              targetType: "SECURE_CODE",
              courseId,
              attemptId: result.attemptId,
            }}
          />
        </section>
      ) : null}
    </section>
  );
}
