"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ExamQuestion = {
  id: string;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  answerData: string;
  isCorrect?: boolean | null;
  earnedScore?: number | null;
  possibleScore: number;
  explanation?: string;
  wrongAnswerExplanation?: string;
  correctAnswer?: string[];
  choices: Array<{ id: string; content: string }>;
};

export function MockExamSession({
  attempt,
}: {
  attempt: {
    id: string;
    title: string;
    expiresAt: string;
    status: string;
    resultsAvailable: boolean;
    score: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    analysis?: {
      bySubject: Array<{ id: string; name: string; total: number; accuracy: number }>;
      byTopic: Array<{ id: string; name: string; total: number; accuracy: number }>;
    };
    questions: ExamQuestion[];
  };
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      attempt.questions.map((question) => {
        try {
          const value = JSON.parse(question.answerData || '""');
          return [question.id, Array.isArray(value) ? value : value ? [value] : []];
        } catch {
          return [question.id, []];
        }
      }),
    ),
  );
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const submitted = attempt.status !== "IN_PROGRESS";
  const question = attempt.questions[index];
  const selected = answers[question.id] ?? [];
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.length).length,
    [answers],
  );

  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [submitted]);

  useEffect(() => {
    if (!submitted && remaining === 0) void submit(true);
    // submit is intentionally triggered only when the server-derived timer reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, submitted]);

  async function save(next: string[]) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [question.id]: next }));
    const response = await fetch("/api/mock-exams/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: attempt.id,
        questionId: question.id,
        answer: question.type === "MULTIPLE_CHOICE" ? next : (next[0] ?? ""),
      }),
    });
    setMessage(response.ok ? "답안이 저장되었습니다." : "답안을 저장하지 못했습니다.");
  }

  async function submit(auto = false) {
    if (submittingRef.current || submitted) return;
    if (!auto && !window.confirm("시험을 제출하시겠습니까? 제출 후 답안을 변경할 수 없습니다.")) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/mock-exams/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id }),
      });
      if (!response.ok && !auto) {
        const payload = (await response.json()) as { error?: string };
        setMessage(
          typeof payload.error === "string"
            ? payload.error
            : "시험을 제출하지 못했습니다.",
        );
        return;
      }
      window.location.reload();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return (
    <section className="exam-shell">
      <header className="exam-header">
        <div>
          <p className="eyebrow">모의고사</p>
          <h1>{attempt.title}</h1>
        </div>
        {submitted && attempt.resultsAvailable ? (
          <div className="exam-score">
            <strong>{attempt.score}점</strong>
            <span>
              정답 {attempt.correctCount} · 오답 {attempt.wrongCount} · 미응답{" "}
              {attempt.unansweredCount}
            </span>
          </div>
        ) : (
          <div className="exam-timer" aria-label="남은 시간">
            {minutes}:{seconds}
          </div>
        )}
      </header>
      <nav className="exam-question-nav" aria-label="문제 이동">
        {attempt.questions.map((item, itemIndex) => (
          <button
            key={item.id}
            className={`${itemIndex === index ? "current" : ""} ${
              answers[item.id]?.length ? "answered" : ""
            }`}
            onClick={() => setIndex(itemIndex)}
          >
            {itemIndex + 1}
          </button>
        ))}
      </nav>
      <article className="practice-card">
        <div className="practice-toolbar">
          <span>
            {index + 1} / {attempt.questions.length}
          </span>
          <span>{question.difficulty}</span>
        </div>
        <p className="eyebrow">{question.type.replaceAll("_", " ")}</p>
        <h2>{question.title}</h2>
        <p className="question-content">{question.content}</p>
        {question.type === "SHORT_ANSWER" ? (
          <input
            value={selected[0] ?? ""}
            disabled={submitted}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [question.id]: [event.target.value],
              }))
            }
            onBlur={() => void save(selected)}
          />
        ) : (
          <div className="answer-choices">
            {question.choices.map((choice) => {
              const multiple = question.type === "MULTIPLE_CHOICE";
              return (
                <label key={choice.id}>
                  <input
                    type={multiple ? "checkbox" : "radio"}
                    name={`exam-${question.id}`}
                    checked={selected.includes(choice.id)}
                    disabled={submitted}
                    onChange={() =>
                      void save(
                        multiple
                          ? selected.includes(choice.id)
                            ? selected.filter((id) => id !== choice.id)
                            : [...selected, choice.id]
                          : [choice.id],
                      )
                    }
                  />
                  <span>{choice.content}</span>
                </label>
              );
            })}
          </div>
        )}
        {submitted && attempt.resultsAvailable ? (
          <div className={question.isCorrect ? "grade-panel grade-correct" : "grade-panel grade-wrong"}>
            <strong>{question.isCorrect ? "정답" : question.answerData ? "오답" : "미응답"}</strong>
            <p>
              {question.earnedScore ?? 0} / {question.possibleScore}점
            </p>
            <p>{question.explanation}</p>
            {!question.isCorrect ? <p>{question.wrongAnswerExplanation}</p> : null}
            <p>정답: {question.correctAnswer?.join(", ")}</p>
          </div>
        ) : submitted ? (
          <div className="grade-panel">
            <strong>결과 공개 전</strong>
            <p>관리자가 설정한 결과 공개 시점 이후에 채점 결과와 해설을 확인할 수 있습니다.</p>
          </div>
        ) : null}
        <div className="practice-actions">
          <button
            className="button button-ghost"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            이전
          </button>
          <button
            className="button button-ghost"
            disabled={index === attempt.questions.length - 1}
            onClick={() =>
              setIndex((value) => Math.min(attempt.questions.length - 1, value + 1))
            }
          >
            다음
          </button>
        </div>
      </article>
      <footer className="exam-footer">
        <span>
          응답 {answeredCount} / {attempt.questions.length}
        </span>
        {!submitted ? (
          <button
            className="button button-dark"
            disabled={submitting}
            onClick={() => void submit(false)}
          >
            {submitting ? "제출 중…" : "제출 확인"}
          </button>
        ) : null}
        {message ? <span className="form-message">{message}</span> : null}
      </footer>
      {submitted && attempt.resultsAvailable && attempt.analysis ? (
        <section className="analytics-grid section-block">
          <ExamBreakdown title="과목별 분석" rows={attempt.analysis.bySubject} />
          <ExamBreakdown title="주제별 분석" rows={attempt.analysis.byTopic} />
        </section>
      ) : null}
    </section>
  );
}

function ExamBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; name: string; total: number; accuracy: number }>;
}) {
  return (
    <article className="admin-panel">
      <h2>{title}</h2>
      {rows.length ? (
        rows.map((row) => (
          <div className="analytics-row" key={row.id}>
            <span>{row.name}</span>
            <div className="analytics-bar">
              <i style={{ width: `${row.accuracy}%` }} />
            </div>
            <strong>{row.accuracy}%</strong>
          </div>
        ))
      ) : (
        <p>분석할 학습 기록이 아직 충분하지 않습니다.</p>
      )}
    </article>
  );
}
