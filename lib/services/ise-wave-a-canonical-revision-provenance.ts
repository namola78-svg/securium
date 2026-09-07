import {
  waveAInformationSecurityGeneralLessons,
} from "../data/security-certification-information-security-general-wave-a.mjs";
import { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";

export { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";

export const ISE_WAVE_A_PACKAGE_ID = "ise-wave-a-information-security-general";
export const ISE_WAVE_A_PACKAGE_CONTRACT = "ISE_WAVE_A_PACKAGE_V1";
export const ISE_CONTENT_HASH_CONTRACT = "CANONICAL_SEMANTIC_LESSON_PROJECTION_SHA256";
export const ISE_PROVENANCE_CONTRACT = "ISE_WAVE_A_PROVENANCE_V1";
export const ISE_WAVE_A_SUBJECT_IDS = Object.freeze([
  "ise-wave-a-general-lesson-01:revision:1",
  "ise-wave-a-general-lesson-02:revision:1",
] as const);

const expectedHashes = Object.freeze({
  "ise-wave-a-general-lesson-01:revision:1": "53816fec03e22b2e142d80e53a59cb6286547eb97cc94a8ce3f119d521814c06",
  "ise-wave-a-general-lesson-02:revision:1": "71eeb324e882dbf1e310018c94ff1856ac970bd4510a3e21aa505a585e2ae02b",
});

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

export type WaveALesson = Readonly<{
  id: string;
  slug: string;
  canonicalKey: string;
  title: string;
  summary: string;
  body: string;
  learningObjectives: readonly string[];
  coreConcepts: readonly string[];
  practicalExamples: readonly string[];
  sourceMetadata: Readonly<Record<string, unknown>>;
}>;

export type WaveASourceBinding = Readonly<{
  sourceIdentityId: string;
  canonicalKey: string;
  sourceType: string;
  normalizedIdentity: string;
  lifecycleState: "ACTIVE";
  role: "SCOPE_REFERENCE" | "EXCLUDED_SOURCE";
  locator: string;
  expressionReuse: "NOT_USED";
}>;

export type WaveAProvenanceEnvelope = Readonly<{
  contract: typeof ISE_PROVENANCE_CONTRACT;
  revisionId: string;
  contentHash: string;
  qualification: string;
  packageId: string;
  sourceLineage: "SECURIUM_INDEPENDENT_AUTHORING";
  sourceBindings: readonly WaveASourceBinding[];
  rightsState: "REVIEW_REQUIRED";
  currentnessState: "REVIEW_REQUIRED";
  responsibleOwnerState: "OWNER_ATTESTATION_REQUIRED";
  reviewInputState: "FRESH_AUTHENTICATED_REVIEW_REQUIRED";
  semanticIdentity: string;
}>;

export type WaveAGovernedRevisionPayload = Readonly<{
  semanticId: string;
  contentId: string;
  version: "1";
  contentType: "LESSON";
  revisionStatus: "review";
  semanticHash: string;
  snapshotJson: string;
  createdBy: string | null;
  reviewedBy: null;
  reviewedAt: null;
  humanReviewHash: null;
  provenance: WaveAProvenanceEnvelope;
}>;

export type WaveARegistrationState = Readonly<{
  qualification: string;
  packageId: string;
  subjectIds: readonly string[];
  packageSemanticIdentity: string;
  revisions: readonly Readonly<{
    semanticId: string;
    contentHash: string;
    projection: Json;
    provenance: WaveAProvenanceEnvelope;
    registrationPayload: WaveAGovernedRevisionPayload;
  }>[];
  packageProvenanceIdentity: string;
  readiness: "CANONICAL_REVISION_PROVENANCE_READY_FOR_REVIEW" | "NOT_READY";
  blockingReasons: readonly string[];
}>;

export type WaveAQualificationResolver = (qualificationId: string) => Promise<Readonly<{ id: string; active: boolean }> | null>;
export type WaveASourceResolver = (lesson: WaveALesson) => Promise<readonly WaveASourceBinding[]>;
export type WaveARegistrationDependencies = Readonly<{
  qualificationResolver: WaveAQualificationResolver;
  sourceResolver: WaveASourceResolver;
}>;

export function buildCanonicalSemanticLessonProjection(lesson: WaveALesson): Json {
  return {
    id: lesson.id,
    slug: lesson.slug,
    canonicalKey: lesson.canonicalKey,
    title: lesson.title,
    summary: lesson.summary,
    body: lesson.body,
    learningObjectives: lesson.learningObjectives,
    coreConcepts: lesson.coreConcepts,
    practicalExamples: lesson.practicalExamples,
  };
}

export async function computeCanonicalLessonRevisionHash(lesson: WaveALesson): Promise<string> {
  return sha256Canonical(buildCanonicalSemanticLessonProjection(lesson));
}

export function canonicalWaveASubjectIds(ids: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(ids)].sort());
}

export async function buildIseWaveAPackageIdentity(input: {
  qualification: string;
  subjectIds: readonly string[];
}): Promise<string> {
  const subjects = canonicalWaveASubjectIds(input.subjectIds);
  return sha256Canonical({
    contract: ISE_WAVE_A_PACKAGE_CONTRACT,
    packageId: ISE_WAVE_A_PACKAGE_ID,
    qualification: input.qualification,
    subjectIds: subjects,
  });
}

export async function resolveIseWaveAQualification(
  resolver: WaveAQualificationResolver,
): Promise<string> {
  const course = await resolver("course-ise");
  if (!course || course.id !== "course-ise" || !course.active) throw new Error("ISE_WAVE_A_QUALIFICATION_UNRESOLVED");
  return course.id;
}

