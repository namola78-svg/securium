import { AppError } from "../lib/errors.ts";
import {
  sha256,
  stableJson,
  type LearningEventSourceType,
} from "../lib/services/learning-event-contracts.ts";
import type {
  CanonicalEvidenceSource,
  EvidenceCandidate,
  EvidenceSourceType,
  ProjectionOutcome,
} from "../lib/services/evidence-projection.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseValue,
} from "./provider/database-provider.ts";

export type RecomputeScope = "EVENT" | "USER" | "CONCEPT" | "FULL";
export type RecomputeRequestType = "EVIDENCE_RECOMPUTE_REQUIRED" | "MASTERY_RECOMPUTE_REQUIRED";
export type RecomputeRequestInput = Readonly<{
  id: string;
  requestType: RecomputeRequestType;
  scopeType: RecomputeScope;
  sourceType?: LearningEventSourceType;
  sourceEventId?: string;
  sourceRevisionIdentity?: string;
  userId?: string;
  conceptId?: string;
  projectionVersion: string;
  reasonCode: string;
  inputSemanticHash: string;
  cursor?: string | null;
  generationId?: string | null;
}>;

export type RecomputeLifecycleState =
  | "PENDING"
  | "PROCESSING"
  | "RETRYABLE"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SUPERSEDED";

export type RetryErrorClass =
  | "TRANSIENT_DB"
  | "LOCK_CONTENTION"
  | "WORKER_CRASH"
  | "INVALID_REQUEST"
  | "SOURCE_INVALID"
  | "MAPPING_VERSION_CHANGED"
  | "PROJECTION_VERSION_CHANGED"
  | "SECURITY_SCOPE_FAILURE"
  | "CORRUPT_SOURCE"
  | "CHECKPOINT_FAILURE"
  | "MASTERY_HANDOFF_FAILURE";

export type RecomputeRequestRecord = RecomputeRequestInput & Readonly<{
  status: RecomputeLifecycleState;
  attempts: number;
  claimedBy: string | null;
  claimToken: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  nextAttemptAt: string | null;
  checkpoint: string | null;
  errorClass: RetryErrorClass | null;
  completedAt: string | null;
}>;

export type EvidenceRebuildGeneration = Readonly<{
  id: string;
  scopeKey: string;
  projectionVersion: string;
  mappingSnapshotHash: string;
  sourceCutoff: string | null;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "SUPERSEDED";
  checkpoint: string | null;
  active: boolean;
  startedAt: string | null;
  completedAt: string | null;
  failureClass: string | null;
}>;

export const E2A_MAX_ATTEMPTS = 5;
export const E2A_INITIAL_BACKOFF_MS = 1_000;
export const E2A_MAX_BACKOFF_MS = 60_000;
export const E2A_LEASE_DURATION_MS = 120_000;

type ActiveProjectionRow = Readonly<{
  id: string;
  user_id: string;
  source_event_id: string;
  source_revision_identity: string;
  concept_id: string;
  concept_mapping_set_hash: string;
  evidence_type: string;
  projection_version: string;
  semantic_hash: string;
}>;

type InvalidationTarget = Readonly<{
  sourceType: EvidenceSourceType;
  sourceLineageIdentity: string;
  sourceRevisionIdentity: string;
  userId: string;
  reasonCode: string;
  guard?: Readonly<{ kind: "PRACTICAL_ATTEMPT_VOIDED"; attemptId: string }>;
}>;

