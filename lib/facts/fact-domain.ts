import {
  normalizeCurrentnessState,
  normalizeUsageFacts,
  resolveRestrictiveUsageFacts,
  type AuthenticationState,
  type AuthorityClass,
  type CopyrightReviewState,
  type CurrentnessState,
  type IndependenceState,
  type UsageClass,
} from "../provenance/source-taxonomy.ts";

export const FACT_CURRENTNESS_STATES = Object.freeze([
  "CURRENT_VERIFIED",
  "CURRENT_WITH_QUALIFICATION",
  "FUTURE_CHANGE_PENDING",
  "UNVERIFIED",
  "SUPERSEDED",
  "CONFLICTING",
] as const);

export const FACT_NORMATIVE_STRENGTHS = Object.freeze([
  "STATUTORY_REQUIREMENT",
  "REGULATORY_REQUIREMENT",
  "OFFICIAL_INTERPRETATION",
  "OFFICIAL_GUIDANCE",
  "BEST_PRACTICE_REFERENCE",
  "EXAM_IDENTITY_FACT",
  "NEUTRAL_DEFINITION",
] as const);

export type FactCurrentnessState = (typeof FACT_CURRENTNESS_STATES)[number];
export type FactNormativeStrength = (typeof FACT_NORMATIVE_STRENGTHS)[number];
export type FactLifecycleState = "DRAFT" | "PUBLISHED" | "RETIRED";

export const FACT_SOURCE_ROLES = Object.freeze([
  "PRIMARY_AUTHORITY",
  "SUPPORTING_AUTHORITY",
  "CONTEXT_SOURCE",
] as const);

export type FactSourceRole = (typeof FACT_SOURCE_ROLES)[number];

export type FactSourceClassification = Readonly<{
  authorityClass: AuthorityClass;
  usageFacts: readonly UsageClass[];
  copyrightReviewState: CopyrightReviewState;
  independenceState: IndependenceState;
  currentnessState: CurrentnessState;
  authenticationState: AuthenticationState;
}>;

export type FactSourceVerification = Readonly<{
  classification: FactSourceClassification;
  reviewDecision: "ACCEPTED" | "CONTEXT_ONLY";
  verifiedBy: string;
  verifiedAt: string;
  retrievedAt: string | null;
}>;

export type FactProvenanceSource = Readonly<{
  sourceIdentityId: string;
  sourceRole: FactSourceRole;
  sourceVersion: string;
  sourceHash: string;
  locator: string;
  verification: FactSourceVerification;
}>;

export type FactProvenanceManifest = Readonly<{
  sources: readonly FactProvenanceSource[];
}>;

export type CanonicalFactJson =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalFactJson[]
  | Readonly<{ [key: string]: CanonicalFactJson }>;

export type FactIdentity = Readonly<{
  id: string;
  canonicalKey: string;
  domain: string;
  canonicalLabel: string;
  normalizedSemanticIdentity: string;
  scopeDiscriminator: string;
  lifecycleState: FactLifecycleState;
  createdBy: string;
  createdAt: string;
}>;

