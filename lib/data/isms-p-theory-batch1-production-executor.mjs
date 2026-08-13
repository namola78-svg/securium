import { createHash } from "node:crypto";
import {
  buildIsmsPBatch1CreateStatements,
  buildIsmsPBatch1MaterializationManifest,
  planIsmsPBatch1Materialization,
  verifyIsmsPBatch1Materialization,
} from "./isms-p-theory-batch1-materializer.mjs";

export const ISMS_P_BATCH1_PRODUCTION_BATCH = "SECURIUM_ISMS_P_BATCH1";
export const ISMS_P_BATCH1_PRODUCTION_TARGET_CONFIRMATION =
  "CONFIRM SECURIUM PRODUCTION POSTGRESQL";

export async function createIsmsPBatch1ProductionPreflight(
  database,
  { mainSha, targetFingerprint, capturedAt = new Date().toISOString() },
) {
  assertSha("mainSha", mainSha);
  assertSha("targetFingerprint", targetFingerprint);
  const plan = await planIsmsPBatch1Materialization(database);
  const manifest = buildIsmsPBatch1MaterializationManifest();
  const entityCounts = countEntities(plan.operations);
  const freshDiff = {
    batch: ISMS_P_BATCH1_PRODUCTION_BATCH,
    course: plan.course,
    operations: plan.operations.map((operation) => ({
      operationId: operation.operationId,
      entity: operation.entity,
      code: operation.code,
      plannedId: operation.plannedId,
      existingId: operation.existingId,
      classification: operation.classification,
      payloadHash: operation.payloadHash,
    })),
    counts: plan.counts,
    entityCounts,
    pending: 0,
    holdOperations: plan.holdOperationCount,
  };
  const freshDiffHash = hashCanonical(freshDiff);
  const binding = {
    batch: ISMS_P_BATCH1_PRODUCTION_BATCH,
    mainSha,
    targetFingerprint,
    operationCount: plan.operationSlots,
    conflictCount: plan.counts.CONFLICT,
    pending: 0,
    holdOperations: plan.holdOperationCount,
    freshDiffHash,
    payloadHashes: manifest.map((entry) => ({
      code: entry.code,
      body: entry.hashes.body,
      summary: entry.hashes.summary,
      example: entry.hashes.example,
      examPoint: entry.hashes.examPoint,
      materialization: entry.hashes.materialization,
    })),
  };
  return {
    schemaVersion: "1.0.0",
    mode: "PRODUCTION_PLAN",
    capturedAt,
    ...binding,
    preflightSha: hashCanonical(binding),
    plan,
  };
}

export function createIsmsPBatch1ApprovalDigest({
  approvalString,
  mainSha,
  preflightSha,
  operationCount,
  freshDiffHash,
}) {
  return hashCanonical({
    approvalString,
    batch: ISMS_P_BATCH1_PRODUCTION_BATCH,
    freshDiffHash,
    mainSha,
    operationCount,
    preflightSha,
  });
}

