export const EXECUTION_STAGES = [
  "PREFLIGHT",
  "WRITE",
  "POST_WRITE_RECHECK",
  "VERIFICATION",
  "REPORT",
  "DONE",
] as const;

export type ExecutionStage = (typeof EXECUTION_STAGES)[number];

export const WRITE_PROCESS_OUTCOMES = [
  "NOT_STARTED",
  "EXIT_ZERO",
  "EXIT_NONZERO",
  "TIMEOUT",
  "PROCESS_LOSS",
  "OUTPUT_LOSS",
] as const;

export type WriteProcessOutcome = (typeof WRITE_PROCESS_OUTCOMES)[number];

export const COMMIT_EVIDENCE_KINDS = [
  "NONE",
  "WRITER_ACKNOWLEDGEMENT",
  "TARGET_READ_BACK",
  "OPERATION_BOUND_READ_BACK",
] as const;

export type CommitEvidenceKind = (typeof COMMIT_EVIDENCE_KINDS)[number];

export const VERIFICATION_RESULTS = [
  "NOT_RUN",
  "PASSED",
  "MISMATCH",
  "QUERY_FAILED",
  "UNAVAILABLE",
] as const;

export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export const ROLLBACK_RESULTS = [
  "NOT_APPLICABLE",
  "CONFIRMED",
  "NOT_CONFIRMED",
] as const;

export type RollbackResult = (typeof ROLLBACK_RESULTS)[number];

export const SECONDARY_FAILURES = ["REPORT_WRITE_FAILED", "CLEANUP_FAILED"] as const;

export type SecondaryFailure = (typeof SECONDARY_FAILURES)[number];

export const RESULT_STATES = [
  "FAILED_BEFORE_WRITE",
  "COMMITTED_VERIFICATION_FAILED",
  "COMMITTED_BUT_UNVERIFIED",
  "COMMIT_OUTCOME_UNKNOWN",
  "COMMITTED_VERIFIED",
] as const;

export type ResultState = (typeof RESULT_STATES)[number];

export const WRITE_COMMIT_RESULTS = [
  "NOT_ATTEMPTED",
  "FAILED",
  "ACKNOWLEDGED",
  "CONFIRMED",
  "UNKNOWN",
] as const;

export type WriteCommitResult = (typeof WRITE_COMMIT_RESULTS)[number];

export type D1SeedResultObservation = {
  executionStage: ExecutionStage;
  write: {
    attempted: boolean;
    processOutcome: WriteProcessOutcome;
    commitEvidence: CommitEvidenceKind;
  };
  verification: VerificationResult;
  rollback: RollbackResult;
  secondaryFailures?: readonly SecondaryFailure[];
};

export type ClassifiedD1SeedResult = {
  kind: "CLASSIFIED";
  resultState: ResultState;
  executionStage: ExecutionStage;
  writeCommit: WriteCommitResult;
  verification: VerificationResult;
  rollback: RollbackResult;
  secondaryFailures: readonly SecondaryFailure[];
};

export const INPUT_ERROR_CODES = [
  "INVALID_INPUT_TYPE",
  "UNKNOWN_ENUM_VALUE",
  "CONTRADICTORY_OBSERVATION",
] as const;

export type InputErrorCode = (typeof INPUT_ERROR_CODES)[number];

export const UNSUPPORTED_COMBINATION_CODES = [
  "ROLLBACK_CONFIRMED_NOT_IN_RESULT_SET",
  "VERIFICATION_REQUIRES_OPERATION_BOUND_COMMIT_EVIDENCE",
] as const;

export type UnsupportedCombinationCode = (typeof UNSUPPORTED_COMBINATION_CODES)[number];

export type D1SeedClassifierFailure =
  | {
      kind: "INPUT_ERROR";
      code: InputErrorCode;
    }
  | {
      kind: "UNSUPPORTED_COMBINATION";
      code: UnsupportedCombinationCode;
    };

