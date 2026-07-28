import { AppError } from "./errors.ts";

type Bucket = { count: number; resetAt: number };
export type RateLimitOptions = { limit: number; windowMs: number };
export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export interface RateLimitProvider {
  consume(
    key: string,
    options: RateLimitOptions,
    now?: number,
  ): Promise<RateLimitDecision>;
}

export class MemoryRateLimitProvider implements RateLimitProvider {
  private readonly buckets = new Map<string, Bucket>();

  async consume(
    key: string,
    options: RateLimitOptions,
    now = Date.now(),
  ): Promise<RateLimitDecision> {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, options.limit - 1),
        retryAfterMs: 0,
      };
    }
    if (current.count >= options.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, current.resetAt - now),
      };
    }
    current.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - current.count),
      retryAfterMs: 0,
    };
  }
}

let provider: RateLimitProvider = new MemoryRateLimitProvider();

export function configureRateLimitProvider(nextProvider: RateLimitProvider) {
  provider = nextProvider;
}

export async function assertRateLimit(
  key: string,
  options: RateLimitOptions = {
    limit: 30,
    windowMs: 60_000,
  },
) {
  const result = await provider.consume(key, options);
  if (!result.allowed) {
    throw new AppError(
      "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      429,
      "RATE_LIMITED",
    );
  }
  return result;
}

export function assertAdminActionRateLimit(userId: string, scope: string) {
  return assertRateLimit(`admin:${scope}:${userId}`, {
    limit: 30,
    windowMs: 60_000,
  });
}

export function assertDataExportRateLimit(userId: string) {
  return assertRateLimit(`export:${userId}`, {
    limit: 5,
    windowMs: 60 * 60_000,
  });
}
