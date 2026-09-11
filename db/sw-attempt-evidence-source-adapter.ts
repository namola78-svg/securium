import { AppError } from "../lib/errors.ts";
import {
  assertSwFoundationAttemptCourse,
  assertSwFoundationBindingMatches,
  getSwFoundationQuestionBindingSeed,
  type SwFoundationQuestionBindingRecord,
} from "../lib/services/securium-sw-security-weakness-foundation-binding.ts";
import {
  type RuntimeCourseIdentity,
} from "../lib/services/securium-sw-security-weakness-runtime-adapter.ts";
import {
  sha256,
  stableJson,
} from "../lib/services/learning-event-contracts.ts";
import type { CanonicalEvidenceSource } from "../lib/services/evidence-projection.ts";
import type { DatabaseProvider } from "./provider/database-provider.ts";

type ResolveInput = Readonly<{
  sourceType: "QUESTION_ATTEMPT";
  sourceEventId: string;
  sourceRevisionIdentity: string;
  expectedUserId?: string;
}>;

type BaseAttemptRow = Readonly<Record<string, unknown>>;

type SwAttemptRow = BaseAttemptRow & Readonly<{
  id: unknown;
  course_id: unknown;
  question_id: unknown;
  foundation_question_binding_id: unknown;
  question_version_id: unknown;
  concept_mapping_set_hash: unknown;
  binding_id: unknown;
  binding_course_id: unknown;
  foundation_binding_key: unknown;
  foundation_version: unknown;
  foundation_question_id: unknown;
  binding_semantic_hash: unknown;
  lifecycle_state: unknown;
  retired_at: unknown;
  course_code: unknown;
  course_slug: unknown;
  course_name: unknown;
  course_active: unknown;
  course_published: unknown;
  course_is_sample: unknown;
  course_deleted_at: unknown;
}>;

type RevisionRow = Readonly<{
  action: unknown;
  semantic_hash: unknown;
  correction_payload_json: unknown;
}>;

type EdgeRow = Readonly<{
  edge_key: string;
  concept_id: string;
}>;

export type SwAttemptUnresolvedReason =
  | "SW_MAPPING_REVISION_MISSING"
  | "SW_MAPPING_MISSING"
  | "SW_EVALUATION_INCOMPLETE";

export type SwAttemptResolution = Readonly<{
  source: CanonicalEvidenceSource;
  status: "RESOLVED" | "UNRESOLVED";
  reason?: SwAttemptUnresolvedReason;
}>;

/**
 * Read-only adapter for the special SW Foundation identity path.
 *
 * SW attempts intentionally do not use question_versions. Their immutable
 * content identity is the server-owned Foundation binding. Because the raw
 * attempt does not contain an event-time concept mapping snapshot, a mapping
 * correction revision is required before the attempt can become formal
 * Evidence. Current ontology edges are only accepted when that revision's
 * stored mapping hash matches the exact edge set returned here.
 */
