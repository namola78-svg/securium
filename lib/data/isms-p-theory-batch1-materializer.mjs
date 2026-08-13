import { createHash } from "node:crypto";
import {
  ISMS_P_THEORY_BATCH1_HOLD_CODES,
  ISMS_P_THEORY_BATCH1_READY_CODES,
  getApprovedIsmsPTheoryBatch1Records,
} from "./isms-p-theory-batch1.mjs";

export const ISMS_P_BATCH1_COURSE_ID = "course-isms-p";
export const ISMS_P_BATCH1_WRITE_CONFIRMATION =
  "ISOLATED_ISMS_P_BATCH1_WRITE_ONLY";

export function buildIsmsPBatch1MaterializationManifest() {
  const records = getApprovedIsmsPTheoryBatch1Records();
  assertExactBatch(records);
  return records.map((record) => {
    const code = record.metadata.officialCode;
    const content = {
      id: record.content.id,
      slug: record.content.slug,
      canonical_key: record.content.canonicalKey,
      title: record.content.title,
      summary: record.content.summary,
      body: record.content.body,
      body_format: record.content.bodyFormat,
      learning_objectives_json: record.content.learningObjectivesJson,
      core_concepts_json: record.content.coreConceptsJson,
      practical_examples_json: record.content.practicalExamplesJson,
      diagrams_json: record.content.diagramsJson,
      media_json: record.content.mediaJson,
      version: record.content.version,
      status: record.content.status,
      created_by: null,
      deleted_at: null,
    };
    const courseLesson = {
      id: record.courseLesson.id,
      course_id: ISMS_P_BATCH1_COURSE_ID,
      curriculum_node_id: null,
      content_id: record.content.id,
      lesson_id: null,
      display_title: record.courseLesson.displayTitle,
      sort_order: record.courseLesson.sortOrder,
      difficulty: emptyToNull(record.courseLesson.difficulty),
      importance: record.courseLesson.importance ?? null,
      estimated_minutes: record.courseLesson.estimatedMinutes,
      is_required: record.courseLesson.isRequired ? 1 : 0,
      unlock_condition: emptyToNull(record.courseLesson.unlockCondition),
      completion_rule: record.courseLesson.completionRule,
      status: record.courseLesson.status,
      deleted_at: null,
    };
    const extension = {
      id: `course-lesson-extension-isms-p-theory-${code.replaceAll(".", "-")}`,
      course_lesson_id: record.courseLesson.id,
      learning_objectives_override_json: emptyToNull(
        record.extension.learningObjectivesOverrideJson,
      ),
      additional_body: emptyToNull(record.extension.additionalBody),
      exam_points_json: record.extension.examPointsJson,
      practical_notes: record.extension.practicalNotes,
      legal_notes: record.extension.legalNotes,
      standard_notes: record.extension.standardNotes,
      evidence_notes: record.extension.evidenceNotes,
      common_mistakes: record.extension.commonMistakes,
      instructor_notes: record.extension.instructorNotes,
      version: record.extension.version,
      status: record.extension.status,
    };
    return {
      code,
      content,
      courseLesson,
      extension,
      hashes: {
        body: sha256(content.body),
        summary: sha256(content.summary),
        example: sha256(content.practical_examples_json),
        examPoint: sha256(extension.exam_points_json),
        content: hashObject(content),
        courseLesson: hashObject(courseLesson),
        extension: hashObject(extension),
        materialization: hashObject({ content, courseLesson, extension }),
      },
      trace: {
        sourceLessonId: record.metadata.sourceLessonId,
        source: record.metadata.source,
        currentness: record.metadata.currentness,
        repositoryPreviewBodyHash:
          record.metadata.provenance.approvedPreviewBodySha256,
        repositoryPreviewSummaryHash:
          record.metadata.provenance.approvedPreviewSummarySha256,
      },
    };
  });
}

