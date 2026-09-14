import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createD1SeedObservationEnvelope,
  D1_SEED_COMMIT_EVIDENCE_KINDS,
  D1_SEED_ERROR_CLASSES,
  D1_SEED_EXECUTION_STAGES,
  D1_SEED_OBSERVATION_ENVELOPE_INPUT_ERRORS,
  D1_SEED_REPORT_STATUSES,
  D1_SEED_ROLLBACK_RESULTS,
  D1_SEED_SECONDARY_FAILURES,
  D1_SEED_SNAPSHOT_OBSERVATIONS,
  D1_SEED_TARGET_IDENTITY_EVIDENCE,
  D1_SEED_TARGET_SCOPES,
  D1_SEED_VERIFICATION_RESULTS,
  D1_SEED_WRITE_PROCESS_OUTCOMES,
  validateD1SeedObservationEnvelope,
} from "../lib/services/d1-seed-observation-envelope";

type SyntheticObservationInput = Record<string, unknown>;

function validInput(
  overrides: SyntheticObservationInput = {},
): SyntheticObservationInput {
  const input: SyntheticObservationInput = {
    schemaVersion: 1,
    operationId: "op-20260914-001",
    targetScope: "d1-local",
    targetIdentityEvidence: ["EXPLICIT_CONFIG"],
    sourcePlanHash: "a1b2c3d4e5f6",
    executionStage: "VERIFICATION",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "PASSED",
    rollback: "NOT_APPLICABLE",
    secondaryFailures: [],
    reportStatus: "WRITTEN",
    ...overrides,
  };
  for (const key of ["operationId", "targetScope", "targetIdentityEvidence", "sourcePlanHash", "secondaryFailures", "errorClass", "reportStatus"]) {
    if (input[key] === undefined) delete input[key];
  }
  return input;
}

function validEnvelope(input: SyntheticObservationInput) {
  const result = createD1SeedObservationEnvelope(validInput(input));
  assert.equal(result.kind, "VALID");
  if (result.kind !== "VALID") throw new Error("expected a valid envelope");
  return result.envelope;
}