export function validateIsmsPBatch1ProductionApproval(
  preflight,
  input,
  { releaseSha, targetFingerprint },
) {
  for (const field of [
    "approvalString",
    "expectedMainSha",
    "expectedPreflightSha",
    "expectedOperationCount",
    "expectedConflictCount",
    "expectedHoldOperations",
    "expectedFreshDiffHash",
    "approvalDigest",
    "confirmProductionTarget",
  ]) {
    if (input[field] === undefined || input[field] === null || input[field] === "") {
      fail("ISMS_P_BATCH1_PRODUCTION_INPUT_REQUIRED", `${field} is required.`);
    }
  }
  const expectedApproval = `APPROVE SECURIUM BATCH1 PRODUCTION MATERIALIZATION ${input.expectedOperationCount}`;
  if (input.approvalString !== expectedApproval) {
    fail("ISMS_P_BATCH1_PRODUCTION_APPROVAL_INVALID", "The exact approval string does not match the requested operation count.");
  }
  if (input.confirmProductionTarget !== ISMS_P_BATCH1_PRODUCTION_TARGET_CONFIRMATION) {
    fail("ISMS_P_BATCH1_PRODUCTION_TARGET_UNCONFIRMED", "The Production PostgreSQL target was not explicitly confirmed.");
  }
  const equalityChecks = [
    ["main SHA", input.expectedMainSha, releaseSha],
    ["preflight main SHA", preflight.mainSha, releaseSha],
    ["preflight SHA", input.expectedPreflightSha, preflight.preflightSha],
    ["fresh diff hash", input.expectedFreshDiffHash, preflight.freshDiffHash],
    ["target fingerprint", preflight.targetFingerprint, targetFingerprint],
  ];
  for (const [label, expected, actual] of equalityChecks) {
    if (expected !== actual) {
      fail("ISMS_P_BATCH1_PRODUCTION_APPROVAL_INVALIDATED", `${label} changed after approval.`);
    }
  }
  if (
    input.expectedOperationCount !== 36 ||
    preflight.operationCount !== 36 ||
    preflight.plan.counts.CREATE !== 36
  ) {
    fail("ISMS_P_BATCH1_PRODUCTION_CREATE_COUNT_INVALID", "Production APPLY requires exactly 36 CREATE operations.");
  }
  if (
    input.expectedConflictCount !== 0 ||
    preflight.conflictCount !== 0 ||
    preflight.plan.counts.CONFLICT !== 0
  ) {
    fail("ISMS_P_BATCH1_PRODUCTION_CONFLICT", "Production APPLY refuses every conflict.");
  }
  if (preflight.plan.counts.NOOP !== 0) {
    fail("ISMS_P_BATCH1_PRODUCTION_NOOP", "Production APPLY refuses an unexpected NOOP or replay.");
  }
  if (preflight.pending !== 0) {
    fail("ISMS_P_BATCH1_PRODUCTION_PENDING", "Production APPLY refuses pending operations.");
  }
  if (
    input.expectedHoldOperations !== 0 ||
    preflight.holdOperations !== 0
  ) {
    fail("ISMS_P_BATCH1_PRODUCTION_HOLD", "Production APPLY refuses HOLD operations.");
  }
  if (!preflight.plan.course.valid) {
    fail("ISMS_P_BATCH1_PRODUCTION_COURSE_INVALID", "course-isms-p is not uniquely active and published.");
  }
  const digest = createIsmsPBatch1ApprovalDigest({
    approvalString: input.approvalString,
    mainSha: input.expectedMainSha,
    preflightSha: input.expectedPreflightSha,
    operationCount: input.expectedOperationCount,
    freshDiffHash: input.expectedFreshDiffHash,
  });
  if (input.approvalDigest !== digest) {
    fail("ISMS_P_BATCH1_PRODUCTION_APPROVAL_DIGEST_INVALID", "The approval digest is not bound to the approved tuple.");
  }
  return { valid: true, approvalDigest: digest };
}

