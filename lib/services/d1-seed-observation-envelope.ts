export const D1_SEED_OBSERVATION_ENVELOPE_SCHEMA_VERSION = 1 as const;

export const D1_SEED_TARGET_SCOPES = Object.freeze([
  "d1-local",
  "d1-remote",
  "d1-managed",
] as const);

export type D1SeedTargetScope = (typeof D1_SEED_TARGET_SCOPES)[number];

export const D1_SEED_TARGET_IDENTITY_EVIDENCE = Object.freeze([
  "EXPLICIT_CONFIG",
  "LOCAL_PERSISTENCE_IDENTITY",
] as const);

export type D1SeedTargetIdentityEvidence =
  (typeof D1_SEED_TARGET_IDENTITY_EVIDENCE)[number];

export const D1_SEED_EXECUTION_STAGES = Object.freeze([
  "PREFLIGHT",
  "WRITE",
  "POST_WRITE_RECHECK",
  "VERIFICATION",
  "REPORT",
  "DONE",
] as const);

export type D1SeedObservationExecutionStage =
  (typeof D1_SEED_EXECUTION_STAGES)[number];

export const D1_SEED_WRITE_PROCESS_OUTCOMES = Object.freeze([
  "NOT_STARTED",
  "EXIT_ZERO",
  "EXIT_NONZERO",
  "TIMEOUT",
  "PROCESS_LOSS",
  "OUTPUT_LOSS",
] as const);

export type D1SeedWriteProcessOutcome =
  (typeof D1_SEED_WRITE_PROCESS_OUTCOMES)[number];

export const D1_SEED_COMMIT_EVIDENCE_KINDS = Object.freeze([
  "NONE",
  "WRITER_ACKNOWLEDGEMENT",
  "TARGET_READ_BACK",
  "OPERATION_BOUND_READ_BACK",
] as const);

export type D1SeedCommitEvidenceKind =
  (typeof D1_SEED_COMMIT_EVIDENCE_KINDS)[number];

export const D1_SEED_SNAPSHOT_OBSERVATIONS = Object.freeze([
  "NOT_RUN",
  "PASSED",
  "MISMATCH",
  "QUERY_FAILED",
  "UNAVAILABLE",
] as const);

export type D1SeedSnapshotObservation =
  (typeof D1_SEED_SNAPSHOT_OBSERVATIONS)[number];

export const D1_SEED_VERIFICATION_RESULTS = Object.freeze([
  "NOT_RUN",
  "PASSED",
  "MISMATCH",
  "QUERY_FAILED",
  "UNAVAILABLE",
] as const);

export type D1SeedVerificationResult =
  (typeof D1_SEED_VERIFICATION_RESULTS)[number];

export const D1_SEED_ROLLBACK_RESULTS = Object.freeze([
  "NOT_APPLICABLE",
  "CONFIRMED",
  "NOT_CONFIRMED",
] as const);

export type D1SeedRollbackResult = (typeof D1_SEED_ROLLBACK_RESULTS)[number];

export const D1_SEED_SECONDARY_FAILURES = Object.freeze([
  "REPORT_WRITE_FAILED",
  "CLEANUP_FAILED",
] as const);

export type D1SeedSecondaryFailure =
  (typeof D1_SEED_SECONDARY_FAILURES)[number];

export const D1_SEED_ERROR_CLASSES = Object.freeze([
  "INPUT_VALIDATION",
  "PREFLIGHT_QUERY",
  "WRITE_PROCESS",
  "TIMEOUT",
  "PROCESS_LOSS",
  "OUTPUT_LOSS",
  "SNAPSHOT_QUERY",
  "SNAPSHOT_MISMATCH",
  "VERIFICATION_QUERY",
  "VERIFICATION_MISMATCH",
] as const);

export type D1SeedObservationErrorClass =
  (typeof D1_SEED_ERROR_CLASSES)[number];

export const D1_SEED_REPORT_STATUSES = Object.freeze([
  "NOT_ATTEMPTED",
  "WRITTEN",
  "WRITE_FAILED",
  "UNKNOWN",
] as const);

export type D1SeedReportStatus = (typeof D1_SEED_REPORT_STATUSES)[number];

