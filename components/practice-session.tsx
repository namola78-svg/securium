"use client";

import { useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/state-ui";
import { publicCopy } from "@/lib/public-copy";
import {
  formatAIExplanationStatusLabel,
  formatDifficultyLabel,
  formatQuestionTypeLabel,
} from "@/lib/question-display";

type PublicQuestion = {
  id: string;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  courseId: string;
  automaticGradingAvailable: boolean;
  choices: Array<{
    id: string;
    content: string;
    displayOrder: number;
  }>;
};

type GradeResponse = {
  result: {
    isCorrect: boolean;
    score: number;
    explanation: string;
    wrongAnswerExplanation: string;
    correctAnswer: string[];
    explanationVersion: {
      contentDate: string | null;
      version: string | null;
      reviewedAt: string | null;
    };
  };
};

type AIExplanationResult = {
  provider: "mock" | "openai";
  model: string;
  generatedAt: string;
  sourceContextIds: string[];
  disclaimer: string;
  reviewed: boolean;
  requestId: string;
  latencyMs: number;
  status:
    | "generated"
    | "failed"
    | "insufficient_context"
    | "reviewed"
    | "rejected";
  content: {
    intent: string;
    correctReason: string;
    wrongReasons: Array<{
      choiceId: string;
      choice: string;
      reason: string;
    }>;
    relatedStandards: string[];
    relatedLaws: string[];
    memorySummary: string;
    similarQuestions: Array<{ id: string; title: string }>;
    internalSources: Array<{ id: string; title: string; kind: string }>;
  };
};

export function PracticeSession({
  questions,
  courseId,
}: {
  questions: PublicQuestion[];
  courseId: string;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, GradeResponse["result"]>>(
    {},
  );
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<
    Record<string, AIExplanationResult>
  >({});
  const submittingRef = useRef(false);
  const idempotencyKeysRef = useRef<Record<string, string>>({});
  const question = questions[index];
  const selected = question ? (answers[question.id] ?? []) : [];
  const completed = Object.keys(results).length;
  const accuracy = useMemo(() => {
    const values = Object.values(results);
    return values.length
      ? Math.round(
          (values.filter((result) => result.isCorrect).length / values.length) *
            100,
        )
      : 0;
  }, [results]);

  if (!questions.length) {
    return (
      <EmptyState
        title="조건에 맞는 공개 문제가 없습니다"
        description="필터를 바꾸거나 공개 문제가 추가된 뒤 다시 시도해 주세요."
        action={{ label: "다시 시도", onClick: () => window.location.reload() }}
      />
    );
  }

  if (finished) {
    return (
      <section className="practice-card practice-finish">
        <p className="eyebrow">풀이 완료</p>
        <h2>학습 세션이 종료되었습니다.</h2>
        <div className="practice-summary">
          <strong>{completed}</strong>
          <span>풀이 완료</span>
          <strong>{accuracy}%</strong>
          <span>정답률</span>
        </div>
        <button className="button button-dark" onClick={() => setFinished(false)}>
          결과 다시 보기
        </button>
      </section>
    );
  }

  function setSingle(value: string) {
    if (!question || results[question.id]) return;
    setAnswers((current) => ({ ...current, [question.id]: [value] }));
  }

  function toggleMultiple(value: string) {
    if (!question || results[question.id]) return;
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setAnswers((current) => ({ ...current, [question.id]: next }));
  }

  async function submit() {
    if (
      !question ||
      !selected.length ||
      results[question.id] ||
      submittingRef.current
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    const idempotencyKey =
      idempotencyKeysRef.current[question.id] ?? crypto.randomUUID();
    idempotencyKeysRef.current[question.id] = idempotencyKey;
    try {
      const response = await fetch("/api/question-attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          courseId,
          answer: question.type === "MULTIPLE_CHOICE" ? selected : selected[0],
          responseTime: 0,
          idempotencyKey,
        }),
      });
      const payload = (await response.json()) as
        | GradeResponse
        | { error?: string };
      if (!response.ok || !("result" in payload)) {
        setMessage(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "답안을 제출하지 못했습니다.",
        );
        return;
      }
      setResults((current) => ({
        ...current,
        [question.id]: payload.result,
      }));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function bookmark() {
    if (!question) return;
    const response = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: "QUESTION",
        targetId: question.id,
        courseId,
      }),
    });
    const payload = (await response.json()) as { bookmarked?: boolean };
    setMessage(
      response.ok
        ? payload.bookmarked
          ? "즐겨찾기에 추가했습니다."
          : "즐겨찾기에서 제거했습니다."
        : "즐겨찾기를 변경하지 못했습니다.",
    );
  }

  async function requestAIExplanation() {
    if (!question || !result || aiLoading) return;
    setAiLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/question-explanations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          courseId,
        }),
      });
      const payload = (await response.json()) as
        | { result: AIExplanationResult }
        | { error?: string };
      if (!response.ok || !("result" in payload)) {
        setMessage(
          "error" in payload && payload.error
            ? payload.error
            : "AI 참고 해설을 불러오지 못했습니다.",
        );
        return;
      }
      setAiExplanations((current) => ({
        ...current,
        [question.id]: payload.result,
      }));
    } catch {
      setMessage("AI 참고 해설을 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  async function report(formData: FormData) {
    if (!question) return;
    const response = await fetch("/api/question-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        reason: formData.get("reason"),
        content: formData.get("content"),
      }),
    });
    setMessage(
      response.ok
        ? "신고를 접수했습니다. 검토 후 필요한 경우 반영됩니다."
        : "신고를 접수하지 못했습니다.",
    );
  }

  const result = results[question.id];
  const remaining = Math.max(questions.length - completed, 0);
  return (
    <section className="practice-card">
      <div className="practice-session-brief" aria-label="문제풀이 진행 요약">
        <div>
          <p className="eyebrow">풀이 안내</p>
          <strong>답안 선택 → 자동 채점 → 검수 해설 → AI 근거 순서로 학습합니다.</strong>
          <span>
            답안을 제출하면 채점 결과와 검수 해설을 확인할 수 있습니다. AI 참고
            해설은 채점 이후 요청할 수 있으며 공식 채점 결과가 아닙니다.
          </span>
        </div>
        <dl>
          <div>
            <dt>완료</dt>
            <dd>{completed}문항</dd>
          </div>
          <div>
            <dt>남은 문제</dt>
            <dd>{remaining}문항</dd>
          </div>
          <div>
            <dt>AI 해설</dt>
            <dd>{result ? "요청 가능" : "제출 후 가능"}</dd>
          </div>
        </dl>
      </div>
      <ol className="practice-learning-flow" aria-label="문제풀이 학습 흐름">
        <li className={!result ? "is-current" : "is-done"}>
          <span>1</span>
          <strong>답안 선택</strong>
        </li>
        <li className={result ? "is-done" : ""}>
          <span>2</span>
          <strong>자동 채점</strong>
        </li>
        <li className={result ? "is-current" : ""}>
          <span>3</span>
          <strong>검수 해설</strong>
        </li>
        <li className={aiExplanations[question.id] ? "is-current" : ""}>
          <span>4</span>
          <strong>AI 근거</strong>
        </li>
      </ol>
      <div className="practice-toolbar">
        <span>
          {index + 1} / {questions.length}
        </span>
        <span>{formatDifficultyLabel(question.difficulty)}</span>
        <button type="button" className="text-link" onClick={bookmark}>
          즐겨찾기
        </button>
      </div>
      <div
        className="progress-track"
        aria-label={`풀이 진행률 ${Math.round(((index + 1) / questions.length) * 100)}%`}
      >
        <span
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>
      <p className="eyebrow">{formatQuestionTypeLabel(question.type)}</p>
      <h2>{publicCopy(question.title)}</h2>
      <p className="question-content">{publicCopy(question.content)}</p>

      {!question.automaticGradingAvailable ? (
        <div className="notice warning">
          이 문제 유형은 개설 예정입니다. 현재는 자동채점을 지원하지 않으며
          문제 본문만 확인할 수 있습니다.
        </div>
      ) : question.type === "SHORT_ANSWER" ? (
        <label className="answer-short">
          답안
          <input
            value={selected[0] ?? ""}
            disabled={Boolean(result)}
            onChange={(event) => setSingle(event.target.value)}
            maxLength={500}
          />
        </label>
      ) : (
        <div className="answer-choices">
          {question.choices.map((choice) => {
            const multiple = question.type === "MULTIPLE_CHOICE";
            return (
              <label key={choice.id}>
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`answer-${question.id}`}
                  value={choice.id}
                  checked={selected.includes(choice.id)}
                  disabled={Boolean(result)}
                  onChange={() =>
                    multiple
                      ? toggleMultiple(choice.id)
                      : setSingle(choice.id)
                  }
                />
                <span>{publicCopy(choice.content)}</span>
              </label>
            );
          })}
        </div>
      )}

      {result ? (
        <div
          className={`grade-panel ${result.isCorrect ? "grade-correct" : "grade-wrong"}`}
        >
          <div className="grade-panel-heading">
            <div>
              <p className="explanation-label">검수 해설</p>
              <strong>{result.isCorrect ? "정답입니다." : "오답입니다."}</strong>
            </div>
            <span>점수 {result.score}점</span>
          </div>
          {result.explanationVersion.version ? (
            <p className="muted-copy">
              기준일 {result.explanationVersion.contentDate ?? "미등록"} · 버전{" "}
              {result.explanationVersion.version} · 최신 검수일{" "}
              {result.explanationVersion.reviewedAt?.slice(0, 10) ?? "미등록"}
            </p>
          ) : (
            <p className="muted-copy">검수 정보가 등록되지 않았습니다.</p>
          )}
          <p className="grade-context-copy">
            아래 해설은 검수된 학습 콘텐츠입니다. AI 참고 해설은 이 해설을
            대체하지 않고 이해를 돕는 보조 설명으로만 표시됩니다.
          </p>
          <p>{publicCopy(result.explanation)}</p>
          {!result.isCorrect ? <p>{publicCopy(result.wrongAnswerExplanation)}</p> : null}
          <p>정답: {result.correctAnswer.map(publicCopy).join(", ")}</p>
        </div>
      ) : null}
      {result ? (
        <div className="ai-explanation-actions">
          <button
            className="button button-ghost"
            type="button"
            disabled={aiLoading || Boolean(aiExplanations[question.id])}
            onClick={requestAIExplanation}
          >
            {aiLoading
              ? "AI 참고 해설 생성 중"
              : aiExplanations[question.id]
                ? "AI 참고 해설 생성 완료"
                : "AI 근거 해설 보기"}
          </button>
          {aiExplanations[question.id] ? (
            <AIExplanationPanel result={aiExplanations[question.id]} />
          ) : null}
        </div>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
      <div className="practice-actions">
        <button
          className="button button-ghost"
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          이전 문제
        </button>
        {!result ? (
          <button
            className="button button-dark"
            type="button"
            disabled={
              submitting ||
              !selected.length ||
              !question.automaticGradingAvailable
            }
            onClick={submit}
          >
            {submitting ? "제출 중" : "답안 제출"}
          </button>
        ) : (
          <button
            className="button button-dark"
            type="button"
            onClick={() =>
              index === questions.length - 1
                ? setFinished(true)
                : setIndex((value) => value + 1)
            }
          >
            {index === questions.length - 1 ? "풀이 종료" : "다음 문제"}
          </button>
        )}
      </div>
      <details className="report-box">
        <summary>문제 신고</summary>
        <form action={report}>
          <select name="reason" defaultValue="WRONG_ANSWER">
            <option value="WRONG_ANSWER">정답 오류</option>
            <option value="WRONG_EXPLANATION">해설 오류</option>
            <option value="TYPO">오탈자</option>
            <option value="OUTDATED_STANDARD">오래된 법령 또는 기준</option>
            <option value="DUPLICATE">중복 문제</option>
            <option value="OTHER">기타</option>
          </select>
          <textarea name="content" maxLength={3000} placeholder="신고 내용을 입력하세요" />
          <button className="button button-ghost" type="submit">
            신고 접수
          </button>
        </form>
      </details>
    </section>
  );
}

