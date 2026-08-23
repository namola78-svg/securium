import { AppError } from "../errors.ts";
import { sha256, stableJson } from "./learning-event-contracts.ts";

export const EVIDENCE_PROJECTION_VERSION = "EVIDENCE_V1" as const;
export const evidenceSourceTypes = [
  "QUESTION_ATTEMPT", "MOCK_ATTEMPT", "MOCK_ITEM_RESULT", "PRACTICAL_EVALUATION",
  "LESSON_PROGRESS", "COURSE_LESSON_PROGRESS", "LECTURE_PROGRESS", "AUDIO_PROGRESS",
] as const;
export type EvidenceSourceType = (typeof evidenceSourceTypes)[number];
export type EvidenceType = "PERFORMANCE_RESULT" | "PRACTICAL_PERFORMANCE" | "LEARNING_ACTIVITY";
export type EvidenceQuality = "DIRECT_PERFORMANCE" | "HUMAN_EVALUATED" | "SUPPORTING_ACTIVITY";
export type EvidenceLifecycle = "ACTIVE" | "SUPERSEDED" | "INVALIDATED";
export type ProjectionOutcome = "NEW_SUCCESS" | "EXACT_REPLAY" | "CONFLICT" | "INVALID_SOURCE";

export type EvidenceMappingGuard =
  | Readonly<{
    kind: "QUESTION_VERSION" | "MOCK_COMPOSITION";
    parentIdentity: string;
    members: readonly Readonly<{
      mappingId: string;
      conceptId: string;
      conceptIdentity: string;
      mappingVersion: number;
      qualificationJson: string | null;
      provenanceJson: string | null;
    }>[];
  }>
  | Readonly<{
    kind: "ONTOLOGY_EDGES";
    parentIdentity: string;
    parentType: string;
    members: readonly Readonly<{ edgeKey: string; conceptId: string }>[];
  }>;

export type CanonicalEvidenceSource = Readonly<{
  sourceType: EvidenceSourceType;
  sourceEventId: string;
  sourceLineageIdentity: string;
  sourceRevisionIdentity: string;
  userId: string;
  contentVersionIdentity: string;
  conceptMappingSetHash: string;
  conceptIds: readonly string[];
  occurredAt: string;
  validity: "ELIGIBLE" | "INVALIDATED" | "LEGACY_INELIGIBLE";
  evidenceType: EvidenceType;
  quality: EvidenceQuality;
  resultSummary: Readonly<Record<string, string | number | boolean | null>>;
  sourceSemanticHash: string;
  mappingTransition: "PRESERVE_EVENT_TIME" | "GOVERNED_CORRECTION";
  mappingGuard: EvidenceMappingGuard;
}>;

export type EvidenceCandidate = Readonly<{
  id: string;
  userId: string;
  sourceType: EvidenceSourceType;
  sourceEventId: string;
  sourceLineageIdentity: string;
  sourceRevisionIdentity: string;
  evidenceType: EvidenceType;
  conceptId: string;
  conceptMappingSetHash: string;
  projectionVersion: typeof EVIDENCE_PROJECTION_VERSION;
  sourceSemanticHash: string;
  semanticHash: string;
  resultSummaryJson: string;
  quality: EvidenceQuality;
  lifecycle: "ACTIVE";
  occurredAt: string;
}>;

export interface EvidenceAdapter<T extends CanonicalEvidenceSource = CanonicalEvidenceSource> {
  readonly sourceType: T["sourceType"];
  adapt(source: T): Promise<readonly EvidenceCandidate[]>;
}

export function createEvidenceAdapter<T extends CanonicalEvidenceSource>(
  sourceType: T["sourceType"],
): EvidenceAdapter<T> {
  return Object.freeze({
    sourceType,
    async adapt(source: T) {
      validateSource(source, sourceType);
      if (source.validity !== "ELIGIBLE") invalid("EVIDENCE_SOURCE_INELIGIBLE");
      return Promise.all([...source.conceptIds].sort().map((conceptId) => buildCandidate(source, conceptId)));
    },
  });
}

export const QuestionAttemptEvidenceAdapter = createEvidenceAdapter("QUESTION_ATTEMPT");
export const MockAttemptEvidenceAdapter = createEvidenceAdapter("MOCK_ATTEMPT");
export const MockItemResultEvidenceAdapter = createEvidenceAdapter("MOCK_ITEM_RESULT");
export const PracticalEvaluationEvidenceAdapter = createEvidenceAdapter("PRACTICAL_EVALUATION");
export const LessonCompletionEvidenceAdapter = createEvidenceAdapter("LESSON_PROGRESS");
export const CourseLessonCompletionEvidenceAdapter = createEvidenceAdapter("COURSE_LESSON_PROGRESS");
export const LectureCompletionEvidenceAdapter = createEvidenceAdapter("LECTURE_PROGRESS");
export const AudioCompletionEvidenceAdapter = createEvidenceAdapter("AUDIO_PROGRESS");

