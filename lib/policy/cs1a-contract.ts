export const CS1A_POLICY_VERSION = "CS1A_POLICY_V1" as const;
export const CS1A_AUTHORITY_HASH =
  "fc43c39eb88c532a19c7ae9d0c60b463d29c6cc20b344497ed9df07ac4196748" as const;

export const CS1A_CONTENT_CLASSES = [
  "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
  "AUTHORIZED_EXTERNAL_SOURCE",
  "REVIEW_REQUIRED_EXTERNAL_SOURCE",
  "LEGACY_REVIEW_REQUIRED",
  "MUST_EXCLUDE",
  "UNKNOWN",
] as const;

export type Cs1aContentClass = (typeof CS1A_CONTENT_CLASSES)[number];
export type Cs1aDecision = "ALLOW_DRAFT" | "DENY" | "ALLOW_PUBLICATION";
export type Cs1aOperation =
  | "DRAFT_MUTATION"
  | "CANONICAL_MUTATION"
  | "PUBLICATION";

export type Cs1aPolicyRequest = Readonly<{
  policyVersion?: unknown;
  contentClass?: unknown;
  operation: Cs1aOperation;
  sourcePackageIdentity?: unknown;
  sourceAuthority?: unknown;
  authorityHash?: unknown;
  rightsDisposition?: unknown;
  reviewStatus?: unknown;
  provenance?: unknown;
  requiredEvidence?: readonly string[];
  publicationPermission?: unknown;
}>;

export type Cs1aPolicyDecision = Readonly<{
  decision: Cs1aDecision;
  policyVersion: typeof CS1A_POLICY_VERSION;
  contentClass: Cs1aContentClass;
  reasonCode: string;
  requiredEvidence: readonly string[];
  sourceAuthority: string | null;
  evaluatedAt: string;
  canonicalMutationAllowed: boolean;
  publicationAllowed: boolean;
}>;

export const CS1A_REQUIRED_EVIDENCE = [
  "sourcePackageIdentity",
  "sourceAuthority",
  "authorityHash",
  "rightsDisposition",
  "reviewStatus",
  "provenance",
] as const;

export function isCs1aContentClass(value: unknown): value is Cs1aContentClass {
  return (
    typeof value === "string" &&
    (CS1A_CONTENT_CLASSES as readonly string[]).includes(value)
  );
}