export async function planIsmsPBatch1Materialization(database) {
  const manifest = buildIsmsPBatch1MaterializationManifest();
  const courseRows = await rowsOf(
    database,
    "SELECT id, active, published, deleted_at FROM courses WHERE id = ?",
    [ISMS_P_BATCH1_COURSE_ID],
  );
  const contentRows = [];
  for (const entries of chunk(manifest, 4)) {
    contentRows.push(
      ...(await rowsOf(
        database,
        `SELECT * FROM contents WHERE id IN (${placeholders(entries.length)}) OR slug IN (${placeholders(entries.length)}) OR canonical_key IN (${placeholders(entries.length)})`,
        [
          ...entries.map((entry) => entry.content.id),
          ...entries.map((entry) => entry.content.slug),
          ...entries.map((entry) => entry.content.canonical_key),
        ],
      )),
    );
  }
  const courseLessonRows = await rowsOf(
    database,
    `SELECT * FROM course_lessons WHERE id IN (${placeholders(manifest.length)}) OR (course_id = ? AND (content_id IN (${placeholders(manifest.length)}) OR sort_order IN (${placeholders(manifest.length)})))`,
    [
      ...manifest.map((entry) => entry.courseLesson.id),
      ISMS_P_BATCH1_COURSE_ID,
      ...manifest.map((entry) => entry.courseLesson.content_id),
      ...manifest.map((entry) => entry.courseLesson.sort_order),
    ],
  );
  const extensionRows = await rowsOf(
    database,
    `SELECT * FROM course_lesson_extensions WHERE id IN (${placeholders(manifest.length)}) OR course_lesson_id IN (${placeholders(manifest.length)})`,
    [
      ...manifest.map((entry) => entry.extension.id),
      ...manifest.map((entry) => entry.extension.course_lesson_id),
    ],
  );

  const operations = [];
  for (const entry of manifest) {
    operations.push(
      classifyEntity("content", entry, contentRows),
      classifyEntity("courseLesson", entry, courseLessonRows),
      classifyEntity("extension", entry, extensionRows),
    );
  }
  const counts = countClassifications(operations);
  return {
    mode: "PLAN",
    provider: database.kind,
    course: {
      exists: courseRows.length === 1,
      valid:
        courseRows.length === 1 &&
        truthyDatabaseBoolean(courseRows[0].active) &&
        truthyDatabaseBoolean(courseRows[0].published) &&
        courseRows[0].deleted_at == null,
      rowCount: courseRows.length,
    },
    approvedCount: manifest.length,
    holdCount: ISMS_P_THEORY_BATCH1_HOLD_CODES.length,
    holdOperationCount: 0,
    operationSlots: operations.length,
    operations,
    counts,
    conflictGate: counts.CONFLICT === 0 ? "PASS" : "FAIL",
  };
}

export async function applyIsmsPBatch1Materialization(database, context) {
  assertNonProductionWriteContext(database, context);
  const plan = await planIsmsPBatch1Materialization(database);
  const { statements, createdOperationIds } =
    buildIsmsPBatch1CreateStatements(plan);
  const results = statements.length ? await database.transaction(statements) : [];
  if (results.some((result) => result.affectedRows !== 1)) {
    throw materializerError(
      "ISMS_P_BATCH1_APPLY_ROW_COUNT_MISMATCH",
      "The isolated materialization transaction did not create exactly one row per CREATE operation.",
    );
  }
  const verification = await verifyIsmsPBatch1Materialization(database);
  return {
    mode: "APPLY",
    plan,
    created: statements.length,
    createdOperationIds,
    verification,
  };
}

export function buildIsmsPBatch1CreateStatements(plan) {
  assertApplicablePlan(plan);
  const manifest = buildIsmsPBatch1MaterializationManifest();
  const createKeys = new Set(
    plan.operations
      .filter((operation) => operation.classification === "CREATE")
      .map((operation) => `${operation.entity}:${operation.code}`),
  );
  const statements = [];
  const createdOperationIds = [];
  for (const entry of manifest) {
    if (createKeys.has(`content:${entry.code}`)) {
      statements.push(insertStatement("contents", entry.content));
      createdOperationIds.push(`content:${entry.code}`);
    }
  }
  for (const entry of manifest) {
    if (createKeys.has(`courseLesson:${entry.code}`)) {
      statements.push(insertStatement("course_lessons", entry.courseLesson));
      createdOperationIds.push(`courseLesson:${entry.code}`);
    }
  }
  for (const entry of manifest) {
    if (createKeys.has(`extension:${entry.code}`)) {
      statements.push(
        insertStatement("course_lesson_extensions", entry.extension),
      );
      createdOperationIds.push(`extension:${entry.code}`);
    }
  }
  return { statements, createdOperationIds };
}

