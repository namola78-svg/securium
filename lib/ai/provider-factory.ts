import type { AIProvider } from "./ai-provider.ts";
import { MockAIProvider } from "./mock-ai-provider.ts";
import { OpenAIProvider } from "./openai-provider.ts";

export type AIProviderFactoryConfig = {
  provider?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImplementation?: typeof fetch;
};

export function createAIProvider(
  config: AIProviderFactoryConfig,
): AIProvider {
  const selected = config.provider?.trim().toLowerCase() ?? "mock";
  if (selected !== "openai") {
    return new MockAIProvider(
      selected === "disabled" ? "ai_disabled" : "configured_mock",
    );
  }
  if (!config.apiKey?.trim()) {
    return new MockAIProvider("missing_api_key");
  }
  return new OpenAIProvider({
    apiKey: config.apiKey,
    model: config.model?.trim() || "gpt-5.6-luna",
    timeoutMs: config.timeoutMs ?? 8_000,
    maxRetries: config.maxRetries ?? 1,
    fetchImplementation: config.fetchImplementation,
  });
}
