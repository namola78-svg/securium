"use client";

import { useEffect, useState } from "react";

export function LessonActions({
  lessonId,
  initialStatus,
  initialLastPosition,
  completionPolicy,
}: {
  lessonId: string;
  initialStatus: string;
  initialLastPosition: number;
  completionPolicy: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [lastPosition, setLastPosition] = useState(initialLastPosition);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function complete() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/lessons/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, action: "COMPLETE", lastPosition }),
      });
      const payload = (await response.json()) as {
        result?: { status: string; lastPosition: number };
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "레슨 진도를 저장하지 못했습니다.");
        return;
      }
      if (payload.result?.status) setStatus(payload.result.status);
      if (typeof payload.result?.lastPosition === "number") {
        setLastPosition(payload.result.lastPosition);
      }
      setMessage("레슨 완료를 저장했습니다. 같은 요청은 중복 집계되지 않습니다.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    function recordPosition() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const position =
        scrollable <= 0
          ? 10000
          : Math.min(10000, Math.max(0, Math.round((window.scrollY / scrollable) * 10000)));
      setLastPosition((current) => Math.max(current, position));
    }
    window.addEventListener("scroll", recordPosition, { passive: true });
    recordPosition();
    return () => window.removeEventListener("scroll", recordPosition);
  }, [lessonId]);

  const scrollRequired = completionPolicy === "SCROLL_END" && lastPosition < 10000;
  const progressPercent = Math.round(lastPosition / 100);
  const statusLabel =
    status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "학습 중" : "시작 전";
  return (
    <div className="lesson-actions">
      <span className={`lesson-status lesson-status-${status.toLowerCase()}`}>{statusLabel}</span>
      <span
        className="lesson-reading-progress"
        role="progressbar"
        aria-label="현재 레슨 읽기 진도"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-valuetext={`${progressPercent}%`}
      >
        읽기 진도 {progressPercent}%
      </span>
      <button
        className="button button-dark"
        type="button"
        disabled={pending || status === "COMPLETED" || scrollRequired}
        aria-busy={pending}
        onClick={() => void complete()}
      >
        {pending
          ? "저장 중"
          : status === "COMPLETED"
            ? "완료됨"
            : scrollRequired
              ? "본문 끝까지 학습"
              : "레슨 완료"}
      </button>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </div>
  );
}