export class EvidenceProjectionRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async reconcileEventProjectionSet(
    source: CanonicalEvidenceSource,
    candidates: readonly EvidenceCandidate[],
  ): Promise<ProjectionOutcome> {
    validateCandidateSet(source, candidates);
    const desired = [...candidates].sort((left, right) => left.id.localeCompare(right.id));
    const active = await this.listActiveLineage(source);
    if (
      source.mappingTransition !== "GOVERNED_CORRECTION" &&
      active.rows.some((row) => row.concept_mapping_set_hash !== source.conceptMappingSetHash)
    ) {
      return "CONFLICT";
    }
    const persisted = await this.listProjectionIdentities(desired.map((candidate) => candidate.id));
    if (persisted.rows.some((row) => {
      const candidate = desired.find((item) => item.id === row.id);
      return !candidate || row.semantic_hash !== candidate.semanticHash || row.lifecycle !== "ACTIVE";
    })) {
      return "CONFLICT";
    }

    const currentByConcept = new Map(active.rows.map((row) => [row.concept_id, row]));
    const desiredByConcept = new Map(desired.map((candidate) => [candidate.conceptId, candidate]));
    const statements: DatabaseStatement[] = [];
    const semanticWriteIndexes: number[] = [];
    const initialGuard = completeSourceAndSnapshotGuard(source, desired[0], active.rows);
    statements.push(initialGuard);

    for (const row of active.rows) {
      const replacement = desiredByConcept.get(row.concept_id);
      if (replacement?.id === row.id) continue;
      semanticWriteIndexes.push(statements.length);
      statements.push(replacement
        ? {
          sql: `UPDATE evidence_projections SET lifecycle = 'SUPERSEDED',
            superseded_by_id = NULL, invalidation_reason = NULL
            WHERE id = ? AND lifecycle = 'ACTIVE' AND semantic_hash = ?`,
          parameters: [row.id, row.semantic_hash],
        }
        : {
          sql: `UPDATE evidence_projections SET lifecycle = 'INVALIDATED',
            superseded_by_id = NULL, invalidation_reason = 'CONCEPT_MAPPING_REMOVED'
            WHERE id = ? AND lifecycle = 'ACTIVE' AND semantic_hash = ?`,
          parameters: [row.id, row.semantic_hash],
        });
    }

    for (const candidate of desired) {
      if (currentByConcept.get(candidate.conceptId)?.id === candidate.id) continue;
      semanticWriteIndexes.push(statements.length);
      statements.push(projectionInsert(candidate));
    }

    for (const row of active.rows) {
      const replacement = desiredByConcept.get(row.concept_id);
      if (!replacement || replacement.id === row.id) continue;
      semanticWriteIndexes.push(statements.length);
      statements.push({
        sql: `UPDATE evidence_projections SET superseded_by_id = ?
          WHERE id = ? AND lifecycle = 'SUPERSEDED' AND superseded_by_id IS NULL`,
        parameters: [replacement.id, row.id],
      });
    }

    const affectedConcepts = new Set([
      ...desired.map((candidate) => candidate.conceptId),
      ...active.rows.map((row) => row.concept_id),
    ]);
    for (const conceptId of [...affectedConcepts].sort()) {
      const removed = !desiredByConcept.has(conceptId);
      const request = await createRecomputeRequest({
        requestType: "MASTERY_RECOMPUTE_REQUIRED",
        scopeType: "CONCEPT",
        userId: source.userId,
        conceptId,
        projectionVersion: desired[0].projectionVersion,
        reasonCode: removed ? "EVIDENCE_MAPPING_REMOVED" : "EVIDENCE_SEMANTICS_CHANGED",
        sourceType: source.sourceType,
        sourceEventId: source.sourceEventId,
        sourceRevisionIdentity: source.sourceRevisionIdentity,
      });
      semanticWriteIndexes.push(statements.length);
      statements.push(recomputeInsert(request));
    }
    statements.push(finalActiveSetGuard(source, desired[0], desired));

    try {
      const results = await this.database.transaction(statements);
      const state = await this.inspectDesiredActiveSet(source, desired);
      if (state !== "EXACT") return state === "CONFLICT" ? "CONFLICT" : "INVALID_SOURCE";
      return semanticWriteIndexes.some((index) => (results[index]?.affectedRows ?? 0) > 0)
        ? "NEW_SUCCESS"
        : "EXACT_REPLAY";
    } catch (error) {
      if (!await this.isSourceCurrent(source)) return "CONFLICT";
      const state = await this.inspectDesiredActiveSet(source, desired);
      if (state === "EXACT") return "EXACT_REPLAY";
      if (isGuardOrUniqueViolation(error)) return "CONFLICT";
      throw error;
    }
  }

  invalidateEventSource(source: CanonicalEvidenceSource, reasonCode: string) {
    return this.invalidateActiveLineage({
      sourceType: source.sourceType,
      sourceLineageIdentity: source.sourceLineageIdentity,
      sourceRevisionIdentity: source.sourceRevisionIdentity,
      userId: source.userId,
      reasonCode,
    }, source);
  }

  invalidateLineage(input: InvalidationTarget) {
    return this.invalidateActiveLineage(input, null);
  }

  async enqueue(request: RecomputeRequestInput) {
    const existing = await this.database.queryOne<{ input_semantic_hash: string }>({
      sql: "SELECT input_semantic_hash FROM evidence_recompute_requests WHERE request_type = ? AND input_semantic_hash = ? LIMIT 1",
      parameters: [request.requestType, request.inputSemanticHash],
    });
    if (existing) return "EXACT_REPLAY" as const;
    const result = await this.database.execute(recomputeInsert(request));
    return result.affectedRows === 1 ? "NEW_SUCCESS" as const : "EXACT_REPLAY" as const;
  }

  async claimNext(scopeType: RecomputeScope | null, workerId: string, now = new Date().toISOString()) {
    if (!workerId.trim()) fail("EVIDENCE_WORKER_ID_REQUIRED");
    const candidate = await this.database.queryOne<{ id: string }>({
      sql: `SELECT id FROM evidence_recompute_requests
        WHERE status IN ('PENDING', 'RETRYABLE', 'PROCESSING')
          AND (CAST(? AS TEXT) IS NULL OR scope_type = CAST(? AS TEXT))
          AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY created_at, id LIMIT 1`,
      parameters: [scopeType, scopeType, now, now],
    });
    if (!candidate) return null;
    const token = crypto.randomUUID();
    const leaseExpiresAt = new Date(Date.now() + E2A_LEASE_DURATION_MS).toISOString();
    const result = await this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET status = 'PROCESSING',
        claimed_by = ?, claim_token = ?, claimed_at = ?, lease_expires_at = ?,
        attempts = attempts + 1
        WHERE id = ? AND status IN ('PENDING', 'RETRYABLE', 'PROCESSING')
          AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
      parameters: [workerId, token, now, leaseExpiresAt, candidate.id, now, now],
    });
    if (result.affectedRows !== 1) return null;
    return this.getRequest(candidate.id);
  }

  async getRequest(id: string) {
    const row = await this.database.queryOne<Record<string, unknown>>({
      sql: "SELECT * FROM evidence_recompute_requests WHERE id = ? LIMIT 1",
      parameters: [id],
    });
    return row ? mapRequestRecord(row) : null;
  }

  async updateCheckpoint(id: string, claimToken: string, checkpoint: string | null) {
    return this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET checkpoint = ?, cursor = ?
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?
          AND lease_expires_at > ?`,
      parameters: [checkpoint, checkpoint, id, claimToken, new Date().toISOString()],
    });
  }

  async scheduleRetry(id: string, claimToken: string, errorClass: RetryErrorClass, random = Math.random(), now = new Date()) {
    const request = await this.getRequest(id);
    if (!request || request.status !== "PROCESSING" || request.claimToken !== claimToken) return { outcome: "CONFLICT" as const };
    if (request.attempts >= E2A_MAX_ATTEMPTS) {
      const result = await this.database.execute({
        sql: `UPDATE evidence_recompute_requests SET status = 'FAILED', error_class = ?,
          completed_at = ?, claimed_by = NULL, claim_token = NULL, lease_expires_at = NULL
          WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?`,
        parameters: [errorClass, now.toISOString(), id, claimToken],
      });
      return { outcome: result.affectedRows === 1 ? "FAILED" as const : "CONFLICT" as const };
    }
    const cap = Math.min(E2A_MAX_BACKOFF_MS, E2A_INITIAL_BACKOFF_MS * (2 ** Math.max(0, request.attempts - 1)));
    const delay = Math.floor(Math.max(0, Math.min(1, random)) * cap);
    const nextAttemptAt = new Date(now.getTime() + delay).toISOString();
    const result = await this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET status = 'RETRYABLE', error_class = ?,
        next_attempt_at = ?, claimed_by = NULL, claim_token = NULL, claimed_at = NULL,
        lease_expires_at = NULL WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?`,
      parameters: [errorClass, nextAttemptAt, id, claimToken],
    });
    return { outcome: result.affectedRows === 1 ? "RETRYABLE" as const : "CONFLICT" as const, nextAttemptAt };
  }

  async completeClaim(id: string, claimToken: string) {
    return this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP,
        claimed_by = NULL, claim_token = NULL, lease_expires_at = NULL
        WHERE id = ? AND status = 'PROCESSING' AND claim_token = ?`,
      parameters: [id, claimToken],
    });
  }

  async cancelRequest(id: string, reason = "CANCELLED") {
    return this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET status = 'CANCELLED', error_class = ?,
        cancelled_at = CURRENT_TIMESTAMP, claimed_by = NULL, claim_token = NULL, lease_expires_at = NULL
        WHERE id = ? AND status IN ('PENDING', 'RETRYABLE')`,
      parameters: [reason, id],
    });
  }

  async supersedeRequest(id: string, successorId: string) {
    return this.database.execute({
      sql: `UPDATE evidence_recompute_requests SET status = 'SUPERSEDED', superseded_by_id = ?,
        claimed_by = NULL, claim_token = NULL, lease_expires_at = NULL
        WHERE id = ? AND status IN ('PENDING', 'RETRYABLE')`,
      parameters: [successorId, id],
    });
  }

  async createGeneration(input: Readonly<{ id: string; mappingSnapshotHash: string; sourceCutoff?: string | null; projectionVersion?: string; scopeKey?: string }>) {
    const result = await this.database.execute({
      sql: `INSERT INTO evidence_rebuild_generations
        (id, scope_key, projection_version, mapping_snapshot_hash, source_cutoff, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING') ON CONFLICT (id) DO NOTHING`,
      parameters: [input.id, input.scopeKey ?? "EVIDENCE_V1", input.projectionVersion ?? "EVIDENCE_V1", input.mappingSnapshotHash, input.sourceCutoff ?? null],
    });
    return result.affectedRows === 1 ? "NEW_SUCCESS" as const : "EXACT_REPLAY" as const;
  }

  async startGeneration(id: string) {
    return this.database.execute({
      sql: "UPDATE evidence_rebuild_generations SET status = 'RUNNING', started_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING'",
      parameters: [id],
    });
  }

  async completeGeneration(id: string) {
    return this.database.execute({
      sql: "UPDATE evidence_rebuild_generations SET status = 'SUCCEEDED', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'RUNNING' AND active = 0",
      parameters: [id],
    });
  }

  async cutoverGeneration(id: string, scopeKey = "EVIDENCE_V1") {
    const target = await this.database.queryOne<{ status: string; active: number }>({
      sql: "SELECT status, active FROM evidence_rebuild_generations WHERE id = ? AND scope_key = ? LIMIT 1",
      parameters: [id, scopeKey],
    });
    if (!target || target.status !== "SUCCEEDED") return "CONFLICT" as const;
    if (Number(target.active) === 1) return "EXACT_REPLAY" as const;
    try {
      const results = await this.database.transaction([
        { sql: "UPDATE evidence_rebuild_generations SET active = 0 WHERE scope_key = ? AND active = 1", parameters: [scopeKey] },
        { sql: `UPDATE evidence_rebuild_generations SET active = 1
          WHERE id = ? AND scope_key = ? AND status = 'SUCCEEDED' AND active = 0
            AND NOT EXISTS (SELECT 1 FROM evidence_rebuild_generations WHERE scope_key = ? AND active = 1)`, parameters: [id, scopeKey, scopeKey] },
      ]);
      return (results[1]?.affectedRows ?? 0) === 1 ? "NEW_SUCCESS" as const : "CONFLICT" as const;
    } catch {
      return "CONFLICT" as const;
    }
  }

  async cancelGeneration(id: string) {
    return this.database.execute({
      sql: "UPDATE evidence_rebuild_generations SET status = 'CANCELLED', failure_class = 'CANCELLED' WHERE id = ? AND status IN ('PENDING', 'RUNNING') AND active = 0",
      parameters: [id],
    });
  }

  async supersedeGeneration(id: string, successorId: string) {
    return this.database.execute({
      sql: "UPDATE evidence_rebuild_generations SET status = 'SUPERSEDED', superseded_by_id = ?, active = 0 WHERE id = ? AND status IN ('PENDING', 'RUNNING', 'SUCCEEDED') AND active = 0",
      parameters: [successorId, id],
    });
  }

  async listPending(scopeType: RecomputeScope, limit: number, cursor?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail("EVIDENCE_REBUILD_LIMIT_INVALID");
    return this.database.query<Record<string, unknown>>({
      sql: `SELECT * FROM evidence_recompute_requests
        WHERE status = 'PENDING' AND scope_type = ? AND (? IS NULL OR id > ?)
        ORDER BY id LIMIT ?`,
      parameters: [scopeType, cursor ?? null, cursor ?? null, limit],
    });
  }

  async completeRequest(id: string) {
    return this.database.execute({
      sql: "UPDATE evidence_recompute_requests SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('PENDING', 'PROCESSING')",
      parameters: [id],
    });
  }

  private async invalidateActiveLineage(
    input: InvalidationTarget,
    source: CanonicalEvidenceSource | null,
  ) {
    const active = await this.listActiveTarget(input);
    if (!active.rows.length) return "EXACT_REPLAY" as const;
    const seed = candidateSeedFromActive(input, active.rows[0]);
    const statements: DatabaseStatement[] = [
      source
        ? completeSourceAndSnapshotGuard(source, seed, active.rows)
        : invalidationControlAndSnapshotGuard(input, seed, active.rows),
    ];
    for (const row of active.rows) {
      statements.push({
        sql: `UPDATE evidence_projections SET lifecycle = 'INVALIDATED',
          superseded_by_id = NULL, invalidation_reason = ?
          WHERE id = ? AND lifecycle = 'ACTIVE' AND semantic_hash = ?`,
        parameters: [input.reasonCode, row.id, row.semantic_hash],
      });
    }
    for (const conceptId of [...new Set(active.rows.map((row) => row.concept_id))].sort()) {
      statements.push(recomputeInsert(await createRecomputeRequest({
        requestType: "MASTERY_RECOMPUTE_REQUIRED",
        scopeType: "CONCEPT",
        userId: input.userId,
        conceptId,
        projectionVersion: "EVIDENCE_V1",
        reasonCode: input.reasonCode,
        sourceType: input.sourceType,
        sourceEventId: input.sourceLineageIdentity,
        sourceRevisionIdentity: input.sourceRevisionIdentity,
      })));
    }
    statements.push(noActiveLineageGuard(input, seed));
    try {
      await this.database.transaction(statements);
      return "NEW_SUCCESS" as const;
    } catch (error) {
      const current = await this.listActiveTarget(input);
      if (!current.rows.length) return "EXACT_REPLAY" as const;
      if (isGuardOrUniqueViolation(error)) return "CONFLICT" as const;
      throw error;
    }
  }

  private listActiveLineage(source: CanonicalEvidenceSource) {
    return this.database.query<ActiveProjectionRow>({
      sql: `SELECT id, user_id, source_event_id, source_revision_identity, concept_id,
        concept_mapping_set_hash, evidence_type, projection_version, semantic_hash
        FROM evidence_projections WHERE user_id = ? AND source_type = ?
          AND source_lineage_identity = ? AND evidence_type = ?
          AND projection_version = ? AND lifecycle = 'ACTIVE' ORDER BY id`,
      parameters: [source.userId, source.sourceType, source.sourceLineageIdentity,
        source.evidenceType, "EVIDENCE_V1"],
    });
  }

  private listActiveTarget(input: InvalidationTarget) {
    return this.database.query<ActiveProjectionRow>({
      sql: `SELECT id, user_id, source_event_id, source_revision_identity, concept_id,
        concept_mapping_set_hash, evidence_type, projection_version, semantic_hash
        FROM evidence_projections WHERE user_id = ? AND source_type = ?
          AND source_lineage_identity = ? AND lifecycle = 'ACTIVE' ORDER BY id`,
      parameters: [input.userId, input.sourceType, input.sourceLineageIdentity],
    });
  }

  private listProjectionIdentities(ids: readonly string[]) {
    if (!ids.length) return Promise.resolve({ rows: [], rowCount: 0, metadata: { provider: this.database.kind } } as const);
    return this.database.query<{ id: string; semantic_hash: string; lifecycle: string }>({
      sql: `SELECT id, semantic_hash, lifecycle FROM evidence_projections
        WHERE id IN (${ids.map(() => "?").join(", ")}) ORDER BY id`,
      parameters: ids,
    });
  }

  private async inspectDesiredActiveSet(
    source: CanonicalEvidenceSource,
    desired: readonly EvidenceCandidate[],
  ): Promise<"EXACT" | "CONFLICT" | "ABSENT"> {
    const active = await this.listActiveLineage(source);
    if (!active.rows.length && desired.length) return "ABSENT";
    if (active.rows.length !== desired.length) return "CONFLICT";
    const expected = new Map(desired.map((candidate) => [candidate.id, candidate.semanticHash]));
    return active.rows.every((row) => expected.get(row.id) === row.semantic_hash)
      ? "EXACT"
      : "CONFLICT";
  }

  private async isSourceCurrent(source: CanonicalEvidenceSource) {
    const canonical = canonicalSourcePredicate(source);
    const mapping = canonicalMappingPredicate(source);
    const row = await this.database.queryOne<{ ok: number | string }>({
      sql: `SELECT 1 AS ok WHERE (${canonical.sql}) AND (${mapping.sql})`,
      parameters: [...canonical.parameters, ...mapping.parameters],
    });
    return Number(row?.ok ?? 0) === 1;
  }
}
export async function createRecomputeRequest(
  input: Omit<RecomputeRequestInput, "id" | "inputSemanticHash">,
): Promise<RecomputeRequestInput> {
  const semantics = { ...input, cursor: input.cursor ?? null };
  const inputSemanticHash = await sha256(stableJson(semantics));
  return Object.freeze({ ...semantics, id: inputSemanticHash, inputSemanticHash });
}

