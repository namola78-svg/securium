import { createHash } from "node:crypto";
import {
  getApprovedIsmsPTheoryBatch1Records,
  ISMS_P_THEORY_BATCH1_READY_CODES,
} from "../data/isms-p-theory-batch1.mjs";
import {
  computeTheoryRevisionSemanticHash,
  stableJson,
  type GovernedTheoryRevisionCandidate,
} from "../services/content-revision-service.ts";

export const ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT =
  "SECURIUM_ISMS_P_RUNTIME_MATERIALIZATION_CURRENT_MAIN_V1" as const;
export const ISMS_P_RUNTIME_PLAN_HASH_DOMAIN =
  "SECURIUM_ISMS_P_RUNTIME_MATERIALIZATION_PLAN_CURRENT_MAIN_V1" as const;
export const ISMS_P_RUNTIME_CONTENT_TYPE = "LEARNING_UNIT" as const;
export const ISMS_P_RUNTIME_CONTENT_STATUS = "DRAFT" as const;
export const ISMS_P_RUNTIME_REVISION_STATUS = "review" as const;
export const ISMS_P_MATERIALIZATION_ORDER = Object.freeze([
  "CONTENT_IDENTITY",
  "IMMUTABLE_REVISION",
  "SOURCE_BINDING",
  "AUTHENTICATED_GOVERNANCE_AUDIT",
  "CANONICAL_RECEIPT",
] as const);

export type MaterializationErrorCode =
  | "AUTHORING_AUTHORITY_INVALID"
  | "IDENTITY_BRIDGE_INVALID"
  | "IDENTITY_COLLISION"
  | "PAYLOAD_INVALID"
  | "PROVENANCE_GATE_FAILED"
  | "CURRENTNESS_GATE_FAILED"
  | "SOURCE_BINDING_REQUIRED"
  | "GOVERNANCE_RECONFIRMATION_REQUIRED"
  | "PLAN_HASH_MISMATCH"
  | "PLAN_TAMPERED"
  | "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE";

export class IsmsPMaterializationError extends Error {
  readonly code: MaterializationErrorCode;

  constructor(code: MaterializationErrorCode, message: string) {
    super(message);
    this.name = "IsmsPMaterializationError";
    this.code = code;
  }
}

export type IsmsPAuthoringSubject = Readonly<{
  authoringId: string;
  authoringRevisionId: string;
  officialCode: string;
  sourceLessonId: string;
  registryVersion: string;
  authoringRevisionHash: null;
  provenanceIdentity: Readonly<{
    sourceLessonId: string;
    lessonsJsonSha256: string;
    approvedPreviewBodySha256: string;
    approvedPreviewSummarySha256: string;
  }>;
}>;

export type IsmsPAuthoringAuthority = Readonly<{
  contract: typeof ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT;
  subjects: readonly IsmsPAuthoringSubject[];
  provenanceClosure: 84;
  currentnessClosure: 101;
  assessmentQuestionCount: 48;
  practicalSpecCount: 12;
}>;

export type IsmsPRuntimeIdentityBridge = Readonly<{
  authority: "CURRENT_MAIN_BATCH1_REGISTRY";
  authoringId: string;
  authoringRevisionId: string;
  runtimeContentId: string;
  runtimeCanonicalKey: string;
  runtimeSlug: string;
}>;

export type RuntimeContentProjection = Readonly<{
  id: string;
  slug: string;
  canonicalKey: string;
  title: string;
  summary: string;
  body: string;
  bodyFormat: "STRUCTURED_JSON";
  learningObjectivesJson: string;
  coreConceptsJson: string;
  practicalExamplesJson: string;
  diagramsJson: string;
  mediaJson: string;
  version: string;
  status: typeof ISMS_P_RUNTIME_CONTENT_STATUS;
}>;

export type RuntimeRevisionProjection = Readonly<{
  contentType: typeof ISMS_P_RUNTIME_CONTENT_TYPE;
  contentId: string;
  canonicalKey: string;
  version: string;
  title: string;
  body: string;
  bodyFormat: "STRUCTURED_JSON";
  learningObjectives: readonly string[];
  examples: readonly unknown[];
  selfChecks: readonly string[];
  semanticHash: null;
  semanticHashContract: "content_revisions.semantic_hash";
  governance: "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED";
}>;

export type MaterializationDryRunRow = Readonly<{
  authoringId: string;
  authoringRevisionId: string;
  officialCode: string;
  runtimeContentId: string;
  runtimeCanonicalKey: string;
  runtimeSlug: string;
  revisionReplayKey: string;
  runtimeSemanticHash: null;
  semanticHashDomain: "PENDING_CANONICAL_GOVERNANCE";
  sourceIdentityId: null;
  sourceBinding: "CANONICAL_SOURCE_RESOLUTION_REQUIRED";
  governance: "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED";
  receipt: "NOT_READY";
  unresolved: readonly string[];
}>;

