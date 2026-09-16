import {
  gradingModeForResponseType,
  isSupportedResponseType,
  type SupportedResponseType,
} from "./grading-service.ts";

export const PRESENTATION_TYPES = ["STANDARD", "SCENARIO", "CASE"] as const;
export type PresentationType = (typeof PRESENTATION_TYPES)[number];
export type ResponseType = SupportedResponseType;
export type ResponseTypeInput =
  | ResponseType
  | "BOOLEAN"
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "DESCRIPTIVE";
export type GradingMode = "AUTOMATIC" | "MANUAL_REVIEW";

export type AssessmentPresentationResponseContract = Readonly<{
  presentationType: PresentationType;
  responseType: ResponseType;
  gradingMode: GradingMode;
}>;

const RESPONSE_ALIASES: Readonly<Record<string, ResponseType>> = {
  BOOLEAN: "TRUE_FALSE",
  SHORT_TEXT: "SHORT_ANSWER",
  LONG_TEXT: "ESSAY",
  DESCRIPTIVE: "ESSAY",
};

const PRESENTATION_METADATA_AUTHORITY_KEYS = new Set([
  "answer",
  "answerIndex",
  "correctAnswer",
  "correctChoice",
  "gradingMode",
  "isCorrect",
  "score",
  "responseType",
]);

export class AssessmentPresentationResponseError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "AssessmentPresentationResponseError";
    this.code = code;
  }
}

function normalizeResponseType(value: ResponseTypeInput | string): ResponseType {
  const normalized = String(value).trim().toUpperCase();
  const responseType = RESPONSE_ALIASES[normalized] ?? normalized;
  if (!isSupportedResponseType(responseType)) {
    throw new AssessmentPresentationResponseError(
      "RESPONSE_TYPE_EXPLICIT_CONTRACT_REQUIRED",
    );
  }
  return responseType;
}

function assertPresentationType(value: string): PresentationType {
  const normalized = String(value).trim().toUpperCase();
  if (!PRESENTATION_TYPES.includes(normalized as PresentationType)) {
    throw new AssessmentPresentationResponseError("PRESENTATION_TYPE_UNKNOWN");
  }
  return normalized as PresentationType;
}

export function createAssessmentPresentationResponseContract(input: {
  presentationType: string;
  responseType: ResponseTypeInput | string;
}): AssessmentPresentationResponseContract {
  const responseType = normalizeResponseType(input.responseType);
  const presentationType = assertPresentationType(input.presentationType);
  return Object.freeze({
    presentationType,
    responseType,
    gradingMode: gradingModeForResponseType(responseType),
  });
}

export function assertPresentationMetadataHasNoAuthority(
  metadata: Record<string, unknown> | undefined,
): void {
  if (!metadata) return;
  for (const [key, value] of Object.entries(metadata)) {
    if (PRESENTATION_METADATA_AUTHORITY_KEYS.has(key)) {
      throw new AssessmentPresentationResponseError(
        "PRESENTATION_METADATA_AUTHORITY_VIOLATION",
      );
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object") {
          assertPresentationMetadataHasNoAuthority(child as Record<string, unknown>);
        }
      }
    } else if (value && typeof value === "object") {
      assertPresentationMetadataHasNoAuthority(value as Record<string, unknown>);
    }
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function assertContractIntegrity(
  contract: AssessmentPresentationResponseContract,
): AssessmentPresentationResponseContract {
  const derived = createAssessmentPresentationResponseContract({
    presentationType: contract.presentationType,
    responseType: contract.responseType,
  });
  if (contract.gradingMode !== derived.gradingMode) {
    throw new AssessmentPresentationResponseError(
      "GRADING_MODE_DERIVATION_MISMATCH",
    );
  }
  return derived;
}

export function serializeAssessmentPresentationResponse(input: {
  contract: AssessmentPresentationResponseContract;
  presentationMetadata?: Record<string, unknown>;
}): string {
  assertPresentationMetadataHasNoAuthority(input.presentationMetadata);
  const contract = assertContractIntegrity(input.contract);
  return JSON.stringify(
    canonicalize({
      contract,
      ...(input.presentationMetadata
        ? { presentationMetadata: input.presentationMetadata }
        : {}),
    }),
  );
}

export function resolveLegacyCaseAnalysis(input: {
  responseType?: ResponseTypeInput | string | null;
  presentationType?: string | null;
}): AssessmentPresentationResponseContract {
  if (!input.responseType) {
    throw new AssessmentPresentationResponseError(
      "LEGACY_CASE_ANALYSIS_RESPONSE_TYPE_UNRESOLVED",
    );
  }
  return createAssessmentPresentationResponseContract({
    presentationType: input.presentationType ?? "CASE",
    responseType: input.responseType,
  });
}
