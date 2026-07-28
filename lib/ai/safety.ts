import { AppError } from "../errors.ts";

const MAX_AI_REQUEST_BYTES = 4096;
const MAX_AI_CONTEXT_CHARACTERS = 24_000;

export async function readLimitedAIJson(
  request: Request,
  maxBytes = MAX_AI_REQUEST_BYTES,
) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    throw new AppError(
      "AI 요청 크기 제한을 초과했습니다.",
      413,
      "AI_REQUEST_TOO_LARGE",
    );
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) {
    throw new AppError(
      "AI 요청 크기 제한을 초과했습니다.",
      413,
      "AI_REQUEST_TOO_LARGE",
    );
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new AppError(
      "올바른 JSON 요청이 아닙니다.",
      400,
      "INVALID_JSON",
    );
  }
}

export function maskSensitiveText(value: string) {
  return value
    .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[REDACTED_ID]")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(/\b(?:Bearer\s+)?(?:sk-[A-Za-z0-9_-]{12,})\b/gi, "[REDACTED_TOKEN]")
    .replace(
      /\b(password|passwd|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    );
}

export function sanitizeProviderContext<T>(value: T): T {
  const serialized = JSON.stringify(value);
  const limited = serialized.slice(0, MAX_AI_CONTEXT_CHARACTERS);
  return JSON.parse(maskSensitiveText(limited)) as T;
}

export function assertDailyAILimit(count: number, limit: number) {
  if (count >= limit) {
    throw new AppError(
      "오늘의 AI 호출 한도를 모두 사용했습니다.",
      429,
      "AI_DAILY_LIMIT_REACHED",
    );
  }
}

export function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}