function AIExplanationPanel({ result }: { result: AIExplanationResult }) {
  const isMock = result.provider === "mock";
  return (
    <section
      className={`ai-explanation-panel ${isMock ? "ai-mock" : ""}`}
      aria-labelledby={`ai-explanation-${result.requestId}`}
    >
      <div className="ai-explanation-heading">
        <div>
          <p className="eyebrow">{isMock ? "AI 해설 미리보기" : "AI 생성 해설"}</p>
          <h3 id={`ai-explanation-${result.requestId}`}>AI 참고 해설</h3>
        </div>
        <span className="status-badge">
          {formatAIExplanationStatusLabel(result.status)}
        </span>
      </div>
      <dl className="ai-trust-strip" aria-label="AI 해설 생성 정보">
        <div>
          <dt>제공 방식</dt>
          <dd>{formatAIProviderLabel(result.provider)}</dd>
        </div>
        <div>
          <dt>근거</dt>
          <dd>{result.sourceContextIds.length}개</dd>
        </div>
        <div>
          <dt>응답 시간</dt>
          <dd>{result.latencyMs}ms</dd>
        </div>
        <div>
          <dt>검수</dt>
          <dd>{result.reviewed ? "완료" : "미검수"}</dd>
        </div>
      </dl>
      <p className="ai-disclaimer">{result.disclaimer}</p>
      {result.status === "generated" || result.status === "reviewed" ? (
        <ol className="ai-explanation-map" aria-label="AI 해설 활용 순서">
          <li>
            <span>01</span>
            <strong>의도 확인</strong>
            <p>문제가 묻는 핵심 개념을 먼저 잡습니다.</p>
          </li>
          <li>
            <span>02</span>
            <strong>근거 확인</strong>
            <p>정답과 오답을 기준·법령·이론과 연결합니다.</p>
          </li>
          <li>
            <span>03</span>
            <strong>복습 연결</strong>
            <p>헷갈린 선택지는 오답노트와 취약 영역으로 이어집니다.</p>
          </li>
        </ol>
      ) : null}
      {result.status === "insufficient_context" ||
      result.status === "failed" ? (
        <p>{result.content.intent}</p>
      ) : (
        <div className="ai-explanation-sections">
          <div>
            <h4>문제 핵심 의도</h4>
            <p>{result.content.intent}</p>
          </div>
          <div>
            <h4>정답 이유</h4>
            <p>{result.content.correctReason}</p>
          </div>
          {result.content.wrongReasons.length ? (
            <div>
              <h4>오답 이유</h4>
              <ul className="ai-reason-list">
                {result.content.wrongReasons.map((item) => (
                  <li key={`${item.choiceId}-${item.choice}`}>
                    <strong>{item.choice}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h4>기억하기 쉬운 요약</h4>
            <p>{result.content.memorySummary}</p>
          </div>
          <div className="ai-reference-grid">
            <div>
              <h4>관련 기준</h4>
              <p>
                {result.content.relatedStandards.join(", ") ||
                  "검수된 관련 기준 없음"}
              </p>
            </div>
            <div>
              <h4>관련 법령</h4>
              <p>
                {result.content.relatedLaws.join(", ") ||
                  "검수된 관련 법령 없음"}
              </p>
            </div>
          </div>
          {result.content.similarQuestions.length ? (
            <div>
              <h4>유사 문제</h4>
              <ul className="ai-reason-list">
                {result.content.similarQuestions.map((item) => (
                  <li key={item.id}>{publicCopy(item.title)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
      <details className="ai-source-details">
        <summary>참고한 학습 근거</summary>
        {result.content.internalSources.length ? (
          <ul>
            {result.content.internalSources.map((source) => (
              <li key={source.id}>
                {publicCopy(source.title)} <span>({source.kind})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>표시할 검수 근거가 없습니다.</p>
        )}
      </details>
      {result.status === "generated" || result.status === "reviewed" ? (
        <div className="ai-next-action" role="note">
          <strong>다음 행동</strong>
          <p>
            요약을 한 문장으로 다시 말해보고, 틀린 선택지가 있었다면 오답노트에서
            같은 개념을 한 번 더 풀어보세요.
          </p>
        </div>
      ) : null}
      <small>
        {process.env.NODE_ENV !== "production"
          ? `${result.provider} · ${result.model} · 요청 ID ${result.requestId}`
          : "AI가 생성한 참고용 설명입니다."}
      </small>
    </section>
  );
}

function formatAIProviderLabel(provider: AIExplanationResult["provider"]) {
  return provider === "mock" ? "시범 AI" : "AI 생성";
}
