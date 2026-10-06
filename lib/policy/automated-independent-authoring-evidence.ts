import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.ts";

export const AUTOMATED_EVIDENCE_CONTRACT_VERSION = "SECURIUM_AUTOMATED_INDEPENDENT_AUTHORING_EVIDENCE_V1" as const;
export const APPROVAL_MODES = ["HUMAN_REVIEW", "INDEPENDENT_AUTHORING_AUTOMATED"] as const;
export type ApprovalMode = typeof APPROVAL_MODES[number];
export const REQUIRED_ORIGINALITY_CHECKS = [
  "EXACT_PHRASE_OVERLAP", "LONG_NGRAM_OVERLAP", "ORDERED_SEQUENCE_OVERLAP", "DUPLICATE_STEM",
  "DUPLICATE_EXPLANATION", "DISTRACTOR_PATTERN_REUSE", "COPIED_EXAMPLE", "STRUCTURAL_SIMILARITY",
] as const;
export type OriginalityCheckType = typeof REQUIRED_ORIGINALITY_CHECKS[number];
export type CheckResult = "PASS" | "FAIL" | "INCOMPLETE" | "UNSUPPORTED" | "UNCERTAIN";
export type EvaluationResult = "ALLOW" | "DENY";

export interface AutomatedEvidenceMember {
  readonly memberIdentity: string;
  readonly memberVersion: string;
  readonly semanticHash: string;
  readonly semanticOrdinal: number;
}
export interface OriginalityCheck {
  readonly checkType: OriginalityCheckType;
  readonly checkVersion: string;
  readonly result: CheckResult;
  readonly evidenceDigest: string;
  readonly corpusIdentity: string;
}
export interface AutomatedEvidenceCandidate {
  readonly type: string; readonly resource: string; readonly identity: string; readonly version: string; readonly semanticHash: string;
}
export interface VerifiedProvenanceEvidence {
  readonly status: "VERIFIED" | "UNVERIFIED";
  readonly authoringOrigin: "SECURIUM_INDEPENDENT_AUTHORING" | null;
  readonly verifierIdentity: string;
  readonly statementIdentity: string;
  readonly evidenceDigest: string;
}
export interface NormalizedAutomatedIndependentAuthoringEvidence {
  readonly verificationState: "UNVERIFIED";
  readonly contractVersion: string;
  readonly approvalMode: string;
  readonly policyVersion: string;
  readonly evaluatorIdentity: string;
  readonly evaluatorVersion: string;
  readonly evaluatedAt: string;
  /** Computed by Gate A. Caller-supplied result/reasonCodes are ignored. */
  readonly evaluationResult: "DENY";
  readonly reasonCodes: readonly ["AUTOMATED_VERIFICATION_REQUIRED"];
  readonly candidate: AutomatedEvidenceCandidate;
  readonly package: { readonly identity: string; readonly semanticHash: string };
  readonly subject: { readonly identity: string; readonly hash: string };
  readonly provenance: { readonly identity: string; readonly claimedAuthoringOrigin?: string; readonly verifiedEvidence?: VerifiedProvenanceEvidence };
  readonly sourceSet: {
    readonly identity: string; readonly digest: string; readonly completeness: string;
    readonly expressionReuse: string;
    readonly facts: readonly { readonly sourceIdentity: string; readonly sourceDigest: string; readonly use: string; readonly verificationResult: string }[];
  };
  readonly publicationAuthority: "NOT_GRANTED";
  readonly members: readonly AutomatedEvidenceMember[];
  readonly originalityChecks: readonly OriginalityCheck[];
}

/** Untrusted input contract. A value of this type never represents verification. */
export type RawAutomatedApprovalEvidence = Readonly<Record<string, unknown>>;
/** Future resolver output. The brand is type-level only; runtime membership is also required. */
declare const verifiedEvidenceBrand: unique symbol;
export type VerifiedAutomatedApprovalEvidence = NormalizedAutomatedIndependentAuthoringEvidence & { readonly [verifiedEvidenceBrand]: true };

