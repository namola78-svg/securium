import {
  CS1A_AUTHORITY_HASH,
  CS1A_POLICY_VERSION,
  CS1A_REQUIRED_EVIDENCE,
  type Cs1aContentClass,
  type Cs1aPolicyDecision,
  type Cs1aPolicyRequest,
} from "./cs1a-contract.ts";

const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export function evaluateCs1aPolicy(
  request: Cs1aPolicyRequest | undefined,
): Cs1aPolicyDecision {
  const evaluatedAt = new Date().toISOString();
  const contentClass = (request?.contentClass ?? "UNKNOWN") as Cs1aContentClass;
  const sourceAuthority = text(request?.sourceAuthority);
  const base = {
    policyVersion: CS1A_POLICY_VERSION,
    contentClass,
    requiredEvidence: CS1A_REQUIRED_EVIDENCE,
    sourceAuthority,
    evaluatedAt,
  } as const;

  if (!request) return deny(base, "POLICY_CONTEXT_MISSING");
  if (request.policyVersion !== CS1A_POLICY_VERSION) {
    return deny(base, "POLICY_VERSION_UNSUPPORTED");
  }
  if (!isKnownClass(request.contentClass)) {
    return deny({ ...base, contentClass: "UNKNOWN" }, "CONTENT_CLASS_UNKNOWN");
  }
  if (request.operation === "PUBLICATION") {
    if (!request.publicationPermission) {
      return deny(base, "PUBLICATION_PERMISSION_REQUIRED");
    }
    if (!hasRequiredEvidence(request) || request.authorityHash !== CS1A_AUTHORITY_HASH) {
      return deny(base, "REQUIRED_EVIDENCE_MISSING");
    }
    return { ...base, decision: "ALLOW_PUBLICATION", reasonCode: "AUTHORIZED_PUBLICATION", canonicalMutationAllowed: true, publicationAllowed: true };
  }
  if (contentClass === "MUST_EXCLUDE") return deny(base, "CONTENT_MUST_EXCLUDE");
  if (contentClass === "UNKNOWN") return deny(base, "CONTENT_CLASS_UNKNOWN");
  if (contentClass === "REVIEW_REQUIRED_EXTERNAL_SOURCE") {
    return deny(base, "EXTERNAL_SOURCE_REVIEW_REQUIRED");
  }
  if (contentClass === "LEGACY_REVIEW_REQUIRED") {
    return deny(base, "LEGACY_REVIEW_REQUIRED");
  }
  if (request.authorityHash !== CS1A_AUTHORITY_HASH) {
    return deny(base, "AUTHORITY_HASH_INVALID");
  }
  if (!hasRequiredEvidence(request)) {
    return deny(base, "REQUIRED_EVIDENCE_MISSING");
  }
  return {
    ...base,
    decision: "ALLOW_DRAFT",
    reasonCode: "AUTHORIZED_DRAFT",
    canonicalMutationAllowed: true,
    publicationAllowed: false,
  };
}

function isKnownClass(value: unknown): value is Exclude<Cs1aContentClass, "UNKNOWN"> {
  return [
    "PROSPECTIVE_ORIGINAL_SECURIUM_AUTHORED",
    "AUTHORIZED_EXTERNAL_SOURCE",
    "REVIEW_REQUIRED_EXTERNAL_SOURCE",
    "LEGACY_REVIEW_REQUIRED",
    "MUST_EXCLUDE",
  ].includes(value as Exclude<Cs1aContentClass, "UNKNOWN">);
}

function hasRequiredEvidence(request: Cs1aPolicyRequest) {
  return Boolean(
    text(request.sourcePackageIdentity) &&
      text(request.sourceAuthority) &&
      text(request.rightsDisposition) &&
      text(request.reviewStatus) &&
      request.authorityHash === CS1A_AUTHORITY_HASH &&
      request.provenance !== undefined &&
      request.provenance !== null,
  );
}

function deny(
  base: Omit<Cs1aPolicyDecision, "decision" | "reasonCode" | "canonicalMutationAllowed" | "publicationAllowed">,
  reasonCode: string,
): Cs1aPolicyDecision {
  return {
    ...base,
    decision: "DENY",
    reasonCode,
    canonicalMutationAllowed: false,
    publicationAllowed: false,
  };
}
