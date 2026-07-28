"use client";

import { useRef, useState } from "react";

export function LevelActions({
  levelId,
  status,
}: {
  levelId: string;
  status: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  async function run(action: "START" | "COMPLETE") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/levels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ levelId, action }),
      });
      const payload = (await response.json()) as {
        result?: {
          score?: number;
          passed?: boolean;
          nextLevelUnlocked?: boolean;
        };
        error?: string;
      };
      if (!response.ok) {
        setMessage(
          typeof payload.error === "string"
            ? payload.error
            : "단계 상태를 변경하지 못했습니다.",
        );
        return;
      }
      if (action === "START") {
        window.location.reload();
        return;
      }
      setMessage(
        payload.result?.passed
          ? `단계를 통과했습니다. 최고점수 ${payload.result.score}점${payload.result.nextLevelUnlocked ? " · 다음 단계 해제" : ""}`
          : `통과점수에 도달하지 못했습니다. 현재 점수 ${payload.result?.score ?? 0}점`,
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <div className="level-actions">
      {status === "AVAILABLE" ? (
        <button
          className="button button-dark"
          disabled={pending}
          onClick={() => run("START")}
        >
          {pending ? "처리 중…" : "단계 시작"}
        </button>
      ) : null}
      {status !== "LOCKED" ? (
        <button
          className="button button-ghost"
          disabled={pending}
          onClick={() => run("COMPLETE")}
        >
          {pending ? "처리 중…" : "현재 결과로 단계 평가"}
        </button>
      ) : null}
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );
}
