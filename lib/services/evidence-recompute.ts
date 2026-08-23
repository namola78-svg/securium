import { AppError } from "../errors.ts";
import {
  EvidenceProjectionRepository,
  createRecomputeRequest,
  type RecomputeRequestInput,
  type RecomputeScope,
} from "../../db/evidence-projection-repository.ts";
import { buildEvidenceCandidates, EVIDENCE_PROJECTION_VERSION, type CanonicalEvidenceSource } from "./evidence-projection.ts";
import type { LearningEventSourceType } from "./learning-event-contracts.ts";

export interface CanonicalEvidenceSourceResolver {
  resolveEvent(input: Readonly<{
    sourceType: LearningEventSourceType;
    sourceEventId: string;
    sourceRevisionIdentity: string;
  }>): Promise<CanonicalEvidenceSource | null>;
}

export type EventRecomputeResult = Readonly<{
  outcome: "NEW_SUCCESS" | "EXACT_REPLAY" | "INVALID_SOURCE" | "CONFLICT";
  projectionCount: number;
}>;

export class EvidenceRecomputeService {
  private readonly repository: EvidenceProjectionRepository;
  private readonly resolver: CanonicalEvidenceSourceResolver;

  constructor(
    repository: EvidenceProjectionRepository,
    resolver: CanonicalEvidenceSourceResolver,
  ) {
    this.repository = repository;
    this.resolver = resolver;
  }

  async recomputeEvent(input: Readonly<{
    sourceType: LearningEventSourceType;
    sourceEventId: string;
    sourceRevisionIdentity: string;
    invalidationReason?: string;
  }>): Promise<EventRecomputeResult> {
    const source = await this.resolver.resolveEvent(input);
    if (!source || source.validity === "LEGACY_INELIGIBLE") return { outcome: "INVALID_SOURCE", projectionCount: 0 };
    if (source.userId.length === 0 || source.sourceEventId !== input.sourceEventId || source.sourceType !== input.sourceType) return { outcome: "INVALID_SOURCE", projectionCount: 0 };
    if (source.validity === "INVALIDATED") {
      const outcome = await this.repository.invalidateSource({ ...input, reasonCode: input.invalidationReason ?? "SOURCE_INVALIDATED" });
      return { outcome, projectionCount: 0 };
    }
    let created = 0;
    let replayed = 0;
    for (const candidate of await buildEvidenceCandidates(source)) {
      const outcome = await this.repository.project(candidate);
      if (outcome === "CONFLICT") return { outcome, projectionCount: created };
      if (outcome === "NEW_SUCCESS") created += 1;
      if (outcome === "EXACT_REPLAY") replayed += 1;
    }
    return { outcome: created ? "NEW_SUCCESS" : replayed ? "EXACT_REPLAY" : "INVALID_SOURCE", projectionCount: created + replayed };
  }

  async requestEventRecompute(input: Readonly<{
    sourceType: LearningEventSourceType;
    sourceEventId: string;
    sourceRevisionIdentity: string;
    userId: string;
    reasonCode: string;
  }>) {
    const request = await createRecomputeRequest({
      requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
      scopeType: "EVENT",
      sourceType: input.sourceType,
      sourceEventId: input.sourceEventId,
      sourceRevisionIdentity: input.sourceRevisionIdentity,
      userId: input.userId,
      projectionVersion: EVIDENCE_PROJECTION_VERSION,
      reasonCode: input.reasonCode,
    });
    return this.repository.enqueue(request);
  }

  async requestRebuild(input: Readonly<{
    scopeType: Exclude<RecomputeScope, "EVENT">;
    userId?: string;
    conceptId?: string;
    reasonCode: string;
    cursor?: string;
  }>) {
    if (input.scopeType === "USER" && !input.userId) fail("EVIDENCE_REBUILD_USER_REQUIRED");
    if (input.scopeType === "CONCEPT" && !input.conceptId) fail("EVIDENCE_REBUILD_CONCEPT_REQUIRED");
    const request = await createRecomputeRequest({
      requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
      scopeType: input.scopeType,
      userId: input.userId,
      conceptId: input.conceptId,
      projectionVersion: EVIDENCE_PROJECTION_VERSION,
      reasonCode: input.reasonCode,
      cursor: input.cursor ?? null,
    });
    return this.repository.enqueue(request);
  }

  async processBounded(scopeType: RecomputeScope, limit: number, handler: (request: RecomputeRequestInput) => Promise<void>, cursor?: string) {
    const page = await this.repository.listPending(scopeType, limit, cursor);
    for (const raw of page.rows) {
      const request = mapRequest(raw);
      await handler(request);
      await this.repository.completeRequest(request.id);
    }
    return Object.freeze({ processed: page.rows.length, nextCursor: page.rows.at(-1)?.id as string | undefined ?? null });
  }
}

function mapRequest(row: Record<string, unknown>): RecomputeRequestInput {
  return {
    id: String(row.id), requestType: row.request_type as RecomputeRequestInput["requestType"],
    scopeType: row.scope_type as RecomputeRequestInput["scopeType"],
    sourceType: row.source_type as LearningEventSourceType | undefined,
    sourceEventId: row.source_event_id as string | undefined,
    sourceRevisionIdentity: row.source_revision_identity as string | undefined,
    userId: row.user_id as string | undefined, conceptId: row.concept_id as string | undefined,
    projectionVersion: String(row.projection_version), reasonCode: String(row.reason_code),
    inputSemanticHash: String(row.input_semantic_hash), cursor: row.cursor as string | null,
  };
}

function fail(code: string): never {
  throw new AppError("Evidence rebuild request is invalid.", 409, code);
}
