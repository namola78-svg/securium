import { AppError } from "../errors.ts";

export const governedProgressContentTypes = [
  "LESSON",
  "LECTURE",
  "AUDIO_CONTENT",
] as const;

export type GovernedProgressContentType =
  (typeof governedProgressContentTypes)[number];

export type ProgressContentRevisionBinding = Readonly<{
  id: string;
  contentType: GovernedProgressContentType;
  contentId: string;
  version: string;
  revisionStatus: "published";
  isLatest: true;
}>;

export function resolveProgressContentRevision(
  expected: Readonly<{
    contentType: GovernedProgressContentType;
    contentId: string;
  }>,
  row: ProgressContentRevisionBinding | null,
) {
  if (!row) return null;
  if (
    row.contentType !== expected.contentType ||
    row.contentId !== expected.contentId ||
    row.revisionStatus !== "published" ||
    row.isLatest !== true
  ) {
    throw new AppError(
      "Progress content revision is incompatible with the canonical source.",
      409,
      "CONTENT_REVISION_MISMATCH",
    );
  }
  return Object.freeze({
    contentRevisionId: row.id,
    eligibility: "VERSION_BOUND_SUPPORTING_ACTIVITY" as const,
  });
}

export function classifyProgressEvidenceEligibility(
  contentVersionIdentity: string | number | null,
) {
  return contentVersionIdentity !== null
    ? "VERSION_BOUND_SUPPORTING_ACTIVITY"
    : "LEGACY_CONTENT_VERSION_UNKNOWN_SUPPORTING_ACTIVITY_ONLY";
}

export function resolveInlineContentVersion(
  version: string | number | null | undefined,
) {
  if (version === null || version === undefined || version === "") return null;
  if (typeof version === "number" && (!Number.isInteger(version) || version < 1)) {
    throw new AppError("Content version is invalid.", 409, "CONTENT_VERSION_MISMATCH");
  }
  return Object.freeze({
    contentVersion: version,
    eligibility: "VERSION_BOUND_SUPPORTING_ACTIVITY" as const,
  });
}
