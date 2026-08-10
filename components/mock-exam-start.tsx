"use client";

import { useRef, useState } from "react";

export function MockExamStart({ mockExamId }: { mockExamId: string }) {
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  async function start() {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setMessage("");
    try {
      const response = await fetch("/api/mock-exams/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mockExamId }),
      });
      const payload = (await response.json()) as { attempt?: { id: string }; error?: string };
      if (!response.ok || !payload.attempt) {
        setMessage(payload.error || "시험을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      window.location.href = `/mock-exams/attempts/${payload.attempt.id}`;
    } catch {
      setMessage("네트워크 오류가 발생했습니다. 연결을 확인하고 다시 시도해주세요.");
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  return (
    <div>
      <button className="button button-dark" type="button" disabled={starting} aria-busy={starting} onClick={start}>
        {starting ? "시험 준비 중..." : "시험 시작"}
      </button>
      {message ? <p className="form-message" role="alert">{message}</p> : null}
    </div>
  );
}