test("normal stage observations preserve independent axes without classification", () => {
  const preflight = validEnvelope({
    schemaVersion: 1,
    executionStage: "PREFLIGHT",
    write: {
      attempted: false,
      processOutcome: "NOT_STARTED",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "NOT_RUN",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    rollback: "NOT_APPLICABLE",
  });
  assert.equal(preflight.write.attempted, false);
  assert.equal(preflight.write.processOutcome, "NOT_STARTED");
  assert.equal(preflight.verification, "NOT_RUN");

  const write = validEnvelope({
    executionStage: "WRITE",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    errorClass: undefined,
  });
  assert.equal(write.executionStage, "WRITE");
  assert.equal(write.snapshot.after, "NOT_RUN");

  const recheck = validEnvelope({
    executionStage: "POST_WRITE_RECHECK",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "WRITER_ACKNOWLEDGEMENT",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "NOT_RUN",
  });
  assert.equal(recheck.write.commitEvidence, "WRITER_ACKNOWLEDGEMENT");
  assert.equal(recheck.verification, "NOT_RUN");

  const verification = validEnvelope({
    executionStage: "VERIFICATION",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "TARGET_READ_BACK",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "PASSED",
  });
  assert.equal(verification.snapshot.after, "PASSED");
  assert.equal(verification.verification, "PASSED");
  assert.equal("resultState" in verification, false);
  assert.equal("writeCommit" in verification, false);
});

test("preflight failure and write failure remain distinct observations", () => {
  const beforeWrite = validEnvelope({
    executionStage: "PREFLIGHT",
    write: {
      attempted: false,
      processOutcome: "NOT_STARTED",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "QUERY_FAILED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    rollback: "NOT_APPLICABLE",
    errorClass: "PREFLIGHT_QUERY",
  });
  assert.equal(beforeWrite.write.processOutcome, "NOT_STARTED");
  assert.equal(beforeWrite.snapshot.before, "QUERY_FAILED");

  const duringWrite = validEnvelope({
    executionStage: "WRITE",
    write: {
      attempted: true,
      processOutcome: "EXIT_NONZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    rollback: "NOT_CONFIRMED",
    errorClass: "WRITE_PROCESS",
  });
  assert.equal(duringWrite.write.attempted, true);
  assert.equal(duringWrite.write.processOutcome, "EXIT_NONZERO");
  assert.equal(duringWrite.rollback, "NOT_CONFIRMED");
});

test("timeout, process loss, and output loss preserve unknown outcomes", () => {
  const timeout = validEnvelope({
    executionStage: "WRITE",
    write: {
      attempted: true,
      processOutcome: "TIMEOUT",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    rollback: "NOT_CONFIRMED",
    errorClass: "TIMEOUT",
  });
  assert.equal(timeout.write.processOutcome, "TIMEOUT");
  assert.equal(timeout.rollback, "NOT_CONFIRMED");

  const processLoss = validEnvelope({
    executionStage: "WRITE",
    write: {
      attempted: true,
      processOutcome: "PROCESS_LOSS",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    errorClass: "PROCESS_LOSS",
  });
  assert.equal(processLoss.write.processOutcome, "PROCESS_LOSS");

  const outputLoss = validEnvelope({
    executionStage: "WRITE",
    write: {
      attempted: true,
      processOutcome: "OUTPUT_LOSS",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "NOT_RUN",
    },
    verification: "NOT_RUN",
    errorClass: "OUTPUT_LOSS",
  });
  assert.equal(outputLoss.write.processOutcome, "OUTPUT_LOSS");
  assert.equal(outputLoss.verification, "NOT_RUN");
});

test("plain row/read-back and verification results are facts, not commit promotion", () => {
  const readBack = validEnvelope({
    executionStage: "POST_WRITE_RECHECK",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "TARGET_READ_BACK",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "NOT_RUN",
  });
  assert.equal(readBack.write.commitEvidence, "TARGET_READ_BACK");
  assert.equal(readBack.verification, "NOT_RUN");

  const passWithoutOperationBinding = validEnvelope({
    executionStage: "VERIFICATION",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "PASSED",
  });
  assert.equal(passWithoutOperationBinding.verification, "PASSED");
  assert.equal(passWithoutOperationBinding.write.commitEvidence, "NONE");
  assert.equal("resultState" in passWithoutOperationBinding, false);
});

test("verification pass, mismatch, and query error remain distinguishable", () => {
  const cases = ["PASSED", "MISMATCH", "QUERY_FAILED"] as const;
  for (const verification of cases) {
    const envelope = validEnvelope({
      executionStage: "VERIFICATION",
      write: {
        attempted: true,
        processOutcome: "EXIT_ZERO",
        commitEvidence: "NONE",
      },
      snapshot: {
        before: "PASSED",
        after: "MISMATCH",
      },
      verification,
      errorClass:
        verification === "QUERY_FAILED"
          ? "VERIFICATION_QUERY"
          : verification === "MISMATCH"
            ? "VERIFICATION_MISMATCH"
            : undefined,
    });
    assert.equal(envelope.verification, verification);
    assert.equal(envelope.snapshot.after, "MISMATCH");
  }
});

test("preserves verification and snapshot facts alongside uncertain write outcomes", () => {
  const cases = [
    { processOutcome: "TIMEOUT", snapshotAfter: "QUERY_FAILED", verification: "PASSED" },
    { processOutcome: "OUTPUT_LOSS", snapshotAfter: "UNAVAILABLE", verification: "MISMATCH" },
  ] as const;

  for (const observation of cases) {
    const envelope = validEnvelope({
      executionStage: "VERIFICATION",
      write: {
        attempted: true,
        processOutcome: observation.processOutcome,
        commitEvidence: "NONE",
      },
      snapshot: {
        before: "PASSED",
        after: observation.snapshotAfter,
      },
      verification: observation.verification,
      rollback: "NOT_CONFIRMED",
    });

    assert.equal(envelope.write.processOutcome, observation.processOutcome);
    assert.equal(envelope.snapshot.after, observation.snapshotAfter);
    assert.equal(envelope.verification, observation.verification);
    assert.equal(envelope.rollback, "NOT_CONFIRMED");
  }
});

test("primary observation and secondary cleanup/report failures coexist", () => {
  const envelope = validEnvelope({
    executionStage: "REPORT",
    write: {
      attempted: true,
      processOutcome: "EXIT_NONZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "QUERY_FAILED",
    },
    verification: "QUERY_FAILED",
    rollback: "NOT_CONFIRMED",
    secondaryFailures: ["CLEANUP_FAILED", "REPORT_WRITE_FAILED"],
    errorClass: "VERIFICATION_QUERY",
    reportStatus: "WRITE_FAILED",
  });
  assert.deepEqual(envelope.secondaryFailures, ["REPORT_WRITE_FAILED", "CLEANUP_FAILED"]);
  assert.equal(envelope.write.processOutcome, "EXIT_NONZERO");
  assert.equal(envelope.verification, "QUERY_FAILED");
  assert.equal(envelope.reportStatus, "WRITE_FAILED");
});

test("malformed types, enums, unknown keys, and structural contradictions fail closed", () => {
  const invalidCases: unknown[] = [
    null,
    "not-an-object",
    { ...validInput(), schemaVersion: "1" },
    { ...validInput(), executionStage: "UNKNOWN_STAGE" },
    { ...validInput(), verification: "UNKNOWN_RESULT" },
    { ...validInput(), write: { attempted: "true", processOutcome: "EXIT_ZERO", commitEvidence: "NONE" } },
    { ...validInput(), write: { attempted: true, processOutcome: "NOT_STARTED", commitEvidence: "NONE" } },
    {
      ...validInput(),
      executionStage: "PREFLIGHT",
      write: { attempted: true, processOutcome: "EXIT_NONZERO", commitEvidence: "NONE" },
    },
    {
      ...validInput(),
      executionStage: "WRITE",
      snapshot: { before: "PASSED", after: "PASSED" },
      verification: "PASSED",
    },
    {
      ...validInput(),
      write: { attempted: true, processOutcome: "EXIT_NONZERO", commitEvidence: "WRITER_ACKNOWLEDGEMENT" },
    },
    {
      ...validInput(),
      write: { attempted: false, processOutcome: "NOT_STARTED", commitEvidence: "NONE" },
      executionStage: "PREFLIGHT",
      snapshot: { before: "NOT_RUN", after: "NOT_RUN" },
      verification: "NOT_RUN",
      rollback: "NOT_APPLICABLE",
      secondaryFailures: ["CLEANUP_FAILED", "CLEANUP_FAILED"],
    },
    { ...validInput(), extra: "rejected" },
  ];

  const customRoot = validInput();
  Object.setPrototypeOf(customRoot, { custom: "root-sentinel" });
  invalidCases.push(customRoot);

  const customNested = validInput();
  Object.setPrototypeOf(customNested.write, { custom: "nested-sentinel" });
  invalidCases.push(customNested);

  const hiddenUnknown = validInput();
  Object.defineProperty(hiddenUnknown, "hiddenUnknown", {
    value: "hidden-sentinel",
    enumerable: false,
  });
  invalidCases.push(hiddenUnknown);

  const symbolUnknown = validInput();
  Object.defineProperty(symbolUnknown, Symbol("unknown"), {
    value: "symbol-sentinel",
  });
  invalidCases.push(symbolUnknown);

  for (const input of invalidCases) {
    const result = validateD1SeedObservationEnvelope(input);
    assert.equal(result.kind, "INPUT_ERROR");
    assert.equal("envelope" in result, false);
    assert.deepEqual(Object.keys(result).sort(), ["code", "kind"]);
  }
});

test("sensitive fields, raw exceptions, and credential sentinels are rejected and never reflected", () => {
  const forbiddenFields = {
    stdout: "raw stdout secret-sentinel",
    stderr: "raw stderr secret-sentinel",
    sql: "SELECT password FROM users",
    rowPayload: { learnerId: "learner-secret-sentinel" },
    credential: "postgres://user:password@host/db",
    exception: new Error("stack secret-sentinel"),
    stack: "at secret-sentinel",
  };

  for (const field of Object.keys(forbiddenFields)) {
    const result = createD1SeedObservationEnvelope({
      ...validInput(),
      [field]: forbiddenFields[field as keyof typeof forbiddenFields],
    });
    assert.deepEqual(result, {
      kind: "INPUT_ERROR",
      code: "INVALID_INPUT_TYPE",
    });
    assert.doesNotMatch(JSON.stringify(result), /secret-sentinel|password|learner/);
  }
});

test("input is not mutated and output is deterministic, canonical, and deeply frozen", () => {
  const input = validInput({
    targetIdentityEvidence: ["LOCAL_PERSISTENCE_IDENTITY", "EXPLICIT_CONFIG"],
    secondaryFailures: ["CLEANUP_FAILED", "REPORT_WRITE_FAILED"],
  });
  const before = structuredClone(input);
  const first = createD1SeedObservationEnvelope(input);
  const second = createD1SeedObservationEnvelope({
    ...validInput({
      targetIdentityEvidence: ["EXPLICIT_CONFIG", "LOCAL_PERSISTENCE_IDENTITY"],
      secondaryFailures: ["REPORT_WRITE_FAILED", "CLEANUP_FAILED"],
    }),
  });

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  assert.equal(first.kind, "VALID");
  if (first.kind !== "VALID") throw new Error("expected a valid envelope");
  assert.equal(Object.isFrozen(first.envelope), true);
  assert.equal(Object.isFrozen(first.envelope.write), true);
  assert.equal(Object.isFrozen(first.envelope.snapshot), true);
  assert.equal(Object.isFrozen(first.envelope.targetIdentityEvidence), true);
  assert.equal(Object.isFrozen(first.envelope.secondaryFailures), true);

  for (const values of [
    D1_SEED_COMMIT_EVIDENCE_KINDS,
    D1_SEED_ERROR_CLASSES,
    D1_SEED_EXECUTION_STAGES,
    D1_SEED_OBSERVATION_ENVELOPE_INPUT_ERRORS,
    D1_SEED_REPORT_STATUSES,
    D1_SEED_ROLLBACK_RESULTS,
    D1_SEED_SECONDARY_FAILURES,
    D1_SEED_SNAPSHOT_OBSERVATIONS,
    D1_SEED_TARGET_IDENTITY_EVIDENCE,
    D1_SEED_TARGET_SCOPES,
    D1_SEED_VERIFICATION_RESULTS,
    D1_SEED_WRITE_PROCESS_OUTCOMES,
  ]) {
    assert.equal(Object.isFrozen(values), true);
  }
});

test("unobserved correlation, target, plan, and report fields stay absent", () => {
  const envelope = validEnvelope({
    operationId: undefined,
    targetScope: undefined,
    targetIdentityEvidence: undefined,
    sourcePlanHash: undefined,
    secondaryFailures: undefined,
    errorClass: undefined,
    reportStatus: undefined,
  });

  assert.deepEqual(envelope, {
    schemaVersion: 1,
    executionStage: "VERIFICATION",
    write: {
      attempted: true,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "NONE",
    },
    snapshot: {
      before: "PASSED",
      after: "PASSED",
    },
    verification: "PASSED",
    rollback: "NOT_APPLICABLE",
  });
  assert.equal("operationId" in envelope, false);
  assert.equal("targetScope" in envelope, false);
  assert.equal("sourcePlanHash" in envelope, false);
});

test("failed validation never returns a partial envelope or input details", () => {
  const result = createD1SeedObservationEnvelope({
    ...validInput(),
    write: {
      attempted: false,
      processOutcome: "EXIT_ZERO",
      commitEvidence: "NONE",
    },
    operationId: "operation-secret-sentinel",
  });

  assert.deepEqual(result, {
    kind: "INPUT_ERROR",
    code: "CONTRADICTORY_OBSERVATION",
  });
  assert.equal("envelope" in result, false);
  assert.doesNotMatch(JSON.stringify(result), /operation-secret-sentinel/);
});