export async function verifyIsmsPBatch1Materialization(database) {
  const plan = await planIsmsPBatch1Materialization(database);
  const verified =
    plan.course.valid &&
    plan.counts.CREATE === 0 &&
    plan.counts.NOOP === 36 &&
    plan.counts.CONFLICT === 0;
  return { mode: "VERIFY", verified, plan };
}

export async function rollbackIsmsPBatch1Materialization(
  database,
  context,
  createdOperationIds,
) {
  assertNonProductionWriteContext(database, context);
  const owned = new Set(createdOperationIds ?? []);
  const manifest = buildIsmsPBatch1MaterializationManifest();
  const createdCourseLessonIds = manifest
    .filter((entry) => owned.has(`courseLesson:${entry.code}`))
    .map((entry) => entry.courseLesson.id);
  if (createdCourseLessonIds.length) {
    const dependencyRows = await rowsOf(
      database,
      `SELECT count(*) AS count FROM user_course_lesson_progress WHERE course_lesson_id IN (${placeholders(createdCourseLessonIds.length)})`,
      createdCourseLessonIds,
    );
    if (Number(dependencyRows[0]?.count ?? 0) > 0) {
      return {
        mode: "ROLLBACK",
        status: "REFUSED_USER_ACTIVITY",
        deleted: 0,
        archivePlan: createdCourseLessonIds.map((id) => ({
          entity: "course_lessons",
          id,
          proposedStatus: "ARCHIVED",
          executed: false,
        })),
      };
    }
  }
  const statements = [];
  for (const entry of [...manifest].reverse()) {
    if (owned.has(`extension:${entry.code}`)) {
      statements.push(deleteStatement("course_lesson_extensions", entry.extension.id));
    }
  }
  for (const entry of [...manifest].reverse()) {
    if (owned.has(`courseLesson:${entry.code}`)) {
      statements.push(deleteStatement("course_lessons", entry.courseLesson.id));
    }
  }
  for (const entry of [...manifest].reverse()) {
    if (owned.has(`content:${entry.code}`)) {
      statements.push(deleteStatement("contents", entry.content.id));
    }
  }
  const results = statements.length ? await database.transaction(statements) : [];
  if (results.some((result) => result.affectedRows !== 1)) {
    throw materializerError(
      "ISMS_P_BATCH1_ROLLBACK_ROW_COUNT_MISMATCH",
      "The isolated rollback did not remove exactly the Batch-created rows.",
    );
  }
  return { mode: "ROLLBACK", status: "ROLLED_BACK", deleted: statements.length };
}

export function assertNonProductionWriteContext(database, context = {}) {
  const productionMarkers = [
    process.env.NODE_ENV,
    process.env.VERCEL_ENV,
    process.env.APP_ENV,
    context.environment,
  ].map((value) => String(value ?? "").trim().toLowerCase());
  const allowedTarget =
    (database.kind === "d1" && context.target === "isolated-d1") ||
    (database.kind === "supabase" && context.target === "disposable-postgres");
  if (
    productionMarkers.includes("production") ||
    !allowedTarget ||
    context.confirmation !== ISMS_P_BATCH1_WRITE_CONFIRMATION ||
    context.production === true
  ) {
    throw materializerError(
      "ISMS_P_BATCH1_PRODUCTION_WRITE_REFUSED",
      "Batch 1 APPLY and ROLLBACK are restricted to explicitly confirmed isolated non-production databases.",
    );
  }
}