export class SwAttemptEvidenceSourceAdapter {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async resolve(
    input: ResolveInput,
    baseRow: BaseAttemptRow,
  ): Promise<SwAttemptResolution | null> {
    const bindingIdentity = await this.readBindingIdentity(input.sourceEventId);
    if (bindingIdentity === null) return null;

    const row = await this.loadCanonicalRow(input.sourceEventId);
    if (!row) invalid("EVIDENCE_SW_BINDING_NOT_FOUND");
    if (
      String(row.user_id) !== String(baseRow.user_id) ||
      String(row.id) !== input.sourceEventId
    ) {
      invalid("EVIDENCE_SW_ATTEMPT_IDENTITY_MISMATCH");
    }
    if (row.binding_id == null) {
      invalid("EVIDENCE_SW_BINDING_NOT_FOUND");
    }
    if (input.expectedUserId && String(row.user_id) !== input.expectedUserId) {
      invalid("EVIDENCE_SOURCE_OWNER_MISMATCH");
    }

    const runtimeCourse = this.runtimeCourse(row);
    assertSwFoundationAttemptCourse(runtimeCourse);
    const questionId = requiredString(row.foundation_question_id, "foundation_question_id");
    const seed = getSwFoundationQuestionBindingSeed(runtimeCourse, questionId);
    const binding = this.bindingRecord(row);
    assertSwFoundationBindingMatches(seed, binding);

    if (
      String(row.foundation_question_binding_id) !== String(row.binding_id) ||
      row.question_id != null ||
      row.question_version_id != null ||
      row.concept_mapping_set_hash != null
    ) {
      invalid("EVIDENCE_SW_ATTEMPT_IDENTITY_INVALID");
    }

    const evaluation = readEvaluation(row);
    const revision = await this.latestRevision(input.sourceEventId);
    if (revision && !isHash(revision.semantic_hash)) {
      invalid("EVIDENCE_SOURCE_REVISION_INVALID");
    }

    if (revision?.action === "INVALIDATE") {
      return {
        status: "RESOLVED",
        source: {
          sourceType: "QUESTION_ATTEMPT",
          sourceEventId: input.sourceEventId,
          sourceLineageIdentity: input.sourceEventId,
          sourceRevisionIdentity: String(revision.semantic_hash),
          userId: String(row.user_id),
          contentVersionIdentity: String(row.binding_id),
          conceptMappingSetHash: "0".repeat(64),
          conceptIds: [],
          occurredAt: requiredString(row.occurred_at, "attempted_at"),
          validity: "INVALIDATED",
          evidenceType: "PERFORMANCE_RESULT",
          quality: "DIRECT_PERFORMANCE",
          resultSummary: {},
          sourceSemanticHash: String(row.binding_semantic_hash),
          mappingTransition: "PRESERVE_EVENT_TIME",
          resolutionStatus: "RESOLVED",
          mappingGuard: {
            kind: "ONTOLOGY_EDGES",
            parentIdentity: questionId,
            parentType: "QUESTION",
            members: [],
          },
        },
      };
    }

    const mappings = await this.questionMappings(questionId);
    if (revision?.action !== "CORRECT_CONCEPT_MAPPING") {
      return unresolved(
        input,
        row,
        evaluation,
        revision ? String(revision.semantic_hash) : seed.semanticHash,
        mappings.length ? "SW_MAPPING_REVISION_MISSING" : "SW_MAPPING_MISSING",
      );
    }
    if (!mappings.length) {
      return unresolved(
        input,
        row,
        evaluation,
        String(revision.semantic_hash),
        "SW_MAPPING_MISSING",
      );
    }

    const expectedMappingHash = mappingCorrectionHash(
      revision.correction_payload_json,
    );
    const mappingHash = await edgeMappingHash(mappings);
    if (expectedMappingHash !== mappingHash) {
      invalid("EVIDENCE_MAPPING_SET_MISMATCH");
    }

    return {
      status: "RESOLVED",
      source: {
        sourceType: "QUESTION_ATTEMPT",
        sourceEventId: input.sourceEventId,
        sourceLineageIdentity: input.sourceEventId,
        sourceRevisionIdentity: String(revision.semantic_hash),
        userId: String(row.user_id),
        contentVersionIdentity: String(row.binding_id),
        conceptMappingSetHash: mappingHash,
        conceptIds: uniqueConceptIds(mappings),
        occurredAt: requiredString(row.occurred_at, "attempted_at"),
        validity: "ELIGIBLE",
        evidenceType: "PERFORMANCE_RESULT",
        quality: "DIRECT_PERFORMANCE",
        resultSummary: evaluation,
        sourceSemanticHash: String(row.binding_semantic_hash),
        mappingTransition: "GOVERNED_CORRECTION",
        resolutionStatus: "RESOLVED",
        mappingGuard: edgeMappingGuard(questionId, mappings),
      },
    };
  }

