import { readFileSync } from "node:fs";
import { sha256, type ContentReviewDomain, type ContentReviewJudgmentInput, type ContentReviewSubjectBinding } from "../policy/content-review-judgment.ts";

export const SECURE_CODING_REVIEW_CONTRACT = "SECURE_CODING_FINAL_REVIEW_INPUT_V1" as const;
export const SECURE_CODING_SUBJECTS = [
  "SCV1-T01", "SCV1-T02", "SCV1-T03", "SCV1-T04",
  "SCV1-T05", "SCV1-T06", "SCV1-T07", "SCV1-T08",
] as const;

type Manifest = { topics?: Array<{ id?: unknown; minutes?: unknown }> };
export type SecureCodingReviewedInput = {
  contractVersion: typeof SECURE_CODING_REVIEW_CONTRACT;
  resource: "CONTENT_REVISION";
  scope: "SECURE_CODING_V1";
  packageId: "SECURE_CODING_V1";
  packageVersion: "V1";
  subjects: ContentReviewSubjectBinding[];
  snapshot: Record<string, unknown> & { importantClaimCount: number; qualificationRequired: number };
  reviewedInputIdentity: string;
};

function text(path: string) { return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"); }
function json<T>(path: string) { return JSON.parse(text(path)) as T; }

export function buildSecureCodingReviewedInput(): SecureCodingReviewedInput {
  const manifest = json<Manifest>("content-drafts/secure-coding/curriculum-v1-manifest.json");
  const curriculum = text("content-drafts/secure-coding/curriculum-v1.md");
  const sourceMatrix = text("content-drafts/secure-coding/source-verification-matrix-v1.md");
  const sourceManifest = json<Record<string, unknown>>("source-evidence-original/secure-coding/source-manifest.json");
  const topics = manifest.topics ?? [];
  const sections = curriculum.split(/^## Topic /m).slice(1);
  if (topics.length !== SECURE_CODING_SUBJECTS.length || sections.length !== topics.length) throw new Error("SECURE_CODING_REVIEW_INPUT_INCOMPLETE");
  const subjects = topics.map((topic, index) => {
    if (topic.id !== SECURE_CODING_SUBJECTS[index] || typeof topic.minutes !== "number") throw new Error("SECURE_CODING_SUBJECT_REGISTRY_MISMATCH");
    const subjectIdentity = SECURE_CODING_SUBJECTS[index];
    return { subjectIdentity, resourceRevisionId: "V1", contentSemanticHash: sha256({ topicId: subjectIdentity, minutes: topic.minutes, section: sections[index] }), semanticOrdinal: index };
  });
  const snapshot = {
    contractVersion: SECURE_CODING_REVIEW_CONTRACT,
    resource: "CONTENT_REVISION",
    scope: "SECURE_CODING_V1",
    packageId: "SECURE_CODING_V1",
    packageVersion: "V1",
    manifestIdentity: "content-drafts/secure-coding/curriculum-v1-manifest.json",
    manifestSemanticHash: sha256(manifest),
    contentSemanticHash: sha256(subjects),
    sourceManifestIdentity: "source-evidence-original/secure-coding/source-manifest.json",
    sourceManifestSemanticHash: sha256(sourceManifest),
    claimMatrixIdentity: "content-drafts/secure-coding/source-verification-matrix-v1.md",
    claimMatrixSemanticHash: sha256(sourceMatrix),
    subjects,
    importantClaimCount: (sourceMatrix.match(/^\| SCV1-C\d+ \|/gm) ?? []).length,
    qualificationRequired: Number(sourceMatrix.match(/^- DIRECT:\s*(\d+)/m)?.[1] ?? 0),
  };
  return { contractVersion: SECURE_CODING_REVIEW_CONTRACT, resource: "CONTENT_REVISION", scope: "SECURE_CODING_V1", packageId: "SECURE_CODING_V1", packageVersion: "V1", subjects, snapshot, reviewedInputIdentity: sha256(snapshot) };
}

export function bindSecureCodingJudgment(input: Omit<ContentReviewJudgmentInput, "reviewedInputIdentity" | "reviewedInputSnapshot" | "subjects"> & { reviewDomain: ContentReviewDomain; subjectId?: string }): ContentReviewJudgmentInput {
  const current = buildSecureCodingReviewedInput();
  const subjects = input.reviewDomain === "TECHNICAL" && input.subjectId
    ? current.subjects.filter((subject) => subject.subjectIdentity === input.subjectId)
    : current.subjects;
  if (subjects.length === 0) throw new Error("SECURE_CODING_SUBJECT_SELECTOR_INVALID");
  return { ...input, reviewedInputIdentity: current.reviewedInputIdentity, reviewedInputSnapshot: current.snapshot, subjects };
}