export function recomputeInsert(input: RecomputeRequestInput): DatabaseStatement {
  const hasGeneration = input.generationId !== undefined;
  return {
    sql: `INSERT INTO evidence_recompute_requests
      (id, request_type, scope_type, source_type, source_event_id, source_revision_identity,
       user_id, concept_id, projection_version, reason_code, input_semantic_hash, status, cursor${hasGeneration ? ", generation_id" : ""})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?${hasGeneration ? ", ?" : ""})
      ON CONFLICT (request_type, input_semantic_hash) DO NOTHING`,
    parameters: [input.id, input.requestType, input.scopeType, input.sourceType ?? null,
      input.sourceEventId ?? null, input.sourceRevisionIdentity ?? null, input.userId ?? null,
      input.conceptId ?? null, input.projectionVersion, input.reasonCode,
      input.inputSemanticHash, input.cursor ?? null,
      ...(hasGeneration ? [input.generationId ?? null] : [])],
  };
}

function mapRequestRecord(row: Record<string, unknown>): RecomputeRequestRecord {
  return {
    id: String(row.id), requestType: row.request_type as RecomputeRequestType,
    scopeType: row.scope_type as RecomputeScope,
    sourceType: row.source_type as LearningEventSourceType | undefined,
    sourceEventId: row.source_event_id as string | undefined,
    sourceRevisionIdentity: row.source_revision_identity as string | undefined,
    userId: row.user_id as string | undefined, conceptId: row.concept_id as string | undefined,
    projectionVersion: String(row.projection_version), reasonCode: String(row.reason_code),
    inputSemanticHash: String(row.input_semantic_hash), cursor: row.cursor as string | null,
    generationId: row.generation_id as string | null,
    status: row.status as RecomputeLifecycleState, attempts: Number(row.attempts ?? 0),
    claimedBy: row.claimed_by as string | null, claimToken: row.claim_token as string | null,
    claimedAt: row.claimed_at as string | null, leaseExpiresAt: row.lease_expires_at as string | null,
    nextAttemptAt: row.next_attempt_at as string | null, checkpoint: row.checkpoint as string | null,
    errorClass: row.error_class as RetryErrorClass | null, completedAt: row.completed_at as string | null,
  };
}

