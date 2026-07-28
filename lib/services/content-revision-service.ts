export const CONTENT_REVISION_TYPES = [
  "LEGAL_ARTICLE",
  "ISMS_STANDARD",
  "PRIVACY_IMPACT_ITEM",
  "SUBJECT",
  "SECURE_CODING_WEAKNESS",
  "LEARNING_UNIT",
  "LESSON",
  "QUESTION_EXPLANATION",
  "AUDIO_CONTENT",
  "LECTURE",
] as const;

export type ContentRevisionType =
  (typeof CONTENT_REVISION_TYPES)[number];

export const CONTENT_REVISION_TYPE_LABELS: Record<
  ContentRevisionType,
  string
> = {
  LEGAL_ARTICLE: "법령",
  ISMS_STANDARD: "ISMS-P 인증기준",
  PRIVACY_IMPACT_ITEM: "개인정보 영향평가 항목",
  SUBJECT: "시험과목",
  SECURE_CODING_WEAKNESS: "보안약점 분류",
  LEARNING_UNIT: "학습 이론 단위",
  LESSON: "본문형 이론",
  QUESTION_EXPLANATION: "문제 해설",
  AUDIO_CONTENT: "오디오",
  LECTURE: "강의",
};

export type RevisionStatus =
  | "draft"
  | "review"
  | "published"
  | "superseded"
  | "archived";

export function parseRevisionSnapshot(value: string) {
  if (new TextEncoder().encode(value).byteLength > 100_000) {
    throw new Error("버전 스냅샷은 100KB 이하여야 합니다.");
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("버전 스냅샷은 JSON 객체여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

export function mergeAllowedSnapshot(
  current: Record<string, unknown>,
  requested: Record<string, unknown>,
  allowedFields: readonly string[],
) {
  const result: Record<string, unknown> = {};
  for (const key of allowedFields) {
    const candidate = key in requested ? requested[key] : current[key];
    const original = current[key];
    if (
      candidate !== null &&
      candidate !== undefined &&
      typeof candidate !== typeof original
    ) {
      throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
    }
    if (typeof candidate === "string" && candidate.length > 50_000) {
      throw new Error(`${key} 필드가 너무 깁니다.`);
    }
    if (typeof candidate === "number" && !Number.isFinite(candidate)) {
      throw new Error(`${key} 필드가 올바른 숫자가 아닙니다.`);
    }
    result[key] = candidate ?? original ?? "";
  }
  return result;
}

export function compareRevisionSnapshots(
  previousJson: string | null,
  currentJson: string,
) {
  const previous = previousJson
    ? parseRevisionSnapshot(previousJson)
    : {};
  const current = parseRevisionSnapshot(currentJson);
  return [...new Set([...Object.keys(previous), ...Object.keys(current)])]
    .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]))
    .map((field) => ({
      field,
      previous: previous[field],
      current: current[field],
    }));
}

export function isCurrentRevision(input: {
  revisionStatus: string;
  isLatest: boolean;
}) {
  return input.revisionStatus === "published" && input.isLatest;
}

