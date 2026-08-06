"use client";

import { useState } from "react";
import type {
  AIEvidence,
  PrivacyAssessmentAIReview,
  RiskScenarioAIReview,
  SecureCodeAIExplanation,
  WrittenAnswerAIReview,
} from "@/lib/ai/types";

type SpecializedAIRequest =
  | {
      targetType: "WRITTEN_ANSWER";
      courseId: string;
      questionId: string;
      answer: string;
    }
  | {
      targetType: "RISK_SCENARIO";
      courseId: string;
      scenarioId: string;
    }
  | {
      targetType: "PRIVACY_ASSESSMENT";
      courseId: string;
      answerId: string;
    }
  | {
      targetType: "SECURE_CODE";
      courseId: string;
      attemptId: string;
    };

type SpecializedAIResponse = {
  recordId: string;
  targetType: SpecializedAIRequest["targetType"];
  reviewStatus: string;
  provider: "mock" | "openai";
  model: string;
  status: string;
  disclaimer: string;
  requestId: string;
  content:
    | WrittenAnswerAIReview
    | RiskScenarioAIReview
    | PrivacyAssessmentAIReview
    | SecureCodeAIExplanation;
};

export function SpecializedAIReview({
  request,
  disabled = false,
}: {
  request: SpecializedAIRequest;
  disabled?: boolean;
}) {
  const [result, setResult] = useState<SpecializedAIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generate() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/specialized", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await response.json()) as {
        result?: SpecializedAIResponse;
        error?: string;
      };
      if (!response.ok || !payload.result) {
        setMessage(payload.error ?? "AI 보조 검토를 생성하지 못했습니다.");
        return;
      }
      setResult(payload.result);
    } catch {
      setMessage("AI 보조 검토를 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="specialized-ai-review">
      <button
        className="button button-ghost"
        type="button"
        disabled={disabled || loading}
        onClick={() => void generate()}
      >
        {loading
          ? "AI 보조 검토 생성 중…"
          : result
            ? "AI 보조 검토 다시 생성"
            : "AI 보조 검토"}
      </button>
      <p className="sample-notice">
        공식 점수나 관리자 채점 결과를 변경하지 않는 참고용 보조 기능입니다.
      </p>
      {message ? (
        <p className="form-message error-state" role="alert">
          {message}
        </p>
      ) : null}
      {result ? <SpecializedAIResultView result={result} /> : null}
    </section>
  );
}

function SpecializedAIResultView({
  result,
}: {
  result: SpecializedAIResponse;
}) {
  const mock = result.provider === "mock";
  return (
    <section
      className={`ai-explanation-panel specialized-ai-result ${mock ? "ai-mock" : ""}`}
      aria-live="polite"
    >
      <div className="ai-explanation-heading">
        <div>
          <p className="eyebrow">
            {mock ? "AI 특화 검토 미리보기" : "AI 특화 검토"}
          </p>
          <h3>{targetLabel(result.targetType)}</h3>
        </div>
        <span className="status-badge">{result.status}</span>
      </div>
      <p className="ai-disclaimer">{result.disclaimer}</p>
      {result.targetType === "WRITTEN_ANSWER" ? (
        <WrittenResult
          content={result.content as WrittenAnswerAIReview}
        />
      ) : null}
      {result.targetType === "RISK_SCENARIO" ? (
        <RiskResult content={result.content as RiskScenarioAIReview} />
      ) : null}
      {result.targetType === "PRIVACY_ASSESSMENT" ? (
        <PrivacyResult
          content={result.content as PrivacyAssessmentAIReview}
        />
      ) : null}
      {result.targetType === "SECURE_CODE" ? (
        <CodeResult content={result.content as SecureCodeAIExplanation} />
      ) : null}
      <small>
        {formatSpecializedAIProviderLabel(result.provider)} · {result.model} · 검수 상태{" "}
        {result.reviewStatus}
      </small>
    </section>
  );
}

function formatSpecializedAIProviderLabel(
  provider: SpecializedAIResponse["provider"],
) {
  return provider === "mock" ? "시범 AI" : "AI 생성";
}