export type D1SeedObservationEnvelopeInput = Readonly<{
  schemaVersion: 1;
  operationId?: string;
  targetScope?: D1SeedTargetScope;
  targetIdentityEvidence?: readonly D1SeedTargetIdentityEvidence[];
  sourcePlanHash?: string;
  executionStage: D1SeedObservationExecutionStage;
  write: Readonly<{
    attempted: boolean;
    processOutcome: D1SeedWriteProcessOutcome;
    commitEvidence: D1SeedCommitEvidenceKind;
  }>;
  snapshot: Readonly<{
    before: D1SeedSnapshotObservation;
    after: D1SeedSnapshotObservation;
  }>;
  verification: D1SeedVerificationResult;
  rollback: D1SeedRollbackResult;
  secondaryFailures?: readonly D1SeedSecondaryFailure[];
  errorClass?: D1SeedObservationErrorClass;
  reportStatus?: D1SeedReportStatus;
}>;

export type D1SeedObservationEnvelope = Readonly<{
  schemaVersion: 1;
  operationId?: string;
  targetScope?: D1SeedTargetScope;
  targetIdentityEvidence?: readonly D1SeedTargetIdentityEvidence[];
  sourcePlanHash?: string;
  executionStage: D1SeedObservationExecutionStage;
  write: Readonly<{
    attempted: boolean;
    processOutcome: D1SeedWriteProcessOutcome;
    commitEvidence: D1SeedCommitEvidenceKind;
  }>;
  snapshot: Readonly<{
    before: D1SeedSnapshotObservation;
    after: D1SeedSnapshotObservation;
  }>;
  verification: D1SeedVerificationResult;
  rollback: D1SeedRollbackResult;
  secondaryFailures?: readonly D1SeedSecondaryFailure[];
  errorClass?: D1SeedObservationErrorClass;
  reportStatus?: D1SeedReportStatus;
}>;

export const D1_SEED_OBSERVATION_ENVELOPE_INPUT_ERRORS = Object.freeze([
  "INVALID_INPUT_TYPE",
  "UNKNOWN_ENUM_VALUE",
  "CONTRADICTORY_OBSERVATION",
] as const);

export type D1SeedObservationEnvelopeInputError =
  (typeof D1_SEED_OBSERVATION_ENVELOPE_INPUT_ERRORS)[number];

export type D1SeedObservationEnvelopeResult =
  | {
      kind: "VALID";
      envelope: D1SeedObservationEnvelope;
    }
  | {
      kind: "INPUT_ERROR";
      code: D1SeedObservationEnvelopeInputError;
    };

type RecordValue = Record<string, unknown>;
type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: D1SeedObservationEnvelopeInputError };

const ROOT_REQUIRED_KEYS = Object.freeze([
  "schemaVersion",
  "executionStage",
  "write",
  "snapshot",
  "verification",
  "rollback",
] as const);

const ROOT_OPTIONAL_KEYS = Object.freeze([
  "operationId",
  "targetScope",
  "targetIdentityEvidence",
  "sourcePlanHash",
  "secondaryFailures",
  "errorClass",
  "reportStatus",
] as const);

const WRITE_KEYS = Object.freeze(["attempted", "processOutcome", "commitEvidence"] as const);
const SNAPSHOT_KEYS = Object.freeze(["before", "after"] as const);
const TOKEN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/;

function isRecord(value: unknown): value is RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: RecordValue, allowedKeys: readonly string[]): boolean {
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && allowedKeys.includes(key),
  );
}

function hasRequiredKeys(value: RecordValue, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function inputError(code: D1SeedObservationEnvelopeInputError): D1SeedObservationEnvelopeResult {
  return { kind: "INPUT_ERROR", code };
}

function invalidInput<T>(): ParseResult<T> {
  return { ok: false, code: "INVALID_INPUT_TYPE" };
}

function unknownEnum<T>(): ParseResult<T> {
  return { ok: false, code: "UNKNOWN_ENUM_VALUE" };
}

function contradictory<T>(): ParseResult<T> {
  return { ok: false, code: "CONTRADICTORY_OBSERVATION" };
}

function parseEnum<T extends string>(value: unknown, values: readonly T[]): ParseResult<T> {
  if (typeof value !== "string") return invalidInput();
  if (!values.includes(value as T)) return unknownEnum();
  return { ok: true, value: value as T };
}

function parseOptionalEnum<T extends string>(
  record: RecordValue,
  key: string,
  values: readonly T[],
): ParseResult<T | undefined> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return { ok: true, value: undefined };
  }
  return parseEnum(record[key], values);
}

function parseUniqueEnumArray<T extends string>(
  record: RecordValue,
  key: string,
  values: readonly T[],
): ParseResult<readonly T[] | undefined> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(record[key])) return invalidInput();

  const parsedValues: T[] = [];
  for (const value of record[key]) {
    const parsed = parseEnum(value, values);
    if (!parsed.ok) return parsed;
    parsedValues.push(parsed.value);
  }
  if (new Set(parsedValues).size !== parsedValues.length) return contradictory();

  const sorted = [...parsedValues].sort(
    (left, right) => values.indexOf(left) - values.indexOf(right),
  );
  return { ok: true, value: Object.freeze(sorted) };
}