  async readBindingIdentity(attemptId: string) {
    try {
      const row = await this.database.queryOne<{ foundation_question_binding_id: string | null }>({
        sql: "SELECT foundation_question_binding_id FROM question_attempts WHERE id = ? LIMIT 1",
        parameters: [attemptId],
      });
      return row?.foundation_question_binding_id ?? null;
    } catch (error) {
      // Older disposable Evidence fixtures intentionally omit the SW binding
      // column. They are ordinary legacy attempts, not SW rows.
      if (isMissingBindingSchema(error)) return null;
      throw error;
    }
  }

  private loadCanonicalRow(attemptId: string) {
    return this.database.queryOne<SwAttemptRow>({
      sql: `SELECT a.id, a.user_id, a.course_id, a.question_id,
          a.foundation_question_binding_id, a.question_version_id,
          a.concept_mapping_set_hash, a.is_correct, a.score,
          a.attempted_at AS occurred_at,
          b.id AS binding_id, b.course_id AS binding_course_id,
          b.foundation_binding_key, b.foundation_version,
          b.foundation_question_id, b.semantic_hash AS binding_semantic_hash,
          b.lifecycle_state, b.retired_at,
          c.code AS course_code, c.slug AS course_slug, c.name AS course_name,
          c.active AS course_active, c.published AS course_published,
          c.is_sample AS course_is_sample, c.deleted_at AS course_deleted_at
        FROM question_attempts a
        LEFT JOIN foundation_question_bindings b
          ON b.id = a.foundation_question_binding_id
         AND b.course_id = a.course_id
        LEFT JOIN courses c ON c.id = a.course_id
        WHERE a.id = ? LIMIT 1`,
      parameters: [attemptId],
    });
  }

  private async latestRevision(attemptId: string) {
    return this.database.queryOne<RevisionRow>({
      sql: `SELECT action, semantic_hash, correction_payload_json
        FROM learning_event_revisions
        WHERE source_type = 'QUESTION_ATTEMPT' AND source_event_id = ?
        ORDER BY sequence DESC LIMIT 1`,
      parameters: [attemptId],
    });
  }

  private async questionMappings(questionId: string) {
    const result = await this.database.query<EdgeRow>({
      sql: `SELECT e.edge_key, c.id AS concept_id
        FROM ontology_edges e
        JOIN ontology_concepts c ON c.id = e.to_id
        WHERE e.from_type = 'QUESTION' AND e.from_id = ?
          AND e.to_type = 'CONCEPT'
          AND e.status = 'ACTIVE'
          AND e.relation IN ('TESTS', 'ASSESSED_BY', 'COVERS')
          AND c.status = 'ACTIVE'
        ORDER BY e.edge_key`,
      parameters: [questionId],
    });
    return result.rows;
  }

  private runtimeCourse(row: SwAttemptRow): RuntimeCourseIdentity {
    return {
      id: requiredString(row.course_id, "course_id"),
      code: requiredString(row.course_code, "course_code"),
      slug: requiredString(row.course_slug, "course_slug"),
      name: requiredString(row.course_name, "course_name"),
      bindingKey: requiredString(row.foundation_binding_key, "foundation_binding_key"),
      active: databaseBoolean(row.course_active),
      published: databaseBoolean(row.course_published),
      isSample: databaseBoolean(row.course_is_sample),
      deletedAt: row.course_deleted_at == null ? null : String(row.course_deleted_at),
    };
  }

  private bindingRecord(row: SwAttemptRow): SwFoundationQuestionBindingRecord {
    return {
      id: requiredString(row.binding_id, "binding_id"),
      courseId: requiredString(row.binding_course_id, "binding_course_id"),
      foundationBindingKey: requiredString(row.foundation_binding_key, "foundation_binding_key"),
      foundationVersion: requiredString(row.foundation_version, "foundation_version"),
      foundationQuestionId: requiredString(row.foundation_question_id, "foundation_question_id"),
      semanticHash: requiredHash(row.binding_semantic_hash, "binding_semantic_hash"),
      lifecycleState: requiredString(row.lifecycle_state, "lifecycle_state"),
      retiredAt: row.retired_at == null ? null : String(row.retired_at),
    };
  }
}