function projectionInsert(candidate: EvidenceCandidate): DatabaseStatement {
  return {
    sql: `INSERT INTO evidence_projections
      (id, user_id, source_type, source_event_id, source_lineage_identity,
       source_revision_identity, evidence_type, concept_id, concept_mapping_set_hash,
       projection_version, source_semantic_hash, semantic_hash, result_summary_json,
       quality, lifecycle, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      ON CONFLICT (id) DO NOTHING`,
    parameters: [candidate.id, candidate.userId, candidate.sourceType,
      candidate.sourceEventId, candidate.sourceLineageIdentity,
      candidate.sourceRevisionIdentity, candidate.evidenceType, candidate.conceptId,
      candidate.conceptMappingSetHash, candidate.projectionVersion,
      candidate.sourceSemanticHash, candidate.semanticHash, candidate.resultSummaryJson,
      candidate.quality, candidate.occurredAt],
  };
}

function completeSourceAndSnapshotGuard(
  source: CanonicalEvidenceSource,
  seed: EvidenceCandidate,
  snapshot: readonly ActiveProjectionRow[],
) {
  const sourcePredicate = canonicalSourcePredicate(source);
  const mappingPredicate = canonicalMappingPredicate(source);
  const activePredicate = exactActiveSnapshotPredicate(source, snapshot);
  return evidenceGuardStatement(
    seed,
    `NOT ((${sourcePredicate.sql}) AND (${mappingPredicate.sql}) AND (${activePredicate.sql}))`,
    [...sourcePredicate.parameters, ...mappingPredicate.parameters, ...activePredicate.parameters],
  );
}

