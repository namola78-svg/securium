/**
 * A display-only boundary for a server-owned public source projection.
 *
 * The projection marker is a runtime shape check, not an authorization
 * mechanism. A server resolver/policy must establish that the projection is
 * public before calling this formatter. This module does not read a source
 * registry, inspect publication state, or validate source rights.
 */

export const PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND =
  "PUBLIC_SOURCE_DISCLOSURE_PROJECTION" as const;

export const PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE = "출처 정보 확인 필요" as const;

const OFFICIAL_REFERENCE_LABEL = "공식 참고 자료" as const;
const SECURIUM_EXPLANATION_LABEL = "Securium 독립 설명" as const;

const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 2_048;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * This is deliberately a display-ready status projection, rather than a
 * domain/repository enum. The resolver owns the mapping from its private
 * state to this label and scope.
 */
export type PublicReviewStatusProjection = Readonly<{
  displayLabel: string;
  scope?: string | null;
}>;

export type PublicOfficialSourceProjection = Readonly<{
  institutionName?: string | null;
  documentTitle?: string | null;
  sourceUrl?: string | null;
  editionOrVersion?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  sourceCheckedAt?: string | null;
  reviewStatus?: PublicReviewStatusProjection | null;
  reviewedAt?: string | null;
  reviewerDisplayRole?: string | null;
}>;

export type PublicIndependentExplanationProjection = Readonly<{
  scope?: string | null;
}>;

export type PublicSourceDisclosureProjection = Readonly<{
  projectionKind: typeof PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND;
  officialSource?: PublicOfficialSourceProjection | null;
  securiumExplanation?: PublicIndependentExplanationProjection | null;
}>;

export type PublicOfficialReference = Readonly<{
  kind: "OFFICIAL_REFERENCE";
  label: typeof OFFICIAL_REFERENCE_LABEL;
  institutionName?: string;
  documentTitle?: string;
  sourceUrl?: string;
  editionOrVersion?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceCheckedAt?: string;
  review?: Readonly<{
    statusLabel: string;
    scope?: string;
    reviewedAt?: string;
    reviewerDisplayRole?: string;
  }>;
}>;

export type PublicIndependentExplanation = Readonly<{
  kind: "SECURIUM_INDEPENDENT_EXPLANATION";
  label: typeof SECURIUM_EXPLANATION_LABEL;
  scope?: string;
}>;

export type PublicSourceDisclosure = Readonly<{
  officialReference: PublicOfficialReference | null;
  independentExplanation: PublicIndependentExplanation | null;
  notice: typeof PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE | null;
}>;

/**
 * Format a public source projection without performing I/O or authorization.
 * Invalid or absent data is rendered as the same generic notice so that this
 * formatter never discloses whether a private/raw source record exists.
 */
export function formatPublicSourceDisclosure(
  input: unknown,
): PublicSourceDisclosure {
  try {
    return formatProjection(input);
  } catch {
    return missingDisclosure();
  }
}

