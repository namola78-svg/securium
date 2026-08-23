import { AppError } from "../errors.ts";

export const CONTENT_REVISION_TYPES = [
  "LEGAL_ARTICLE",
  "ISMS_STANDARD",
  "PRIVACY_IMPACT_ITEM",
  "SUBJECT",
  "SECURE_CODING_WEAKNESS",
  "LEARNING_UNIT",
  "LESSON",
  "QUESTION_EXPLANATION",
  "AUDIO_CONTENT",
  "LECTURE",
] as const;

export type ContentRevisionType =
  (typeof CONTENT_REVISION_TYPES)[number];

export const CONTENT_REVISION_TYPE_LABELS: Record<
  ContentRevisionType,
  string
> = {
  LEGAL_ARTICLE: "법령",
  ISMS_STANDARD: "ISMS-P 인증기준",
  PRIVACY_IMPACT_ITEM: "개인정보 영향평가 항목",
  SUBJECT: "시험과목",
  SECURE_CODING_WEAKNESS: "보안약점 분류",
  LEARNING_UNIT: "학습 이론 단위",
  LESSON: "본문형 이론",
  QUESTION_EXPLANATION: "문제 해설",
  AUDIO_CONTENT: "오디오",
  LECTURE: "강의",
};

export type RevisionStatus =
  | "draft"
  | "review"
  | "published"
  | "superseded"
  | "archived";

export function parseRevisionSnapshot(value: string) {
  if (new TextEncoder().encode(value).byteLength > 100_000) {
    throw new Error("버전 스냅샷은 100KB 이하여야 합니다.");
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("버전 스냅샷은 JSON 객체여야 합니다.");
  }
  return parsed as Record<string, unknown>;
}

export function mergeAllowedSnapshot(
  current: Record<string, unknown>,
  requested: Record<string, unknown>,
  allowedFields: readonly string[],
) {
  const result: Record<string, unknown> = {};
  for (const key of allowedFields) {
    const candidate = key in requested ? requested[key] : current[key];
    const original = current[key];
    if (
      candidate !== null &&
      candidate !== undefined &&
      typeof candidate !== typeof original
    ) {
      throw new Error(`${key} 필드 형식이 올바르지 않습니다.`);
    }
    if (typeof candidate === "string" && candidate.length > 50_000) {
      throw new Error(`${key} 필드가 너무 깁니다.`);
    }
    if (typeof candidate === "number" && !Number.isFinite(candidate)) {
      throw new Error(`${key} 필드가 올바른 숫자가 아닙니다.`);
    }
    result[key] = candidate ?? original ?? "";
  }
  return result;
}

export function compareRevisionSnapshots(
  previousJson: string | null,
  currentJson: string,
) {
  const previous = previousJson
    ? parseRevisionSnapshot(previousJson)
    : {};
  const current = parseRevisionSnapshot(currentJson);
  return [...new Set([...Object.keys(previous), ...Object.keys(current)])]
    .filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]))
    .map((field) => ({
      field,
      previous: previous[field],
      current: current[field],
    }));
}

export function isCurrentRevision(input: {
  revisionStatus: string;
  isLatest: boolean;
}) {
  return input.revisionStatus === "published" && input.isLatest;
}

export const THEORY_REVISION_CONTENT_TYPE = "LEARNING_UNIT" as const;
export const THEORY_REVISION_STATUS = "review" as const;

export type TheoryConceptMappingInput = Readonly<{
  conceptId?: string | null;
  conceptKey: string;
  qualificationJson: string;
  provenanceJson: string;
  mappingStatus?: "SUGGESTED" | "APPROVED";
  mappingVersion?: number;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}>;

export type TheoryRevisionGovernanceInput = Readonly<{
  blueprintId: string;
  humanReviewHash: string;
  humanReviewedBy: string;
  humanReviewedAt: string;
  rightsStatus: "PASS_ORIGINAL";
  authoringOrigin: "SECURIUM_ORIGINAL";
  copyrightStatus: "PASS_ORIGINAL";
  restrictedPdfGenerationInput: false;
  qualificationJson: string;
  provenanceJson: string;
  lifecycle: "CANONICAL_UNPUBLISHED";
}>;