export type TemporalAssertion = Readonly<{
  id: string;
  factIdentityId: string;
  normalizedProposition: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currentnessState: FactCurrentnessState;
  qualification: string;
  normativeStrength: FactNormativeStrength;
  payloadJson: string;
  provenanceJson: string;
  payloadHash: string;
  provenanceHash: string;
  lifecycleState: "DRAFT";
  createdBy: string;
  createdAt: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const CANONICAL_KEY = /^[a-z0-9][a-z0-9._:/-]{2,199}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const AUTHORITY_CLASSES = new Set<AuthorityClass>([
  "OFFICIAL_PUBLIC",
  "OFFICIAL_RESTRICTED_OR_UNKNOWN",
  "PUBLIC_REFERENCE",
  "SUPPLEMENTAL_REFERENCE",
  "COMMERCIAL_REFERENCE",
  "USER_PRESERVED",
  "UNKNOWN",
]);
const COPYRIGHT_REVIEW_STATES = new Set<CopyrightReviewState>([
  "LEGACY_REVIEW_REQUIRED",
  "RIGHTS_REVIEW_REQUIRED",
  "REVIEWED_WITH_RESTRICTIONS",
  "APPROVED_FOR_CANONICAL_USE",
  "BLOCKED",
]);
const INDEPENDENCE_STATES = new Set<IndependenceState>([
  "UNREVIEWED",
  "DECLARED_INDEPENDENT",
  "REVIEW_REQUIRED",
  "REAUTHORING_REQUIRED",
]);
const AUTHENTICATION_STATES = new Set<AuthenticationState>([
  "AUTHENTICATED",
  "ISSUER_INCOMPLETE",
  "UNVERIFIED",
]);

function fail(code: string): never {
  throw new TypeError(code);
}

export function requireFactId(value: unknown, field = "fact_id"): string {
  if (typeof value !== "string" || (!UUID.test(value) && !ULID.test(value))) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function requireFactReference(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 3 ||
    value.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function requireFactTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function requireDigest(value: unknown, field: string): string {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function canonicalizeFactJson(value: unknown): string {
  const visit = (candidate: unknown, depth: number): string => {
    if (depth > 10) fail("FACT_JSON_DEPTH_EXCEEDED");
    if (candidate === null) return "null";
    if (typeof candidate === "string") {
      if (candidate.length > 20_000) fail("FACT_JSON_STRING_TOO_LARGE");
      return JSON.stringify(candidate);
    }
    if (typeof candidate === "number") {
      if (!Number.isFinite(candidate)) fail("FACT_JSON_NON_FINITE_NUMBER");
      return Object.is(candidate, -0) ? "0" : JSON.stringify(candidate);
    }
    if (typeof candidate === "boolean") return candidate ? "true" : "false";
    if (typeof candidate !== "object") fail("FACT_JSON_INVALID_VALUE");
    if (Array.isArray(candidate)) {
      if (candidate.length > 256) fail("FACT_JSON_ARRAY_TOO_LARGE");
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      return `[${candidate.map((item, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor || descriptor.get || descriptor.set) {
          return fail("FACT_JSON_ACCESSOR_FORBIDDEN");
        }
        return visit(item, depth + 1);
      }).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("FACT_JSON_CUSTOM_PROTOTYPE_FORBIDDEN");
    }
    const keys = Reflect.ownKeys(candidate);
    if (keys.length > 128 || keys.some((key) => typeof key !== "string")) {
      fail("FACT_JSON_INVALID_KEYS");
    }
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    return `{${(keys as string[]).sort().map((key) => {
      if (FORBIDDEN_KEYS.has(key)) fail("FACT_JSON_DANGEROUS_KEY");
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || descriptor.get || descriptor.set) {
        fail("FACT_JSON_ACCESSOR_FORBIDDEN");
      }
      return `${JSON.stringify(key)}:${visit(descriptor.value, depth + 1)}`;
    }).join(",")}}`;
  };
  const canonical = visit(value, 0);
  if (canonical.length > 100_000) fail("FACT_JSON_TOO_LARGE");
  return canonical;
}

export async function sha256CanonicalFactJson(value: unknown): Promise<{
  canonicalJson: string;
  digest: string;
}> {
  const canonicalJson = canonicalizeFactJson(value);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson),
  );
  return {
    canonicalJson,
    digest: [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export function createFactIdentity(input: {
  id: unknown;
  canonicalKey: unknown;
  domain: unknown;
  canonicalLabel: unknown;
  normalizedSemanticIdentity: unknown;
  scopeDiscriminator: unknown;
  createdBy: unknown;
  createdAt: unknown;
}): FactIdentity {
  const canonicalKey = requireFactReference(input.canonicalKey, "canonical_key");
  if (!CANONICAL_KEY.test(canonicalKey)) fail("INVALID_CANONICAL_KEY");
  const canonicalLabel = requireFactReference(input.canonicalLabel, "canonical_label");
  const normalizedSemanticIdentity = requireFactReference(
    input.normalizedSemanticIdentity,
    "normalized_semantic_identity",
  );
  if (normalizedSemanticIdentity !== normalizedSemanticIdentity.toLowerCase()) {
    fail("SEMANTIC_IDENTITY_NOT_NORMALIZED");
  }
  const scopeDiscriminator = requireFactReference(
    input.scopeDiscriminator,
    "scope_discriminator",
  );
  return Object.freeze({
    id: requireFactId(input.id),
    canonicalKey,
    domain: requireFactReference(input.domain, "domain"),
    canonicalLabel,
    normalizedSemanticIdentity,
    scopeDiscriminator,
    lifecycleState: "DRAFT",
    createdBy: requireFactId(input.createdBy, "created_by"),
    createdAt: requireFactTimestamp(input.createdAt, "created_at"),
  });
}

export async function createTemporalAssertion(input: {
  id: unknown;
  factIdentityId: unknown;
  normalizedProposition: unknown;
  effectiveFrom: unknown;
  effectiveTo?: unknown;
  currentnessState: unknown;
  qualification?: unknown;
  normativeStrength: unknown;
  provenance: unknown;
  createdBy: unknown;
  createdAt: unknown;
}): Promise<TemporalAssertion> {
  const effectiveFrom = requireFactTimestamp(input.effectiveFrom, "effective_from");
  const effectiveTo = input.effectiveTo == null
    ? null
    : requireFactTimestamp(input.effectiveTo, "effective_to");
  if (effectiveTo !== null && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    fail("INVALID_HALF_OPEN_EFFECTIVE_INTERVAL");
  }
  if (!FACT_CURRENTNESS_STATES.includes(input.currentnessState as FactCurrentnessState)) {
    fail("INVALID_FACT_CURRENTNESS_STATE");
  }
  if (!FACT_NORMATIVE_STRENGTHS.includes(input.normativeStrength as FactNormativeStrength)) {
    fail("INVALID_FACT_NORMATIVE_STRENGTH");
  }
  const normalizedProposition = requireFactReference(
    input.normalizedProposition,
    "normalized_proposition",
  );
  const qualification = input.qualification === undefined
    ? ""
    : typeof input.qualification === "string" && input.qualification.length <= 2_000
      ? input.qualification
      : fail("INVALID_ASSERTION_QUALIFICATION");
  const provenanceManifest = createFactProvenanceManifest(input.provenance);
  const semanticPayload = {
    currentnessState: input.currentnessState,
    effectiveFrom,
    effectiveTo,
    normativeStrength: input.normativeStrength,
    normalizedProposition,
    qualification,
  };
  const [payload, provenance] = await Promise.all([
    sha256CanonicalFactJson(semanticPayload),
    sha256CanonicalFactJson(provenanceManifest),
  ]);
  return Object.freeze({
    id: requireFactId(input.id, "assertion_id"),
    factIdentityId: requireFactId(input.factIdentityId, "fact_identity_id"),
    normalizedProposition,
    effectiveFrom,
    effectiveTo,
    currentnessState: input.currentnessState as FactCurrentnessState,
    qualification,
    normativeStrength: input.normativeStrength as FactNormativeStrength,
    payloadJson: payload.canonicalJson,
    provenanceJson: provenance.canonicalJson,
    payloadHash: payload.digest,
    provenanceHash: provenance.digest,
    lifecycleState: "DRAFT",
    createdBy: requireFactId(input.createdBy, "created_by"),
    createdAt: requireFactTimestamp(input.createdAt, "created_at"),
  });
}

export function createFactProvenanceManifest(input: unknown): FactProvenanceManifest {
  requireExactRecord(input, ["sources"], "INVALID_FACT_PROVENANCE_MANIFEST");
  if (!Array.isArray(input.sources) || input.sources.length === 0 || input.sources.length > 64) {
    fail("INVALID_FACT_PROVENANCE_SOURCES");
  }
  const sources = input.sources.map(createFactProvenanceSource);
  if (sources.filter((source) => source.sourceRole === "PRIMARY_AUTHORITY").length !== 1) {
    fail("FACT_PROVENANCE_PRIMARY_AUTHORITY_REQUIRED");
  }
  const unique = new Set(sources.map((source) =>
    `${source.sourceIdentityId}\u0000${source.sourceRole}\u0000${source.locator}`
  ));
  if (unique.size !== sources.length) fail("DUPLICATE_FACT_PROVENANCE_SOURCE");
  const ordered = [...sources].sort((left, right) =>
    canonicalizeFactJson(left).localeCompare(canonicalizeFactJson(right))
  );
  return Object.freeze({ sources: Object.freeze(ordered) });
}

export function sourceVerificationIsAuthorityEligible(
  verification: FactSourceVerification,
): boolean {
  const classification = verification.classification;
  return verification.reviewDecision === "ACCEPTED" &&
    classification.authorityClass === "OFFICIAL_PUBLIC" &&
    resolveRestrictiveUsageFacts(classification.usageFacts) === "CAN_USE_AS_AUTHORITY" &&
    classification.copyrightReviewState === "APPROVED_FOR_CANONICAL_USE" &&
    classification.independenceState === "DECLARED_INDEPENDENT" &&
    classification.authenticationState === "AUTHENTICATED" &&
    (classification.currentnessState === "CURRENT" ||
      classification.currentnessState === "FUTURE_EFFECTIVE");
}

export function provenanceSourceEstablishesAuthority(source: FactProvenanceSource): boolean {
  return source.sourceRole !== "CONTEXT_SOURCE" &&
    sourceVerificationIsAuthorityEligible(source.verification);
}

export function createFactProvenanceSource(input: unknown): FactProvenanceSource {
  requireExactRecord(input, [
    "sourceIdentityId",
    "sourceRole",
    "sourceVersion",
    "sourceHash",
    "locator",
    "verification",
  ], "INVALID_FACT_PROVENANCE_SOURCE");
  if (!FACT_SOURCE_ROLES.includes(input.sourceRole as FactSourceRole)) {
    fail("INVALID_FACT_SOURCE_ROLE");
  }
  const sourceVersion = optionalFactText(input.sourceVersion, "source_version", 300);
  const sourceHash = input.sourceHash === ""
    ? ""
    : requireDigest(input.sourceHash, "source_hash");
  const source: FactProvenanceSource = Object.freeze({
    sourceIdentityId: requireFactId(input.sourceIdentityId, "source_identity_id"),
    sourceRole: input.sourceRole as FactSourceRole,
    sourceVersion,
    sourceHash,
    locator: requireFactReference(input.locator, "source_locator"),
    verification: createFactSourceVerification(input.verification),
  });
  if (source.sourceRole !== "CONTEXT_SOURCE" && !provenanceSourceEstablishesAuthority(source)) {
    fail("FACT_SOURCE_AUTHORITY_NOT_ELIGIBLE");
  }
  return source;
}

function createFactSourceVerification(input: unknown): FactSourceVerification {
  requireExactRecord(input, [
    "classification",
    "reviewDecision",
    "verifiedBy",
    "verifiedAt",
    "retrievedAt",
  ], "INVALID_FACT_SOURCE_VERIFICATION");
  requireExactRecord(input.classification, [
    "authorityClass",
    "usageFacts",
    "copyrightReviewState",
    "independenceState",
    "currentnessState",
    "authenticationState",
  ], "INVALID_FACT_SOURCE_CLASSIFICATION");
  const classificationInput = input.classification;
  const usageFacts = normalizeUsageFacts(classificationInput.usageFacts);
  const currentnessState = normalizeCurrentnessState(classificationInput.currentnessState);
  if (
    !AUTHORITY_CLASSES.has(classificationInput.authorityClass as AuthorityClass) ||
    !usageFacts ||
    !COPYRIGHT_REVIEW_STATES.has(
      classificationInput.copyrightReviewState as CopyrightReviewState,
    ) ||
    !INDEPENDENCE_STATES.has(classificationInput.independenceState as IndependenceState) ||
    !currentnessState ||
    !AUTHENTICATION_STATES.has(
      classificationInput.authenticationState as AuthenticationState,
    )
  ) {
    fail("INVALID_FACT_SOURCE_CLASSIFICATION");
  }
  if (input.reviewDecision !== "ACCEPTED" && input.reviewDecision !== "CONTEXT_ONLY") {
    fail("INVALID_FACT_SOURCE_REVIEW_DECISION");
  }
  return Object.freeze({
    classification: Object.freeze({
      authorityClass: classificationInput.authorityClass as AuthorityClass,
      usageFacts: Object.freeze([...usageFacts]),
      copyrightReviewState:
        classificationInput.copyrightReviewState as CopyrightReviewState,
      independenceState: classificationInput.independenceState as IndependenceState,
      currentnessState,
      authenticationState: classificationInput.authenticationState as AuthenticationState,
    }),
    reviewDecision: input.reviewDecision,
    verifiedBy: requireFactId(input.verifiedBy, "source_verified_by"),
    verifiedAt: requireFactTimestamp(input.verifiedAt, "source_verified_at"),
    retrievedAt: input.retrievedAt === null
      ? null
      : requireFactTimestamp(input.retrievedAt, "source_retrieved_at"),
  });
}

function requireExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  code: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  if (Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || keys.some((key) => !expectedKeys.includes(key))) {
    fail(code);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some((key) => !descriptors[key]?.enumerable || descriptors[key]?.get || descriptors[key]?.set)) {
    fail(code);
  }
}

function optionalFactText(value: unknown, field: string, maxLength: number): string {
  if (
    typeof value !== "string" || value.trim() !== value || value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function assertFactDigest(value: unknown, field: string): string {
  return requireDigest(value, field);
}
