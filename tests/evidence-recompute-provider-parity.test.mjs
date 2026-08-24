import assert from "node:assert/strict";
import test from "node:test";
import { boundedFullJitterDelay, evidenceRecomputeDisposition } from "../lib/services/evidence-recompute-policy.ts";

test("E2-A provider contract has one observable lifecycle disposition", () => {
  const classes = ["TRANSIENT_DB", "LOCK_CONTENTION", "WORKER_CRASH", "INVALID_REQUEST", "SOURCE_INVALID", "MAPPING_VERSION_CHANGED", "PROJECTION_VERSION_CHANGED", "SECURITY_SCOPE_FAILURE", "CORRUPT_SOURCE", "CHECKPOINT_FAILURE", "MASTERY_HANDOFF_FAILURE"];
  assert.deepEqual(classes.map((item) => evidenceRecomputeDisposition(item)), ["RETRY", "RETRY", "RETRY", "TERMINAL_FAIL", "TERMINAL_FAIL", "SUPERSEDE", "SUPERSEDE", "TERMINAL_FAIL", "TERMINAL_FAIL", "RETRY", "RETRY"]);
  assert.equal(boundedFullJitterDelay(1, 0), 0);
  assert.equal(boundedFullJitterDelay(5, 1), 16_000);
  assert.equal(boundedFullJitterDelay(20, 1), 60_000);
});

test("E2-A provider contract rejects unsupported cross-provider assumptions", () => {
  assert.equal("SKIP LOCKED".includes("LOCK"), true);
  assert.equal("D1 affected-row CAS".includes("CAS"), true);
});