export type GovernedTheoryRevisionCandidate = Readonly<{
  canonicalKey: string;
  contentId: string;
  version: string;
  title: string;
  body: string;
  bodyFormat: "MARKDOWN" | "STRUCTURED_JSON" | "PLAIN_TEXT";
  learningObjectives: readonly string[];
  examples: readonly unknown[];
  selfChecks: readonly string[];
  conceptMappings: readonly TheoryConceptMappingInput[];
  governance: TheoryRevisionGovernanceInput;
}>;

export type TheoryRevisionSemanticProjection = Omit<GovernedTheoryRevisionCandidate, "contentId">;

export function stableJson(value: unknown): string {
  return JSON.stringify(sortTheoryValue(value));
}

export async function computeTheoryRevisionSemanticHash(
  value: TheoryRevisionSemanticProjection,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(stableJson(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function assertTheoryRevisionCandidate(
  candidate: GovernedTheoryRevisionCandidate,
  actorUserId: string,
) {
  if (!candidate.canonicalKey || !candidate.contentId || !candidate.version) failTheory("THEORY_REVISION_IDENTITY_INVALID");
  if (!candidate.title.trim() || !candidate.body.trim()) failTheory("THEORY_REVISION_CONTENT_INVALID");
  if (!candidate.learningObjectives.length || !candidate.selfChecks.length) failTheory("THEORY_REVISION_LEARNING_FIELDS_INVALID");
  if (!actorUserId.trim()) failTheory("ACTOR_REQUIRED");
  const governance = candidate.governance;
  if (!/^\w{64}$/.test(governance.humanReviewHash)) failTheory("HUMAN_REVIEW_HASH_INVALID");
  if (governance.authoringOrigin !== "SECURIUM_ORIGINAL") failTheory("THEORY_AUTHORING_ORIGIN_INVALID");
  if (governance.rightsStatus !== "PASS_ORIGINAL" || governance.copyrightStatus !== "PASS_ORIGINAL") failTheory("RIGHTS_REVIEW_REQUIRED");
  if (governance.restrictedPdfGenerationInput !== false) failTheory("RESTRICTED_SOURCE_FORBIDDEN");
  if (governance.lifecycle !== "CANONICAL_UNPUBLISHED") failTheory("THEORY_LIFECYCLE_INVALID");
  if (!governance.humanReviewedBy || !governance.humanReviewedAt) failTheory("HUMAN_REVIEW_BINDING_INVALID");
  assertTheoryObjectJson(governance.qualificationJson, "THEORY_QUALIFICATION_INVALID");
  assertTheoryObjectJson(governance.provenanceJson, "THEORY_PROVENANCE_INVALID");
  candidate.conceptMappings.forEach((mapping) => {
    if (!mapping.conceptKey.trim()) failTheory("CONCEPT_MAPPING_INVALID");
    if (mapping.mappingStatus === "APPROVED" && (!mapping.reviewedBy || !mapping.reviewedAt)) failTheory("CONCEPT_REVIEW_REQUIRED");
    if (mapping.mappingVersion !== undefined && mapping.mappingVersion < 1) failTheory("CONCEPT_MAPPING_VERSION_INVALID");
    assertTheoryObjectJson(mapping.qualificationJson, "CONCEPT_QUALIFICATION_INVALID");
    assertTheoryObjectJson(mapping.provenanceJson, "CONCEPT_PROVENANCE_INVALID");
  });
}

function assertTheoryObjectJson(value: string, code: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) failTheory(code);
  } catch (error) {
    if (error instanceof AppError) throw error;
    failTheory(code);
  }
}

function failTheory(code: string): never {
  throw new AppError("Theory revision governance validation failed.", 400, code);
}

function sortTheoryValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortTheoryValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortTheoryValue(child)]),
    );
  }
  return value;
}

