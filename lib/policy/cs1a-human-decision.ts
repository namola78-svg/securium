import { createHash } from "node:crypto";
import { AppError } from "../errors.ts";
import {
  CS1A_AUTHORING_ORIGINS,
  CS1A_CONTENT_CLASSES,
  CS1A_DECISIONS,
  CS1A_POLICY_VERSION,
  CS1A_PUBLICATION_AUTHORITIES,
  CS1A_REASON_CODES,
  CS1A_RESOURCE_TYPES,
  CS1A_RIGHTS_DISPOSITIONS,
  CS1A_SOURCE_ORIGINS,
  type Cs1aAuthoringOrigin,
  type Cs1aContentClass,
  type Cs1aCurrentnessDisposition,
  type Cs1aDecision,
  type Cs1aPublicationAuthority,
  type Cs1aReasonCode,
  type Cs1aResourceType,
  type Cs1aRightsDisposition,
  type Cs1aSourceOrigin,
} from "./cs1a-contract.ts";
import { normalizeCurrentnessState } from "../provenance/source-taxonomy.ts";
import { canonicalJson } from "./canonical-json.ts";

export const CS1A_HUMAN_DECISION_HASH_V1 = "CS1A_HUMAN_DECISION_HASH_V1" as const;
export const CS1A_HUMAN_DECISION_ARTIFACT_V1 = "CS1A_HUMAN_DECISION_ARTIFACT_V1" as const;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type Cs1aHumanDecisionSubject = Readonly<{
  governanceScope: string;
  resourceType: Cs1aResourceType;
  resourceId: string;
  resourceRevisionId: string;
  contentHash: string;
  revisionHash: string;
  policyVersion: typeof CS1A_POLICY_VERSION;
  decision: Cs1aDecision;
  reasonCode: Cs1aReasonCode;
  rightsDisposition: Cs1aRightsDisposition;
  currentnessDisposition: Cs1aCurrentnessDisposition;
  authoringOrigin: Cs1aAuthoringOrigin;
  contentClass: Cs1aContentClass;
  sourceOrigin: Cs1aSourceOrigin;
  publicationAuthority: Cs1aPublicationAuthority;
  sourceAuthority?: string | null;
  sourceManifestRef?: string | null;
  sourceSetHash?: string | null;
  parentRevisionId?: string | null;
  immutableProvenanceIdentity?: string | null;
}>;

export type Cs1aHumanDecisionInput = Readonly<{
  contractVersion: typeof CS1A_HUMAN_DECISION_HASH_V1;
  subjects: readonly Cs1aHumanDecisionSubject[];
}>;

export type Cs1aHumanDecisionProjection = Readonly<{
  contractVersion: typeof CS1A_HUMAN_DECISION_HASH_V1;
  subjects: readonly Readonly<Record<string, unknown>>[];
}>;

export type Cs1aHumanDecisionArtifact = Readonly<{
  artifactVersion: typeof CS1A_HUMAN_DECISION_ARTIFACT_V1;
  contractVersion: typeof CS1A_HUMAN_DECISION_HASH_V1;
  projection: Cs1aHumanDecisionProjection;
  humanDecisionHash: string;
  subjectCount: number;
  generatedAt?: string;
  legacyDecisionRef?: string;
}>;

export function buildCanonicalHumanDecisionProjection(
  input: Cs1aHumanDecisionInput,
): Cs1aHumanDecisionProjection {
  assertInput(input);
  const subjects = [...input.subjects]
    .sort(compareSubjects)
    .map((subject) => canonicalSubject(subject));
  return Object.freeze({ contractVersion: input.contractVersion, subjects: Object.freeze(subjects) });
}

export function computeHumanDecisionHash(input: Cs1aHumanDecisionInput): string {
  return sha256(canonicalJson(buildCanonicalHumanDecisionProjection(input)));
}

export function buildHumanDecisionArtifact(
  input: Cs1aHumanDecisionInput,
  metadata: Readonly<{ generatedAt?: string; legacyDecisionRef?: string }> = {},
): Cs1aHumanDecisionArtifact {
  const projection = buildCanonicalHumanDecisionProjection(input);
  const hash = sha256(canonicalJson(projection));
  if (metadata.generatedAt !== undefined && !text(metadata.generatedAt)) fail("CS1A_ARTIFACT_GENERATED_AT_INVALID");
  if (metadata.legacyDecisionRef !== undefined && !text(metadata.legacyDecisionRef)) fail("CS1A_LEGACY_DECISION_REF_INVALID");
  return Object.freeze({
    artifactVersion: CS1A_HUMAN_DECISION_ARTIFACT_V1,
    contractVersion: CS1A_HUMAN_DECISION_HASH_V1,
    projection,
    humanDecisionHash: hash,
    subjectCount: projection.subjects.length,
    ...(metadata.generatedAt === undefined ? {} : { generatedAt: metadata.generatedAt }),
    ...(metadata.legacyDecisionRef === undefined ? {} : { legacyDecisionRef: metadata.legacyDecisionRef }),
  });
}