function formatProjection(input: unknown): PublicSourceDisclosure {
  if (!isRecord(input) || input.projectionKind !== PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND) {
    return missingDisclosure();
  }

  const officialReference = formatOfficialReference(input.officialSource);
  const independentExplanation = formatIndependentExplanation(input.securiumExplanation);

  return Object.freeze({
    officialReference,
    independentExplanation,
    notice: hasCompleteOfficialReference(officialReference)
      ? null
      : PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
}

function formatOfficialReference(value: unknown): PublicOfficialReference | null {
  if (!isRecord(value)) return null;

  const institutionName = readText(value.institutionName, MAX_TEXT_LENGTH);
  const documentTitle = readText(value.documentTitle, MAX_TEXT_LENGTH);
  const sourceUrl = readDisplayUrl(value.sourceUrl);
  const editionOrVersion = readText(value.editionOrVersion, MAX_TEXT_LENGTH);
  const effectiveFrom = readDate(value.effectiveFrom);
  const effectiveTo = readDate(value.effectiveTo);
  const sourceCheckedAt = readDate(value.sourceCheckedAt);
  const review = formatReview(value.reviewStatus, value.reviewedAt, value.reviewerDisplayRole);

  if (
    institutionName === undefined &&
    documentTitle === undefined &&
    sourceUrl === undefined &&
    editionOrVersion === undefined &&
    effectiveFrom === undefined &&
    effectiveTo === undefined &&
    sourceCheckedAt === undefined &&
    review === undefined
  ) {
    return null;
  }

  const result: {
    kind: "OFFICIAL_REFERENCE";
    label: typeof OFFICIAL_REFERENCE_LABEL;
    institutionName?: string;
    documentTitle?: string;
    sourceUrl?: string;
    editionOrVersion?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    sourceCheckedAt?: string;
    review?: PublicOfficialReference["review"];
  } = {
    kind: "OFFICIAL_REFERENCE",
    label: OFFICIAL_REFERENCE_LABEL,
  };

  if (institutionName !== undefined) result.institutionName = institutionName;
  if (documentTitle !== undefined) result.documentTitle = documentTitle;
  if (sourceUrl !== undefined) result.sourceUrl = sourceUrl;
  if (editionOrVersion !== undefined) result.editionOrVersion = editionOrVersion;
  if (effectiveFrom !== undefined) result.effectiveFrom = effectiveFrom;
  if (effectiveTo !== undefined) result.effectiveTo = effectiveTo;
  if (sourceCheckedAt !== undefined) result.sourceCheckedAt = sourceCheckedAt;
  if (review !== undefined) result.review = review;

  return Object.freeze(result);
}

function formatIndependentExplanation(
  value: unknown,
): PublicIndependentExplanation | null {
  if (!isRecord(value)) return null;

  const rawScope = value.scope;
  const scope = readText(rawScope, MAX_TEXT_LENGTH);
  if (rawScope !== undefined && rawScope !== null && scope === undefined) {
    return null;
  }
  if (scope === undefined) {
    return Object.freeze({
      kind: "SECURIUM_INDEPENDENT_EXPLANATION",
      label: SECURIUM_EXPLANATION_LABEL,
    });
  }

  return Object.freeze({
    kind: "SECURIUM_INDEPENDENT_EXPLANATION",
    label: SECURIUM_EXPLANATION_LABEL,
    scope,
  });
}

function formatReview(
  value: unknown,
  reviewedAtValue: unknown,
  reviewerDisplayRoleValue: unknown,
): PublicOfficialReference["review"] {
  if (!isRecord(value)) return undefined;

  const statusLabel = readText(value.displayLabel, MAX_TEXT_LENGTH);
  if (statusLabel === undefined) return undefined;

  const scope = readText(value.scope, MAX_TEXT_LENGTH);
  const reviewedAt = readDate(reviewedAtValue);
  const reviewerDisplayRole = readText(reviewerDisplayRoleValue, MAX_TEXT_LENGTH);
  const review: {
    statusLabel: string;
    scope?: string;
    reviewedAt?: string;
    reviewerDisplayRole?: string;
  } = { statusLabel };

  if (scope !== undefined) review.scope = scope;
  if (reviewedAt !== undefined) review.reviewedAt = reviewedAt;
  if (reviewerDisplayRole !== undefined) review.reviewerDisplayRole = reviewerDisplayRole;

  return Object.freeze(review);
}

function hasCompleteOfficialReference(reference: PublicOfficialReference | null): boolean {
  return (
    reference !== null &&
    reference.institutionName !== undefined &&
    reference.documentTitle !== undefined &&
    reference.sourceCheckedAt !== undefined
  );
}

function readText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    return undefined;
  }
  if (Array.from(value).length > maxLength || /[\u0000-\u001F\u007F]/u.test(value)) {
    return undefined;
  }
  return value;
}

function readDate(value: unknown): string | undefined {
  const text = readText(value, 10);
  if (text === undefined || !DATE_PATTERN.test(text)) return undefined;

  const timestamp = Date.parse(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString().slice(0, 10) === text ? text : undefined;
}

function readDisplayUrl(value: unknown): string | undefined {
  const text = readText(value, MAX_URL_LENGTH);
  if (text === undefined) return undefined;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.hostname.length === 0) return undefined;
    if (url.username.length > 0 || url.password.length > 0) return undefined;
    return text;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function missingDisclosure(): PublicSourceDisclosure {
  return Object.freeze({
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
}