export type D1SeedClassifierResult = ClassifiedD1SeedResult | D1SeedClassifierFailure;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: RecordValue, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasRequiredKeys(value: RecordValue, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validateEnumValue<T extends string>(
  value: unknown,
  values: readonly T[],
): { ok: true; value: T } | { ok: false; code: InputErrorCode } {
  if (typeof value !== "string") {
    return { ok: false, code: "INVALID_INPUT_TYPE" };
  }
  if (!values.includes(value as T)) {
    return { ok: false, code: "UNKNOWN_ENUM_VALUE" };
  }
  return { ok: true, value: value as T };
}

function inputError(code: InputErrorCode): D1SeedClassifierFailure {
  return { kind: "INPUT_ERROR", code };
}

function validateObservation(input: unknown):
  | { observation: D1SeedResultObservation; secondaryFailures: readonly SecondaryFailure[] }
  | D1SeedClassifierFailure {
  if (!isRecord(input)) {
    return inputError("INVALID_INPUT_TYPE");
  }

  const observationKeys = ["executionStage", "write", "verification", "rollback", "secondaryFailures"];
  if (!hasOnlyKeys(input, observationKeys) || !hasRequiredKeys(input, observationKeys.slice(0, 4))) {
    return inputError("INVALID_INPUT_TYPE");
  }

  const executionStage = validateEnumValue(input.executionStage, EXECUTION_STAGES);
  if (!executionStage.ok) {
    return inputError(executionStage.code);
  }
  const verification = validateEnumValue(input.verification, VERIFICATION_RESULTS);
  if (!verification.ok) {
    return inputError(verification.code);
  }
  const rollback = validateEnumValue(input.rollback, ROLLBACK_RESULTS);
  if (!rollback.ok) {
    return inputError(rollback.code);
  }

  const secondaryFailures: SecondaryFailure[] = [];
  if (input.secondaryFailures !== undefined) {
    if (!Array.isArray(input.secondaryFailures)) {
      return inputError("INVALID_INPUT_TYPE");
    }
    for (const failure of input.secondaryFailures) {
      const validatedFailure = validateEnumValue(failure, SECONDARY_FAILURES);
      if (!validatedFailure.ok) {
        return inputError(validatedFailure.code);
      }
      secondaryFailures.push(validatedFailure.value);
    }
    if (new Set(secondaryFailures).size !== secondaryFailures.length) {
      return inputError("CONTRADICTORY_OBSERVATION");
    }
  }

  if (!isRecord(input.write)) {
    return inputError("INVALID_INPUT_TYPE");
  }
  const writeKeys = ["attempted", "processOutcome", "commitEvidence"];
  if (!hasOnlyKeys(input.write, writeKeys) || !hasRequiredKeys(input.write, writeKeys)) {
    return inputError("INVALID_INPUT_TYPE");
  }
  if (typeof input.write.attempted !== "boolean") {
    return inputError("INVALID_INPUT_TYPE");
  }
  const processOutcome = validateEnumValue(input.write.processOutcome, WRITE_PROCESS_OUTCOMES);
  if (!processOutcome.ok) {
    return inputError(processOutcome.code);
  }
  const commitEvidence = validateEnumValue(input.write.commitEvidence, COMMIT_EVIDENCE_KINDS);
  if (!commitEvidence.ok) {
    return inputError(commitEvidence.code);
  }

  const observation: D1SeedResultObservation = {
    executionStage: executionStage.value,
    write: {
      attempted: input.write.attempted,
      processOutcome: processOutcome.value,
      commitEvidence: commitEvidence.value,
    },
    verification: verification.value,
    rollback: rollback.value,
    secondaryFailures,
  };

  return { observation, secondaryFailures };
}

function validateRelations(observation: D1SeedResultObservation): D1SeedClassifierFailure | null {
  const { executionStage, write, verification, rollback } = observation;

  if (!write.attempted) {
    if (
      executionStage !== "PREFLIGHT" ||
      write.processOutcome !== "NOT_STARTED" ||
      write.commitEvidence !== "NONE" ||
      verification !== "NOT_RUN" ||
      rollback !== "NOT_APPLICABLE"
    ) {
      return inputError("CONTRADICTORY_OBSERVATION");
    }
    return null;
  }

  if (write.processOutcome === "NOT_STARTED") {
    return inputError("CONTRADICTORY_OBSERVATION");
  }
  if (executionStage === "PREFLIGHT" || executionStage === "WRITE" && verification !== "NOT_RUN") {
    return inputError("CONTRADICTORY_OBSERVATION");
  }
  if (write.commitEvidence === "WRITER_ACKNOWLEDGEMENT" && write.processOutcome !== "EXIT_ZERO") {
    return inputError("CONTRADICTORY_OBSERVATION");
  }

  if (rollback === "CONFIRMED") {
    return {
      kind: "UNSUPPORTED_COMBINATION",
      code: "ROLLBACK_CONFIRMED_NOT_IN_RESULT_SET",
    };
  }

  return null;
}

function deriveWriteCommit(observation: D1SeedResultObservation): WriteCommitResult {
  if (!observation.write.attempted) {
    return "NOT_ATTEMPTED";
  }
  if (observation.write.commitEvidence === "OPERATION_BOUND_READ_BACK") {
    return "CONFIRMED";
  }
  if (observation.write.processOutcome === "EXIT_ZERO") {
    return "ACKNOWLEDGED";
  }
  return "UNKNOWN";
}

function canonicalSecondaryFailures(
  secondaryFailures: readonly SecondaryFailure[],
): readonly SecondaryFailure[] {
  return [...secondaryFailures].sort(
    (left, right) => SECONDARY_FAILURES.indexOf(left) - SECONDARY_FAILURES.indexOf(right),
  );
}

function classifiedResult(
  observation: D1SeedResultObservation,
  secondaryFailures: readonly SecondaryFailure[],
  resultState: ResultState,
): ClassifiedD1SeedResult {
  return {
    kind: "CLASSIFIED",
    resultState,
    executionStage: observation.executionStage,
    writeCommit: deriveWriteCommit(observation),
    verification: observation.verification,
    rollback: observation.rollback,
    secondaryFailures: canonicalSecondaryFailures(secondaryFailures),
  };
}

export function classifyD1SeedResult(input: unknown): D1SeedClassifierResult {
  const validated = validateObservation(input);
  if ("kind" in validated) {
    return validated;
  }

  const relationError = validateRelations(validated.observation);
  if (relationError !== null) {
    return relationError;
  }

  const { observation, secondaryFailures } = validated;
  if (!observation.write.attempted) {
    return classifiedResult(observation, secondaryFailures, "FAILED_BEFORE_WRITE");
  }

  const { commitEvidence } = observation.write;
  const operationBoundCommit = commitEvidence === "OPERATION_BOUND_READ_BACK";
  if (
    !operationBoundCommit &&
    (observation.verification === "PASSED" || observation.verification === "MISMATCH")
  ) {
    return {
      kind: "UNSUPPORTED_COMBINATION",
      code: "VERIFICATION_REQUIRES_OPERATION_BOUND_COMMIT_EVIDENCE",
    };
  }

  if (operationBoundCommit) {
    if (observation.verification === "PASSED") {
      return classifiedResult(observation, secondaryFailures, "COMMITTED_VERIFIED");
    }
    if (observation.verification === "MISMATCH") {
      return classifiedResult(observation, secondaryFailures, "COMMITTED_VERIFICATION_FAILED");
    }
    return classifiedResult(observation, secondaryFailures, "COMMITTED_BUT_UNVERIFIED");
  }

  if (observation.write.processOutcome === "EXIT_ZERO") {
    return classifiedResult(observation, secondaryFailures, "COMMITTED_BUT_UNVERIFIED");
  }

  return classifiedResult(observation, secondaryFailures, "COMMIT_OUTCOME_UNKNOWN");
}