function finalActiveSetGuard(
  source: CanonicalEvidenceSource,
  seed: EvidenceCandidate,
  desired: readonly EvidenceCandidate[],
) {
  const predicate = exactDesiredSetPredicate(source, desired);
  return evidenceGuardStatement(seed, `NOT (${predicate.sql})`, predicate.parameters);
}

function invalidationControlAndSnapshotGuard(
  input: InvalidationTarget,
  seed: EvidenceCandidate,
  snapshot: readonly ActiveProjectionRow[],
) {
  if (input.guard?.kind !== "PRACTICAL_ATTEMPT_VOIDED") fail("EVIDENCE_INVALIDATION_GUARD_REQUIRED");
  const snapshotPredicate = exactTargetSnapshotPredicate(input, snapshot);
  return evidenceGuardStatement(
    seed,
    `NOT (EXISTS (SELECT 1 FROM practical_attempts
      WHERE id = ? AND user_id = ? AND state = 'VOIDED') AND (${snapshotPredicate.sql}))`,
    [input.guard.attemptId, input.userId, ...snapshotPredicate.parameters],
  );
}

function noActiveLineageGuard(input: InvalidationTarget, seed: EvidenceCandidate) {
  return evidenceGuardStatement(
    seed,
    `EXISTS (SELECT 1 FROM evidence_projections WHERE user_id = ? AND source_type = ?
      AND source_lineage_identity = ? AND lifecycle = 'ACTIVE')`,
    [input.userId, input.sourceType, input.sourceLineageIdentity],
  );
}

