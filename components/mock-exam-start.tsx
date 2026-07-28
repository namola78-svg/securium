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
    try {
      const response = await fetch("/api/mock-exams/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mockExamId }),
      });
      const payload = (await response.json()) as {
        attempt?: { id: string };
        error?: string;
      };
      if (!response.ok || !payload.attempt) {
        setMessage(
          typeof payload.error === "string"
            ? payload.error
            : "시험을 시작하지 못했습니다.",
        );
        return;
      }
      window.location.href = `/mock-exams/attempts/${payload.attempt.id}`;
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }
  return (
    <>
      <button
        className="button button-dark"
        type="button"
        disabled={starting}
        onClick={start}
      >
        {starting ? "시험을 여는 중…" : "시험 시작"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </>
  );
}