function parseToken(value: unknown): ParseResult<string> {
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) return invalidInput();
  return { ok: true, value };
}

function parseOptionalToken(record: RecordValue, key: string): ParseResult<string | undefined> {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return { ok: true, value: undefined };
  }
  return parseToken(record[key]);
}

function parseWrite(
  value: unknown,
): ParseResult<D1SeedObservationEnvelopeInput["write"]> {
  if (!isRecord(value)) return invalidInput();
  if (!hasOnlyKeys(value, WRITE_KEYS) || !hasRequiredKeys(value, WRITE_KEYS)) {
    return invalidInput();
  }
  if (typeof value.attempted !== "boolean") return invalidInput();

  const processOutcome = parseEnum(value.processOutcome, D1_SEED_WRITE_PROCESS_OUTCOMES);
  if (!processOutcome.ok) return processOutcome;
  const commitEvidence = parseEnum(value.commitEvidence, D1_SEED_COMMIT_EVIDENCE_KINDS);
  if (!commitEvidence.ok) return commitEvidence;

  return {
    ok: true,
    value: Object.freeze({
      attempted: value.attempted,
      processOutcome: processOutcome.value,
      commitEvidence: commitEvidence.value,
    }),
  };
}

function parseSnapshot(
  value: unknown,
): ParseResult<D1SeedObservationEnvelopeInput["snapshot"]> {
  if (!isRecord(value)) return invalidInput();
  if (!hasOnlyKeys(value, SNAPSHOT_KEYS) || !hasRequiredKeys(value, SNAPSHOT_KEYS)) {
    return invalidInput();
  }

  const before = parseEnum(value.before, D1_SEED_SNAPSHOT_OBSERVATIONS);
  if (!before.ok) return before;
  const after = parseEnum(value.after, D1_SEED_SNAPSHOT_OBSERVATIONS);
  if (!after.ok) return after;

  return {
    ok: true,
    value: Object.freeze({ before: before.value, after: after.value }),
  };
}

function validateRelations(
  executionStage: D1SeedObservationExecutionStage,
  write: D1SeedObservationEnvelopeInput["write"],
  snapshot: D1SeedObservationEnvelopeInput["snapshot"],
  verification: D1SeedVerificationResult,
  rollback: D1SeedRollbackResult,
): ParseResult<null> {
  if (!write.attempted) {
    if (
      executionStage !== "PREFLIGHT" ||
      write.processOutcome !== "NOT_STARTED" ||
      write.commitEvidence !== "NONE" ||
      snapshot.after !== "NOT_RUN" ||
      verification !== "NOT_RUN" ||
      rollback !== "NOT_APPLICABLE"
    ) {
      return contradictory();
    }
    return { ok: true, value: null };
  }

  if (executionStage === "PREFLIGHT" || write.processOutcome === "NOT_STARTED") {
    return contradictory();
  }
  if (executionStage === "WRITE" && (snapshot.after !== "NOT_RUN" || verification !== "NOT_RUN")) {
    return contradictory();
  }
  if (
    write.commitEvidence === "WRITER_ACKNOWLEDGEMENT" &&
    write.processOutcome !== "EXIT_ZERO"
  ) {
    return contradictory();
  }
  return { ok: true, value: null };
}

function freezeEnvelope(
  input: Readonly<{
    schemaVersion: 1;
    operationId?: string;
    targetScope?: D1SeedTargetScope;
    targetIdentityEvidence?: readonly D1SeedTargetIdentityEvidence[];
    sourcePlanHash?: string;
    executionStage: D1SeedObservationExecutionStage;
    write: D1SeedObservationEnvelopeInput["write"];
    snapshot: D1SeedObservationEnvelopeInput["snapshot"];
    verification: D1SeedVerificationResult;
    rollback: D1SeedRollbackResult;
    secondaryFailures?: readonly D1SeedSecondaryFailure[];
    errorClass?: D1SeedObservationErrorClass;
    reportStatus?: D1SeedReportStatus;
  }>,
): D1SeedObservationEnvelope {
  return Object.freeze({
    schemaVersion: input.schemaVersion,
    ...(input.operationId === undefined ? {} : { operationId: input.operationId }),
    ...(input.targetScope === undefined ? {} : { targetScope: input.targetScope }),
    ...(input.targetIdentityEvidence === undefined
      ? {}
      : { targetIdentityEvidence: Object.freeze([...input.targetIdentityEvidence]) }),
    ...(input.sourcePlanHash === undefined ? {} : { sourcePlanHash: input.sourcePlanHash }),
    executionStage: input.executionStage,
    write: input.write,
    snapshot: input.snapshot,
    verification: input.verification,
    rollback: input.rollback,
    ...(input.secondaryFailures === undefined
      ? {}
      : { secondaryFailures: Object.freeze([...input.secondaryFailures]) }),
    ...(input.errorClass === undefined ? {} : { errorClass: input.errorClass }),
    ...(input.reportStatus === undefined ? {} : { reportStatus: input.reportStatus }),
  }) as D1SeedObservationEnvelope;
}

