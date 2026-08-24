import assert from "node:assert/strict";
import test from "node:test";
import { evidenceRecomputeDisposition } from "../lib/services/evidence-recompute-policy.ts";

const cases = [
  ["claim-race", "LOCK_CONTENTION", "RETRY"],
  ["lease-expiry", "WORKER_CRASH", "RETRY"],
  ["dead-worker", "WORKER_CRASH", "RETRY"],
  ["transient-db", "TRANSIENT_DB", "RETRY"],
  ["checkpoint-write", "CHECKPOINT_FAILURE", "RETRY"],
  ["evidence-write", "TRANSIENT_DB", "RETRY"],
  ["mastery-handoff", "MASTERY_HANDOFF_FAILURE", "RETRY"],
  ["mapping-version", "MAPPING_VERSION_CHANGED", "SUPERSEDE"],
  ["projection-version", "PROJECTION_VERSION_CHANGED", "SUPERSEDE"],
  ["cross-user", "SECURITY_SCOPE_FAILURE", "TERMINAL_FAIL"],
  ["invalid-concept", "INVALID_REQUEST", "TERMINAL_FAIL"],
  ["deleted-user-hook", "SECURITY_SCOPE_FAILURE", "TERMINAL_FAIL"],
  ["stale-request", "SOURCE_INVALID", "TERMINAL_FAIL"],
  ["duplicate-replay", "TRANSIENT_DB", "RETRY"],
  ["retry-exhaustion", "CORRUPT_SOURCE", "TERMINAL_FAIL"],
  ["full-resume", "WORKER_CRASH", "RETRY"],
];

test("E2-A frozen failure matrix preserves exact dispositions", () => {
  assert.equal(cases.length, 16);
  for (const [, errorClass, expected] of cases) assert.equal(evidenceRecomputeDisposition(errorClass), expected);
});

test("E2-A failure classifications are never implicitly retryable", () => {
  assert.equal(evidenceRecomputeDisposition("CORRUPT_SOURCE"), "TERMINAL_FAIL");
  assert.equal(evidenceRecomputeDisposition("SECURITY_SCOPE_FAILURE"), "TERMINAL_FAIL");
  assert.equal(evidenceRecomputeDisposition("MAPPING_VERSION_CHANGED"), "SUPERSEDE");
});