export interface ExpectedIndependentAuthoringAuthority {
  readonly candidate: AutomatedEvidenceCandidate;
  readonly packageIdentity: string;
  readonly packageSemanticHash: string;
  readonly subjectIdentity: string;
  readonly subjectHash: string;
  readonly completeOrderedMembers: readonly AutomatedEvidenceMember[];
}
export interface PolicyDecision { readonly result: EvaluationResult; readonly reasonCodes: readonly string[] }
export interface MemberSetComparison { readonly result: "MATCH" | "MISMATCH"; readonly reasonCode?: "AUTOMATED_MEMBER_SET_MISMATCH" }

const HASH = /^[0-9a-f]{64}$/;
const VERIFIED_OBJECTS = new WeakSet<object>();
function fail(code: string): never { throw new Error(code); }
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function requireRecord(v: unknown, code = "AUTOMATED_EVIDENCE_MALFORMED"): Record<string, unknown> {
  if (!isRecord(v)) fail(code);
  return v;
}
function requiredString(v: unknown, code = "AUTOMATED_EVIDENCE_MALFORMED"): string {
  if (typeof v !== "string" || !v.trim()) fail(code);
  return v;
}
function requiredHash(v: unknown, code = "AUTOMATED_HASH_INVALID"): string {
  if (typeof v !== "string" || !HASH.test(v)) fail(code);
  return v;
}
function parseJsonValue(serializedJson: string): unknown {
  if (typeof serializedJson !== "string") fail("AUTOMATED_JSON_INPUT_REQUIRED");
  try { return JSON.parse(serializedJson) as unknown; }
  catch { return fail("AUTOMATED_JSON_MALFORMED"); }
}
function parseJsonObject(serializedJson: string): Record<string, unknown> {
  const parsed = parseJsonValue(serializedJson);
  if (!isRecord(parsed)) fail("AUTOMATED_JSON_ROOT_INVALID");
  return parsed;
}
function normalizeMemberSet(input: unknown): readonly AutomatedEvidenceMember[] {
  if (!Array.isArray(input) || input.length === 0) fail("AUTOMATED_MEMBER_SET_INVALID");
  const members = (input as unknown[]).map((raw: unknown) => {
    const member = requireRecord(raw, "AUTOMATED_MEMBER_SET_INVALID");
    if (!Number.isSafeInteger(member.semanticOrdinal) || (member.semanticOrdinal as number) < 0) fail("AUTOMATED_MEMBER_SET_INVALID");
    return Object.freeze({
      memberIdentity: requiredString(member.memberIdentity, "AUTOMATED_MEMBER_SET_INVALID"),
      memberVersion: requiredString(member.memberVersion, "AUTOMATED_MEMBER_SET_INVALID"),
      semanticHash: requiredHash(member.semanticHash, "AUTOMATED_MEMBER_SET_INVALID"),
      semanticOrdinal: member.semanticOrdinal as number,
    });
  });
  if (new Set(members.map(m => m.memberIdentity)).size !== members.length || new Set(members.map(m => m.semanticOrdinal)).size !== members.length) fail("AUTOMATED_MEMBER_SET_INVALID");
  if (members.some((m, i) => i > 0 && members[i - 1]!.semanticOrdinal >= m.semanticOrdinal)) fail("AUTOMATED_MEMBER_ORDER_INVALID");
  return Object.freeze(members);
}

/**
 * Public raw boundary accepts serialized JSON only. Rejecting non-strings uses only typeof,
 * before any operation that could inspect caller-controlled object properties or Proxy traps.
 * Duplicate JSON keys follow JSON.parse last-key semantics; raw evidence remains UNVERIFIED/DENY.
 */