export function validateD1SeedObservationEnvelope(
  input: unknown,
): D1SeedObservationEnvelopeResult {
  if (!isRecord(input)) return inputError("INVALID_INPUT_TYPE");

  const allowedRootKeys = [...ROOT_REQUIRED_KEYS, ...ROOT_OPTIONAL_KEYS];
  if (
    !hasOnlyKeys(input, allowedRootKeys) ||
    !hasRequiredKeys(input, ROOT_REQUIRED_KEYS)
  ) {
    return inputError("INVALID_INPUT_TYPE");
  }
  if (input.schemaVersion !== D1_SEED_OBSERVATION_ENVELOPE_SCHEMA_VERSION) {
    return inputError("INVALID_INPUT_TYPE");
  }

  const executionStage = parseEnum(input.executionStage, D1_SEED_EXECUTION_STAGES);
  if (!executionStage.ok) return inputError(executionStage.code);
  const targetScope = parseOptionalEnum(input, "targetScope", D1_SEED_TARGET_SCOPES);
  if (!targetScope.ok) return inputError(targetScope.code);
  const targetIdentityEvidence = parseUniqueEnumArray(
    input,
    "targetIdentityEvidence",
    D1_SEED_TARGET_IDENTITY_EVIDENCE,
  );
  if (!targetIdentityEvidence.ok) return inputError(targetIdentityEvidence.code);
  const operationId = parseOptionalToken(input, "operationId");
  if (!operationId.ok) return inputError(operationId.code);
  const sourcePlanHash = parseOptionalToken(input, "sourcePlanHash");
  if (!sourcePlanHash.ok) return inputError(sourcePlanHash.code);

  const write = parseWrite(input.write);
  if (!write.ok) return inputError(write.code);
  const snapshot = parseSnapshot(input.snapshot);
  if (!snapshot.ok) return inputError(snapshot.code);
  const verification = parseEnum(input.verification, D1_SEED_VERIFICATION_RESULTS);
  if (!verification.ok) return inputError(verification.code);
  const rollback = parseEnum(input.rollback, D1_SEED_ROLLBACK_RESULTS);
  if (!rollback.ok) return inputError(rollback.code);
  const secondaryFailures = parseUniqueEnumArray(
    input,
    "secondaryFailures",
    D1_SEED_SECONDARY_FAILURES,
  );
  if (!secondaryFailures.ok) return inputError(secondaryFailures.code);
  const errorClass = parseOptionalEnum(input, "errorClass", D1_SEED_ERROR_CLASSES);
  if (!errorClass.ok) return inputError(errorClass.code);
  const reportStatus = parseOptionalEnum(input, "reportStatus", D1_SEED_REPORT_STATUSES);
  if (!reportStatus.ok) return inputError(reportStatus.code);

  const relationResult = validateRelations(
    executionStage.value,
    write.value,
    snapshot.value,
    verification.value,
    rollback.value,
  );
  if (!relationResult.ok) return inputError(relationResult.code);

  return {
    kind: "VALID",
    envelope: freezeEnvelope({
      schemaVersion: D1_SEED_OBSERVATION_ENVELOPE_SCHEMA_VERSION,
      operationId: operationId.value,
      targetScope: targetScope.value,
      targetIdentityEvidence: targetIdentityEvidence.value,
      sourcePlanHash: sourcePlanHash.value,
      executionStage: executionStage.value,
      write: write.value,
      snapshot: snapshot.value,
      verification: verification.value,
      rollback: rollback.value,
      secondaryFailures: secondaryFailures.value,
      errorClass: errorClass.value,
      reportStatus: reportStatus.value,
    }),
  };
}

export function createD1SeedObservationEnvelope(
  input: unknown,
): D1SeedObservationEnvelopeResult {
  return validateD1SeedObservationEnvelope(input);
}