function evidenceGuardStatement(
  seed: EvidenceCandidate,
  violationPredicate: string,
  predicateParameters: readonly DatabaseValue[],
): DatabaseStatement {
  return {
    sql: `INSERT INTO evidence_projections
      (id, user_id, source_type, source_event_id, source_lineage_identity,
       source_revision_identity, evidence_type, concept_id, concept_mapping_set_hash,
       projection_version, source_semantic_hash, semantic_hash, result_summary_json,
       quality, lifecycle, occurred_at)
      SELECT NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?
      WHERE ${violationPredicate}`,
    parameters: [seed.userId, seed.sourceType, seed.sourceEventId,
      seed.sourceLineageIdentity, seed.sourceRevisionIdentity, seed.evidenceType,
      seed.conceptId, seed.conceptMappingSetHash, seed.projectionVersion,
      seed.sourceSemanticHash, seed.semanticHash, seed.resultSummaryJson,
      seed.quality, seed.occurredAt, ...predicateParameters],
  };
}

function canonicalSourcePredicate(source: CanonicalEvidenceSource): SqlPredicate {
  if (source.sourceType === "PRACTICAL_EVALUATION") {
    const attemptStatePredicate = source.validity === "INVALIDATED"
      ? "a.state = 'VOIDED'"
      : "a.state <> 'VOIDED'";
    return {
      sql: `EXISTS (SELECT 1 FROM practical_evaluations e
        JOIN practical_attempts a ON a.id = e.attempt_id
        WHERE e.id = ? AND e.attempt_id = ? AND a.user_id = ?
          AND ${attemptStatePredicate} AND e.evaluation_payload_digest = ?
          AND NOT EXISTS (SELECT 1 FROM practical_evaluations newer
            WHERE newer.attempt_id = e.attempt_id AND newer.sequence > e.sequence))`,
      parameters: [source.sourceEventId, source.sourceLineageIdentity,
        source.userId, source.sourceRevisionIdentity],
    };
  }
  const relation = sourceRelation(source.sourceType);
  return {
    sql: `EXISTS (SELECT 1 FROM ${relation.fromSql} WHERE ${relation.identitySql})
      AND (NOT EXISTS (SELECT 1 FROM learning_event_revisions
          WHERE source_type = ? AND source_event_id = ?)
        OR EXISTS (SELECT 1 FROM learning_event_revisions current_revision
          WHERE current_revision.source_type = ? AND current_revision.source_event_id = ?
            AND current_revision.semantic_hash = ?
            AND NOT EXISTS (SELECT 1 FROM learning_event_revisions newer
              WHERE newer.source_type = current_revision.source_type
                AND newer.source_event_id = current_revision.source_event_id
                AND newer.sequence > current_revision.sequence)))`,
    parameters: [source.sourceEventId, source.userId, source.sourceType,
      source.sourceEventId, source.sourceType, source.sourceEventId,
      source.sourceRevisionIdentity],
  };
}

