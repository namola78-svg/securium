import { AppError } from "../errors.ts";

type VideoProviderConfig = {
  code: string;
  label: string;
  allowedHosts: readonly string[];
  embedOrigin: string;
  playerProtocol: "YOUTUBE_POST_MESSAGE" | "VIMEO_POST_MESSAGE";
  allow: string;
  sandbox: string;
  buildEmbedUrl: (url: URL, startSeconds: number) => string;
};

const MINIMUM_IFRAME_ALLOW =
  "accelerometer; autoplay; encrypted-media; picture-in-picture";
const VIDEO_IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation";

const PROVIDERS = {
  YOUTUBE: {
    code: "YOUTUBE",
    label: "YouTube",
    allowedHosts: [
      "youtube.com",
      "www.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com",
    ],
    embedOrigin: "https://www.youtube-nocookie.com",
    playerProtocol: "YOUTUBE_POST_MESSAGE",
    allow: MINIMUM_IFRAME_ALLOW,
    sandbox: VIDEO_IFRAME_SANDBOX,
    buildEmbedUrl(url, startSeconds) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.split("/").filter(Boolean)[0]
          : url.searchParams.get("v") ??
            readPathId(url.pathname, "embed");
      assertVideoId(id, /^[A-Za-z0-9_-]{6,20}$/);
      const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        enablejsapi: "1",
        playsinline: "1",
      });
      if (startSeconds > 0) params.set("start", String(startSeconds));
      return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    },
  },
  VIMEO: {
    code: "VIMEO",
    label: "Vimeo",
    allowedHosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
    embedOrigin: "https://player.vimeo.com",
    playerProtocol: "VIMEO_POST_MESSAGE",
    allow: MINIMUM_IFRAME_ALLOW,
    sandbox: VIDEO_IFRAME_SANDBOX,
    buildEmbedUrl(url, startSeconds) {
      const id =
        readPathId(url.pathname, "video") ??
        url.pathname.split("/").filter(Boolean).at(-1);
      assertVideoId(id, /^\d{5,20}$/);
      const fragment = startSeconds > 0 ? `#t=${startSeconds}s` : "";
      return `https://player.vimeo.com/video/${id}?dnt=1&playsinline=1${fragment}`;
    },
  },
} as const satisfies Record<string, VideoProviderConfig>;

export type VideoProviderCode = keyof typeof PROVIDERS;

export function getAllowedVideoEmbedOrigins() {
  return [...new Set(Object.values(PROVIDERS).map((item) => item.embedOrigin))];
}

export function getVideoProviderConfig(provider: string) {
  const config = PROVIDERS[provider as VideoProviderCode] as
    | VideoProviderConfig
    | undefined;
  if (!config) {
    throw new AppError(
      "지원하지 않는 영상 공급자입니다.",
      422,
      "VIDEO_PROVIDER_NOT_ALLOWED",
    );
  }
  return config;
}

export function createSafeVideoEmbed(
  provider: string,
  value: string,
  startSeconds = 0,
) {
  const config = getVideoProviderConfig(provider);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidVideoUrl();
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !config.allowedHosts.includes(hostname)
  ) {
    throw invalidVideoUrl();
  }
  return {
    provider: config.code,
    providerLabel: config.label,
    embedUrl: config.buildEmbedUrl(
      url,
      Math.max(0, Math.floor(startSeconds)),
    ),
    embedOrigin: config.embedOrigin,
    playerProtocol: config.playerProtocol,
    iframeAllow: config.allow,
    iframeSandbox: config.sandbox,
  };
}

export function validateLecturePosition(
  positionSeconds: number,
  durationSeconds: number,
) {
  if (
    !Number.isInteger(positionSeconds) ||
    positionSeconds < 0 ||
    positionSeconds > durationSeconds
  ) {
    throw new AppError(
      "시청 위치가 강의 길이 범위를 벗어났습니다.",
      400,
      "LECTURE_POSITION_OUT_OF_RANGE",
    );
  }
  return positionSeconds;
}

export function assertLectureCompletionPosition(
  positionSeconds: number,
  durationSeconds: number,
) {
  const allowedRemaining = Math.max(10, Math.ceil(durationSeconds * 0.05));
  if (positionSeconds < durationSeconds - allowedRemaining) {
    throw new AppError(
      "강의를 끝까지 시청한 뒤 완료할 수 있습니다.",
      400,
      "LECTURE_COMPLETION_POSITION_REQUIRED",
    );
  }
}

function readPathId(pathname: string, marker: string) {
  const parts = pathname.split("/").filter(Boolean);
  const markerIndex = parts.indexOf(marker);
  return markerIndex >= 0 ? parts[markerIndex + 1] : null;
}

function assertVideoId(
  value: string | null | undefined,
  pattern: RegExp,
): asserts value is string {
  if (!value || !pattern.test(value)) throw invalidVideoUrl();
}

function invalidVideoUrl() {
  return new AppError(
    "허용되지 않은 영상 URL입니다.",
    422,
    "VIDEO_URL_NOT_ALLOWED",
  );
}
