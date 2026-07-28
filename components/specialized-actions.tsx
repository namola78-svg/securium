"use client";

import { useState } from "react";
import { SpecializedAIReview } from "./specialized-ai-review";

export function SpecializedBookmarkButton({
  courseId,
  contentType,
  contentId,
  initialBookmarked,
}: {
  courseId: string;
  contentType:
    | "ISMS_STANDARD"
    | "ISMS_DEFECT_CASE"
    | "LEGAL_ARTICLE"
    | "RISK_SCENARIO";
  contentId: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState("");
  async function toggle() {
    const response = await fetch("/api/specialized/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId, contentType, contentId }),
    });
    if (!response.ok) {
      setMessage("즐겨찾기를 변경하지 못했습니다.");
      return;
    }
    const payload = (await response.json()) as {
      result: { bookmarked: boolean };
    };
    setBookmarked(payload.result.bookmarked);
    setMessage(payload.result.bookmarked ? "즐겨찾기에 저장했습니다." : "즐겨찾기에서 해제했습니다.");
  }
  return (
    <div className="inline-actions">
      <button className="button button-ghost" type="button" onClick={() => void toggle()}>
        {bookmarked ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

type WrittenResult = {
  earnedScore: number;
  maximumScore: number;
  fulfilledRequired: string[];
  missingRequired: string[];
  fulfilledOptional: string[];
  modelAnswer: string;
  guidance: string;
  advisoryOnly: boolean;
};

export function WrittenAnswerPractice({
  courseId,
  questionId,
  title,
  maximumScore,
}: {
  courseId: string;
  questionId: string;
  title: string;
  maximumScore: number;
}) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<WrittenResult | null>(null);
  const [message, setMessage] = useState("");
  async function grade() {
    const response = await fetch("/api/specialized/written-grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId, answer }),
    });
    const payload = (await response.json()) as {
      result?: WrittenResult;
      error?: { message?: string };
    };
    if (!response.ok || !payload.result) {
      setMessage(payload.error?.message ?? "보조채점을 완료하지 못했습니다.");
      return;
    }
    setResult(payload.result);
    setMessage("");
  }
  return (
    <article className="specialized-card written-practice">
      <p className="eyebrow">ADVISORY GRADING</p>
      <h3>{title}</h3>
      <p>배점 {maximumScore}점 · 개발용 샘플</p>
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="핵심 개념과 적용 통제를 서술하세요."
        rows={6}
      />
      <button className="button button-dark" type="button" disabled={!answer.trim()} onClick={() => void grade()}>
        참고용 보조채점
      </button>
      {message ? <p className="form-message">{message}</p> : null}
      {result ? (
        <div className="written-result">
          <strong>참고 점수 {result.earnedScore} / {result.maximumScore}</strong>
          <p className="sample-notice">{result.guidance}</p>
          <dl className="content-facts">
            <div><dt>충족한 필수 키워드</dt><dd>{result.fulfilledRequired.join(", ") || "없음"}</dd></div>
            <div><dt>누락한 키워드</dt><dd>{result.missingRequired.join(", ") || "없음"}</dd></div>
            <div><dt>충족한 선택 키워드</dt><dd>{result.fulfilledOptional.join(", ") || "없음"}</dd></div>
            <div><dt>개발용 모범답안</dt><dd>{result.modelAnswer}</dd></div>
          </dl>
          <SpecializedAIReview
            request={{
              targetType: "WRITTEN_ANSWER",
              courseId,
              questionId,
              answer,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

type RiskMethod = {
  id: string;
  name: string;
  description: string;
};

export function RiskPractice({
  methods,
  scenarios,
}: {
  methods: RiskMethod[];
  scenarios: Array<{
    id: string;
    title: string;
    asset: string;
    threat: string;
    vulnerability: string;
  }>;
}) {
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [likelihood, setLikelihood] = useState(3);
  const [impact, setImpact] = useState(3);
  const [result, setResult] = useState<{
    riskValue: number;
    riskLabel: string;
    treatmentGuidance: string;
    method: { name: string };
  } | null>(null);
  const [message, setMessage] = useState("");

  async function calculate() {
    const response = await fetch("/api/specialized/risk-calculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ methodId, likelihood, impact }),
    });
    const payload = (await response.json()) as {
      result?: typeof result;
      error?: { message?: string };
    };
    if (!response.ok || !payload.result) {
      setMessage(payload.error?.message ?? "위험도를 계산하지 못했습니다.");
      return;
    }
    setResult(payload.result);
    setMessage("");
  }

  async function saveRegister(formData: FormData) {
    const scenario = scenarios.find((item) => item.id === formData.get("scenarioId"));
    if (!scenario) return;
    const response = await fetch("/api/specialized/risk-register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: scenario.id,
        asset: scenario.asset,
        threat: scenario.threat,
        vulnerability: scenario.vulnerability,
        likelihood,
        impact,
        treatment: formData.get("treatment"),
        owner: formData.get("owner"),
        dueDate: formData.get("dueDate"),
        status: "OPEN",
      }),
    });
    setMessage(response.ok ? "내 위험등록부에 저장했습니다." : "위험등록부를 저장하지 못했습니다.");
  }

  return (
    <section className="risk-practice-grid">
      <article className="specialized-card">
        <p className="eyebrow">RISK CALCULATOR</p>
        <h2>평가 방법을 바꿔 위험도 비교</h2>
        <label>평가 방법<select value={methodId} onChange={(event) => setMethodId(event.target.value)}>
          {methods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
        </select></label>
        <label>가능성<input type="number" min={0} max={1000} value={likelihood} onChange={(event) => setLikelihood(Number(event.target.value))} /></label>
        <label>영향도<input type="number" min={0} max={1000} value={impact} onChange={(event) => setImpact(Number(event.target.value))} /></label>
        <button className="button button-dark" type="button" onClick={() => void calculate()}>위험도 계산</button>
        {result ? (
          <div className="risk-result">
            <strong>{result.riskValue} · {result.riskLabel}</strong>
            <p>{result.method.name}</p>
            <p>{result.treatmentGuidance}</p>
          </div>
        ) : null}
      </article>
      <form className="specialized-card" action={saveRegister}>
        <p className="eyebrow">RISK REGISTER</p>
        <h2>위험등록부 작성 연습</h2>
        <label>시나리오<select name="scenarioId" required>
          {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
        </select></label>
        <label>처리 방안<textarea name="treatment" required /></label>
        <label>담당자<input name="owner" required /></label>
        <label>목표일<input name="dueDate" type="date" /></label>
        <button className="button button-dark" type="submit">내 위험등록부에 저장</button>
        {message ? <p className="form-message">{message}</p> : null}
      </form>
    </section>
  );
}
