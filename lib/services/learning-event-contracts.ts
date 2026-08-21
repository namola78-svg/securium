import { AppError } from "../errors.ts";

export const learningEventSourceTypes = [
  "QUESTION_ATTEMPT",
  "MOCK_ATTEMPT",
  "MOCK_ITEM_RESULT",
  "PRACTICAL_ATTEMPT",
  "PRACTICAL_EVALUATION",
  "LESSON_PROGRESS",
  "COURSE_LESSON_PROGRESS",
  "LECTURE_PROGRESS",
  "AUDIO_PROGRESS",
] as const;

export type LearningEventSourceType = (typeof learningEventSourceTypes)[number];

export const learningEventRevisionActions = [
  "CORRECT",
  "INVALIDATE",
  "RESTORE_ELIGIBILITY",
  "CORRECT_CONCEPT_MAPPING",
] as const;

export type LearningEventRevisionAction =
  (typeof learningEventRevisionActions)[number];

export type EvidenceRecomputeRequiredSignal = Readonly<{
  type: "EVIDENCE_RECOMPUTE_REQUIRED";
  sourceType: LearningEventSourceType;
  sourceEventId: string;
  reasonCode: string;
  sourceRevisionIdentity: string;
}>;

export const legacyLearningEventEligibility = Object.freeze({
  questionAttempt: "LEGACY_VERSION_UNKNOWN_NOT_ELIGIBLE_FOR_FORMAL_EVIDENCE",
  mockAttempt: "LEGACY_COMPOSITION_UNKNOWN_NOT_ELIGIBLE_FOR_FORMAL_EVIDENCE",
  progress: "LEGACY_CONTENT_VERSION_UNKNOWN_SUPPORTING_ACTIVITY_ONLY",
} as const);

export type GovernedConceptMapping = Readonly<{
  conceptIdentity: string;
  mappingVersion: number;
  qualification: unknown;
  provenance: unknown;
  status: "APPROVED";
}>;

export async function computeConceptMappingSetHash(
  mappings: readonly GovernedConceptMapping[],
) {
  if (!mappings.length) fail("CONCEPT_MAPPING_NOT_ELIGIBLE");
  const normalized = [...mappings]
    .map((mapping) => {
      if (!mapping.conceptIdentity || mapping.mappingVersion < 1) {
        fail("CONCEPT_MAPPING_SET_MISMATCH");
      }
      if (mapping.status !== "APPROVED") fail("CONCEPT_MAPPING_NOT_ELIGIBLE");
      return {
        conceptIdentity: mapping.conceptIdentity,
        mappingVersion: mapping.mappingVersion,
        provenance: mapping.provenance,
        qualification: mapping.qualification,
        status: mapping.status,
      };
    })
    .sort((left, right) =>
      `${left.conceptIdentity}:${left.mappingVersion}`.localeCompare(
        `${right.conceptIdentity}:${right.mappingVersion}`,
      ),
    );
  return sha256(stableJson(normalized));
}

export type MockCompositionItem = Readonly<{
  displayOrder: number;
  questionIdentity: string;
  questionVersionSemanticHash: string;
  possibleScore: number;
  conceptMappingSetHash: string;
}>;

export async function computeMockCompositionSemanticHash(input: Readonly<{
  items: readonly MockCompositionItem[];
  passingScore: number;
  questionCount: number;
  randomizeQuestions: boolean;
  randomizeChoices: boolean;
}>) {
  if (input.items.length !== input.questionCount) fail("MOCK_ITEM_VERSION_MISMATCH");
  const ordered = [...input.items].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  if (new Set(ordered.map((item) => item.displayOrder)).size !== ordered.length) {
    fail("MOCK_COMPOSITION_CONFLICT");
  }
  return sha256(
    stableJson({
      items: ordered,
      passingScore: input.passingScore,
      questionCount: input.questionCount,
      randomizeChoices: input.randomizeChoices,
      randomizeQuestions: input.randomizeQuestions,
    }),
  );
}

export function createEvidenceRecomputeRequiredSignal(input: Readonly<{
  sourceType: LearningEventSourceType;
  sourceEventId: string;
  reasonCode: string;
  sourceRevisionIdentity: string;
}>): EvidenceRecomputeRequiredSignal {
  if (!learningEventSourceTypes.includes(input.sourceType)) fail("EVENT_SOURCE_TYPE_INVALID");
  if (!input.sourceEventId || !input.reasonCode || !input.sourceRevisionIdentity) {
    fail("EVENT_RECOMPUTE_SIGNAL_INVALID");
  }
  return Object.freeze({ type: "EVIDENCE_RECOMPUTE_REQUIRED", ...input });
}

export type FutureLabCtfEventContract = Readonly<{
  status: "FUTURE_SOURCE_NOT_IMPLEMENTED";
  attemptIdentity: string;
  learnerIdentity: string;
  contentVersionIdentity: string;
  environmentVersionIdentity: string;
  resultEvaluationIdentity: string;
  conceptMappingSetHash: string;
  validity: "ELIGIBLE" | "INVALIDATED";
  startedAt: string;
  completedAt: string | null;
  invalidationIdentity: string | null;
}>;

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function fail(code: string): never {
  throw new AppError("Learning event governance validation failed.", 409, code);
}