export function verifyHumanDecisionArtifact(
  artifact: Cs1aHumanDecisionArtifact,
): string {
  if (!artifact || typeof artifact !== "object") fail("CS1A_ARTIFACT_INVALID");
  if (artifact.artifactVersion !== CS1A_HUMAN_DECISION_ARTIFACT_V1) fail("CS1A_ARTIFACT_VERSION_UNSUPPORTED");
  if (artifact.contractVersion !== CS1A_HUMAN_DECISION_HASH_V1) fail("CS1A_CONTRACT_VERSION_UNSUPPORTED");
  if (!Number.isInteger(artifact.subjectCount) || artifact.subjectCount <= 0) fail("CS1A_SUBJECT_COUNT_INVALID");
  const projection = artifact.projection as Cs1aHumanDecisionProjection;
  const rebuilt = buildCanonicalHumanDecisionProjection({
    contractVersion: projection.contractVersion,
    subjects: projection.subjects as readonly Cs1aHumanDecisionSubject[],
  });
  const serialized = canonicalJson(projection);
  if (serialized !== canonicalJson(rebuilt)) fail("CS1A_ARTIFACT_PROJECTION_NON_CANONICAL");
  const hash = sha256(serialized);
  if (projection.subjects.length !== artifact.subjectCount || hash !== artifact.humanDecisionHash) {
    fail("CS1A_ARTIFACT_HASH_MISMATCH");
  }
  return hash;
}

function assertInput(input: Cs1aHumanDecisionInput): void {
  if (!input || typeof input !== "object") fail("CS1A_HUMAN_DECISION_INPUT_INVALID");
  if (input.contractVersion !== CS1A_HUMAN_DECISION_HASH_V1) fail("CS1A_CONTRACT_VERSION_UNSUPPORTED");
  if (!Array.isArray(input.subjects) || input.subjects.length === 0) fail("CS1A_EMPTY_DECISION_SET");

  const semanticKeys = new Set<string>();
  const revisionKeys = new Set<string>();
  for (const subject of input.subjects) {
    assertSubject(subject);
    const semanticKey = [subject.governanceScope, subject.resourceType, subject.resourceId, subject.resourceRevisionId].join("\u001f");
    const revisionKey = [subject.governanceScope, subject.resourceType, subject.resourceId, subject.resourceRevisionId].join("\u001e");
    if (semanticKeys.has(semanticKey)) fail("CS1A_DUPLICATE_SUBJECT");
    if (revisionKeys.has(revisionKey)) fail("CS1A_DUPLICATE_RESOURCE_REVISION");
    semanticKeys.add(semanticKey);
    revisionKeys.add(revisionKey);
  }
}