export type IsmsPMaterializationPlan = Readonly<{
  contract: typeof ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT;
  mode: "DRY_RUN";
  subjectCount: 12;
  rows: readonly MaterializationDryRunRow[];
  identityCollisionCount: 0;
  provenanceClosure: 84;
  currentnessClosure: 101;
  planHash: string;
  status: "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE";
}>;

export type MaterializationValidation = Readonly<{
  valid: boolean;
  errors: readonly Readonly<{ code: MaterializationErrorCode; message: string }>[];
}>;

type RegistryRecord = ReturnType<typeof getApprovedIsmsPTheoryBatch1Records>[number];

const EXPECTED_CODES = Object.freeze([...ISMS_P_THEORY_BATCH1_READY_CODES].sort());

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sectionValues(record: RegistryRecord, key: string): readonly unknown[] {
  try {
    const body = JSON.parse(record.content.body) as { sections?: Record<string, { value?: unknown }> };
    const value = body.sections?.[key]?.value;
    return Array.isArray(value) ? value : [];
  } catch {
    throw new IsmsPMaterializationError("PAYLOAD_INVALID", `Registry payload for ${record.metadata.officialCode} is not valid JSON.`);
  }
}

function authoringId(record: RegistryRecord) {
  return `isms-p.authoring.${record.metadata.sourceLessonId}`;
}

function authoringRevisionId(record: RegistryRecord) {
  return `${authoringId(record)}@${record.content.version}`;
}

function toAuthoringSubject(record: RegistryRecord): IsmsPAuthoringSubject {
  return Object.freeze({
    authoringId: authoringId(record),
    authoringRevisionId: authoringRevisionId(record),
    officialCode: record.metadata.officialCode,
    sourceLessonId: record.metadata.sourceLessonId,
    registryVersion: record.content.version,
    authoringRevisionHash: null,
    provenanceIdentity: Object.freeze({
      sourceLessonId: record.metadata.provenance.sourceLessonId,
      lessonsJsonSha256: record.metadata.provenance.lessonsJsonSha256,
      approvedPreviewBodySha256: record.metadata.provenance.approvedPreviewBodySha256,
      approvedPreviewSummarySha256: record.metadata.provenance.approvedPreviewSummarySha256,
    }),
  });
}

function assertRegistryShape(records: readonly RegistryRecord[]) {
  const codes = records.map((record) => record.metadata.officialCode).sort();
  if (records.length !== 12 || stableJson(codes) !== stableJson(EXPECTED_CODES)) {
    throw new IsmsPMaterializationError("AUTHORING_AUTHORITY_INVALID", "Current-main ISMS-P registry is not the approved 12-subject set.");
  }
  const ids = new Set(records.map((record) => record.content.id));
  const keys = new Set(records.map((record) => record.content.canonicalKey));
  if (ids.size !== records.length || keys.size !== records.length) {
    throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", "The current-main registry contains duplicate runtime identities.");
  }
}

export function getApprovedIsmsPAuthoringAuthority(): IsmsPAuthoringAuthority {
  const records = getApprovedIsmsPTheoryBatch1Records();
  assertRegistryShape(records);
  return Object.freeze({
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    subjects: Object.freeze(records.map(toAuthoringSubject)),
    provenanceClosure: 84,
    currentnessClosure: 101,
    assessmentQuestionCount: 48,
    practicalSpecCount: 12,
  });
}

export function getApprovedIsmsPRuntimeIdentityBridge(): readonly IsmsPRuntimeIdentityBridge[] {
  const records = getApprovedIsmsPTheoryBatch1Records();
  assertRegistryShape(records);
  const bridge = records.map((record) => Object.freeze({
    authority: "CURRENT_MAIN_BATCH1_REGISTRY" as const,
    authoringId: authoringId(record),
    authoringRevisionId: authoringRevisionId(record),
    runtimeContentId: record.content.id,
    runtimeCanonicalKey: record.content.canonicalKey,
    runtimeSlug: record.content.slug,
  }));
  const authoringIds = new Set(bridge.map((entry) => entry.authoringId));
  const runtimeIds = new Set(bridge.map((entry) => entry.runtimeContentId));
  if (authoringIds.size !== 12 || runtimeIds.size !== 12) {
    throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", "The current-main identity bridge is not one-to-one.");
  }
  return Object.freeze(bridge);
}

