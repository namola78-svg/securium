"use client";

import { useEffect, useRef, useState } from "react";
import {
  supportsSpeechSynthesis,
  type TranscriptSegment,
} from "@/lib/services/audio-service";
import { publicCopy } from "@/lib/public-copy";

type AudioLearningItem = {
  id: string;
  title: string;
  audioUrl: string;
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  durationSeconds: number;
  voiceProvider: string;
  voiceName: string;
  speedOptions: number[];
  currentPositionSeconds: number;
  completed: boolean;
  completedAt: string | null;
};

export function AudioLearningPlayer({
  items,
}: {
  items: AudioLearningItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="lesson-audio-section" aria-labelledby="audio-heading">
      <div className="lesson-audio-heading">
        <div>
          <p className="eyebrow">AUDIO LEARNING</p>
          <h2 id="audio-heading">오디오 학습</h2>
        </div>
        <p>재생 위치는 계정별로 저장되며 15초 간격으로 업데이트됩니다.</p>
      </div>
      <div className="audio-learning-list">
        {items.map((item) => (
          <AudioLearningItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function AudioLearningItem({ item }: { item: AudioLearningItem }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAtRef = useRef(0);
  const desiredSaveRef = useRef({
    position: item.currentPositionSeconds,
    complete: item.completed,
  });
  const speechTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [position, setPosition] = useState(item.currentPositionSeconds);
  const [completed, setCompleted] = useState(item.completed);
  const [speed, setSpeed] = useState(
    item.speedOptions.includes(1) ? 1 : item.speedOptions[0] ?? 1,
  );
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(Boolean(item.audioUrl));
  const [message, setMessage] = useState("");
  const [speechAvailable, setSpeechAvailable] = useState<boolean | null>(
    null,
  );

  const usesBrowserVoice = !item.audioUrl;
  const safeTitle = publicCopy(item.title);
  const safeTranscript = publicCopy(item.transcript);
  const safeTranscriptSegments = item.transcriptSegments.map((segment) => ({
    ...segment,
    text: publicCopy(segment.text),
  }));
  const activeSegment = safeTranscriptSegments.findIndex(
    (segment) =>
      position >= segment.startSeconds &&
      position < segment.endSeconds,
  );

  async function persist(
    nextPosition: number,
    complete: boolean,
  ) {
    lastSavedAtRef.current = Date.now();
    const response = await fetch("/api/audio/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audioContentId: item.id,
        currentPositionSeconds: Math.max(
          0,
          Math.min(item.durationSeconds, Math.round(nextPosition)),
        ),
        complete,
      }),
    });
    const payload = (await response.json()) as {
      result?: {
        currentPositionSeconds: number;
        completed: boolean;
      };
      error?: string;
    };
    if (!response.ok) {
      setMessage(payload.error ?? "오디오 진행도를 저장하지 못했습니다.");
      return;
    }
    if (payload.result) {
      setCompleted(payload.result.completed);
      setMessage(
        payload.result.completed
          ? "오디오 학습 완료를 저장했습니다."
          : "재생 위치를 저장했습니다.",
      );
    }
  }

  function queueSave(
    nextPosition: number,
    complete = false,
    force = false,
  ) {
    desiredSaveRef.current = {
      position: nextPosition,
      complete: desiredSaveRef.current.complete || complete,
    };
    const elapsed = Date.now() - lastSavedAtRef.current;
    if (force || elapsed >= 15_000) {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
      const desired = desiredSaveRef.current;
      void persist(desired.position, desired.complete);
      return;
    }
    if (!pendingSaveRef.current) {
      pendingSaveRef.current = setTimeout(() => {
        pendingSaveRef.current = null;
        const desired = desiredSaveRef.current;
        void persist(desired.position, desired.complete);
      }, 15_000 - elapsed);
    }
  }

  function stopSpeechTimer() {
    if (speechTimerRef.current) {
      clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }
  }

  function startSpeechTimer() {
    stopSpeechTimer();
    speechTimerRef.current = setInterval(() => {
      setPosition((current) => {
        const next = Math.min(item.durationSeconds, current + speed);
        queueSave(next);
        return next;
      });
    }, 1000);
  }

  async function play() {
    setMessage("오디오 학습 상태를 업데이트했습니다.");
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setMessage("오디오 학습 상태를 업데이트했습니다.");
      }
      return;
    }
    if (
      !supportsSpeechSynthesis(
        typeof window === "undefined" ? undefined : window,
      )
    ) {
      setSpeechAvailable(false);
      setMessage("오디오 학습 상태를 업데이트했습니다.");
      return;
    }
    setSpeechAvailable(true);
    if (window.speechSynthesis.paused && speechUtteranceRef.current) {
      window.speechSynthesis.resume();
      setPlaying(true);
      startSpeechTimer();
      return;
    }
    window.speechSynthesis.cancel();
    const remainingSegments = safeTranscriptSegments.filter(
      (segment) => segment.endSeconds > position,
    );
    const speechText = remainingSegments.length
      ? remainingSegments.map((segment) => segment.text).join(" ")
      : safeTranscript;
    if (!speechText.trim()) {
      setMessage("오디오 학습 상태를 업데이트했습니다.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = speed;
    utterance.onend = () => {
      stopSpeechTimer();
      setPlaying(false);
      setPosition(item.durationSeconds);
      queueSave(item.durationSeconds, true, true);
    };
    utterance.onerror = () => {
      stopSpeechTimer();
      setPlaying(false);
      setMessage("오디오 학습 상태를 업데이트했습니다.");
    };
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
    startSpeechTimer();
  }

  function pause() {
    if (audioRef.current) {
      audioRef.current.pause();
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
      stopSpeechTimer();
    }
    setPlaying(false);
    queueSave(position, false, true);
  }

  function seek(deltaSeconds: number) {
    const next = Math.max(
      0,
      Math.min(item.durationSeconds, position + deltaSeconds),
    );
    if (audioRef.current) {
      audioRef.current.currentTime = next;
    } else if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      speechUtteranceRef.current = null;
      stopSpeechTimer();
      setPlaying(false);
    }
    setPosition(next);
    queueSave(next, false, true);
  }

  useEffect(() => {
    const capabilityTimer = setTimeout(() => {
      setSpeechAvailable(
        usesBrowserVoice
          ? supportsSpeechSynthesis(window)
          : null,
      );
    }, 0);
    const audio = audioRef.current;
    if (audio && item.currentPositionSeconds > 0) {
      audio.currentTime = item.currentPositionSeconds;
    }
    return () => {
      clearTimeout(capabilityTimer);
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      stopSpeechTimer();
      if (
        speechUtteranceRef.current &&
        typeof window !== "undefined" &&
        window.speechSynthesis
      ) {
        window.speechSynthesis.cancel();
      }
    };
    // Initial resume position and browser capability are evaluated once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <article className="audio-learning-card">
      <div className="audio-learning-title">
        <div>
          <h3>{safeTitle}</h3>
          <p>
            {formatTime(position)} / {formatTime(item.durationSeconds)}
          </p>
        </div>
        <span
          className={`lesson-status lesson-status-${completed ? "completed" : "in_progress"}`}
        >
          {completed ? "완료" : "학습 중"}
        </span>
      </div>

      {item.audioUrl ? (
        <audio
          ref={audioRef}
          src={item.audioUrl}
          preload="metadata"
          onCanPlay={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => {
            setLoading(false);
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const next = Math.floor(event.currentTarget.currentTime);
            setPosition(next);
            queueSave(next);
          }}
          onEnded={() => {
            setPlaying(false);
            setPosition(item.durationSeconds);
            queueSave(item.durationSeconds, true, true);
          }}
          onError={() => {
            setLoading(false);
            setMessage("오디오 파일을 불러오지 못했습니다.");
          }}
        >
          브라우저가 오디오 재생을 지원하지 않습니다.
        </audio>
      ) : (
        <div className="browser-voice-notice">
          <strong>브라우저 제공 음성</strong>
          <span>실제 강사 음성이 아닌 기기 내 음성 합성으로 재생합니다.</span>
          {speechAvailable === false ? (
            <span role="status">현재 브라우저에서는 음성 재생을 사용할 수 없습니다.</span>
          ) : null}
        </div>
      )}

      <div className="audio-controls" aria-label={`${safeTitle} 재생 제어`}>
        <button
          className="button button-ghost"
          type="button"
          onClick={() => seek(-10)}
        >
          10초 이전
        </button>
        <button
          className="button button-dark"
          type="button"
          onClick={playing ? pause : () => void play()}
          disabled={loading && Boolean(item.audioUrl)}
        >
          {loading && item.audioUrl
            ? "불러오는 중..."
            : playing
              ? "일시정지"
              : position > 0
                ? "이어서 듣기"
                : "재생"}
        </button>
        <button
          className="button button-ghost"
          type="button"
          onClick={() => seek(10)}
        >
          10초 이후
        </button>
        <label>
          재생 속도<select
            value={speed}
            onChange={(event) => {
              const next = Number(event.target.value);
              setSpeed(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
              if (speechUtteranceRef.current) {
                setMessage(
                  "브라우저 음성 배속 변경은 다음 재생부터 적용됩니다.",
                );
              }
            }}
          >
            {item.speedOptions.map((option) => (
            <option key={option} value={option}>
              {option}배속
            </option>
            ))}
          </select>
        </label>
        <button
          className="button button-soft"
          type="button"
          disabled={
            completed ||
            position <
              item.durationSeconds -
                Math.max(5, Math.ceil(item.durationSeconds * 0.05))
          }
          onClick={() => queueSave(position, true, true)}
        >
          {completed ? "완료됨" : "오디오 완료"}
        </button>
      </div>

      <progress
        className="audio-progress"
        max={item.durationSeconds}
        value={position}
        aria-label="오디오 재생 진행률"
      />

      <details className="audio-transcript" open>
        <summary>스크립트</summary>
        {safeTranscriptSegments.length ? (
          <ol>
            {safeTranscriptSegments.map((segment, index) => (
              <li
                key={`${segment.startSeconds}-${segment.endSeconds}`}
                className={index === activeSegment ? "is-current" : ""}
                aria-current={index === activeSegment ? "true" : undefined}
              >
                <button
                  type="button"
                  onClick={() => {
                    const delta = segment.startSeconds - position;
                    seek(delta);
                  }}
                >
                  <time>{formatTime(segment.startSeconds)}</time>
                  <span>{segment.text}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>{safeTranscript || "등록된 스크립트가 없습니다."}</p>
        )}
      </details>

      <p className="audio-provider">
        음성 출처:{" "}
        {usesBrowserVoice
          ? "브라우저 제공 음성"
          : item.voiceProvider || "등록된 오디오 파일"}
        {item.voiceName ? ` · ${item.voiceName}` : ""}
      </p>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </article>
  );
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
