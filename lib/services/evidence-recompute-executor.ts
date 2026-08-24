import {
  EvidenceProjectionRepository,
  type RecomputeRequestRecord,
  type RecomputeScope,
  type RetryErrorClass,
} from "../../db/evidence-projection-repository.ts";
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
    if (disposition === "TERMINAL_FAIL") return this.repository.scheduleRetry(request.id, request.claimToken, errorClass, 1);
    return Promise.resolve({ outcome: "SUPERSEDE_REQUIRED" as const });
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