function canonicalMappingPredicate(source: CanonicalEvidenceSource): SqlPredicate {
  const guard = source.mappingGuard;
  if (guard.kind === "ONTOLOGY_EDGES") {
    const base = `e.from_type = ? AND e.from_id = ? AND e.to_type = 'CONCEPT'
      AND e.status = 'ACTIVE' AND e.relation IN ('TESTS', 'ASSESSED_BY', 'COVERS')
      AND c.status = 'ACTIVE'`;
    const exact = guard.members.map(() => `EXISTS (SELECT 1 FROM ontology_edges e
      JOIN ontology_concepts c ON c.id = e.to_id
      WHERE ${base} AND e.edge_key = ? AND c.id = ?)`);
    return {
      sql: `(SELECT count(*) FROM ontology_edges e JOIN ontology_concepts c ON c.id = e.to_id
        WHERE ${base}) = ?${exact.length ? ` AND ${exact.join(" AND ")}` : ""}`,
      parameters: [guard.parentType, guard.parentIdentity, guard.members.length,
        ...guard.members.flatMap((member) => [guard.parentType, guard.parentIdentity,
          member.edgeKey, member.conceptId])],
    };
  }
  const from = guard.kind === "MOCK_COMPOSITION"
    ? `mock_exam_answers answer JOIN question_concepts qc
        ON qc.question_version_id = answer.question_version_id
      JOIN ontology_concepts c ON c.id = qc.concept_id
      WHERE answer.attempt_id = ?`
    : `question_concepts qc JOIN ontology_concepts c ON c.id = qc.concept_id
      WHERE qc.question_version_id = ?`;
  const current = `${from} AND qc.mapping_status = 'APPROVED' AND c.status = 'ACTIVE'`;
  const exact = guard.members.map(() => `EXISTS (SELECT 1 FROM ${current}
    AND qc.id = ? AND qc.concept_id = ? AND c.concept_key = ?
    AND qc.mapping_version = ?
    AND (qc.qualification_json = ? OR (qc.qualification_json IS NULL AND CAST(? AS TEXT) IS NULL))
    AND (qc.provenance_json = ? OR (qc.provenance_json IS NULL AND CAST(? AS TEXT) IS NULL)))`);
  return {
    sql: `(SELECT count(DISTINCT qc.id) FROM ${current}) = ?${exact.length ? ` AND ${exact.join(" AND ")}` : ""}`,
    parameters: [guard.parentIdentity, guard.members.length,
      ...guard.members.flatMap((member) => [guard.parentIdentity, member.mappingId,
        member.conceptId, member.conceptIdentity, member.mappingVersion,
        member.qualificationJson, member.qualificationJson,
        member.provenanceJson, member.provenanceJson])],
  };
}

function exactActiveSnapshotPredicate(
  source: CanonicalEvidenceSource,
  snapshot: readonly ActiveProjectionRow[],
): SqlPredicate {
  const base = `user_id = ? AND source_type = ? AND source_lineage_identity = ?
    AND evidence_type = ? AND projection_version = ? AND lifecycle = 'ACTIVE'`;
  const exact = snapshot.map(() => `EXISTS (SELECT 1 FROM evidence_projections
    WHERE ${base} AND id = ? AND semantic_hash = ?)`);
  return {
    sql: `(SELECT count(*) FROM evidence_projections WHERE ${base}) = ?${exact.length ? ` AND ${exact.join(" AND ")}` : ""}`,
    parameters: [source.userId, source.sourceType, source.sourceLineageIdentity,
      source.evidenceType, "EVIDENCE_V1", snapshot.length,
      ...snapshot.flatMap((row) => [source.userId, source.sourceType,
        source.sourceLineageIdentity, source.evidenceType, "EVIDENCE_V1",
        row.id, row.semantic_hash])],
  };
}

