import { createHash } from "node:crypto";
import { AppError } from "../errors.ts";
import {
  CS1A_AUTHORING_ORIGINS,
  CS1A_CONTENT_CLASSES,
  CS1A_DECISIONS,
  CS1A_POLICY_VERSION,
  CS1A_PUBLICATION_AUTHORITIES,
  CS1A_REASON_CODES,
  CS1A_RIGHTS_DISPOSITIONS,
  CS1A_SOURCE_ORIGINS,
  isCs1aPolicyVersion,
  isCs1aResourceType,
  type Cs1aGovernanceReceiptInput,
  type Cs1aReceiptReplayResult,
  type Cs1aReceiptProvenance,
} from "./cs1a-contract.ts";
import { normalizeCurrentnessState } from "../provenance/source-taxonomy.ts";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type Cs1aSemanticDecisionProjection = Readonly<{
  resourceType: Cs1aGovernanceReceiptInput["resourceType"];
  resourceId: string;
  resourceRevisionId: string;
  parentRevisionId: string | null;
  sourceSetHash: string;
  revisionHash: string;
  policyVersion: typeof CS1A_POLICY_VERSION;
  humanDecisionHash: string;
  decision: Cs1aGovernanceReceiptInput["decision"];
  reasonCode: Cs1aGovernanceReceiptInput["reasonCode"];
  rightsDisposition: Cs1aGovernanceReceiptInput["rightsDisposition"];
  currentnessDisposition: Cs1aGovernanceReceiptInput["currentnessDisposition"];
  publicationAuthority: Cs1aGovernanceReceiptInput["publicationAuthority"];
  contentClass: Cs1aGovernanceReceiptInput["contentClass"];
  authoringOrigin: Cs1aGovernanceReceiptInput["authoringOrigin"];
  sourceOrigin: Cs1aGovernanceReceiptInput["sourceOrigin"];
}>;

export type Cs1aReceiptIdentity = Readonly<{
  semanticDecisionHash: string;
  idempotencyKey: string;
}>;

export function assertCs1aGovernanceReceiptInput(
  input: Cs1aGovernanceReceiptInput,
): void {
  if (!input || typeof input !== "object") fail("CS1A_RECEIPT_INPUT_INVALID");
  if (!isCs1aResourceType(input.resourceType) || !text(input.resourceId)) {
    fail("CS1A_RESOURCE_IDENTITY_INVALID");
  }
  if (!text(input.resourceRevisionId)) fail("CS1A_RESOURCE_REVISION_REQUIRED");
  if (!isCs1aPolicyVersion(input.policyVersion)) fail("CS1A_POLICY_VERSION_UNSUPPORTED");
  assertHash(input.sourceSetHash, "CS1A_SOURCE_SET_HASH_INVALID");
  assertHash(input.revisionHash, "CS1A_REVISION_HASH_INVALID");
  assertHash(input.humanDecisionHash, "CS1A_HUMAN_DECISION_HASH_INVALID");
  if (!text(input.humanDecisionRef) || !validTimestamp(input.humanDecisionAt)) {
    fail("CS1A_HUMAN_DECISION_BINDING_INVALID");
  }
  if (!member(CS1A_DECISIONS, input.decision)) fail("CS1A_DECISION_INVALID");
  if (!member(CS1A_REASON_CODES, input.reasonCode)) fail("CS1A_REASON_CODE_INVALID");
  if (!member(CS1A_RIGHTS_DISPOSITIONS, input.rightsDisposition)) fail("CS1A_RIGHTS_DISPOSITION_INVALID");
  if (!normalizeCurrentnessState(input.currentnessDisposition)) fail("CS1A_CURRENTNESS_DISPOSITION_INVALID");
  if (!member(CS1A_PUBLICATION_AUTHORITIES, input.publicationAuthority)) fail("CS1A_PUBLICATION_AUTHORITY_INVALID");
  if (!member(CS1A_CONTENT_CLASSES, input.contentClass)) fail("CS1A_CONTENT_CLASS_INVALID");
  if (!member(CS1A_AUTHORING_ORIGINS, input.authoringOrigin)) fail("CS1A_AUTHORING_ORIGIN_INVALID");
  if (!member(CS1A_SOURCE_ORIGINS, input.sourceOrigin)) fail("CS1A_SOURCE_ORIGIN_INVALID");
  if (!text(input.actorAuditLogId)) fail("CS1A_ACTOR_AUDIT_REQUIRED");
  assertOptionalIdentity(input.parentRevisionId, "CS1A_PARENT_REVISION_INVALID");
  assertOptionalIdentity(input.supersedesReceiptId, "CS1A_SUPERSESSION_INVALID");
  if (input.parentRevisionId === input.resourceRevisionId) fail("CS1A_PARENT_REVISION_SELF_REFERENCE");
  if (input.supersedesReceiptId === input.resourceRevisionId) fail("CS1A_SUPERSESSION_IDENTITY_INVALID");
  if (input.sourceOrigin === "NONE_NOT_APPLICABLE") {
    if (input.sourceAuthority !== null && input.sourceAuthority !== undefined) fail("CS1A_SOURCE_AUTHORITY_INVALID");
    if (input.sourceManifestRef !== null && input.sourceManifestRef !== undefined) fail("CS1A_SOURCE_MANIFEST_INVALID");
  } else if (!text(input.sourceAuthority)) {
    fail("CS1A_SOURCE_AUTHORITY_REQUIRED");
  }
  if (input.publicationAuthority === "GRANTED_BY_SEPARATE_AUTHORITY") {
    if (input.decision !== "ALLOW_PUBLICATION" || !input.supersedesReceiptId) {
      fail("CS1A_PUBLICATION_AUTHORITY_REQUIRED");
    }
  }
  if (input.decision === "ALLOW_PUBLICATION" && input.publicationAuthority !== "GRANTED_BY_SEPARATE_AUTHORITY") {
    fail("CS1A_PUBLICATION_AUTHORITY_REQUIRED");
  }
  if (input.decision !== "ALLOW_PUBLICATION" && input.publicationAuthority === "GRANTED_BY_SEPARATE_AUTHORITY") {
    fail("CS1A_PUBLICATION_DECISION_MISMATCH");
  }
  if (input.decision === "DENY" || input.decision.startsWith("DEFER_")) {
    if (input.publicationAuthority === "GRANTED_BY_SEPARATE_AUTHORITY") fail("CS1A_DENY_DEFER_PUBLICATION_INVALID");
  }
  assertSupersession(input, null);
  assertProvenance(input.provenance);
}