export const evidenceAdapterRegistry = Object.freeze(new Map<EvidenceSourceType, EvidenceAdapter>([
  ["QUESTION_ATTEMPT", QuestionAttemptEvidenceAdapter],
  ["MOCK_ATTEMPT", MockAttemptEvidenceAdapter],
  ["MOCK_ITEM_RESULT", MockItemResultEvidenceAdapter],
  ["PRACTICAL_EVALUATION", PracticalEvaluationEvidenceAdapter],
  ["LESSON_PROGRESS", LessonCompletionEvidenceAdapter],
  ["COURSE_LESSON_PROGRESS", CourseLessonCompletionEvidenceAdapter],
  ["LECTURE_PROGRESS", LectureCompletionEvidenceAdapter],
  ["AUDIO_PROGRESS", AudioCompletionEvidenceAdapter],
]));

export async function buildEvidenceCandidates(source: CanonicalEvidenceSource) {
  const adapter = evidenceAdapterRegistry.get(source.sourceType);
  if (!adapter) invalid("EVIDENCE_SOURCE_UNSUPPORTED");
  return adapter.adapt(source);
}

async function buildCandidate(source: CanonicalEvidenceSource, conceptId: string): Promise<EvidenceCandidate> {
  const identitySemantics = {
    conceptId,
    conceptMappingSetHash: source.conceptMappingSetHash,
    evidenceType: source.evidenceType,
    projectionVersion: EVIDENCE_PROJECTION_VERSION,
    sourceEventId: source.sourceEventId,
    sourceRevisionIdentity: source.sourceRevisionIdentity,
    sourceType: source.sourceType,
    userId: source.userId,
  };
  const id = await sha256(stableJson(identitySemantics));
  const resultSummaryJson = stableJson(source.resultSummary);
  const semanticHash = await sha256(stableJson({
    ...identitySemantics,
    contentVersionIdentity: source.contentVersionIdentity,
    lifecycle: "ACTIVE",
    occurredAt: source.occurredAt,
    quality: source.quality,
    resultSummary: source.resultSummary,
    sourceSemanticHash: source.sourceSemanticHash,
  }));
  return Object.freeze({
    ...identitySemantics,
    id,
    lifecycle: "ACTIVE",
    occurredAt: source.occurredAt,
    quality: source.quality,
    resultSummaryJson,
    semanticHash,
    sourceSemanticHash: source.sourceSemanticHash,
    sourceLineageIdentity: source.sourceLineageIdentity,
  });
}

function validateSource(source: CanonicalEvidenceSource, expected: EvidenceSourceType) {
  if (source.sourceType !== expected || !evidenceSourceTypes.includes(source.sourceType)) invalid("EVIDENCE_SOURCE_UNSUPPORTED");
  for (const value of [source.sourceEventId, source.sourceLineageIdentity, source.sourceRevisionIdentity, source.userId, source.contentVersionIdentity]) {
    if (!value || value.length > 500) invalid("EVIDENCE_SOURCE_IDENTITY_INVALID");
  }
  for (const hash of [source.conceptMappingSetHash, source.sourceSemanticHash]) {
    if (!/^[0-9a-f]{64}$/.test(hash)) invalid("EVIDENCE_SOURCE_HASH_INVALID");
  }
  if (!source.conceptIds.length || new Set(source.conceptIds).size !== source.conceptIds.length) invalid("EVIDENCE_CONCEPT_MAPPING_INVALID");
  if (source.sourceType === "PRACTICAL_EVALUATION" && source.quality !== "HUMAN_EVALUATED" && source.quality !== "DIRECT_PERFORMANCE") invalid("PRACTICAL_EVALUATION_NOT_QUALIFIED");
  if (source.sourceType.endsWith("PROGRESS") && (source.evidenceType !== "LEARNING_ACTIVITY" || source.quality !== "SUPPORTING_ACTIVITY")) invalid("PROGRESS_EVIDENCE_QUALITY_INVALID");
  const allowedResultKeys: Record<EvidenceSourceType, readonly string[]> = {
    QUESTION_ATTEMPT: ["correct", "score"],
    MOCK_ITEM_RESULT: ["correct", "score"],
    MOCK_ATTEMPT: ["score", "correctCount", "wrongCount", "unansweredCount"],
    PRACTICAL_EVALUATION: ["rawScore", "maximumScore", "qualification"],
    LESSON_PROGRESS: ["completed"], COURSE_LESSON_PROGRESS: ["completed"],
    LECTURE_PROGRESS: ["completed"], AUDIO_PROGRESS: ["completed"],
  };
  if (Object.keys(source.resultSummary).some((key) => !allowedResultKeys[source.sourceType].includes(key))) invalid("EVIDENCE_RESULT_SCHEMA_INVALID");
  if (Object.values(source.resultSummary).some((value) => typeof value === "string" && value.length > 100)) invalid("EVIDENCE_RESULT_SCHEMA_INVALID");
  if (stableJson(source.resultSummary).length > 4000) invalid("EVIDENCE_RESULT_SUMMARY_TOO_LARGE");
}

function invalid(code: string): never {
  throw new AppError("Canonical source is not eligible for formal Evidence.", 409, code);
}
