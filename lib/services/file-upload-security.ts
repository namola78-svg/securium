import { AppError } from "../errors.ts";

export type UploadVisibility = "PUBLIC" | "PRIVATE";
export type UploadKind = "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "IMPORT";

export type UploadCandidate = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: UploadKind;
  visibility: UploadVisibility;
};

const MAX_SIZE_BYTES: Record<UploadKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  DOCUMENT: 20 * 1024 * 1024,
  IMPORT: 25 * 1024 * 1024,
};

const ALLOWED: Record<UploadKind, Record<string, readonly string[]>> = {
  IMAGE: {
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".png": ["image/png"],
    ".webp": ["image/webp"],
  },
  AUDIO: {
    ".mp3": ["audio/mpeg"],
    ".m4a": ["audio/mp4", "audio/x-m4a"],
    ".wav": ["audio/wav", "audio/x-wav"],
    ".ogg": ["audio/ogg"],
  },
  VIDEO: {
    ".mp4": ["video/mp4"],
    ".webm": ["video/webm"],
  },
  DOCUMENT: {
    ".pdf": ["application/pdf"],
    ".txt": ["text/plain"],
  },
  IMPORT: {
    ".csv": ["text/csv", "application/csv"],
    ".json": ["application/json"],
    ".xlsx": [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
};

const EXECUTABLE_EXTENSION =
  /\.(?:exe|dll|com|bat|cmd|ps1|sh|msi|jar|js|mjs|cjs|html?|xhtml|svg|svgz)$/i;

export function validateUpload(candidate: UploadCandidate) {
  const originalName = candidate.originalName.trim();
  if (
    !originalName ||
    originalName.length > 180 ||
    /[\u0000-\u001f\u007f]/.test(originalName) ||
    /[/\\]/.test(originalName) ||
    originalName === "." ||
    originalName === ".."
  ) {
    throw uploadError("파일명이 안전하지 않습니다.", "UPLOAD_NAME_INVALID");
  }
  if (EXECUTABLE_EXTENSION.test(originalName)) {
    throw uploadError(
      "실행 가능하거나 활성 콘텐츠인 파일은 업로드할 수 없습니다.",
      "UPLOAD_ACTIVE_CONTENT_BLOCKED",
    );
  }
  if (
    !Number.isSafeInteger(candidate.sizeBytes) ||
    candidate.sizeBytes <= 0 ||
    candidate.sizeBytes > MAX_SIZE_BYTES[candidate.kind]
  ) {
    throw uploadError(
      "파일 크기가 허용 범위를 벗어났습니다.",
      "UPLOAD_SIZE_INVALID",
    );
  }

  const extension = readExtension(originalName);
  const mimeType = candidate.mimeType.trim().toLowerCase();
  if (!ALLOWED[candidate.kind][extension]?.includes(mimeType)) {
    throw uploadError(
      "파일 확장자와 MIME 유형이 허용 정책에 맞지 않습니다.",
      "UPLOAD_TYPE_INVALID",
    );
  }

  return {
    originalName: normalizeDisplayName(originalName),
    storageKey: createStorageKey(
      candidate.kind,
      candidate.visibility,
      extension,
    ),
    mimeType,
    sizeBytes: candidate.sizeBytes,
    visibility: candidate.visibility,
  };
}

function createStorageKey(
  kind: UploadKind,
  visibility: UploadVisibility,
  extension: string,
) {
  return `${visibility.toLowerCase()}/${kind.toLowerCase()}/${crypto.randomUUID()}${extension}`;
}

function normalizeDisplayName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ");
}

function readExtension(value: string) {
  const index = value.lastIndexOf(".");
  return index >= 0 ? value.slice(index).toLowerCase() : "";
}

function uploadError(message: string, code: string) {
  return new AppError(message, 422, code);
}