function assertSubject(subject: Cs1aHumanDecisionSubject): void {
  if (!subject || typeof subject !== "object") fail("CS1A_SUBJECT_INVALID");
  for (const [name, value] of [
    ["governanceScope", subject.governanceScope], ["resourceId", subject.resourceId],
    ["resourceRevisionId", subject.resourceRevisionId], ["contentHash", subject.contentHash],
    ["revisionHash", subject.revisionHash], ["policyVersion", subject.policyVersion],
    ["decision", subject.decision], ["reasonCode", subject.reasonCode],
    ["rightsDisposition", subject.rightsDisposition], ["currentnessDisposition", subject.currentnessDisposition],
    ["authoringOrigin", subject.authoringOrigin], ["contentClass", subject.contentClass],
    ["sourceOrigin", subject.sourceOrigin], ["publicationAuthority", subject.publicationAuthority],
  ] as const) {
    if (!text(value)) fail(`CS1A_${name.toUpperCase()}_REQUIRED`);
  }
  if (!member(CS1A_RESOURCE_TYPES, subject.resourceType)) fail("CS1A_RESOURCE_TYPE_INVALID");
  if (subject.policyVersion !== CS1A_POLICY_VERSION) fail("CS1A_POLICY_VERSION_UNSUPPORTED");
  if (!member(CS1A_DECISIONS, subject.decision)) fail("CS1A_DECISION_INVALID");
  if (!member(CS1A_REASON_CODES, subject.reasonCode)) fail("CS1A_REASON_CODE_INVALID");
  if (!member(CS1A_RIGHTS_DISPOSITIONS, subject.rightsDisposition)) fail("CS1A_RIGHTS_DISPOSITION_INVALID");
  if (!normalizeCurrentnessState(subject.currentnessDisposition)) fail("CS1A_CURRENTNESS_DISPOSITION_INVALID");
  if (!member(CS1A_AUTHORING_ORIGINS, subject.authoringOrigin)) fail("CS1A_AUTHORING_ORIGIN_INVALID");
  if (!member(CS1A_CONTENT_CLASSES, subject.contentClass)) fail("CS1A_CONTENT_CLASS_INVALID");
  if (!member(CS1A_SOURCE_ORIGINS, subject.sourceOrigin)) fail("CS1A_SOURCE_ORIGIN_INVALID");
  if (!member(CS1A_PUBLICATION_AUTHORITIES, subject.publicationAuthority)) fail("CS1A_PUBLICATION_AUTHORITY_INVALID");
  assertHash(subject.contentHash, "CS1A_CONTENT_HASH_INVALID");
  assertHash(subject.revisionHash, "CS1A_REVISION_HASH_INVALID");
  assertOptionalHash(subject.sourceSetHash, "CS1A_SOURCE_SET_HASH_INVALID");
  assertOptionalIdentity(subject.parentRevisionId, "CS1A_PARENT_REVISION_INVALID");
  assertOptionalIdentity(subject.immutableProvenanceIdentity, "CS1A_PROVENANCE_IDENTITY_INVALID");
  if (subject.parentRevisionId === subject.resourceRevisionId) fail("CS1A_PARENT_REVISION_SELF_REFERENCE");
  if (subject.sourceOrigin === "NONE_NOT_APPLICABLE") {
    if (subject.sourceAuthority != null || subject.sourceManifestRef != null || subject.sourceSetHash != null) fail("CS1A_SOURCE_FIELDS_NOT_APPLICABLE");
  } else if (!text(subject.sourceAuthority)) {
    fail("CS1A_SOURCE_AUTHORITY_REQUIRED");
  }
}

function canonicalSubject(subject: Cs1aHumanDecisionSubject): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {
    authoringOrigin: subject.authoringOrigin,
    contentClass: subject.contentClass,
    contentHash: subject.contentHash,
    currentnessDisposition: subject.currentnessDisposition,
    decision: subject.decision,
    governanceScope: subject.governanceScope,
    policyVersion: subject.policyVersion,
    publicationAuthority: subject.publicationAuthority,
    reasonCode: subject.reasonCode,
    resourceId: subject.resourceId,
    resourceRevisionId: subject.resourceRevisionId,
    resourceType: subject.resourceType,
    rightsDisposition: subject.rightsDisposition,
    revisionHash: subject.revisionHash,
    sourceOrigin: subject.sourceOrigin,
  };
  for (const key of ["immutableProvenanceIdentity", "parentRevisionId", "sourceAuthority", "sourceManifestRef", "sourceSetHash"] as const) {
    const value = subject[key];
    if (value !== undefined && value !== null) result[key] = value;
  }
  return Object.freeze(result);
}

function compareSubjects(a: Cs1aHumanDecisionSubject, b: Cs1aHumanDecisionSubject): number {
  for (const [left, right] of [[a.governanceScope, b.governanceScope], [a.resourceType, b.resourceType], [a.resourceId, b.resourceId], [a.resourceRevisionId, b.resourceRevisionId]]) {
    const result = left < right ? -1 : left > right ? 1 : 0;
    if (result !== 0) return result;
  }
  return 0;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertHash(value: unknown, code: string): void {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
}

function assertOptionalHash(value: unknown, code: string): void {
  if (value !== undefined && value !== null) assertHash(value, code);
}

function assertOptionalIdentity(value: unknown, code: string): void {
  if (value !== undefined && value !== null && !text(value)) fail(code);
}

function member<const Values extends readonly string[]>(values: Values, value: unknown): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(code: string): never {
  throw new AppError("CS-1A HumanDecisionHash validation failed.", 400, code);
}
