const SOURCE_TAXONOMY_VERSION = "source-taxonomy-v1" as const;

const AUTHORITY_VALUES = [
  "OFFICIAL_PUBLIC",
  "OFFICIAL_RESTRICTED_OR_UNKNOWN",
  "PUBLIC_REFERENCE",
  "SUPPLEMENTAL_REFERENCE",
  "COMMERCIAL_REFERENCE",
  "USER_PRESERVED",
  "UNKNOWN",
] as const;

const USAGE_VALUES = [
  "CAN_USE_AS_AUTHORITY",
  "CAN_REFERENCE",
  "CAN_QUOTE_LIMITED_IF_ALLOWED",
  "REFERENCE_ONLY",
  "USAGE_REVIEW_REQUIRED",
  "DO_NOT_REPUBLISH",
] as const;

const COPYRIGHT_REVIEW_VALUES = [
  "LEGACY_REVIEW_REQUIRED",
  "RIGHTS_REVIEW_REQUIRED",
  "REVIEWED_WITH_RESTRICTIONS",
  "APPROVED_FOR_CANONICAL_USE",
  "BLOCKED",
] as const;

const INDEPENDENCE_VALUES = [
  "UNREVIEWED",
  "DECLARED_INDEPENDENT",
  "REVIEW_REQUIRED",
  "REAUTHORING_REQUIRED",
] as const;

const CURRENTNESS_VALUES = [
  "CURRENT",
  "CURRENT_WITH_VERSION_UNCERTAINTY",
  "HISTORICAL",
  "SUPERSEDED",
  "FUTURE_EFFECTIVE",
  "UNKNOWN",
  "REVIEW_REQUIRED",
] as const;

const AUTHENTICATION_VALUES = [
  "AUTHENTICATED",
  "ISSUER_INCOMPLETE",
  "UNVERIFIED",
] as const;

const BINDING_ROLE_VALUES = [
  "PRIMARY_AUTHORITY",
  "CURRICULUM_CONTEXT",
  "SUPPLEMENTAL_REFERENCE",
  "REQUIREMENT_REFERENCE",
] as const;

export type AuthorityClass = (typeof AUTHORITY_VALUES)[number];
export type UsageClass = (typeof USAGE_VALUES)[number];
export type CopyrightReviewState = (typeof COPYRIGHT_REVIEW_VALUES)[number];
export type IndependenceState = (typeof INDEPENDENCE_VALUES)[number];
export type CurrentnessState = (typeof CURRENTNESS_VALUES)[number];
export type AuthenticationState = (typeof AUTHENTICATION_VALUES)[number];
export type BindingRole = (typeof BINDING_ROLE_VALUES)[number];

export type SourceIdentity = Readonly<{
  logicalSourceDocumentId: string;
  sourceSha256: string | null;
  issuer: string;
  officialTitle: string;
  version: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}>;

export type SourceLocator =
  | Readonly<{ kind: "page"; page: number }>
  | Readonly<{ kind: "page_range"; pageStart: number; pageEnd: number }>
  | Readonly<{
      kind: "article";
      article: string;
      paragraph?: string | null;
      subparagraph?: string | null;
    }>
  | Readonly<{
      kind: "criterion";
      criterionId: string;
      sectionHeading: string;
      pageStart: number;
      pageEnd: number;
      documentSubheading: string | null;
    }>
  | Readonly<{ kind: "chapter"; chapter: string }>
  | Readonly<{ kind: "section"; section: string }>
  | Readonly<{ kind: "subheading"; subheading: string }>
  | Readonly<{ kind: "annex"; annex: string }>;

const USAGE_PRECEDENCE: readonly UsageClass[] = [
  "DO_NOT_REPUBLISH",
  "USAGE_REVIEW_REQUIRED",
  "REFERENCE_ONLY",
  "CAN_QUOTE_LIMITED_IF_ALLOWED",
  "CAN_REFERENCE",
  "CAN_USE_AS_AUTHORITY",
];

function isMember<const Values extends readonly string[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

export function normalizeUsageFacts(input: unknown): readonly UsageClass[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.some((value) => !isMember(USAGE_VALUES, value))) return null;
  const unique = new Set(input as UsageClass[]);
  return Object.freeze(USAGE_PRECEDENCE.filter((value) => unique.has(value)));
}

export function resolveRestrictiveUsageFacts(input: unknown): UsageClass | null {
  const normalized = normalizeUsageFacts(input);
  return normalized?.[0] ?? null;
}

export function normalizeCurrentnessState(input: unknown): CurrentnessState | null {
  return isMember(CURRENTNESS_VALUES, input) ? input : null;
}

void SOURCE_TAXONOMY_VERSION;
void AUTHORITY_VALUES;
void COPYRIGHT_REVIEW_VALUES;
void INDEPENDENCE_VALUES;
void AUTHENTICATION_VALUES;
void BINDING_ROLE_VALUES;