export function normalizeAutomatedIndependentAuthoringEvidence(serializedJson: string): NormalizedAutomatedIndependentAuthoringEvidence {
  const raw = parseJsonObject(serializedJson);
  const candidateRaw = requireRecord(raw.candidate);
  const packageRaw = requireRecord(raw.package);
  const subjectRaw = requireRecord(raw.subject);
  const provenanceRaw = requireRecord(raw.provenance);
  const sourceRaw = requireRecord(raw.sourceSet);
  const candidate = Object.freeze({
    type: requiredString(candidateRaw.type), resource: requiredString(candidateRaw.resource),
    identity: requiredString(candidateRaw.identity), version: requiredString(candidateRaw.version), semanticHash: requiredHash(candidateRaw.semanticHash),
  });
  const provenanceEvidenceRaw = provenanceRaw.verifiedEvidence === undefined ? undefined : requireRecord(provenanceRaw.verifiedEvidence);
  const provenance = Object.freeze({
    identity: requiredString(provenanceRaw.identity),
    ...(typeof provenanceRaw.claimedAuthoringOrigin === "string" ? { claimedAuthoringOrigin: provenanceRaw.claimedAuthoringOrigin } : {}),
    ...(provenanceEvidenceRaw ? { verifiedEvidence: Object.freeze({
      status: provenanceEvidenceRaw.status as "VERIFIED" | "UNVERIFIED",
      authoringOrigin: provenanceEvidenceRaw.authoringOrigin as "SECURIUM_INDEPENDENT_AUTHORING" | null,
      verifierIdentity: requiredString(provenanceEvidenceRaw.verifierIdentity),
      statementIdentity: requiredString(provenanceEvidenceRaw.statementIdentity),
      evidenceDigest: requiredHash(provenanceEvidenceRaw.evidenceDigest),
    }) } : {}),
  });
  if (provenance.verifiedEvidence) {
    if (provenance.verifiedEvidence.status !== "VERIFIED" && provenance.verifiedEvidence.status !== "UNVERIFIED") fail("AUTOMATED_PROVENANCE_EVIDENCE_INVALID");
    if (provenance.verifiedEvidence.authoringOrigin !== "SECURIUM_INDEPENDENT_AUTHORING" && provenance.verifiedEvidence.authoringOrigin !== null) fail("AUTOMATED_PROVENANCE_EVIDENCE_INVALID");
    const expectedDigest = provenanceDigest(provenance.verifiedEvidence);
    if (provenance.verifiedEvidence.evidenceDigest !== expectedDigest) fail("AUTOMATED_PROVENANCE_EVIDENCE_DIGEST_MISMATCH");
  }
  const sourceFacts = sourceRaw.facts;
  if (!Array.isArray(sourceFacts)) fail("AUTOMATED_SOURCE_EVIDENCE_INVALID");
  const facts = Object.freeze((sourceFacts as unknown[]).map((f: unknown) => {
    const fact = requireRecord(f, "AUTOMATED_SOURCE_EVIDENCE_INVALID");
    const use = requiredString(fact.use, "AUTOMATED_SOURCE_EVIDENCE_INVALID");
    if (use !== "FACT_VERIFICATION") fail("AUTOMATED_SOURCE_EVIDENCE_INVALID");
    const verificationResult = requiredString(fact.verificationResult, "AUTOMATED_SOURCE_EVIDENCE_INVALID");
    if (!["PASS", "FAIL", "INCOMPLETE", "UNCERTAIN", "UNSUPPORTED"].includes(verificationResult)) fail("AUTOMATED_SOURCE_EVIDENCE_INVALID");
    return Object.freeze({ sourceIdentity: requiredString(fact.sourceIdentity, "AUTOMATED_SOURCE_EVIDENCE_INVALID"), sourceDigest: requiredHash(fact.sourceDigest, "AUTOMATED_SOURCE_EVIDENCE_INVALID"), use, verificationResult });
  }));
  const completeness = requiredString(sourceRaw.completeness);
  if (!["COMPLETE", "UNKNOWN", "INCOMPLETE", "AMBIGUOUS"].includes(completeness)) fail("AUTOMATED_SOURCE_SET_INVALID");
  const expressionReuse = requiredString(sourceRaw.expressionReuse);
  if (!["NOT_USED", "USED", "UNKNOWN", "UNVERIFIED", "PARTIAL"].includes(expressionReuse)) fail("AUTOMATED_EXPRESSION_REUSE_INVALID");
  if (!Array.isArray(raw.originalityChecks)) fail("AUTOMATED_ORIGINALITY_CHECKS_INVALID");
  const checks = (raw.originalityChecks as unknown[]).map((rawCheck: unknown) => {
    const check = requireRecord(rawCheck, "AUTOMATED_ORIGINALITY_CHECK_INVALID");
    if (!REQUIRED_ORIGINALITY_CHECKS.includes(check.checkType as OriginalityCheckType)) fail("AUTOMATED_ORIGINALITY_CHECK_INVALID");
    const result = requiredString(check.result, "AUTOMATED_ORIGINALITY_CHECK_INVALID");
    if (!(new Set<string>(["PASS", "FAIL", "INCOMPLETE", "UNSUPPORTED", "UNCERTAIN"])).has(result)) fail("AUTOMATED_ORIGINALITY_CHECK_INVALID");
    if (result !== "PASS") fail(`AUTOMATED_ORIGINALITY_${result}`);
    return Object.freeze({ checkType: check.checkType as OriginalityCheckType, checkVersion: requiredString(check.checkVersion), result: result as CheckResult, evidenceDigest: requiredHash(check.evidenceDigest), corpusIdentity: requiredString(check.corpusIdentity) });
  });
  if (new Set(checks.map(c => c.checkType)).size !== checks.length) fail("AUTOMATED_ORIGINALITY_CHECK_DUPLICATE");
  const checkTypes = new Set(checks.map(c => c.checkType));
  if (REQUIRED_ORIGINALITY_CHECKS.some(required => !checkTypes.has(required))) fail("AUTOMATED_ORIGINALITY_CHECK_MISSING");
  const members = normalizeMemberSet(raw.members);
  if (raw.publicationAuthority !== "NOT_GRANTED") fail("AUTOMATED_PUBLICATION_AUTHORITY_NOT_GRANTED_REQUIRED");
  return Object.freeze({
    verificationState: "UNVERIFIED" as const,
    contractVersion: requiredString(raw.contractVersion), approvalMode: requiredString(raw.approvalMode),
    policyVersion: requiredString(raw.policyVersion), evaluatorIdentity: requiredString(raw.evaluatorIdentity),
    evaluatorVersion: requiredString(raw.evaluatorVersion), evaluatedAt: requiredString(raw.evaluatedAt),
    evaluationResult: "DENY" as const, reasonCodes: Object.freeze(["AUTOMATED_VERIFICATION_REQUIRED"] as const),
    candidate, package: Object.freeze({ identity: requiredString(packageRaw.identity), semanticHash: requiredHash(packageRaw.semanticHash) }),
    subject: Object.freeze({ identity: requiredString(subjectRaw.identity), hash: requiredHash(subjectRaw.hash) }),
    provenance,
    sourceSet: Object.freeze({ identity: requiredString(sourceRaw.identity), digest: requiredHash(sourceRaw.digest), completeness, expressionReuse, facts }),
    publicationAuthority: "NOT_GRANTED" as const, members,
    originalityChecks: Object.freeze(checks),
  });
}

