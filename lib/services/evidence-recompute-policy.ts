import type { RetryErrorClass } from "../../db/evidence-projection-repository.ts";

export const E2A_RETRYABLE_ERROR_CLASSES: readonly RetryErrorClass[] = [
  "TRANSIENT_DB", "LOCK_CONTENTION", "WORKER_CRASH", "CHECKPOINT_FAILURE", "MASTERY_HANDOFF_FAILURE",
];

export const E2A_SUPERSEDE_ERROR_CLASSES: readonly RetryErrorClass[] = [
  "MAPPING_VERSION_CHANGED", "PROJECTION_VERSION_CHANGED",
];

export const E2A_TERMINAL_ERROR_CLASSES: readonly RetryErrorClass[] = [
  "INVALID_REQUEST", "SOURCE_INVALID", "SECURITY_SCOPE_FAILURE", "CORRUPT_SOURCE",
];

export function evidenceRecomputeDisposition(errorClass: RetryErrorClass) {
  if (E2A_RETRYABLE_ERROR_CLASSES.includes(errorClass)) return "RETRY" as const;
  if (E2A_SUPERSEDE_ERROR_CLASSES.includes(errorClass)) return "SUPERSEDE" as const;
  if (E2A_TERMINAL_ERROR_CLASSES.includes(errorClass)) return "TERMINAL_FAIL" as const;
  return "TERMINAL_FAIL" as const;
}

export function boundedFullJitterDelay(attempt: number, random = Math.random()) {
  const cap = Math.min(60_000, 1_000 * (2 ** Math.max(0, attempt - 1)));
  return Math.floor(Math.max(0, Math.min(1, random)) * cap);
}

