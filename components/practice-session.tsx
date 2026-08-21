"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceCard } from "@/components/evidence-card";
import { EmptyState } from "@/components/state-ui";
import styles from "@/components/v2/practice-v2.module.css";
import { publicCopy } from "@/lib/public-copy";
import {
  formatAIExplanationStatusLabel,
  formatDifficultyLabel,
  formatQuestionTypeLabel,
} from "@/lib/question-display";

type PublicQuestion = {
  id: string;
  questionVersionId: string | null;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  courseId: string;
  automaticGradingAvailable: boolean;
  choices: Array<{ id: string; content: string; displayOrder: number }>;
};
type GradeResult = {
  isCorrect: boolean;
  score: number;
  explanation: string;
  wrongAnswerExplanation: string;
  correctAnswer: string[];
  explanationVersion: { contentDate: string | null; version: string | null; reviewedAt: string | null };
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
  status: "generated" | "failed" | "insufficient_context" | "reviewed" | "rejected";
  content: {
    intent: string;
    correctReason: string;
    wrongReasons: Array<{ choiceId: string; choice: string; reason: string }>;
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
  courseName,
}: {
  questions: PublicQuestion[];
  courseId: string;
  courseName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<Record<string, GradeResult>>({});
  const [bookmarkStates, setBookmarkStates] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, AIExplanationResult>>({});
  const submittingRef = useRef(false);
  const idempotencyKeysRef = useRef<Record<string, string>>({});
  const question = questions[index];
  const selected = question ? answers[question.id] ?? [] : [];
  const result = question ? results[question.id] : undefined;
  const completed = Object.keys(results).length;
  const accuracy = useMemo(() => {
    const values = Object.values(results);
    return values.length
      ? Math.round((values.filter((item) => item.isCorrect).length / values.length) * 100)
      : 0;
  }, [results]);

  useEffect(() => {
    if (!result || !question) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`practice-result-${question.id}`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [question, result]);

  if (!questions.length) {
    return <EmptyState title="풀 수 있는 공개 문제가 없습니다" description="필터를 바꾸거나 과정의 공개 콘텐츠를 확인해보세요." action={{ label: "다시 시도", onClick: () => window.location.reload() }} />;
  }

  if (finished) {
    return (
      <section className={styles.finish} aria-labelledby="practice-finish-title">
        <p className={styles.eyebrow}>세션 완료</p>
        <h2 id="practice-finish-title">문제풀이를 마쳤습니다</h2>
        <dl><div><dt>완료 문제</dt><dd>{completed}</dd></div><div><dt>정답률</dt><dd>{accuracy}%</dd></div></dl>
        <p>결과를 다시 확인하거나 오답노트에서 틀린 문제를 복습할 수 있습니다.</p>
        <div className={styles.finishActions}>
          <button type="button" onClick={() => setFinished(false)}>결과 다시 보기</button>
          <Link href="/wrong-notes">오답노트 보기</Link>
        </div>
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
    if (!question || !selected.length || results[question.id] || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    const idempotencyKey = idempotencyKeysRef.current[question.id] ?? crypto.randomUUID();
    idempotencyKeysRef.current[question.id] = idempotencyKey;
    try {
      const response = await fetch("/api/question-attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          questionVersionId: question.questionVersionId,
          courseId,
          answer: question.type === "MULTIPLE_CHOICE" ? selected : selected[0],
          responseTime: 0,
          idempotencyKey,
        }),
      });
      const payload = (await response.json()) as { result?: GradeResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "SUBMIT_FAILED");
      setResults((current) => ({ ...current, [question.id]: payload.result! }));
    } catch (error) {
      setMessage(error instanceof Error && error.message !== "SUBMIT_FAILED"
        ? error.message
        : "답안을 제출하지 못했습니다. 잠시 후 다시 시도해주세요.");
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
      body: JSON.stringify({ targetType: "QUESTION", targetId: question.id, courseId }),
    });
    const payload = (await response.json()) as { bookmarked?: boolean };
    if (response.ok && typeof payload.bookmarked === "boolean") {
      setBookmarkStates((current) => ({ ...current, [question.id]: payload.bookmarked! }));
    }
    setMessage(response.ok
      ? payload.bookmarked ? "북마크에 추가했습니다." : "북마크에서 삭제했습니다."
      : "북마크를 변경하지 못했습니다.");
  }

  async function requestAIExplanation() {
    if (!question || !result || aiLoading || aiExplanations[question.id]) return;
    setAiLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/ai/question-explanations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, courseId }),
      });
      const payload = (await response.json()) as { result?: AIExplanationResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "AI_EXPLANATION_FAILED");
      setAiExplanations((current) => ({ ...current, [question.id]: payload.result! }));
    } catch {
      setMessage("AI 참고 설명을 불러오지 못했습니다. 공식 해설을 먼저 확인해주세요.");
    } finally {
      setAiLoading(false);
    }
  }

  async function report(formData: FormData) {
    if (!question) return;
    const response = await fetch("/api/question-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: question.id, reason: formData.get("reason"), content: formData.get("content") }),
    });
    setMessage(response.ok
      ? "신고를 접수했습니다. 검토가 필요한 경우 반영하겠습니다."
      : "신고를 접수하지 못했습니다.");
  }

  function goNext() {
    if (index === questions.length - 1) setFinished(true);
    else setIndex((value) => value + 1);
  }

  const questionNumber = index + 1;
  const progress = Math.round((questionNumber / questions.length) * 100);
  const aiExplanation = aiExplanations[question.id];

  return (
    <section className={styles.session} data-practice-session-v2="">
      <header className={styles.sessionTopbar}>
        <div>
          <span>{courseName ?? "학습 문제"}</span>
          <strong>문제 {questionNumber} / {questions.length}</strong>
        </div>
        <div className={styles.sessionProgress} role="progressbar" aria-label="문제 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${questionNumber}/${questions.length} 문제`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <button className={styles.bookmarkButton} type="button" onClick={bookmark} aria-pressed={Boolean(bookmarkStates[question.id])}>
          {bookmarkStates[question.id] ? "북마크 저장됨" : "북마크"}
        </button>
      </header>

      <div className={styles.questionMeta}>
        <span>Q{questionNumber}</span>
        <span>{formatQuestionTypeLabel(question.type)}</span>
        <span>{formatDifficultyLabel(question.difficulty)}</span>
      </div>
      <h1 className={styles.questionTitle}>{publicCopy(question.title)}</h1>
      <p className={styles.questionBody}>{publicCopy(question.content)}</p>

      {!question.automaticGradingAvailable ? (
        <div className={styles.notice}>이 문제 유형은 자동 채점을 지원하지 않습니다. 답안 제출 기록만 저장됩니다.</div>
      ) : question.type === "SHORT_ANSWER" ? (
        <label className={styles.shortAnswer}>
          <span>답안 입력</span>
          <input value={selected[0] ?? ""} disabled={Boolean(result)} onChange={(event) => setSingle(event.target.value)} maxLength={500} />
        </label>
      ) : (
        <fieldset className={styles.choiceFieldset}>
          <legend>답안 선택</legend>
          <div className={styles.choiceList}>
            {question.choices.map((choice, choiceIndex) => {
              const multiple = question.type === "MULTIPLE_CHOICE";
              const chosen = selected.includes(choice.id);
              const correct = Boolean(result?.correctAnswer.some((answer) =>
                answer === choice.id || publicCopy(answer) === publicCopy(choice.content)
              ));
              const state = result
                ? correct ? "correct" : chosen ? "incorrect" : "disabled"
                : chosen ? "selected" : "default";
              return (
                <label className={styles.choice} data-state={state} key={choice.id}>
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={`answer-${question.id}`}
                    value={choice.id}
                    checked={chosen}
                    disabled={Boolean(result)}
                    onChange={() => multiple ? toggleMultiple(choice.id) : setSingle(choice.id)}
                  />
                  <span className={styles.choiceIndex} aria-hidden="true">{String.fromCharCode(65 + choiceIndex)}</span>
                  <span className={styles.choiceText}>{publicCopy(choice.content)}</span>
                  {result && correct ? <strong>정답</strong> : null}
                  {result && chosen && !correct ? <strong>선택한 오답</strong> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {message ? <p className={styles.message} role="alert" aria-live="assertive">{message}</p> : null}

      {!result ? (
        <div className={styles.submitBar}>
          <button className={styles.previousButton} type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>이전 문제</button>
          <button className={styles.submitButton} type="button" disabled={submitting || !selected.length} aria-busy={submitting} onClick={submit}>
            {submitting ? "제출 중…" : question.automaticGradingAvailable ? "정답 확인" : "답안 저장"}
          </button>
        </div>
      ) : (
        <div className={styles.explanationFlow}>
          <GradePanel result={result} question={question} />

          <div className={styles.explanationActions}>
            {!result.isCorrect ? <Link href="/wrong-notes">오답노트 보기</Link> : null}
            <button type="button" disabled={aiLoading || Boolean(aiExplanation)} onClick={requestAIExplanation}>
              {aiLoading ? "AI 설명 생성 중" : aiExplanation ? "AI 설명 확인 완료" : "AI에게 추가 설명 요청"}
            </button>
          </div>
          {aiExplanation ? <AIExplanationPanel result={aiExplanation} /> : null}

          <button className={styles.nextButton} type="button" onClick={goNext}>
            {index === questions.length - 1 ? "세션 결과 보기" : "다음 문제"}
          </button>
        </div>
      )}

      <details className={styles.reportBox}>
        <summary>문제 신고</summary>
        <form action={report}>
          <label className={styles.visuallyHidden} htmlFor={`report-reason-${question.id}`}>신고 사유</label>
          <select id={`report-reason-${question.id}`} name="reason" defaultValue="WRONG_ANSWER"><option value="WRONG_ANSWER">정답 오류</option><option value="WRONG_EXPLANATION">해설 오류</option><option value="TYPO">오탈자</option><option value="OUTDATED_STANDARD">기준 변경</option><option value="DUPLICATE">중복 문제</option><option value="OTHER">기타</option></select>
          <textarea aria-label="신고 내용" name="content" maxLength={3000} placeholder="문제의 어떤 부분이 이상한지 설명해주세요." />
          <button type="submit">신고 접수</button>
        </form>
      </details>
    </section>
  );
}

function GradePanel({ result, question }: { result: GradeResult; question: PublicQuestion }) {
  const correctAnswer = result.correctAnswer.map((answer) => {
    const choice = question.choices.find((item) => item.id === answer);
    return publicCopy(choice?.content ?? answer);
  }).join(", ");

  return (
    <section className={`${styles.gradePanel} ${result.isCorrect ? styles.correct : styles.incorrect}`} role="status" aria-live="polite" aria-labelledby={`practice-result-${question.id}`}>
      <header>
        <span aria-hidden="true">{result.isCorrect ? "✓" : "!"}</span>
        <div>
          <p>채점 결과</p>
          <h2 id={`practice-result-${question.id}`} tabIndex={-1}>{result.isCorrect ? "정답입니다" : "다시 확인할 문제입니다"}</h2>
        </div>
      </header>
      <div className={styles.answerSummary}><span>정답</span><strong>{correctAnswer}</strong></div>
      <section className={styles.officialExplanation}>
        <p className={styles.eyebrow}>공식 해설</p>
        <h3>왜 이 답이 정답인가</h3>
        <p>{publicCopy(result.explanation)}</p>
      </section>
      {!result.isCorrect && result.wrongAnswerExplanation ? (
        <section className={styles.wrongExplanation}>
          <h3>왜 틀렸는지 확인하기</h3>
          <p>{publicCopy(result.wrongAnswerExplanation)}</p>
        </section>
      ) : null}
      <details className={styles.evidenceDisclosure}>
        <summary>공식 근거와 검수 정보</summary>
        <EvidenceCard compact evidence={{
          title: "문항 공식 해설",
          kind: "검수 콘텐츠",
          date: result.explanationVersion.reviewedAt?.slice(0, 10),
          reference: result.explanationVersion.version
            ? `해설 버전 ${result.explanationVersion.version}`
            : "검수 버전 확인 필요",
        }} />
      </details>
    </section>
  );
}

function AIExplanationPanel({ result }: { result: AIExplanationResult }) {
  const isMock = result.provider === "mock";
  return (
    <section className={styles.aiPanel} aria-labelledby={`ai-explanation-${result.requestId}`}>
      <header>
        <div><p className={styles.eyebrow}>AI 보조 설명</p><h3 id={`ai-explanation-${result.requestId}`}>추가로 이해하기</h3></div>
        <span>{formatAIExplanationStatusLabel(result.status)}</span>
      </header>
      <p className={styles.aiDisclaimer}>{result.disclaimer}</p>
      {result.status === "generated" || result.status === "reviewed" ? (
        <div className={styles.aiSections}>
          <section><h4>핵심 의도</h4><p>{result.content.intent}</p></section>
          <section><h4>정답 이유</h4><p>{result.content.correctReason}</p></section>
          {result.content.wrongReasons.length ? <section><h4>선택지별 참고</h4><ul>{result.content.wrongReasons.map((item) => <li key={`${item.choiceId}-${item.choice}`}><strong>{item.choice}</strong> {item.reason}</li>)}</ul></section> : null}
          <section><h4>기억하기</h4><p>{result.content.memorySummary}</p></section>
        </div>
      ) : <p>{result.content.intent}</p>}
      <details className={styles.aiSources}>
        <summary>AI가 참고한 학습 근거</summary>
        {result.content.internalSources.length ? <ul>{result.content.internalSources.map((source) => <li key={source.id}>{publicCopy(source.title)} <span>({source.kind})</span></li>)}</ul> : <p>표시할 학습 근거가 없습니다.</p>}
      </details>
      <small>{isMock ? "미리보기 설명이며 공식 해설을 대체하지 않습니다." : "AI 생성 설명이며 공식 해설을 대체하지 않습니다."}</small>
    </section>
  );
}
