import { AppError } from "../errors.ts";

export const questionGovernanceStatuses = [
  "LEGACY_UNVERIFIED",
  "DRAFT",
  "APPROVED",
  "REJECTED",
] as const;
export type QuestionGovernanceStatus = (typeof questionGovernanceStatuses)[number];

export type QuestionConceptInput = Readonly<{
  conceptId: string;
  qualificationJson?: string | null;
  provenanceJson?: string | null;
  mappingStatus?: "SUGGESTED" | "APPROVED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}>;

export type QuestionGovernanceInput = Readonly<{
  blueprintId: string;
  qualificationJson: string;
  provenanceJson: string;
  governanceJson: string;
  humanReviewHash?: string | null;
  humanReviewedBy?: string | null;
  humanReviewedAt?: string | null;
}>;

export type GovernedQuestionCandidate = Readonly<{
  id: string;
  version: number;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  explanation: string;
  wrongAnswerExplanation: string;
  answerConfigJson: string;
  source?: string | null;
  sourceDate?: string | null;
  choices: readonly Readonly<{
    id?: string;
    content: string;
    displayOrder: number;
    isCorrect: boolean;
    explanation: string;
  }>[];
  courseIds: readonly string[];
  conceptMappings: readonly QuestionConceptInput[];
  governance: QuestionGovernanceInput;
}>;

export type QuestionSemanticProjection = Readonly<{
  id: string;
  version: number;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  explanation: string;
  wrongAnswerExplanation: string;
  answerConfigJson: unknown;
  source: string | null;
  sourceDate: string | null;
  choices: readonly Readonly<{
    content: string;
    displayOrder: number;
    isCorrect: boolean;
    explanation: string;
  }>[];
  courseIds: readonly string[];
  conceptMappings: readonly QuestionConceptInput[];
  governance: QuestionGovernanceInput;
}>;

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function computeQuestionSemanticHash(
  value: QuestionSemanticProjection,
): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function assertGovernanceInput(input: QuestionGovernanceInput) {
  if (!input.blueprintId.trim()) fail("QUESTION_BLUEPRINT_REQUIRED");
  assertJson(input.qualificationJson, "QUESTION_QUALIFICATION_INVALID");
  assertJson(input.provenanceJson, "QUESTION_PROVENANCE_INVALID");
  const governance = parseJson(input.governanceJson, "QUESTION_GOVERNANCE_INVALID");
  if (governance.authoringOrigin !== "ORIGINAL_AI_ASSISTED_AUTHORING") {
    fail("QUESTION_AUTHORING_ORIGIN_INVALID");
  }
  if (governance.rightsStatus !== "PASS") fail("RIGHTS_REVIEW_REQUIRED");
  if (!["PASS_LOW_SIMILARITY", "REVIEW_MEDIUM_SIMILARITY"].includes(String(governance.similarityStatus))) {
    fail("QUESTION_SIMILARITY_NOT_CLEAR");
  }
  if (String(governance.similarityStatus) === "REVIEW_MEDIUM_SIMILARITY" && governance.humanEscalation !== true) {
    fail("QUESTION_SIMILARITY_REVIEW_REQUIRED");
  }
  if (input.humanReviewHash && (!input.humanReviewedBy || !input.humanReviewedAt)) {
    fail("HUMAN_REVIEW_BINDING_INVALID");
  }
}

export function assertQuestionConceptInput(input: QuestionConceptInput) {
  if (!input.conceptId.trim()) fail("CONCEPT_NOT_FOUND");
  if (input.qualificationJson) assertJson(input.qualificationJson, "CONCEPT_QUALIFICATION_INVALID");
  if (input.provenanceJson) assertJson(input.provenanceJson, "CONCEPT_PROVENANCE_INVALID");
  if (input.mappingStatus === "APPROVED" && (!input.reviewedBy || !input.reviewedAt)) {
    fail("CONCEPT_REVIEW_REQUIRED");
  }
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

function assertJson(value: string, code: string) {
  parseJson(value, code);
}

function parseJson(value: string, code: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(code);
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    fail(code);
  }
}

function fail(code: string): never {
  throw new AppError("Question governance validation failed.", 400, code);
}