function exactTargetSnapshotPredicate(
  input: InvalidationTarget,
  snapshot: readonly ActiveProjectionRow[],
): SqlPredicate {
  const base = `user_id = ? AND source_type = ? AND source_lineage_identity = ?
    AND lifecycle = 'ACTIVE'`;
  const exact = snapshot.map(() => `EXISTS (SELECT 1 FROM evidence_projections
    WHERE ${base} AND id = ? AND semantic_hash = ?)`);
  return {
    sql: `(SELECT count(*) FROM evidence_projections WHERE ${base}) = ?${exact.length ? ` AND ${exact.join(" AND ")}` : ""}`,
    parameters: [input.userId, input.sourceType, input.sourceLineageIdentity,
      snapshot.length, ...snapshot.flatMap((row) => [input.userId,
        input.sourceType, input.sourceLineageIdentity, row.id, row.semantic_hash])],
  };
}

function exactDesiredSetPredicate(
  source: CanonicalEvidenceSource,
  desired: readonly EvidenceCandidate[],
): SqlPredicate {
  const base = `user_id = ? AND source_type = ? AND source_lineage_identity = ?
    AND evidence_type = ? AND projection_version = ? AND lifecycle = 'ACTIVE'`;
  const exact = desired.map(() => `EXISTS (SELECT 1 FROM evidence_projections
    WHERE ${base} AND id = ? AND semantic_hash = ?)`);
  return {
    sql: `(SELECT count(*) FROM evidence_projections WHERE ${base}) = ?
      AND ${exact.join(" AND ")}`,
    parameters: [source.userId, source.sourceType, source.sourceLineageIdentity,
      source.evidenceType, "EVIDENCE_V1", desired.length,
      ...desired.flatMap((candidate) => [source.userId, source.sourceType,
        source.sourceLineageIdentity, source.evidenceType, "EVIDENCE_V1",
        candidate.id, candidate.semanticHash])],
  };
}

function sourceRelation(sourceType: EvidenceSourceType) {
  const direct: Partial<Record<EvidenceSourceType, string>> = {
    QUESTION_ATTEMPT: "question_attempts",
    MOCK_ATTEMPT: "mock_exam_attempts",
    LESSON_PROGRESS: "user_lesson_progress",
    COURSE_LESSON_PROGRESS: "user_course_lesson_progress",
    LECTURE_PROGRESS: "lecture_progress",
    AUDIO_PROGRESS: "audio_progress",
  };
  if (direct[sourceType]) {
    return { fromSql: `${direct[sourceType]} source`, identitySql: "source.id = ? AND source.user_id = ?" };
  }
  if (sourceType === "MOCK_ITEM_RESULT") {
    return {
      fromSql: "mock_exam_answers source JOIN mock_exam_attempts owner ON owner.id = source.attempt_id",
      identitySql: "source.id = ? AND owner.user_id = ?",
    };
  }
  fail("EVIDENCE_SOURCE_TYPE_INVALID");
}

function candidateSeedFromActive(
  input: InvalidationTarget,
  row: ActiveProjectionRow,
): EvidenceCandidate {
  return {
    id: row.id,
    userId: input.userId,
    sourceType: input.sourceType,
    sourceEventId: row.source_event_id,
    sourceLineageIdentity: input.sourceLineageIdentity,
    sourceRevisionIdentity: input.sourceRevisionIdentity,
    evidenceType: row.evidence_type as EvidenceCandidate["evidenceType"],
    conceptId: row.concept_id,
    conceptMappingSetHash: row.concept_mapping_set_hash,
    projectionVersion: "EVIDENCE_V1",
    sourceSemanticHash: "0".repeat(64),
    semanticHash: row.semantic_hash,
    resultSummaryJson: "{}",
    quality: "DIRECT_PERFORMANCE",
    lifecycle: "ACTIVE",
    occurredAt: "1970-01-01T00:00:00.000Z",
  };
}

function validateCandidateSet(
  source: CanonicalEvidenceSource,
  candidates: readonly EvidenceCandidate[],
) {
  if (!candidates.length || candidates.length !== source.conceptIds.length) {
    fail("EVIDENCE_EVENT_SET_INCOMPLETE");
  }
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length ||
    new Set(candidates.map((candidate) => candidate.conceptId)).size !== candidates.length) {
    fail("EVIDENCE_EVENT_SET_DUPLICATE");
  }
  for (const candidate of candidates) {
    if (candidate.userId !== source.userId || candidate.sourceType !== source.sourceType ||
      candidate.sourceEventId !== source.sourceEventId ||
      candidate.sourceLineageIdentity !== source.sourceLineageIdentity ||
      candidate.sourceRevisionIdentity !== source.sourceRevisionIdentity ||
      candidate.conceptMappingSetHash !== source.conceptMappingSetHash ||
      candidate.projectionVersion !== "EVIDENCE_V1") {
      fail("EVIDENCE_EVENT_SET_MISMATCH");
    }
  }
}

function isGuardOrUniqueViolation(error: unknown) {
  return error instanceof Error &&
    /NOT NULL constraint failed: evidence_projections\.id|null value in column ["']?id["']?.*not-null constraint|UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|duplicate key/i
      .test(error.message);
}

type SqlPredicate = Readonly<{ sql: string; parameters: readonly DatabaseValue[] }>;

function fail(code: string): never {
  throw new AppError("Evidence projection operation failed.", 409, code);
}
