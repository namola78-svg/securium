import type { CurrentnessState } from "../provenance/source-taxonomy.ts";

export const CS1A_POLICY_VERSION = "CS1A_POLICY_V1" as const;

export const CS1A_AUTHORITY_HASH =
  "fc43c39eb88c532a19c7ae9d0c60b463d29c6cc20b344497ed9df07ac4196748" as const;

export const CS1A_RESOURCE_TYPES = [
  "CONTENT",
  "CONTENT_REVISION",
  "QUESTION",
  "QUESTION_VERSION",
  "LESSON",
  "LEARNING_UNIT",
  "COURSE_LESSON",
  "CURRICULUM_TREE",
  "CURRICULUM_NODE",
  "COURSE_GROUP",
  "COURSE",
  "SUBJECT",
  "TOPIC",
] as const;

export const CS1A_CONTENT_CLASSES = [
  "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
  "AUTHORIZED_EXTERNAL_SOURCE",
  "REVIEW_REQUIRED_EXTERNAL_SOURCE",
  "LEGACY_REVIEW_REQUIRED",
  "MUST_EXCLUDE",
  "UNKNOWN",
] as const;

export const CS1A_DECISIONS = [
  "ALLOW_DRAFT",
  "ALLOW_CANONICAL",
  "ALLOW_PUBLICATION",
  "DENY",
  "DEFER_RIGHTS",
  "DEFER_CURRENTNESS",
] as const;

export const CS1A_REASON_CODES = [
  "AUTHORIZED_PROSPECTIVE_ORIGINAL",
  "AUTHORIZED_EXTERNAL_SOURCE",
  "REVIEW_REQUIRED",
  "LEGACY_REVIEW_REQUIRED",
  "MUST_EXCLUDE",
  "UNKNOWN_CONTENT_CLASS",
  "MISSING_PROVENANCE",
  "UNSUPPORTED_POLICY_VERSION",
  "INVALID_RESOURCE_IDENTITY",
  "AMBIGUOUS_EFFECTIVE_STATE",
  "PUBLICATION_AUTHORITY_REQUIRED",
  "POLICY_DENY",
] as const;

export const CS1A_RIGHTS_DISPOSITIONS = [
  "ORIGINAL_INTERNAL",
  "REVIEWED_EXTERNAL_AUTHORIZED",
  "REVIEW_REQUIRED",
  "LEGACY_UNRESOLVED",
  "EXCLUDED",
  "UNKNOWN",
] as const;

export const CS1A_PUBLICATION_AUTHORITIES = [
  "NOT_GRANTED",
  "GRANTED_BY_SEPARATE_AUTHORITY",
  "NOT_APPLICABLE",
] as const;

export const CS1A_AUTHORING_ORIGINS = [
  "SECURIUM_ADMIN_CMS",
  "SECURIUM_GIT_PACKAGE",
  "EXTERNAL_SOURCE",
  "LEGACY",
  "UNKNOWN",
] as const;

export const CS1A_SOURCE_ORIGINS = [
  "NONE_NOT_APPLICABLE",
  "KNOWN_SOURCE_PACKAGE",
  "KNOWN_EXTERNAL_SOURCE",
  "LEGACY_UNKNOWN",
  "UNKNOWN",
] as const;

type Value<T extends readonly string[]> = T[number];

export type Cs1aResourceType = Value<typeof CS1A_RESOURCE_TYPES>;
export type Cs1aContentClass = Value<typeof CS1A_CONTENT_CLASSES>;
export type Cs1aDecision = Value<typeof CS1A_DECISIONS>;
export type Cs1aReasonCode = Value<typeof CS1A_REASON_CODES>;
export type Cs1aRightsDisposition = Value<typeof CS1A_RIGHTS_DISPOSITIONS>;
export type Cs1aPublicationAuthority = Value<typeof CS1A_PUBLICATION_AUTHORITIES>;
export type Cs1aAuthoringOrigin = Value<typeof CS1A_AUTHORING_ORIGINS>;
export type Cs1aSourceOrigin = Value<typeof CS1A_SOURCE_ORIGINS>;
export type Cs1aCurrentnessDisposition = CurrentnessState;

export type Cs1aReceiptProvenance = Readonly<{
  gitSha?: string;
  executionId?: string;
}>;

export type Cs1aGovernanceReceiptInput = Readonly<{
  resourceType: Cs1aResourceType;
  resourceId: string;
  resourceRevisionId: string;
  parentRevisionId?: string | null;
  supersedesReceiptId?: string | null;
  sourceSetHash: string;
  revisionHash: string;
  policyVersion: typeof CS1A_POLICY_VERSION;
  humanDecisionHash: string;
  humanDecisionRef: string;
  humanDecisionAt: string;
  decision: Cs1aDecision;
  reasonCode: Cs1aReasonCode;
  rightsDisposition: Cs1aRightsDisposition;
  currentnessDisposition: Cs1aCurrentnessDisposition;
  publicationAuthority: Cs1aPublicationAuthority;
  contentClass: Cs1aContentClass;
  authoringOrigin: Cs1aAuthoringOrigin;
  sourceOrigin: Cs1aSourceOrigin;
  sourceManifestRef?: string | null;
  sourceAuthority?: string | null;
  actorAuditLogId: string;
  provenance?: Cs1aReceiptProvenance;
}>;

export type Cs1aGovernanceReceipt = Cs1aGovernanceReceiptInput & Readonly<{
  receiptId: string;
  semanticDecisionHash: string;
  idempotencyKey: string;
  createdAt: string;
}>;

export type Cs1aReceiptWriteOutcome =
  | "CREATED"
  | "IDEMPOTENT_EXISTING"
  | "CONFLICT"
  | "VALIDATION_DENIED";

export type Cs1aReceiptReplayResult =
  | Readonly<{ outcome: "IDEMPOTENT_EXISTING"; receiptId: string }>
  | Readonly<{ outcome: "CONFLICT"; reason: "SEMANTIC_IDENTITY_MISMATCH" }>;

export function isCs1aResourceType(value: unknown): value is Cs1aResourceType {
  return typeof value === "string" && CS1A_RESOURCE_TYPES.includes(value as Cs1aResourceType);
}

export function isCs1aPolicyVersion(value: unknown): value is typeof CS1A_POLICY_VERSION {
  return value === CS1A_POLICY_VERSION;
}

export function isCs1aDecision(value: unknown): value is Cs1aDecision {
  return typeof value === "string" && CS1A_DECISIONS.includes(value as Cs1aDecision);
}

export function isCs1aRightsDisposition(value: unknown): value is Cs1aRightsDisposition {
  return typeof value === "string" && CS1A_RIGHTS_DISPOSITIONS.includes(value as Cs1aRightsDisposition);
}

export function isCs1aPublicationAuthority(value: unknown): value is Cs1aPublicationAuthority {
  return typeof value === "string" && CS1A_PUBLICATION_AUTHORITIES.includes(value as Cs1aPublicationAuthority);
}