export function assertApprovedIsmsPRuntimeIdentityBridge(
  candidate: readonly IsmsPRuntimeIdentityBridge[],
) {
  const approved = getApprovedIsmsPRuntimeIdentityBridge();
  if (stableJson(candidate) !== stableJson(approved)) {
    throw new IsmsPMaterializationError(
      "IDENTITY_BRIDGE_INVALID",
      "Only the current-main registry identity bridge is authoritative.",
    );
  }
}

export function buildRuntimeContentProjection(record: RegistryRecord, bridge: IsmsPRuntimeIdentityBridge): RuntimeContentProjection {
  if (record.content.id !== bridge.runtimeContentId || record.content.canonicalKey !== bridge.runtimeCanonicalKey || record.content.slug !== bridge.runtimeSlug) {
    throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", `Registry content identity does not match its bridge for ${record.metadata.officialCode}.`);
  }
  return Object.freeze({
    id: bridge.runtimeContentId,
    slug: bridge.runtimeSlug,
    canonicalKey: bridge.runtimeCanonicalKey,
    title: record.content.title,
    summary: record.content.summary,
    body: record.content.body,
    bodyFormat: "STRUCTURED_JSON",
    learningObjectivesJson: record.content.learningObjectivesJson,
    coreConceptsJson: record.content.coreConceptsJson,
    practicalExamplesJson: record.content.practicalExamplesJson,
    diagramsJson: record.content.diagramsJson,
    mediaJson: record.content.mediaJson,
    version: record.content.version,
    status: ISMS_P_RUNTIME_CONTENT_STATUS,
  });
}

export function buildRuntimeRevisionProjection(record: RegistryRecord, bridge: IsmsPRuntimeIdentityBridge): RuntimeRevisionProjection {
  const payload = buildRuntimeContentProjection(record, bridge);
  return Object.freeze({
    contentType: ISMS_P_RUNTIME_CONTENT_TYPE,
    contentId: payload.id,
    canonicalKey: payload.canonicalKey,
    version: payload.version,
    title: payload.title,
    body: payload.body,
    bodyFormat: payload.bodyFormat,
    learningObjectives: Object.freeze(sectionValues(record, "learning_objectives").filter((value): value is string => typeof value === "string")),
    examples: Object.freeze(sectionValues(record, "practical_application")),
    selfChecks: Object.freeze(sectionValues(record, "verification_points").filter((value): value is string => typeof value === "string")),
    semanticHash: null,
    semanticHashContract: "content_revisions.semantic_hash",
    governance: "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED",
  });
}

function toDryRunRow(record: RegistryRecord, bridge: IsmsPRuntimeIdentityBridge): MaterializationDryRunRow {
  const revision = buildRuntimeRevisionProjection(record, bridge);
  return Object.freeze({
    authoringId: bridge.authoringId,
    authoringRevisionId: bridge.authoringRevisionId,
    officialCode: record.metadata.officialCode,
    runtimeContentId: bridge.runtimeContentId,
    runtimeCanonicalKey: bridge.runtimeCanonicalKey,
    runtimeSlug: bridge.runtimeSlug,
    revisionReplayKey: [revision.contentType, revision.contentId, revision.version].join("\u0000"),
    runtimeSemanticHash: null,
    semanticHashDomain: "PENDING_CANONICAL_GOVERNANCE",
    sourceIdentityId: null,
    sourceBinding: "CANONICAL_SOURCE_RESOLUTION_REQUIRED",
    governance: "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED",
    receipt: "NOT_READY",
    unresolved: Object.freeze([
      "CANONICAL_SOURCE_BINDING_REQUIRED",
      "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED",
      "TRUSTED_ACTOR_AUDIT_REQUIRED",
      "RUNTIME_SEMANTIC_HASH_DEFERRED_UNTIL_GOVERNED_REVISION_INPUT",
    ]),
  });
}

function computePlanHash(authority: IsmsPAuthoringAuthority, rows: readonly MaterializationDryRunRow[]) {
  return sha256(stableJson({
    domain: ISMS_P_RUNTIME_PLAN_HASH_DOMAIN,
    contract: authority.contract,
    closure: { provenance: authority.provenanceClosure, currentness: authority.currentnessClosure },
    rows,
  }));
}