function readEvaluation(row: BaseAttemptRow) {
  if (row.is_correct == null || row.score == null || row.occurred_at == null) {
    invalid("EVIDENCE_SW_EVALUATION_INCOMPLETE");
  }
  const score = Number(row.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    invalid("EVIDENCE_SW_EVALUATION_INVALID");
  }
  return {
    correct: databaseBoolean(row.is_correct),
    score,
  } as const;
}

function unresolved(
  input: ResolveInput,
  row: SwAttemptRow,
  evaluation: Readonly<{ correct: boolean; score: number }>,
  revisionIdentity: string,
  reason: SwAttemptUnresolvedReason,
): SwAttemptResolution {
  return {
    status: "UNRESOLVED",
    reason,
    source: {
      sourceType: "QUESTION_ATTEMPT",
      sourceEventId: input.sourceEventId,
      sourceLineageIdentity: input.sourceEventId,
      sourceRevisionIdentity: revisionIdentity,
      userId: String(row.user_id),
      contentVersionIdentity: String(row.binding_id),
      conceptMappingSetHash: "0".repeat(64),
      conceptIds: ["SW_MAPPING_UNRESOLVED"],
      occurredAt: requiredString(row.occurred_at, "attempted_at"),
      validity: "LEGACY_INELIGIBLE",
      evidenceType: "PERFORMANCE_RESULT",
      quality: "DIRECT_PERFORMANCE",
      resultSummary: evaluation,
      sourceSemanticHash: requiredHash(row.binding_semantic_hash, "binding_semantic_hash"),
      mappingTransition: "PRESERVE_EVENT_TIME",
      resolutionStatus: "UNRESOLVED",
      unresolvedReason: reason,
      mappingGuard: {
        kind: "ONTOLOGY_EDGES",
        parentIdentity: String(row.foundation_question_id),
        parentType: "QUESTION",
        members: [],
      },
    },
  };
}

function edgeMappingGuard(parentIdentity: string, mappings: readonly EdgeRow[]) {
  return {
    kind: "ONTOLOGY_EDGES" as const,
    parentIdentity,
    parentType: "QUESTION",
    members: mappings.map((item) => ({
      edgeKey: item.edge_key,
      conceptId: item.concept_id,
    })),
  };
}

function uniqueConceptIds(mappings: readonly EdgeRow[]) {
  return [...new Set(mappings.map((item) => item.concept_id))].sort();
}

async function edgeMappingHash(mappings: readonly EdgeRow[]) {
  return sha256(stableJson(mappings.map((item) => ({
    edgeKey: item.edge_key,
    conceptId: item.concept_id,
  }))));
}

function mappingCorrectionHash(value: unknown): string {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    invalid("EVIDENCE_SOURCE_METADATA_INVALID");
  }
  if (
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).kind !== "CONCEPT_MAPPING" ||
    !isHash((parsed as Record<string, unknown>).conceptMappingSetHash)
  ) {
    invalid("EVIDENCE_SOURCE_METADATA_INVALID");
  }
  return String((parsed as Record<string, unknown>).conceptMappingSetHash);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    invalid("EVIDENCE_SW_" + field.toUpperCase() + "_MISSING");
  }
  return value;
}

function requiredHash(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!isHash(result)) invalid("EVIDENCE_SW_HASH_INVALID");
  return result;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function databaseBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

function isMissingBindingSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column|column .* does not exist/i.test(message);
}

function invalid(code: string): never {
  throw new AppError("Canonical SW attempt Evidence adapter rejected its source.", 409, code);
}
