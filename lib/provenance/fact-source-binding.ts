import {
  FACT_SOURCE_ROLES,
  canonicalizeFactJson,
  createFactProvenanceManifest,
  createFactProvenanceSource,
  provenanceSourceEstablishesAuthority,
  requireFactId,
  requireFactReference,
  requireFactTimestamp,
  sha256CanonicalFactJson,
  type FactProvenanceManifest,
  type FactProvenanceSource,
  type FactSourceRole,
  type FactSourceVerification,
} from "../facts/fact-domain.ts";
import type { SourceIdentity as TaxonomySourceIdentity } from "./source-taxonomy.ts";

export { FACT_SOURCE_ROLES };
export type { FactSourceRole };

export type SourceIdentity = Readonly<{
  id: string;
  logicalSourceDocumentId: TaxonomySourceIdentity["logicalSourceDocumentId"];
  sourceKind: string;
  officialTitle: TaxonomySourceIdentity["officialTitle"];
  normalizedIdentity: string;
  issuer: TaxonomySourceIdentity["issuer"];
  jurisdiction: string;
  lifecycleState: "ACTIVE";
  createdBy: string;
  createdAt: string;
}>;

export type AssertionSourceBinding = Readonly<{
  id: string;
  temporalAssertionId: string;
  sourceIdentityId: string;
  sourceRole: FactSourceRole;
  sourceVersion: string;
  sourceHash: string;
  locator: string;
  verificationMetadataJson: string;
  createdBy: string;
  createdAt: string;
}>;

function fail(code: string): never {
  throw new TypeError(code);
}

function optionalBoundedText(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function createSourceIdentity(input: {
  id: unknown;
  logicalSourceDocumentId: unknown;
  sourceKind: unknown;
  officialTitle: unknown;
  normalizedIdentity: unknown;
  issuer?: unknown;
  jurisdiction?: unknown;
  createdBy: unknown;
  createdAt: unknown;
}): SourceIdentity {
  const normalizedIdentity = requireFactReference(
    input.normalizedIdentity,
    "source_normalized_identity",
  );
  if (normalizedIdentity !== normalizedIdentity.toLowerCase()) {
    fail("SOURCE_IDENTITY_NOT_NORMALIZED");
  }
  return Object.freeze({
    id: requireFactId(input.id, "source_identity_id"),
    logicalSourceDocumentId: requireFactReference(
      input.logicalSourceDocumentId,
      "logical_source_document_id",
    ),
    sourceKind: requireFactReference(input.sourceKind, "source_kind"),
    officialTitle: requireFactReference(input.officialTitle, "source_official_title"),
    normalizedIdentity,
    issuer: input.issuer === undefined ? "" : optionalBoundedText(input.issuer, "source_issuer"),
    jurisdiction: input.jurisdiction === undefined
      ? ""
      : optionalBoundedText(input.jurisdiction, "source_jurisdiction"),
    lifecycleState: "ACTIVE",
    createdBy: requireFactId(input.createdBy, "created_by"),
    createdAt: requireFactTimestamp(input.createdAt, "created_at"),
  });
}

export function createAssertionSourceBinding(input: {
  id: unknown;
  temporalAssertionId: unknown;
  sourceIdentityId: unknown;
  sourceRole: unknown;
  sourceVersion?: unknown;
  sourceHash?: unknown;
  locator: unknown;
  verification: unknown;
  createdBy: unknown;
  createdAt: unknown;
}): AssertionSourceBinding {
  const source = createFactProvenanceSource({
    sourceIdentityId: input.sourceIdentityId,
    sourceRole: input.sourceRole,
    sourceVersion: input.sourceVersion ?? "",
    sourceHash: input.sourceHash ?? "",
    locator: input.locator,
    verification: input.verification,
  });
  return Object.freeze({
    id: requireFactId(input.id, "source_binding_id"),
    temporalAssertionId: requireFactId(input.temporalAssertionId, "temporal_assertion_id"),
    sourceIdentityId: source.sourceIdentityId,
    sourceRole: source.sourceRole,
    sourceVersion: source.sourceVersion,
    sourceHash: source.sourceHash,
    locator: source.locator,
    verificationMetadataJson: canonicalizeFactJson(source.verification),
    createdBy: requireFactId(input.createdBy, "created_by"),
    createdAt: requireFactTimestamp(input.createdAt, "created_at"),
  });
}

export function bindingEstablishesAuthority(binding: AssertionSourceBinding): boolean {
  return provenanceSourceEstablishesAuthority(bindingToProvenanceSource(binding));
}

export function bindingToProvenanceSource(
  binding: AssertionSourceBinding,
): FactProvenanceSource {
  let verification: unknown;
  try {
    verification = JSON.parse(binding.verificationMetadataJson);
  } catch {
    fail("INVALID_FACT_SOURCE_VERIFICATION");
  }
  return createFactProvenanceSource({
    sourceIdentityId: binding.sourceIdentityId,
    sourceRole: binding.sourceRole,
    sourceVersion: binding.sourceVersion,
    sourceHash: binding.sourceHash,
    locator: binding.locator,
    verification,
  });
}

export function provenanceManifestFromBindings(
  bindings: readonly AssertionSourceBinding[],
): FactProvenanceManifest {
  return createFactProvenanceManifest({
    sources: bindings.map(bindingToProvenanceSource),
  });
}

export async function digestFactProvenance(
  bindings: readonly AssertionSourceBinding[],
): Promise<string> {
  return (await sha256CanonicalFactJson(provenanceManifestFromBindings(bindings))).digest;
}

export function sourceVerificationFromBinding(
  binding: AssertionSourceBinding,
): FactSourceVerification {
  return bindingToProvenanceSource(binding).verification;
}
