"use client";

import { useEffect, useRef, useState } from "react";

type EmbedConfig = {
  provider: string;
  providerLabel: string;
  embedUrl: string;
  embedOrigin: string;
  playerProtocol:
    | "YOUTUBE_POST_MESSAGE"
    | "VIMEO_POST_MESSAGE";
  iframeAllow: string;
  iframeSandbox: string;
};

export function LecturePlayer({
  lectureId,
  title,
  durationSeconds,
  embed,
  authenticated,
  initialPosition,
  initialCompleted,
  initialBookmarked,
  initialNote,
}: {
  lectureId: string;
  title: string;
  durationSeconds: number;
  embed: EmbedConfig;
  authenticated: boolean;
  initialPosition: number;
  initialCompleted: boolean;
  initialBookmarked: boolean;
  initialNote: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastSavedAtRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredPositionRef = useRef(initialPosition);
  const [position, setPosition] = useState(initialPosition);
  const [completed, setCompleted] = useState(initialCompleted);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [note, setNote] = useState(initialNote);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function persistProgress(
    nextPosition: number,
    complete = false,
  ) {
    if (!authenticated) return;
    lastSavedAtRef.current = Date.now();
    const response = await fetch("/api/lectures/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lectureId,
        currentPositionSeconds: Math.max(
          0,
          Math.min(durationSeconds, Math.round(nextPosition)),
        ),
        complete,
      }),
    });
    const payload = (await response.json()) as {
      result?: { completed: boolean; currentPositionSeconds: number };
      error?: string;
    };
    if (!response.ok) {
      setMessage(payload.error ?? "시청 진도를 저장하지 못했습니다.");
      return;
    }
    if (payload.result) setCompleted(payload.result.completed);
    if (complete) setMessage("강의 완료를 저장했습니다.");
  }

  function queueProgress(nextPosition: number, complete = false) {
    if (!authenticated) return;
    desiredPositionRef.current = nextPosition;
    const elapsed = Date.now() - lastSavedAtRef.current;
    if (complete || elapsed >= 15_000) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      void persistProgress(nextPosition, complete);
      return;
    }
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistProgress(desiredPositionRef.current);
      }, 15_000 - elapsed);
    }
  }

  useEffect(() => {
    function receiveMessage(event: MessageEvent) {
      if (
        event.origin !== embed.embedOrigin ||
        event.source !== iframeRef.current?.contentWindow
      ) {
        return;
      }
      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const message = data as {
        event?: string;
        info?: { currentTime?: number; playerState?: number };
        data?: { seconds?: number };
      };
      let next: number | null = null;
      let ended = false;
      if (
        embed.playerProtocol === "YOUTUBE_POST_MESSAGE" &&
        message.event === "infoDelivery"
      ) {
        next =
          typeof message.info?.currentTime === "number"
            ? message.info.currentTime
            : null;
        ended = message.info?.playerState === 0;
      }
      if (embed.playerProtocol === "VIMEO_POST_MESSAGE") {
        if (
          message.event === "timeupdate" &&
          typeof message.data?.seconds === "number"
        ) {
          next = message.data.seconds;
        }
        ended = message.event === "ended";
      }
      if (next !== null) {
        const bounded = Math.max(
          0,
          Math.min(durationSeconds, Math.floor(next)),
        );
        setPosition(bounded);
        queueProgress(bounded);
      }
      if (ended) {
        setPosition(durationSeconds);
        queueProgress(durationSeconds, true);
      }
    }
    window.addEventListener("message", receiveMessage);
    return () => {
      window.removeEventListener("message", receiveMessage);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // The listener is bound to this immutable embed and lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId]);

  function initializePlayer() {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    if (embed.playerProtocol === "YOUTUBE_POST_MESSAGE") {
      frame.postMessage(
        JSON.stringify({ event: "listening", id: lectureId }),
        embed.embedOrigin,
      );
    } else {
      for (const event of ["timeupdate", "ended", "pause"]) {
        frame.postMessage(
          { method: "addEventListener", value: event },
          embed.embedOrigin,
        );
      }
    }
  }

  async function toggleBookmark() {
    setPending(true);
    try {
      const response = await fetch("/api/lectures/bookmark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lectureId }),
      });
      const payload = (await response.json()) as {
        result?: { bookmarked: boolean };
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "즐겨찾기를 변경하지 못했습니다.");
        return;
      }
      setBookmarked(Boolean(payload.result?.bookmarked));
      setMessage(
        payload.result?.bookmarked
          ? "즐겨찾기에 추가했습니다."
          : "즐겨찾기에서 해제했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveNote() {
    setPending(true);
    try {
      const response = await fetch("/api/lectures/note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lectureId, content: note }),
      });
      const payload = (await response.json()) as {
        result?: { content: string; deleted: boolean };
        error?: string;
      };
      if (!response.ok) {
        setMessage(payload.error ?? "강의 메모를 저장하지 못했습니다.");
        return;
      }
      setNote(payload.result?.content ?? "");
      setMessage(
        payload.result?.deleted
          ? "메모를 삭제했습니다."
          : "강의 메모를 저장했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  const completionThreshold =
    durationSeconds - Math.max(10, Math.ceil(durationSeconds * 0.05));

  return (
    <div className="lecture-player">
      <div className="lecture-video-frame">
        <iframe
          ref={iframeRef}
          src={embed.embedUrl}
          title={`${title} 영상`}
          allow={embed.iframeAllow}
          sandbox={embed.iframeSandbox}
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={initializePlayer}
        />
      </div>
      <div className="lecture-progress-summary">
        <span>
          이어보기 {formatTime(position)} / {formatTime(durationSeconds)}
        </span>
        <progress
          max={durationSeconds}
          value={position}
          aria-label="강의 시청 진행률"
        />
        <span>{completed ? "완료" : "시청 중"}</span>
      </div>
      {authenticated ? (
        <>
          <div className="lecture-user-actions">
            <button
              className="button button-ghost"
              type="button"
              disabled={pending}
              onClick={() => void toggleBookmark()}
            >
              {bookmarked ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기"}
            </button>
            <button
              className="button button-soft"
              type="button"
              disabled={completed || position < completionThreshold}
              onClick={() => void persistProgress(position, true)}
            >
              {completed ? "완료됨" : "강의 완료"}
            </button>
          </div>
          <label className="lecture-note-field">
            강의 메모
            <textarea
              value={note}
              maxLength={4000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="개인 학습 메모를 입력하세요."
            />
            <span>{note.length}/4000</span>
          </label>
          <button
            className="button button-dark"
            type="button"
            disabled={pending}
            onClick={() => void saveNote()}
          >
            {pending ? "저장 중…" : "메모 저장"}
          </button>
        </>
      ) : (
        <p className="empty-state">
          무료 강의는 시청할 수 있습니다. 이어보기·즐겨찾기·메모는 로그인
          후 저장됩니다.
        </p>
      )}
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const tail = `${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(safe % 60).padStart(2, "0")}`;
  return hours ? `${hours}:${tail}` : tail;
}