export function dryRunIsmsPRuntimeMaterialization(): IsmsPMaterializationPlan {
  const authority = getApprovedIsmsPAuthoringAuthority();
  const bridge = getApprovedIsmsPRuntimeIdentityBridge();
  const records = getApprovedIsmsPTheoryBatch1Records();
  const rows = authority.subjects.map((subject) => {
    const entry = bridge.find((candidate) => candidate.authoringId === subject.authoringId);
    const record = records.find((candidate) => candidate.metadata.sourceLessonId === subject.sourceLessonId);
    if (!entry || !record) throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", `Missing current-main bridge for ${subject.authoringId}.`);
    return toDryRunRow(record, entry);
  });
  const plan = Object.freeze({
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    mode: "DRY_RUN" as const,
    subjectCount: 12 as const,
    rows: Object.freeze(rows),
    identityCollisionCount: 0 as const,
    provenanceClosure: authority.provenanceClosure,
    currentnessClosure: authority.currentnessClosure,
    planHash: computePlanHash(authority, rows),
    status: "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE" as const,
  });
  return plan;
}

export function validateIsmsPMaterializationPlan(plan: IsmsPMaterializationPlan): MaterializationValidation {
  const errors: { code: MaterializationErrorCode; message: string }[] = [];
  let fresh: IsmsPMaterializationPlan;
  try {
    fresh = dryRunIsmsPRuntimeMaterialization();
  } catch (error) {
    errors.push({ code: "AUTHORING_AUTHORITY_INVALID", message: error instanceof Error ? error.message : "Authoring authority validation failed." });
    return Object.freeze({ valid: false, errors: Object.freeze(errors) });
  }
  const structurallyCanonical = (() => {
    try {
      return stableJson(plan) === stableJson(fresh);
    } catch {
      return false;
    }
  })();
  if (!structurallyCanonical) errors.push({ code: "PLAN_TAMPERED", message: "The submitted plan is not structurally equivalent to the current-main canonical plan." });
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.rows) || plan.mode !== "DRY_RUN" || plan.subjectCount !== 12 || plan.rows.length !== 12) errors.push({ code: "PLAN_TAMPERED", message: "Only a current-main 12-subject dry-run plan is valid." });
  if (plan?.planHash !== fresh.planHash) errors.push({ code: "PLAN_HASH_MISMATCH", message: "The materialization plan no longer matches current-main authority." });
  if (plan?.provenanceClosure !== 84) errors.push({ code: "PROVENANCE_GATE_FAILED", message: "The approved 84/84 provenance closure is required." });
  if (plan?.currentnessClosure !== 101) errors.push({ code: "CURRENTNESS_GATE_FAILED", message: "The approved 101/101 currentness closure is required." });
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function materializeGovernedIsmsPRevision(plan: IsmsPMaterializationPlan): never {
  const validation = validateIsmsPMaterializationPlan(plan);
  if (!validation.valid) throw new IsmsPMaterializationError("PLAN_HASH_MISMATCH", validation.errors.map((error) => error.code).join(","));
  throw new IsmsPMaterializationError(
    "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE",
    "Persistent materialization requires the current-main authenticated governance and server transaction composition; this reconciliation gate is dry-run only.",
  );
}

export function classifyCurrentMainRevisionReplay(input: Readonly<{
  existing: Readonly<{ contentId: string; version: string; semanticHash: string | null; snapshotJson: string }> | null;
  candidate: Readonly<{ contentId: string; version: string; semanticHash: string | null; snapshotJson: string }>;
}>): "CREATE" | "EXACT_REPLAY" | "NEW_IMMUTABLE_REVISION_REQUIRED" | "CONFLICT" {
  if (!input.existing) return "CREATE";
  if (input.existing.contentId !== input.candidate.contentId) return "CONFLICT";
  if (input.existing.version === input.candidate.version && input.existing.semanticHash === input.candidate.semanticHash && input.existing.snapshotJson === input.candidate.snapshotJson) return "EXACT_REPLAY";
  return "NEW_IMMUTABLE_REVISION_REQUIRED";
}

export async function computeCanonicalRuntimeSemanticHash(candidate: GovernedTheoryRevisionCandidate) {
  return computeTheoryRevisionSemanticHash(candidate);
}

export function assertRuntimeSemanticHashDomain(input: Readonly<{
  runtimeSemanticHash: string;
  authoringRevisionHash?: string | null;
  sourceSha256?: string | null;
  assessmentSemanticHash?: string | null;
}>) {
  const foreign = [input.authoringRevisionHash, input.sourceSha256, input.assessmentSemanticHash].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (foreign.includes(input.runtimeSemanticHash)) {
    throw new IsmsPMaterializationError(
      "PAYLOAD_INVALID",
      "A non-runtime hash cannot be used as content_revisions.semantic_hash.",
    );
  }
}

/** Production composition has no authority-port parameters. Persistence is deliberately not exposed here. */
export function createIsmsPRuntimeMaterializationService() {
  return Object.freeze({
    dryRun: dryRunIsmsPRuntimeMaterialization,
    validatePlan: validateIsmsPMaterializationPlan,
    materializeGovernedRevision: materializeGovernedIsmsPRevision,
  });
}