export async function executeApprovedIsmsPBatch1ProductionMaterialization({
  runner,
  input,
  releaseSha,
  target,
  clock = () => new Date().toISOString(),
}) {
  assertProductionTarget(target);
  assertSha("releaseSha", releaseSha);

  const freshPreflight = await runner.readOnly((database) =>
    createIsmsPBatch1ProductionPreflight(database, {
      mainSha: releaseSha,
      targetFingerprint: target.fingerprint,
      capturedAt: clock(),
    }),
  );
  const approval = validateIsmsPBatch1ProductionApproval(freshPreflight, input, {
    releaseSha,
    targetFingerprint: target.fingerprint,
  });

  const transaction = await runner.write(async (database) => {
    await database.query({
      sql: "SELECT pg_advisory_xact_lock(hashtext(?)) AS locked",
      parameters: [ISMS_P_BATCH1_PRODUCTION_BATCH],
    });
    const lockedPreflight = await createIsmsPBatch1ProductionPreflight(database, {
      mainSha: releaseSha,
      targetFingerprint: target.fingerprint,
      capturedAt: clock(),
    });
    validateIsmsPBatch1ProductionApproval(lockedPreflight, input, {
      releaseSha,
      targetFingerprint: target.fingerprint,
    });
    const progressBefore = await progressCount(database);
    const publishedBefore = await publishedCount(database);
    const { statements, createdOperationIds } =
      buildIsmsPBatch1CreateStatements(lockedPreflight.plan);
    if (statements.length !== 36 || createdOperationIds.length !== 36) {
      fail("ISMS_P_BATCH1_PRODUCTION_CREATE_COUNT_INVALID", "The transaction did not contain exactly 36 INSERT statements.");
    }
    assertProductionStatementContract(statements);
    const affectedRows = [];
    for (const statement of statements) {
      const result = await database.execute(statement);
      affectedRows.push(result.affectedRows);
      if (result.affectedRows !== 1) {
        fail("ISMS_P_BATCH1_PRODUCTION_INSERT_COUNT_MISMATCH", "Every INSERT must affect exactly one row.");
      }
    }
    const verification = await verifyIsmsPBatch1Materialization(database);
    if (!verification.verified) {
      fail("ISMS_P_BATCH1_PRODUCTION_IN_TRANSACTION_VERIFY_FAILED", "The in-transaction 36-row read-back failed.");
    }
    const progressAfter = await progressCount(database);
    if (progressAfter !== progressBefore) {
      fail("ISMS_P_BATCH1_PRODUCTION_PROGRESS_MUTATED", "Existing progress changed during materialization.");
    }
    const publishedAfter = await publishedCount(database);
    if (publishedAfter !== publishedBefore + 12) {
      fail("ISMS_P_BATCH1_PRODUCTION_DENOMINATOR_MISMATCH", "The published CourseLesson denominator did not increase by 12.");
    }
    return {
      startedAt: clock(),
      insertCount: affectedRows.length,
      updateCount: 0,
      deleteCount: 0,
      createdOperationIds,
      verification,
      progressBefore,
      progressAfter,
      publishedBefore,
      publishedAfter,
    };
  });

  const readBack = await runner.readOnly(async (database) => {
    const verification = await verifyIsmsPBatch1Materialization(database);
    if (!verification.verified) {
      fail("ISMS_P_BATCH1_PRODUCTION_POST_COMMIT_VERIFY_FAILED", "The post-commit read-back failed.");
    }
    return {
      verification,
      publishedCourseLessons: await publishedCount(database),
      progressRows: await progressCount(database),
    };
  });
  return {
    mode: "PRODUCTION_APPLY",
    status: "COMMITTED",
    approvalDigest: approval.approvalDigest,
    preflight: freshPreflight,
    transaction,
    readBack,
    automaticRollback: false,
  };
}

function assertProductionTarget(target) {
  if (
    target?.provider !== "supabase" ||
    target?.environment !== "production" ||
    target?.confirmed !== true
  ) {
    fail("ISMS_P_BATCH1_PRODUCTION_TARGET_INVALID", "The executor requires an explicitly verified Production PostgreSQL target.");
  }
  assertSha("target fingerprint", target.fingerprint);
}

function countEntities(operations) {
  return operations.reduce((counts, operation) => {
    counts[operation.entity] ??= { CREATE: 0, NOOP: 0, CONFLICT: 0 };
    counts[operation.entity][operation.classification] += 1;
    return counts;
  }, {});
}

function assertProductionStatementContract(statements) {
  const expectedTables = [
    ...Array(12).fill("contents"),
    ...Array(12).fill("course_lessons"),
    ...Array(12).fill("course_lesson_extensions"),
  ];
  statements.forEach((statement, index) => {
    const match = /^INSERT INTO ([a-z_]+)\s*\(/.exec(statement.sql);
    if (
      match?.[1] !== expectedTables[index] ||
      /\b(?:UPDATE|DELETE|UPSERT|MERGE|ON\s+CONFLICT)\b/i.test(statement.sql)
    ) {
      fail("ISMS_P_BATCH1_PRODUCTION_STATEMENT_INVALID", "The transaction statement set violated the insert-only FK order contract.");
    }
  });
}

async function publishedCount(database) {
  const row = await database.queryOne({
    sql: "SELECT count(*) AS count FROM course_lessons cl JOIN contents c ON c.id = cl.content_id WHERE cl.course_id = ? AND cl.status = 'PUBLISHED' AND cl.deleted_at IS NULL AND c.status = 'PUBLISHED' AND c.deleted_at IS NULL",
    parameters: ["course-isms-p"],
  });
  return Number(row?.count ?? 0);
}

async function progressCount(database) {
  const row = await database.queryOne({
    sql: "SELECT count(*) AS count FROM user_course_lesson_progress WHERE course_id = ?",
    parameters: ["course-isms-p"],
  });
  return Number(row?.count ?? 0);
}

function assertSha(label, value) {
  if (!/^[a-f0-9]{64}$/i.test(String(value ?? "")) && !/^[a-f0-9]{40}$/i.test(String(value ?? ""))) {
    fail("ISMS_P_BATCH1_PRODUCTION_SHA_INVALID", `${label} must be a full SHA.`);
  }
}

function hashCanonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
