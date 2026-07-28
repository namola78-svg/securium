import { AppError } from "../errors.ts";

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

const DEFAULT_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export function parseTranscriptSegments(
  value: string,
  durationSeconds: number,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .flatMap((item): TranscriptSegment[] => {
      if (
        typeof item !== "object" ||
        item === null ||
        !("startSeconds" in item) ||
        !("endSeconds" in item) ||
        !("text" in item) ||
        typeof item.startSeconds !== "number" ||
        typeof item.endSeconds !== "number" ||
        typeof item.text !== "string"
      ) {
        return [];
      }
      const startSeconds = Math.floor(item.startSeconds);
      const endSeconds = Math.ceil(item.endSeconds);
      const text = item.text.trim();
      if (
        startSeconds < 0 ||
        endSeconds <= startSeconds ||
        endSeconds > durationSeconds ||
        !text
      ) {
        return [];
      }
      return [{ startSeconds, endSeconds, text }];
    })
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

export function parseSpeedOptions(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return DEFAULT_SPEED_OPTIONS;
  }
  if (!Array.isArray(parsed)) return DEFAULT_SPEED_OPTIONS;
  const speeds = [
    ...new Set(
      parsed.filter(
        (item): item is number =>
          typeof item === "number" &&
          Number.isFinite(item) &&
          item >= 0.5 &&
          item <= 3,
      ),
    ),
  ].sort((a, b) => a - b);
  return speeds.includes(1) && speeds.length ? speeds : DEFAULT_SPEED_OPTIONS;
}

export function normalizeAudioPosition(
  positionSeconds: number,
  durationSeconds: number,
) {
  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isInteger(positionSeconds) ||
    positionSeconds < 0 ||
    positionSeconds > durationSeconds
  ) {
    throw new AppError(
      "재생 위치가 오디오 길이 범위를 벗어났습니다.",
      400,
      "AUDIO_POSITION_OUT_OF_RANGE",
    );
  }
  return positionSeconds;
}

export function assertAudioCompletionPosition(
  positionSeconds: number,
  durationSeconds: number,
) {
  const allowedRemainingSeconds = Math.max(
    5,
    Math.ceil(durationSeconds * 0.05),
  );
  if (positionSeconds < durationSeconds - allowedRemainingSeconds) {
    throw new AppError(
      "오디오를 끝까지 학습한 뒤 완료할 수 있습니다.",
      400,
      "AUDIO_COMPLETION_POSITION_REQUIRED",
    );
  }
}

export function validateAudioUrl(
  value: string,
  allowedHosts: string[],
) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (/[\u0000-\u001f\\]/.test(trimmed)) {
      throw invalidAudioUrl();
    }
    return trimmed;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw invalidAudioUrl();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw invalidAudioUrl();
  }
  return url.toString();
}

export function configuredAudioHosts(value = process.env.AUDIO_ALLOWED_HOSTS) {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => /^[a-z0-9.-]+$/.test(host));
}

export function supportsSpeechSynthesis(
  scope:
    | {
        speechSynthesis?: unknown;
        SpeechSynthesisUtterance?: unknown;
      }
    | undefined,
) {
  return Boolean(
    scope?.speechSynthesis &&
      typeof scope.SpeechSynthesisUtterance === "function",
  );
}

function invalidAudioUrl() {
  return new AppError(
    "허용되지 않은 오디오 URL입니다.",
    422,
    "AUDIO_URL_NOT_ALLOWED",
  );
}
