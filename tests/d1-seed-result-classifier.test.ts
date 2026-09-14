import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyD1SeedResult,
  type D1SeedResultObservation,
} from "../lib/services/d1-seed-result-classifier.ts";

function observation(
  overrides: Partial<D1SeedResultObservation> = {},
): D1SeedResultObservation {
  return {
    executionStage: "DONE",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "OPERATION_BOUND_READ_BACK",
      ...overrides.write,
    },
    verification: "NOT_RUN",
    rollback: "NOT_APPLICABLE",
    secondaryFailures: [],
    ...overrides,
  };
}

function expected(
  input: D1SeedResultObservation,
  resultState: string,
  writeCommit: string,
  verification = input.verification,
  secondaryFailures: readonly string[] = [],
) {
  return {
    kind: "CLASSIFIED",
    resultState,
    executionStage: input.executionStage,
    writeCommit,
    verification,
    rollback: input.rollback,
    secondaryFailures,
  };
}

test("classifies a failure before write", () => {
  const input: D1SeedResultObservation = {
    executionStage: "PREFLIGHT",
    write: {
      attempted: false,
      processOutcome: "NOT_STARTED",
      commitEvidence: "NONE",
    },
    verification: "NOT_RUN",
    rollback: "NOT_APPLICABLE",
  };

  assert.deepEqual(classifyD1SeedResult(input), expected(input, "FAILED_BEFORE_WRITE", "NOT_ATTEMPTED"));
});

test("classifies operation-bound evidence and verification success", () => {
  const input = observation({ verification: "PASSED" });

  assert.deepEqual(classifyD1SeedResult(input), expected(input, "COMMITTED_VERIFIED", "CONFIRMED"));
});

test("classifies operation-bound evidence and verification mismatch", () => {
  const input = observation({ verification: "MISMATCH" });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_VERIFICATION_FAILED", "CONFIRMED"),
  );
});

test("classifies committed but unverified when verification did not run", () => {
  const input = observation({ verification: "NOT_RUN" });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_BUT_UNVERIFIED", "CONFIRMED"),
  );
});

test("classifies verification query failure separately from verification mismatch", () => {
  const input = observation({ verification: "QUERY_FAILED" });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_BUT_UNVERIFIED", "CONFIRMED"),
  );
});

test("does not treat exit zero alone as durable commit proof", () => {
  const input = observation({
    write: { attempted: true, processOutcome: "EXIT_ZERO", commitEvidence: "NONE" },
  });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_BUT_UNVERIFIED", "ACKNOWLEDGED"),
  );
  assert.notEqual(
    (classifyD1SeedResult(input) as { resultState?: string }).resultState,
    "COMMITTED_VERIFIED",
  );
});

test("does not elevate an existing row read-back to operation-bound commit evidence", () => {
  const input = observation({
    write: { attempted: true, processOutcome: "EXIT_ZERO", commitEvidence: "TARGET_READ_BACK" },
  });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_BUT_UNVERIFIED", "ACKNOWLEDGED"),
  );
});

test("does not accept verification success without operation-bound commit evidence", () => {
  const input = observation({
    write: { attempted: true, processOutcome: "EXIT_ZERO", commitEvidence: "TARGET_READ_BACK" },
    verification: "PASSED",
  });

  assert.deepEqual(classifyD1SeedResult(input), {
    kind: "UNSUPPORTED_COMBINATION",
    code: "VERIFICATION_REQUIRES_OPERATION_BOUND_COMMIT_EVIDENCE",
  });
});

test("classifies timeout and output loss as unknown commit outcome", () => {
  for (const processOutcome of ["TIMEOUT", "OUTPUT_LOSS"] as const) {
    const input = observation({
      write: { attempted: true, processOutcome, commitEvidence: "NONE" },
    });
    assert.deepEqual(
      classifyD1SeedResult(input),
      expected(input, "COMMIT_OUTCOME_UNKNOWN", "UNKNOWN"),
    );
  }
});

test("does not reduce a write-after-start failure to failed before write", () => {
  const input = observation({
    write: { attempted: true, processOutcome: "EXIT_NONZERO", commitEvidence: "NONE" },
  });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMIT_OUTCOME_UNKNOWN", "UNKNOWN"),
  );
  assert.notEqual(
    (classifyD1SeedResult(input) as { resultState?: string }).resultState,
    "FAILED_BEFORE_WRITE",
  );
});

test("preserves the primary state when report and cleanup fail", () => {
  const input = observation({
    verification: "PASSED",
    secondaryFailures: ["CLEANUP_FAILED", "REPORT_WRITE_FAILED"],
  });

  assert.deepEqual(
    classifyD1SeedResult(input),
    expected(input, "COMMITTED_VERIFIED", "CONFIRMED", "PASSED", [
      "REPORT_WRITE_FAILED",
      "CLEANUP_FAILED",
    ]),
  );
});

test("keeps a confirmed rollback outside the five-state result set", () => {
  const input = observation({
    write: { attempted: true, processOutcome: "EXIT_NONZERO", commitEvidence: "NONE" },
    rollback: "CONFIRMED",
  });

  assert.deepEqual(classifyD1SeedResult(input), {
    kind: "UNSUPPORTED_COMBINATION",
    code: "ROLLBACK_CONFIRMED_NOT_IN_RESULT_SET",
  });
});

test("rejects invalid types, unknown enums, and contradictory observations", () => {
  assert.deepEqual(classifyD1SeedResult(null), {
    kind: "INPUT_ERROR",
    code: "INVALID_INPUT_TYPE",
  });

  assert.deepEqual(
    classifyD1SeedResult({ ...observation(), verification: "MAYBE" }),
    { kind: "INPUT_ERROR", code: "UNKNOWN_ENUM_VALUE" },
  );

  assert.deepEqual(
    classifyD1SeedResult({
      ...observation(),
      write: { attempted: true, processOutcome: "NOT_STARTED", commitEvidence: "NONE" },
    }),
    { kind: "INPUT_ERROR", code: "CONTRADICTORY_OBSERVATION" },
  );
});

test("does not mutate input and is deterministic across repeated calls", () => {
  const input = observation({
    verification: "PASSED",
    secondaryFailures: ["CLEANUP_FAILED", "REPORT_WRITE_FAILED"],
  });
  const before = structuredClone(input);
  const first = classifyD1SeedResult(input);
  const second = classifyD1SeedResult(input);

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test("returns only the public result allowlist and never reflects an input sentinel", () => {
  const input = observation({ verification: "PASSED" });
  const result = classifyD1SeedResult(input);

  assert.deepEqual(Object.keys(result).sort(), [
    "executionStage",
    "kind",
    "resultState",
    "rollback",
    "secondaryFailures",
    "verification",
    "writeCommit",
  ]);
  assert.equal(JSON.stringify(result).includes("sentinel"), false);
});