export function evaluateWaveAExactSubjectSet(subjectIds: readonly string[]): readonly string[] {
  const normalized = canonicalWaveASubjectIds(subjectIds);
  if (subjectIds.length !== ISE_WAVE_A_SUBJECT_IDS.length || normalized.length !== subjectIds.length) return Object.freeze(["EXACT_WAVE_A_SUBJECT_SET_REQUIRED"]);
  return Object.freeze(normalized.every((id, index) => id === ISE_WAVE_A_SUBJECT_IDS[index])
    ? []
    : ["EXACT_WAVE_A_SUBJECT_SET_REQUIRED"]);
}

export async function buildWaveAProvenance(input: {
  lesson: WaveALesson;
  qualification: string;
  packageId: string;
  sourceResolver: WaveASourceResolver;
}): Promise<WaveAProvenanceEnvelope> {
  const contentHash = await computeCanonicalLessonRevisionHash(input.lesson);
  const sourceBindings = Object.freeze([...(await input.sourceResolver(input.lesson))]);
  if (!sourceBindings.length) throw new Error("ISE_WAVE_A_REQUIRED_SOURCE_UNRESOLVED");
  if (sourceBindings.some((binding) =>
    !binding.sourceIdentityId || !binding.canonicalKey || !binding.sourceType ||
    !binding.normalizedIdentity || binding.lifecycleState !== "ACTIVE" || !binding.locator ||
    binding.expressionReuse !== "NOT_USED")) {
    throw new Error("ISE_WAVE_A_CANONICAL_SOURCE_IDENTITY_INVALID");
  }
  const semanticIdentity = await sha256Canonical({
    contract: ISE_PROVENANCE_CONTRACT,
    revisionId: `${input.lesson.id}:revision:1`,
    contentHash,
    qualification: input.qualification,
    packageId: input.packageId,
    sourceLineage: "SECURIUM_INDEPENDENT_AUTHORING",
    sourceBindings,
    rightsState: "REVIEW_REQUIRED",
    currentnessState: "REVIEW_REQUIRED",
    responsibleOwnerState: "OWNER_ATTESTATION_REQUIRED",
  });
  return Object.freeze({
    contract: ISE_PROVENANCE_CONTRACT,
    revisionId: `${input.lesson.id}:revision:1`,
    contentHash,
    qualification: input.qualification,
    packageId: input.packageId,
    sourceLineage: "SECURIUM_INDEPENDENT_AUTHORING",
    sourceBindings,
    rightsState: "REVIEW_REQUIRED",
    currentnessState: "REVIEW_REQUIRED",
    responsibleOwnerState: "OWNER_ATTESTATION_REQUIRED",
    reviewInputState: "FRESH_AUTHENTICATED_REVIEW_REQUIRED",
    semanticIdentity,
  });
}

export async function buildIseWaveARegistrationState(input: WaveARegistrationDependencies): Promise<WaveARegistrationState> {
  if (!input || typeof input.qualificationResolver !== "function") throw new Error("ISE_WAVE_A_QUALIFICATION_RESOLVER_REQUIRED");
  if (typeof input.sourceResolver !== "function") throw new Error("ISE_WAVE_A_SOURCE_RESOLVER_REQUIRED");
  const qualification = await resolveIseWaveAQualification(input.qualificationResolver);
  const lessons = waveAInformationSecurityGeneralLessons as unknown as readonly WaveALesson[];
  const subjectIds = canonicalWaveASubjectIds(lessons.map((lesson) => `${lesson.id}:revision:1`));
  const reasons: string[] = [];
  reasons.push(...evaluateWaveAExactSubjectSet(subjectIds));
  const packageSemanticIdentity = await buildIseWaveAPackageIdentity({ qualification, subjectIds });
  const revisions: Array<WaveARegistrationState["revisions"][number]> = [];
  for (const lesson of lessons) {
    const semanticId = `${lesson.id}:revision:1`;
    const projection = buildCanonicalSemanticLessonProjection(lesson);
    const contentHash = await computeCanonicalLessonRevisionHash(lesson);
    const provenance = await buildWaveAProvenance({ lesson, qualification, packageId: ISE_WAVE_A_PACKAGE_ID, sourceResolver: input.sourceResolver });
    revisions.push({
      semanticId,
      contentHash,
      projection,
      provenance,
      registrationPayload: {
        semanticId,
        contentId: lesson.id,
        version: "1",
        contentType: "LESSON",
        revisionStatus: "review",
        semanticHash: contentHash,
        snapshotJson: stableCanonicalJson(projection),
        createdBy: null,
        reviewedBy: null,
        reviewedAt: null,
        humanReviewHash: null,
        provenance,
      },
    });
  }
  if (revisions.length !== 2) reasons.push("EXACT_TWO_REVISIONS_REQUIRED");
  if (revisions.some(({ provenance }) => provenance.rightsState !== "REVIEW_REQUIRED" || provenance.currentnessState !== "REVIEW_REQUIRED")) reasons.push("UNREVIEWED_STATE_MUST_NOT_BE_AUTO_APPROVED");
  const packageProvenanceIdentity = await sha256Canonical({
    contract: ISE_PROVENANCE_CONTRACT,
    packageId: ISE_WAVE_A_PACKAGE_ID,
    subjectProvenanceIdentities: revisions.map(({ provenance }) => provenance.semanticIdentity).sort(),
  });
  return Object.freeze({
    qualification,
    packageId: ISE_WAVE_A_PACKAGE_ID,
    subjectIds,
    packageSemanticIdentity,
    revisions: Object.freeze(revisions),
    packageProvenanceIdentity,
    readiness: reasons.length === 0 ? "CANONICAL_REVISION_PROVENANCE_READY_FOR_REVIEW" : "NOT_READY",
    blockingReasons: Object.freeze(reasons),
  });
}

export const EXPECTED_WAVE_A_HASHES = expectedHashes;
