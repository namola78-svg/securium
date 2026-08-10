"use client";

import { useEffect, useRef, useState } from "react";

export function LessonActions({ lessonId, initialStatus, initialLastPosition, completionPolicy }: { lessonId: string; initialStatus: string; initialLastPosition: number; completionPolicy: string }) {
  const [status, setStatus] = useState(initialStatus); const [lastPosition, setLastPosition] = useState(initialLastPosition); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false); const startedRef = useRef(false); const savedPositionRef = useRef(initialLastPosition);
  async function run(action: "START" | "UPDATE" | "COMPLETE", position = lastPosition, silent = false) {
    if (pending) return; setPending(true);
    try { const response = await fetch("/api/lessons/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId, action, lastPosition: position }) }); const payload = (await response.json()) as { result?: { status: string; progressPercent: number; lastPosition: number }; error?: string }; if (!response.ok) { if (!silent) setMessage(payload.error ?? "레슨 진도를 저장하지 못했습니다."); return; } if (payload.result?.status) setStatus(payload.result.status); if (typeof payload.result?.lastPosition === "number") { setLastPosition(payload.result.lastPosition); savedPositionRef.current = payload.result.lastPosition; } if (!silent && action === "COMPLETE") setMessage("레슨 완료를 저장했습니다. 같은 요청은 중복 집계되지 않습니다."); } finally { setPending(false); }
  }
  useEffect(() => { if (initialStatus === "NOT_STARTED" && !startedRef.current) { startedRef.current = true; void run("START", initialLastPosition, true); } // Start once when the lesson opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);
  useEffect(() => { function recordPosition() { const scrollable = document.documentElement.scrollHeight - window.innerHeight; const position = scrollable <= 0 ? 10000 : Math.min(10000, Math.max(0, Math.round((window.scrollY / scrollable) * 10000))); setLastPosition((current) => Math.max(current, position)); if (position >= savedPositionRef.current + 1000 || (position === 10000 && savedPositionRef.current < 10000)) { savedPositionRef.current = position; void run(completionPolicy === "SCROLL_END" && position === 10000 ? "COMPLETE" : "UPDATE", position, true); } } window.addEventListener("scroll", recordPosition, { passive: true }); recordPosition(); return () => window.removeEventListener("scroll", recordPosition); // Progress belongs to this lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);
  const scrollRequired = completionPolicy === "SCROLL_END" && lastPosition < 10000;
  return <div className="lesson-actions"><span className={`lesson-status lesson-status-${status.toLowerCase()}`}>{status === "COMPLETED" ? "완료" : status === "IN_PROGRESS" ? "학습 중" : "시작 전"}</span><span className="lesson-reading-progress" aria-live="polite">읽기 위치 {Math.round(lastPosition / 100)}%</span><button className="button button-dark" type="button" disabled={pending || status === "COMPLETED" || scrollRequired} onClick={() => void run("COMPLETE", lastPosition)}>{pending ? "저장 중…" : status === "COMPLETED" ? "완료됨" : scrollRequired ? "본문 끝까지 학습" : "레슨 완료"}</button>{message ? <p className="form-message">{message}</p> : null}</div>;
}
