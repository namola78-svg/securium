import { env } from "cloudflare:workers";
import { createAIProvider } from "./provider-factory.ts";
import { parseBoundedInteger } from "./safety.ts";

export function getRuntimeAIProvider() {
  return createAIProvider({
    provider: env.AI_PROVIDER,
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    timeoutMs: parseBoundedInteger(env.AI_TIMEOUT_MS, 8_000, 1_000, 30_000),
    maxRetries: parseBoundedInteger(env.AI_MAX_RETRIES, 1, 0, 2),
  });
}

export function getRuntimeAILimits() {
  return {
    dailyLimit: parseBoundedInteger(env.AI_DAILY_LIMIT, 20, 1, 200),
    retentionDays: parseBoundedInteger(env.AI_RETENTION_DAYS, 90, 1, 3650),
  };
}