function WrittenResult({ content }: { content: WrittenAnswerAIReview }) {
  return (
    <div className="ai-explanation-sections">
      <Fact
        label="예상 점수 범위"
        value={`${content.expectedScoreRange.minimum}~${content.expectedScoreRange.maximum}점`}
      />
      <List label="포함된 핵심 키워드" values={content.includedKeywords} />
      <List label="누락 키워드" values={content.missingKeywords} />
      <List label="잘된 점" values={content.strengths} />
      <List label="개선할 점" values={content.improvements} />
      <Fact label="예시 답안" value={content.exampleAnswer} />
      <Evidence values={content.evidence} />
    </div>
  );
}

function RiskResult({ content }: { content: RiskScenarioAIReview }) {
  return (
    <div className="ai-explanation-sections">
      <Fact label="자산 확인" value={content.assetReview} />
      <Fact label="위협 확인" value={content.threatReview} />
      <Fact label="취약점 확인" value={content.vulnerabilityReview} />
      <Fact label="시나리오 완성도" value={content.completeness} />
      <List label="누락 요소" values={content.missingElements} />
      <List label="위험 처리방안" values={content.treatmentOptions} />
      <Evidence values={content.evidence} />
    </div>
  );
}

function PrivacyResult({
  content,
}: {
  content: PrivacyAssessmentAIReview;
}) {
  return (
    <div className="ai-explanation-sections">
      <List
        label="평가 항목 누락"
        values={content.missingAssessmentItems}
      />
      <Fact label="개인정보 흐름 검토" value={content.flowReview} />
      <Fact label="위험요인 검토" value={content.riskReview} />
      <List label="개선방안" values={content.improvements} />
      <List
        label="관련 평가 항목"
        values={content.relatedAssessmentItems}
      />
      <Fact label="기준일" value={content.referenceDate} />
      <Evidence values={content.evidence} />
    </div>
  );
}

function CodeResult({ content }: { content: SecureCodeAIExplanation }) {
  return (
    <div className="ai-explanation-sections">
      <Fact
        label="보안약점 분류"
        value={content.weaknessClassification}
      />
      <List label="CWE 연계" values={content.cweLinks} />
      <div>
        <h4>취약 라인 설명</h4>
        {content.vulnerableLineExplanations.length ? (
          <ul className="ai-reason-list">
            {content.vulnerableLineExplanations.map((item, index) => (
              <li key={`${item.lines.join("-")}-${index}`}>
                {item.lines.join(", ") || "라인 미지정"}: {item.explanation}
              </li>
            ))}
          </ul>
        ) : (
          <p>확인된 취약 라인 설명이 없습니다.</p>
        )}
      </div>
      <Fact label="발생 원인" value={content.rootCause} />
      <div>
        <h4>안전한 코드 예시</h4>
        <pre className="ai-code-example">
          <code>{content.secureCodeExample}</code>
        </pre>
      </div>
      <Fact
        label="오탐 가능성"
        value={content.falsePositiveAssessment}
      />
      <List label="관련 이론" values={content.relatedTheory} />
      <Evidence values={content.evidence} />
      <p className="sample-notice">코드 실행 여부: 실행하지 않음</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h4>{label}</h4>
      <p>{value || "확인된 내용이 없습니다."}</p>
    </div>
  );
}

function List({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <h4>{label}</h4>
      {values.length ? (
        <ul className="ai-reason-list">
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>없음</p>
      )}
    </div>
  );
}

function Evidence({ values }: { values: AIEvidence[] }) {
  return (
    <details className="ai-source-details">
      <summary>근거 콘텐츠</summary>
      {values.length ? (
        <ul>
          {values.map((item) => (
            <li key={item.id}>
              {item.title} <span>({item.kind})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>표시할 검수 근거가 없습니다.</p>
      )}
    </details>
  );
}

function targetLabel(targetType: SpecializedAIRequest["targetType"]) {
  switch (targetType) {
    case "WRITTEN_ANSWER":
      return "서술형 AI 보조채점";
    case "RISK_SCENARIO":
      return "ISRM 위험 시나리오 검토";
    case "PRIVACY_ASSESSMENT":
      return "개인정보 영향평가 검토";
    case "SECURE_CODE":
      return "보안약점 코드 설명";
  }
}
