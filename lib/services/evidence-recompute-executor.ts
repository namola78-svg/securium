import {
  EvidenceProjectionRepository,
  type RecomputeRequestRecord,
  type RecomputeScope,
  type RetryErrorClass,
} from "../../db/evidence-projection-repository.ts";
import { EVIDENCE_PROJECTION_VERSION } from "./evidence-projection.ts";
import { EvidenceRecomputeService, type EventRecomputeResult } from "./evidence-recompute.ts";
import { evidenceRecomputeDisposition } from "./evidence-recompute-policy.ts";

export class EvidenceRecomputeLifecycleExecutor {
  constructor(private readonly repository: EvidenceProjectionRepository) {}

  claim(scopeType: RecomputeScope | null, workerId: string) {
    return this.repository.claimNext(scopeType, workerId);
  }

  checkpoint(request: RecomputeRequestRecord, checkpoint: string | null) {
    if (!request.claimToken) return Promise.resolve({ affectedRows: 0, returnedRows: [], metadata: { provider: "d1" as const } });
    return this.repository.updateCheckpoint(request.id, request.claimToken, checkpoint);
  }

  complete(request: RecomputeRequestRecord) {
    if (!request.claimToken) return Promise.resolve({ affectedRows: 0, returnedRows: [], metadata: { provider: "d1" as const } });
    return this.repository.completeClaim(request.id, request.claimToken);
  }

  fail(request: RecomputeRequestRecord, errorClass: RetryErrorClass, random = Math.random()) {
    if (!request.claimToken) return Promise.resolve({ outcome: "CONFLICT" as const });
    const disposition = evidenceRecomputeDisposition(errorClass);
    if (disposition === "RETRY") return this.repository.scheduleRetry(request.id, request.claimToken, errorClass, random);
    if (disposition === "TERMINAL_FAIL") {
      return this.repository.failClaim(request.id, request.claimToken, errorClass)
        .then((result) => ({ outcome: result.affectedRows === 1 ? "FAILED" as const : "CONFLICT" as const }));
    }
    return Promise.resolve({ outcome: "SUPERSEDE_REQUIRED" as const });
  }

  claimQuestionAttemptEvent(workerId: string) {
    return this.repository.claimNextQuestionAttemptEvent(workerId);
  }

  cancel(requestId: string) { return this.repository.cancelRequest(requestId); }
  supersede(requestId: string, successorId: string) { return this.repository.supersedeRequest(requestId, successorId); }
  createGeneration(input: Parameters<EvidenceProjectionRepository["createGeneration"]>[0]) { return this.repository.createGeneration(input); }
  startGeneration(id: string) { return this.repository.startGeneration(id); }
  completeGeneration(id: string) { return this.repository.completeGeneration(id); }
  cutoverGeneration(id: string, scopeKey?: string) { return this.repository.cutoverGeneration(id, scopeKey); }
  cancelGeneration(id: string) { return this.repository.cancelGeneration(id); }
  supersedeGeneration(id: string, successorId: string) { return this.repository.supersedeGeneration(id, successorId); }
}

export type QuestionAttemptEventExecutionResult = Readonly<{
  outcome: "NO_REQUEST" | "COMPLETED" | "RETRYABLE" | "FAILED" | "CLAIM_LOST";
  requestId: string | null;
  projectionOutcome?: EventRecomputeResult["outcome"];
  projectionCount: number;
  errorClass?: RetryErrorClass;
}>;

/**
 * Bounded E2-B seed: only executes durable EVENT requests for governed
 * question attempts. It does not dispatch a worker or traverse a scope.
 */
export class QuestionAttemptEvidenceEventExecutor {
  constructor(
    private readonly lifecycle: EvidenceRecomputeLifecycleExecutor,
    private readonly recompute: EvidenceRecomputeService,
  ) {}

  async processNext(workerId: string): Promise<QuestionAttemptEventExecutionResult> {
    const request = await this.lifecycle.claimQuestionAttemptEvent(workerId);
    if (!request) return { outcome: "NO_REQUEST", requestId: null, projectionCount: 0 };
    return this.processClaimed(request);
  }

  async processClaimed(request: RecomputeRequestRecord): Promise<QuestionAttemptEventExecutionResult> {
    const invalid = validateQuestionAttemptRequest(request);
    if (invalid) return this.fail(request, "INVALID_REQUEST", 0);

    try {
      const recomputed = await this.recompute.recomputeEvent({
        sourceType: "QUESTION_ATTEMPT",
        sourceEventId: request.sourceEventId!,
        sourceRevisionIdentity: request.sourceRevisionIdentity!,
        expectedUserId: request.userId,
      });
      if (recomputed.outcome === "INVALID_SOURCE") {
        return this.fail(request, "SOURCE_INVALID", recomputed.projectionCount, recomputed.outcome);
      }
      if (recomputed.outcome === "CONFLICT") {
        return this.fail(request, "CORRUPT_SOURCE", recomputed.projectionCount, recomputed.outcome);
      }
      const completed = await this.lifecycle.complete(request);
      if (completed.affectedRows !== 1) {
        return {
          outcome: "CLAIM_LOST",
          requestId: request.id,
          projectionOutcome: recomputed.outcome,
          projectionCount: recomputed.projectionCount,
        };
      }
      return {
        outcome: "COMPLETED",
        requestId: request.id,
        projectionOutcome: recomputed.outcome,
        projectionCount: recomputed.projectionCount,
      };
    } catch (error) {
      return this.fail(request, classifyExecutionError(error), 0);
    }
  }

  private async fail(
    request: RecomputeRequestRecord,
    errorClass: RetryErrorClass,
    projectionCount: number,
    projectionOutcome?: EventRecomputeResult["outcome"],
  ): Promise<QuestionAttemptEventExecutionResult> {
    const result = await this.lifecycle.fail(request, errorClass);
    if (result.outcome === "CONFLICT") {
      return { outcome: "CLAIM_LOST", requestId: request.id, projectionOutcome, projectionCount, errorClass };
    }
    return {
      outcome: result.outcome === "RETRYABLE" ? "RETRYABLE" : "FAILED",
      requestId: request.id,
      projectionOutcome,
      projectionCount,
      errorClass,
    };
  }
}

function validateQuestionAttemptRequest(request: RecomputeRequestRecord) {
  if (
    request.requestType !== "EVIDENCE_RECOMPUTE_REQUIRED" ||
    request.scopeType !== "EVENT" ||
    request.sourceType !== "QUESTION_ATTEMPT" ||
    request.projectionVersion !== EVIDENCE_PROJECTION_VERSION ||
    !request.userId ||
    !request.sourceEventId ||
    !request.sourceRevisionIdentity
  ) return true;
  return false;
}

function classifyExecutionError(error: unknown): RetryErrorClass {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (code.startsWith("EVIDENCE_") || code === "PROGRESS_EVIDENCE_QUALITY_INVALID") {
    return "SOURCE_INVALID";
  }
  return "TRANSIENT_DB";
}