export function canonicalCs1aSemanticProjection(
  input: Cs1aGovernanceReceiptInput,
): string {
  assertCs1aGovernanceReceiptInput(input);
  return canonicalJson(semanticProjection(input));
}

export function computeSemanticDecisionHash(
  input: Cs1aGovernanceReceiptInput,
): string {
  return sha256(canonicalCs1aSemanticProjection(input));
}

export function computeIdempotencyKey(
  input: Cs1aGovernanceReceiptInput,
  semanticDecisionHash = computeSemanticDecisionHash(input),
): string {
  assertCs1aGovernanceReceiptInput(input);
  assertHash(semanticDecisionHash, "CS1A_SEMANTIC_DECISION_HASH_INVALID");
  const tuple = {
    humanDecisionHash: input.humanDecisionHash,
    policyVersion: input.policyVersion,
    resourceId: input.resourceId,
    resourceRevisionId: input.resourceRevisionId,
    resourceType: input.resourceType,
    revisionHash: input.revisionHash,
    semanticDecisionHash,
    sourceSetHash: input.sourceSetHash,
  };
  return sha256(canonicalJson(tuple));
}

export function computeCs1aReceiptIdentity(
  input: Cs1aGovernanceReceiptInput,
): Cs1aReceiptIdentity {
  const semanticDecisionHash = computeSemanticDecisionHash(input);
  return Object.freeze({
    semanticDecisionHash,
    idempotencyKey: computeIdempotencyKey(input, semanticDecisionHash),
  });
}

export function classifyCs1aReceiptReplay(
  existing: Readonly<{ receiptId: string; idempotencyKey: string; semanticDecisionHash: string }>,
  candidate: Cs1aReceiptIdentity,
): Cs1aReceiptReplayResult {
  if (
    existing.idempotencyKey === candidate.idempotencyKey &&
    existing.semanticDecisionHash === candidate.semanticDecisionHash
  ) {
    return { outcome: "IDEMPOTENT_EXISTING", receiptId: existing.receiptId };
  }
  return { outcome: "CONFLICT", reason: "SEMANTIC_IDENTITY_MISMATCH" };
}

export function assertCs1aSupersession(
  supersedesReceiptId: string | null | undefined,
  receiptIdentity: string | null | undefined,
): void {
  assertOptionalIdentity(supersedesReceiptId, "CS1A_SUPERSESSION_INVALID");
  if (supersedesReceiptId && receiptIdentity && supersedesReceiptId === receiptIdentity) {
    fail("CS1A_SUPERSESSION_SELF_REFERENCE");
  }
}

function semanticProjection(
  input: Cs1aGovernanceReceiptInput,
): Cs1aSemanticDecisionProjection {
  return {
    authoringOrigin: input.authoringOrigin,
    contentClass: input.contentClass,
    currentnessDisposition: input.currentnessDisposition,
    decision: input.decision,
    humanDecisionHash: input.humanDecisionHash,
    parentRevisionId: input.parentRevisionId ?? null,
    policyVersion: input.policyVersion,
    publicationAuthority: input.publicationAuthority,
    reasonCode: input.reasonCode,
    resourceId: input.resourceId,
    resourceRevisionId: input.resourceRevisionId,
    resourceType: input.resourceType,
    rightsDisposition: input.rightsDisposition,
    revisionHash: input.revisionHash,
    sourceOrigin: input.sourceOrigin,
    sourceSetHash: input.sourceSetHash,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("CS1A_CANONICAL_VALUE_INVALID");
    return JSON.stringify(value);
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    fail("CS1A_CANONICAL_VALUE_INVALID");
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function assertSupersession(input: Cs1aGovernanceReceiptInput, receiptIdentity: string | null) {
  assertCs1aSupersession(input.supersedesReceiptId, receiptIdentity);
}

function assertProvenance(provenance: Cs1aReceiptProvenance | undefined) {
  if (!provenance) return;
  if (provenance.gitSha !== undefined && (!text(provenance.gitSha) || !/^[0-9a-f]{40,64}$/i.test(provenance.gitSha))) {
    fail("CS1A_PROVENANCE_GIT_SHA_INVALID");
  }
  if (provenance.executionId !== undefined && !text(provenance.executionId)) fail("CS1A_PROVENANCE_EXECUTION_ID_INVALID");
}

function assertOptionalIdentity(value: string | null | undefined, code: string) {
  if (value !== null && value !== undefined && !text(value)) fail(code);
}

function assertHash(value: string, code: string) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
}

function validTimestamp(value: string) {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function member<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fail(code: string): never {
  throw new AppError("CS-1A governance receipt domain validation failed.", 400, code);
}