/** Raw input is never evaluated as approval-eligible; only a future trusted resolver can establish that boundary. */
export function evaluateIndependentAuthoringEvidence(serializedJson: string): PolicyDecision {
  try { normalizeAutomatedIndependentAuthoringEvidence(serializedJson); }
  catch (error) { return { result: "DENY", reasonCodes: [error instanceof Error ? error.message : "AUTOMATED_EVIDENCE_MALFORMED"] }; }
  return { result: "DENY", reasonCodes: ["AUTOMATED_VERIFICATION_REQUIRED"] };
}

/** Runtime guard for future resolver outputs. Gate A intentionally exports no way to register verified objects. */
export function evaluateVerifiedIndependentAuthoringEvidence(evidence: unknown): PolicyDecision {
  if (!isRecord(evidence) || !VERIFIED_OBJECTS.has(evidence)) return { result: "DENY", reasonCodes: ["AUTOMATED_VERIFICATION_REQUIRED"] };
  // The resolver-backed ALLOW evaluator is deliberately unavailable until Gate B.
  return { result: "DENY", reasonCodes: ["AUTOMATED_TRUSTED_RESOLVER_UNAVAILABLE"] };
}

/** Recomputes a provenance statement digest; a correct digest proves consistency, not trust or origin. */
function provenanceDigest(evidence: Omit<VerifiedProvenanceEvidence, "evidenceDigest">): string {
  return createHash("sha256").update(canonicalJson({ status: evidence.status, authoringOrigin: evidence.authoringOrigin, verifierIdentity: evidence.verifierIdentity, statementIdentity: evidence.statementIdentity }), "utf8").digest("hex");
}
/** Digest helpers also accept serialized JSON so arbitrary object getters cannot run here. */
export function computeVerifiedProvenanceEvidenceDigest(serializedEvidenceJson: string): string {
  const evidence = parseJsonObject(serializedEvidenceJson);
  return provenanceDigest({ status: requiredString(evidence.status) as VerifiedProvenanceEvidence["status"], authoringOrigin: evidence.authoringOrigin as VerifiedProvenanceEvidence["authoringOrigin"], verifierIdentity: requiredString(evidence.verifierIdentity), statementIdentity: requiredString(evidence.statementIdentity) });
}
export function assertVerifiedProvenanceEvidenceDigest(serializedEvidenceJson: string): void {
  const evidence = parseJsonObject(serializedEvidenceJson);
  const expected = computeVerifiedProvenanceEvidenceDigest(canonicalJson({ status: evidence.status, authoringOrigin: evidence.authoringOrigin, verifierIdentity: evidence.verifierIdentity, statementIdentity: evidence.statementIdentity }));
  if (evidence.evidenceDigest !== expected) fail("AUTOMATED_PROVENANCE_EVIDENCE_DIGEST_MISMATCH");
}

