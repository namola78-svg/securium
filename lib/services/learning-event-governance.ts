import { AppError } from "../errors.ts";
import {
  createEvidenceRecomputeRequiredSignal,
  learningEventRevisionActions,
  learningEventSourceTypes,
  sha256,
  stableJson,
  type EvidenceRecomputeRequiredSignal,
  type LearningEventRevisionAction,
  type LearningEventSourceType,
} from "./learning-event-contracts.ts";

export type LearningEventCorrectionPayload =
  | Readonly<{
      kind: "QUESTION_RESULT";
      isCorrect: boolean;
      score: number;
      questionVersionId: string;
      conceptMappingSetHash: string;
    }>
  | Readonly<{
      kind: "MOCK_RESULT";
      score: number;
      correctCount: number;
      wrongCount: number;
      unansweredCount: number;
      compositionSemanticHash: string;
    }>
  | Readonly<{
      kind: "MOCK_ITEM_RESULT";
      isCorrect: boolean | null;
      score: number | null;
      questionVersionId: string;
      conceptMappingSetHash: string;
    }>
  | Readonly<{
      kind: "CONCEPT_MAPPING";
      conceptMappingSetHash: string;
    }>
  | Readonly<{ kind: "VALIDITY_ONLY" }>;

export type AppendLearningEventRevisionInput = Readonly<{
  revisionId: string;
  sourceType: LearningEventSourceType;
  sourceEventId: string;
  ownerUserId: string;
  actorUserId: string;
  action: LearningEventRevisionAction;
  reasonCode: string;
  payload: LearningEventCorrectionPayload;
  expectedPreviousRevisionId: string | null;
}>;

export type LearningEventRevision = Readonly<{
  id: string;
  sourceType: LearningEventSourceType;
  sourceEventId: string;
  sequence: number;
  previousRevisionId: string | null;
  action: LearningEventRevisionAction;
  reasonCode: string;
  payloadSchemaVersion: 1;
  correctionPayloadJson: string;
  semanticHash: string;
  actorUserId: string;
  createdAt: string;
}>;

export type LearningEventRevisionResult = Readonly<{
  outcome: "NEW_SUCCESS" | "EXACT_REPLAY";
  revision: LearningEventRevision;
  recomputeSignal: EvidenceRecomputeRequiredSignal;
}>;

export interface LearningEventGovernanceRepositoryContract {
  appendRevision(
    input: AppendLearningEventRevisionInput & Readonly<{
      correctionPayloadJson: string;
      semanticHash: string;
    }>,
  ): Promise<Readonly<{
    outcome: "NEW_SUCCESS" | "EXACT_REPLAY";
    revision: LearningEventRevision;
  }>>;
}

export class LearningEventGovernanceService {
  private readonly repository: LearningEventGovernanceRepositoryContract;

  constructor(repository: LearningEventGovernanceRepositoryContract) {
    this.repository = repository;
  }

  async appendRevision(
    input: AppendLearningEventRevisionInput,
  ): Promise<LearningEventRevisionResult> {
    validateInput(input);
    const correctionPayloadJson = stableJson(input.payload);
    const semanticHash = await sha256(
      stableJson({
        action: input.action,
        actorUserId: input.actorUserId,
        expectedPreviousRevisionId: input.expectedPreviousRevisionId,
        payload: input.payload,
        payloadSchemaVersion: 1,
        reasonCode: input.reasonCode,
        sourceEventId: input.sourceEventId,
        sourceType: input.sourceType,
      }),
    );
    const result = await this.repository.appendRevision({
      ...input,
      correctionPayloadJson,
      semanticHash,
    });
    return Object.freeze({
      ...result,
      recomputeSignal: createEvidenceRecomputeRequiredSignal({
        sourceType: input.sourceType,
        sourceEventId: input.sourceEventId,
        reasonCode: input.reasonCode,
        sourceRevisionIdentity: result.revision.semanticHash,
      }),
    });
  }
}

function validateInput(input: AppendLearningEventRevisionInput) {
  if (!learningEventSourceTypes.includes(input.sourceType)) fail("EVENT_SOURCE_TYPE_INVALID");
  if (!learningEventRevisionActions.includes(input.action)) fail("EVENT_REVISION_ACTION_INVALID");
  for (const [value, code] of [
    [input.revisionId, "EVENT_REVISION_ID_INVALID"],
    [input.sourceEventId, "EVENT_SOURCE_ID_INVALID"],
    [input.ownerUserId, "EVENT_OWNER_ID_INVALID"],
    [input.actorUserId, "EVENT_ACTOR_ID_INVALID"],
    [input.reasonCode, "EVENT_REVISION_REASON_INVALID"],
  ] as const) {
    if (!value || value.length > 200) fail(code);
  }
  validatePayload(input.sourceType, input.action, input.payload);
}

function validatePayload(
  sourceType: LearningEventSourceType,
  action: LearningEventRevisionAction,
  payload: LearningEventCorrectionPayload,
) {
  if (action === "INVALIDATE" || action === "RESTORE_ELIGIBILITY") {
    if (payload.kind !== "VALIDITY_ONLY") fail("EVENT_REVISION_PAYLOAD_INVALID");
    return;
  }
  const allowed: Partial<Record<LearningEventSourceType, readonly LearningEventCorrectionPayload["kind"][]>> = {
    QUESTION_ATTEMPT: ["QUESTION_RESULT", "CONCEPT_MAPPING"],
    MOCK_ATTEMPT: ["MOCK_RESULT", "CONCEPT_MAPPING"],
    MOCK_ITEM_RESULT: ["MOCK_ITEM_RESULT", "CONCEPT_MAPPING"],
  };
  if (!allowed[sourceType]?.includes(payload.kind)) fail("EVENT_REVISION_PAYLOAD_INVALID");
  if ("score" in payload && payload.score !== null && (!Number.isFinite(payload.score) || payload.score < 0)) {
    fail("EVENT_REVISION_SCORE_INVALID");
  }
  for (const hash of [
    "conceptMappingSetHash" in payload ? payload.conceptMappingSetHash : null,
    "compositionSemanticHash" in payload ? payload.compositionSemanticHash : null,
  ]) {
    if (hash !== null && !/^[0-9a-f]{64}$/.test(hash)) fail("EVENT_REVISION_HASH_INVALID");
  }
}

function fail(code: string): never {
  throw new AppError("Learning event revision is invalid.", 409, code);
}
