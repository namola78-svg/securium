"use client";

import { useEffect, useRef, useState } from "react";

export function CourseLessonActions({
  courseLessonId,
  initialStatus,
  initialProgressPercent,
  completionRule,
}: {
  courseLessonId: string;
  initialStatus: string;
  initialProgressPercent: number;
  completionRule: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [progressPercent, setProgressPercent] = useState(initialProgressPercent);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const openedAtRef = useRef<number | null>(null);

  function getTimeSpentSeconds() {
    const openedAt = openedAtRef.current ?? Date.now();
    openedAtRef.current = openedAt;
    return Math.max(0, Math.round((Date.now() - openedAt) / 1000));
  }

  async function complete() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/course-lessons/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseLessonId,
          action: "COMPLETE",
          progressPercent: 100,
          timeSpentSeconds: getTimeSpentSeconds(),
        }),
      });
      const payload = (await response.json()) as {
        result?: { status: string; progressPercent: number };
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "레슨 진도를 저장하지 못했습니다.");
        return;
      }
      if (payload.result?.status) setStatus(payload.result.status);
      if (typeof payload.result?.progressPercent === "number") {
        setProgressPercent(payload.result.progressPercent);
      }
      setMessage("레슨 완료를 저장했습니다.");
    } catch {
      setMessage("네트워크 오류로 레슨 진도를 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    function recordProgress() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress =
        scrollable <= 0
          ? 100
          : Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
      setProgressPercent((current) => Math.max(current, nextProgress));
    }
    window.addEventListener("scroll", recordProgress, { passive: true });
    recordProgress();
    return () => window.removeEventListener("scroll", recordProgress);
  }, [courseLessonId]);

  const scrollRequired = completionRule === "SCROLL_END" && progressPercent < 90;
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
              ? "본문을 더 학습해 주세요"
              : "레슨 완료"}
      </button>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </div>
  );
}