export function computeAutomatedIndependentAuthoringEvidenceIdentity(serializedJson: string): string {
  return createHash("sha256").update(canonicalJson(normalizeAutomatedIndependentAuthoringEvidence(serializedJson)), "utf8").digest("hex");
}

/** Exact equality only. This compares caller-provided sets and grants no trust to either side. */
export function compareAutomatedEvidenceMemberSet(actualMembersJson: string, expectedMembersJson: string): MemberSetComparison {
  let actual: readonly AutomatedEvidenceMember[]; let expected: readonly AutomatedEvidenceMember[];
  try {
    const actualParsed = parseJsonValue(actualMembersJson); const expectedParsed = parseJsonValue(expectedMembersJson);
    actual = normalizeMemberSet(actualParsed); expected = normalizeMemberSet(expectedParsed);
  }
  catch { return { result: "MISMATCH", reasonCode: "AUTOMATED_MEMBER_SET_MISMATCH" }; }
  return canonicalJson(actual) === canonicalJson(expected) ? { result: "MATCH" } : { result: "MISMATCH", reasonCode: "AUTOMATED_MEMBER_SET_MISMATCH" };
}

/** Equality against caller-provided expected data only; it does not authenticate that expectation. */
export function compareAutomatedEvidenceToExpectedCandidate(evidenceJson: string, expectedAuthorityJson: string): boolean {
  let normalized: NormalizedAutomatedIndependentAuthoringEvidence;
  let expected: Record<string, unknown>;
  try { normalized = normalizeAutomatedIndependentAuthoringEvidence(evidenceJson); expected = parseJsonObject(expectedAuthorityJson); } catch { return false; }
  const expectedCandidate = expected.candidate;
  if (!isRecord(expectedCandidate)) return false;
  return normalized.candidate.type === expectedCandidate.type && normalized.candidate.resource === expectedCandidate.resource && normalized.candidate.identity === expectedCandidate.identity && normalized.candidate.version === expectedCandidate.version && normalized.candidate.semanticHash === expectedCandidate.semanticHash && normalized.package.identity === expected.packageIdentity && normalized.package.semanticHash === expected.packageSemanticHash && normalized.subject.identity === expected.subjectIdentity && normalized.subject.hash === expected.subjectHash && compareAutomatedEvidenceMemberSet(JSON.stringify(normalized.members), JSON.stringify(expected.completeOrderedMembers)).result === "MATCH";
}