function classifyEntity(entity, entry, rows) {
  const planned = entry[entity];
  const sameId = rows.find((row) => row.id === planned.id);
  const alternate = rows.find((row) => {
    if (row.id === planned.id) return false;
    if (entity === "content") {
      return (
        row.slug === planned.slug || row.canonical_key === planned.canonical_key
      );
    }
    if (entity === "courseLesson") {
      return (
        row.course_id === planned.course_id &&
        (row.content_id === planned.content_id ||
          Number(row.sort_order) === planned.sort_order)
      );
    }
    return row.course_lesson_id === planned.course_lesson_id;
  });
  let classification = "CREATE";
  let reason = "No primary or alternate key exists.";
  let existingId = null;
  if (sameId) {
    existingId = sameId.id;
    if (rowsEquivalent(entity, sameId, planned)) {
      classification = "NOOP";
      reason = "The existing row is payload-equivalent.";
    } else {
      classification = "CONFLICT";
      reason = `The deterministic ID exists with a different payload (${differingKeys(entity, sameId, planned).join(", ")}).`;
    }
  } else if (alternate) {
    classification = "CONFLICT";
    existingId = alternate.id;
    reason = "An alternate unique key is occupied by a different row.";
  }
  return {
    operationId: `${entity}:${entry.code}`,
    entity,
    code: entry.code,
    plannedId: planned.id,
    existingId,
    classification,
    payloadHash: entry.hashes[entity],
    reason,
  };
}

function rowsEquivalent(entity, existing, planned) {
  return differingKeys(entity, existing, planned).length === 0;
}

function differingKeys(entity, existing, planned) {
  return Object.keys(planned).filter((key) => {
    if (key === "is_required") {
      return Number(existing[key]) !== Number(planned[key]);
    }
    return (existing[key] ?? null) !== (planned[key] ?? null);
  });
}

function assertExactBatch(records) {
  const codes = records.map((record) => record.metadata.officialCode);
  if (
    records.length !== 12 ||
    JSON.stringify(codes) !== JSON.stringify(ISMS_P_THEORY_BATCH1_READY_CODES) ||
    codes.some((code) => ISMS_P_THEORY_BATCH1_HOLD_CODES.includes(code)) ||
    records.some(
      (record) =>
        record.metadata.approval.humanSource !== "APPROVE" ||
        record.metadata.approval.sme !== "APPROVE" ||
        record.metadata.approval.example !== "KEEP" ||
        record.metadata.approval.examPoint !== "KEEP" ||
        sha256(record.content.body) !==
          record.metadata.provenance.approvedPreviewBodySha256 ||
        sha256(record.content.summary) !==
          record.metadata.provenance.approvedPreviewSummarySha256,
    )
  ) {
    throw materializerError(
      "ISMS_P_BATCH1_APPROVAL_BASELINE_MISMATCH",
      "The repository registry no longer matches the approved Batch 1 contract.",
    );
  }
}

function assertApplicablePlan(plan) {
  if (!plan.course.valid) {
    throw materializerError(
      "ISMS_P_BATCH1_COURSE_INVALID",
      "The target ISMS-P course is missing, duplicated, inactive, or unpublished.",
    );
  }
  if (plan.operationSlots !== 36 || plan.holdOperationCount !== 0) {
    throw materializerError(
      "ISMS_P_BATCH1_OPERATION_SCOPE_INVALID",
      "The materialization plan must contain exactly 36 approved slots and no HOLD operations.",
    );
  }
  if (plan.counts.CONFLICT > 0) {
    throw materializerError(
      "ISMS_P_BATCH1_CONFLICT",
      "The materialization plan contains conflicts and was not applied.",
    );
  }
}

function insertStatement(table, row) {
  const columns = Object.keys(row);
  return {
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders(columns.length)})`,
    parameters: columns.map((column) => row[column]),
  };
}

function deleteStatement(table, id) {
  return { sql: `DELETE FROM ${table} WHERE id = ?`, parameters: [id] };
}

async function rowsOf(database, sql, parameters = []) {
  const result = await database.query({ sql, parameters });
  return result.rows;
}

function placeholders(count) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function countClassifications(operations) {
  return operations.reduce(
    (counts, operation) => {
      counts[operation.classification] += 1;
      return counts;
    },
    { CREATE: 0, NOOP: 0, CONFLICT: 0 },
  );
}

function truthyDatabaseBoolean(value) {
  return value === true || value === 1 || value === "1";
}

function emptyToNull(value) {
  return value === "" || value == null ? null : value;
}

function hashObject(value) {
  return sha256(canonicalJson(value));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function materializerError(code, message) {
  return Object.assign(new Error(message), { code });
}
