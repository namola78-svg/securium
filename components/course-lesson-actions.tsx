"use client";

import { useEffect, useRef, useState } from "react";

export function CourseLessonActions({ courseLessonId, initialStatus, initialProgressPercent, completionRule }: { courseLessonId: string; initialStatus: string; initialProgressPercent: number; completionRule: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [progressPercent, setProgressPercent] = useState(initialProgressPercent);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const startedRef = useRef(false);
  const openedAtRef = useRef<number | null>(null);
  const savedProgressRef = useRef(initialProgressPercent);

  function getTimeSpentSeconds() { const openedAt = openedAtRef.current ?? Date.now(); openedAtRef.current = openedAt; return Math.max(0, Math.round((Date.now() - openedAt) / 1000)); }

  async function run(action: "START" | "UPDATE" | "COMPLETE", nextProgress = progressPercent, silent = false) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/course-lessons/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseLessonId, action, progressPercent: nextProgress, timeSpentSeconds: getTimeSpentSeconds() }) });
      const payload = (await response.json()) as { result?: { status: string; progressPercent: number }; error?: string };
      if (!response.ok) { if (!silent) setMessage(payload.error ?? "레슨 진도를 저장하지 못했습니다."); return; }
      if (payload.result?.status) setStatus(payload.result.status);
      if (typeof payload.result?.progressPercent === "number") { setProgressPercent(payload.result.progressPercent); savedProgressRef.current = payload.result.progressPercent; }
      if (!silent && action === "COMPLETE") setMessage("레슨 완료를 저장했습니다.");
    } catch { if (!silent) setMessage("네트워크 오류로 레슨 진도를 저장하지 못했습니다."); }
    finally { setPending(false); }
  }

  useEffect(() => { if (initialStatus === "NOT_STARTED" && !startedRef.current) { startedRef.current = true; void run("START", Math.max(initialProgressPercent, 1), true); } // The start request is intentionally issued once per lesson.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);

  useEffect(() => {
    function recordProgress() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = scrollable <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
      setProgressPercent((current) => Math.max(current, nextProgress));
      if (nextProgress >= savedProgressRef.current + 10 || (nextProgress === 100 && savedProgressRef.current < 100)) { savedProgressRef.current = nextProgress; void run(completionRule === "SCROLL_END" && nextProgress >= 90 ? "COMPLETE" : "UPDATE", nextProgress, true); }
    }
    window.addEventListener("scroll", recordProgress, { passive: true }); recordProgress();
    return () => window.removeEventListener("scroll", recordProgress);
    // Progress tracking is scoped to this course lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseLessonId]);

  const scrollRequired = completionRule === "SCROLL_END" && progressPercent < 90;
  const statusLabel = status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "학습 중" : "시작 전";
  return <div className="lesson-actions"><span className={`lesson-status lesson-status-${status.toLowerCase()}`}>{statusLabel}</span><span className="lesson-reading-progress" role="progressbar" aria-label="현재 레슨 읽기 진도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-valuetext={`${progressPercent}%`}>읽기 진도 {progressPercent}%</span><button className="button button-dark" type="button" disabled={pending || status === "COMPLETED" || scrollRequired} aria-busy={pending} onClick={() => void run("COMPLETE", Math.max(progressPercent, 100))}>{pending ? "저장 중…" : status === "COMPLETED" ? "완료됨" : scrollRequired ? "본문을 더 학습해주세요" : "레슨 완료"}</button>{message ? <p className="form-message" role="status">{message}</p> : null}</div>;
}
