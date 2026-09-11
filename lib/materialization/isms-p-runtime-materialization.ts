import { createHash } from "node:crypto";
import {
  getApprovedIsmsPTheoryBatch1Records,
  ISMS_P_THEORY_BATCH1_READY_CODES,
} from "../data/isms-p-theory-batch1.mjs";
import {
  buildIsmsPBatch1MaterializationManifest,
  verifyIsmsPSourceLessonsJsonHash,
} from "../data/isms-p-theory-batch1-materializer.mjs";
import { ISMS_P_SOURCE_BINDING_TARGETS } from "../provenance/isms-p-source-binding.ts";
import {
  courseLessonExtensionSchema,
  courseLessonSchema,
  sharedContentSchema,
} from "../validation.ts";
import {
  assertTheoryRevisionCandidate,
  computeTheoryRevisionSemanticHash,
  stableJson,
  type GovernedTheoryRevisionCandidate,
} from "../services/content-revision-service.ts";

export const ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT =
  "SECURIUM_ISMS_P_RUNTIME_MATERIALIZATION_CURRENT_MAIN_V1" as const;
export const ISMS_P_RUNTIME_PLAN_HASH_DOMAIN =
  "SECURIUM_ISMS_P_RUNTIME_MATERIALIZATION_PLAN_CURRENT_MAIN_V1" as const;
export const ISMS_P_RUNTIME_PLAN_VERSION = "2" as const;
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
  | "PLAN_INPUT_INVALID"
  | "PLAN_HASH_MISMATCH"
  | "PLAN_TAMPERED"
  | "RUNTIME_SEMANTIC_HASH_INVALID"
  | "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE";

export class IsmsPMaterializationError extends Error {
  readonly code: MaterializationErrorCode;

  constructor(code: MaterializationErrorCode, message: string) {
    super(message);
    this.name = "IsmsPMaterializationError";
    this.code = code;
  }
}

type ClosureStatus = "VERIFIED" | "UNRESOLVED";
export type IsmsPSourceLessonHashVerificationStatus =
  | "VERIFIED"
  | "MISSING"
  | "MISMATCH"
  | "IDENTITY_MISMATCH"
  | "UNRESOLVED";

export type IsmsPSourceLessonHashVerification = Readonly<{
  sourceLessonId: string;
  expectedLessonsJsonSha256: string;
  actualLessonsJsonSha256: string | null;
  status: IsmsPSourceLessonHashVerificationStatus;
  reason: string;
}>;

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
    sourceLessonHashVerification: IsmsPSourceLessonHashVerification;
  }>;
}>;

export type IsmsPAuthoringAuthority = Readonly<{
  contract: typeof ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT;
  subjects: readonly IsmsPAuthoringSubject[];
  provenance: Readonly<{
    status: "PARTIAL";
    approvedPreviewVerifiedRecordCount: number;
    totalRecordCount: number;
    sourceLessonHashVerification: Readonly<{
      status: "VERIFIED" | "PARTIAL" | "UNRESOLVED";
      counts: Readonly<Record<IsmsPSourceLessonHashVerificationStatus, number>>;
    }>;
    unresolvedChecks: readonly string[];
  }>;
  currentness: Readonly<{
    status: ClosureStatus;
    counts: Readonly<Record<string, number>>;
    evaluatedRecordCount: number;
    unresolvedOfficialCodes: readonly string[];
  }>;
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
  runtimeContent: RuntimeContentProjection;
  runtimeRevision: RuntimeRevisionProjection;
  sourceLessonHashVerification: IsmsPSourceLessonHashVerification;
  sourceIdentityId: null;
  sourceBinding: "CANONICAL_SOURCE_RESOLUTION_REQUIRED";
  governance: "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED";
  receipt: "NOT_READY";
  unresolved: readonly string[];
}>;

type ReadinessSnapshot = Readonly<{
  provenance: IsmsPAuthoringAuthority["provenance"];
  currentness: IsmsPAuthoringAuthority["currentness"];
  sourceBinding: Readonly<{
    status: "UNRESOLVED";
    targetCount: number;
    unresolvedOfficialCodes: readonly string[];
  }>;
  governance: "REQUIRED";
  receipt: "NOT_READY";
}>;

type CanonicalPlanSnapshot = Readonly<{
  contract: typeof ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT;
  hashDomain: typeof ISMS_P_RUNTIME_PLAN_HASH_DOMAIN;
  planVersion: typeof ISMS_P_RUNTIME_PLAN_VERSION;
  registryRecords: readonly unknown[];
  materializationManifest: readonly unknown[];
  authoringSubjects: readonly IsmsPAuthoringSubject[];
  identityBridge: readonly IsmsPRuntimeIdentityBridge[];
  rows: readonly MaterializationDryRunRow[];
  readiness: ReadinessSnapshot;
}>;

export type IsmsPMaterializationPlan = Readonly<{
  contract: typeof ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT;
  mode: "DRY_RUN";
  planVersion: typeof ISMS_P_RUNTIME_PLAN_VERSION;
  subjectCount: number;
  rows: readonly MaterializationDryRunRow[];
  identityCollisionCount: number;
  canonicalSnapshot: CanonicalPlanSnapshot;
  planHash: string;
  status: "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE";
}>;

export type MaterializationValidation = Readonly<{
  valid: boolean;
  executionReady: false;
  errors: readonly Readonly<{ code: MaterializationErrorCode; message: string }>[];
  unresolved: readonly string[];
}>;

type RegistryRecord = ReturnType<typeof getApprovedIsmsPTheoryBatch1Records>[number];
type MaterializationManifestEntry = ReturnType<typeof buildIsmsPBatch1MaterializationManifest>[number];

const EXPECTED_CODES = Object.freeze([...ISMS_P_THEORY_BATCH1_READY_CODES]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pathFor(path: string, key: string | number) {
  return typeof key === "number" ? `${path}[${key}]` : `${path}.${key}`;
}

/** Reject values that JSON.stringify would silently remove, coerce, or hide. */
function assertPlainJsonValue(value: unknown, path = "$", seen = new WeakSet<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must be a finite JSON number.`);
    return;
  }
  if (value === undefined || typeof value === "function" || typeof value === "bigint" || typeof value === "symbol") {
    throw new Error(`${path} contains a non-JSON value.`);
  }
  if (typeof value !== "object") throw new Error(`${path} contains an unsupported value.`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle.`);
  seen.add(value);
  try {
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) throw new Error(`${path} is not a standard JSON array.`);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (key === "length") continue;
        if (typeof key !== "string" || !/^0$|^[1-9]\d*$/.test(key) || Number(key) >= value.length) {
          throw new Error(`${path} contains a non-index array property.`);
        }
        const descriptor = descriptors[key];
        if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${path}[${key}] is not a JSON data property.`);
      }
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) throw new Error(`${path}[${index}] is sparse.`);
        assertPlainJsonValue(value[index], pathFor(path, index), seen);
      }
    } else {
      if (prototype !== Object.prototype) throw new Error(`${path} is not a plain object.`);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string") throw new Error(`${path} contains a symbol property.`);
        const descriptor = descriptors[key];
        if (!descriptor.enumerable || !("value" in descriptor)) throw new Error(`${path}.${key} is not a JSON data property.`);
        assertPlainJsonValue(descriptor.value, pathFor(path, key), seen);
      }
    }
  } finally {
    seen.delete(value);
  }
}

function cloneAndFreeze<T>(value: T): T {
  assertPlainJsonValue(value);
  const copy = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (current: unknown): unknown => {
    if (current && typeof current === "object" && !Object.isFrozen(current)) {
      Object.values(current).forEach(freeze);
      Object.freeze(current);
    }
    return current;
  };
  return freeze(copy) as T;
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

function unresolvedSourceLessonHashVerification(record: RegistryRecord): IsmsPSourceLessonHashVerification {
  return Object.freeze({
    sourceLessonId: record.metadata.provenance.sourceLessonId,
    expectedLessonsJsonSha256: record.metadata.provenance.lessonsJsonSha256,
    actualLessonsJsonSha256: null,
    status: "UNRESOLVED" as const,
    reason: "CANONICAL_SOURCE_LESSON_LOADER_UNAVAILABLE",
  });
}

/**
 * Compares a source document with the expected hash from the canonical
 * registry. This is an integrity comparison only; the supplied document is
 * never promoted to a source authority or source binding.
 */
export function compareCanonicalIsmsPSourceLessonHash(input: Readonly<{
  officialCode: string;
  sourceLessonsJson: string | Uint8Array | null;
}>): IsmsPSourceLessonHashVerification {
  const record = getCanonicalRegistrySnapshot().records.find(
    (candidate) => candidate.metadata.officialCode === input.officialCode,
  );
  if (!record) {
    throw new IsmsPMaterializationError(
      "PROVENANCE_GATE_FAILED",
      `No canonical ISMS-P source lesson exists for ${input.officialCode}.`,
    );
  }
  return Object.freeze(verifyIsmsPSourceLessonsJsonHash({
    sourceLessonId: record.metadata.provenance.sourceLessonId,
    expectedLessonsJsonSha256: record.metadata.provenance.lessonsJsonSha256,
    sourceLessonsJson: input.sourceLessonsJson,
  }));
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
      sourceLessonHashVerification: unresolvedSourceLessonHashVerification(record),
    }),
  });
}

function assertSchema(record: RegistryRecord) {
  const content = sharedContentSchema.strict().safeParse(record.content);
  const lesson = courseLessonSchema.strict().safeParse(record.courseLesson);
  const extension = courseLessonExtensionSchema.strict().safeParse(record.extension);
  if (!content.success || !lesson.success || !extension.success) {
    throw new IsmsPMaterializationError("PAYLOAD_INVALID", `Canonical registry payload for ${record.metadata.officialCode} failed the shared content schema.`);
  }
}

function assertCanonicalRegistry(records: readonly RegistryRecord[], manifest: readonly MaterializationManifestEntry[]) {
  try {
    assertPlainJsonValue(records, "canonicalRegistry");
    assertPlainJsonValue(manifest, "materializationManifest");
  } catch (error) {
    throw new IsmsPMaterializationError("AUTHORING_AUTHORITY_INVALID", error instanceof Error ? error.message : "Canonical registry is not JSON data.");
  }
  const codes = records.map((record) => record.metadata.officialCode);
  if (records.length !== EXPECTED_CODES.length || stableJson(codes) !== stableJson(EXPECTED_CODES)) {
    throw new IsmsPMaterializationError("AUTHORING_AUTHORITY_INVALID", "Current-main ISMS-P registry is not the exact approved ordered subject set.");
  }
  if (manifest.length !== records.length || manifest.some((entry, index) => entry.code !== codes[index])) {
    throw new IsmsPMaterializationError("AUTHORING_AUTHORITY_INVALID", "The pure ISMS-P materializer manifest is not bound to the approved registry order.");
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  const targetIds = new Set<string>();
  for (const record of records) {
    assertSchema(record);
    const metadata = record.metadata;
    const target = ISMS_P_SOURCE_BINDING_TARGETS.find(([lessonId]) => lessonId === record.courseLesson.id);
    if (!target || target[1] !== record.content.id || target[2] !== metadata.officialCode || record.courseLesson.contentId !== record.content.id || record.extension.courseLessonId !== record.courseLesson.id) {
      throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", `Canonical identity mapping is invalid for ${metadata.officialCode}.`);
    }
    if (record.courseLesson.lessonId !== metadata.sourceLessonId || metadata.provenance.sourceLessonId !== metadata.sourceLessonId) {
      throw new IsmsPMaterializationError("PROVENANCE_GATE_FAILED", `Source lesson identity is not bound for ${metadata.officialCode}.`);
    }
    if (metadata.batch !== "ISMS_P_THEORY_BATCH_1" || metadata.curriculum.mapping !== "EXACT" || metadata.curriculum.courseId !== "course-isms-p") {
      throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", `Canonical curriculum mapping is not exact for ${metadata.officialCode}.`);
    }
    if (record.content.status !== "PUBLISHED" || record.courseLesson.status !== "PUBLISHED" || record.extension.status !== "PUBLISHED") {
      throw new IsmsPMaterializationError("PAYLOAD_INVALID", `Canonical registry status is not published for ${metadata.officialCode}.`);
    }
    if (metadata.currentness !== "CURRENT" && metadata.currentness !== "UNKNOWN") {
      throw new IsmsPMaterializationError("CURRENTNESS_GATE_FAILED", `Unsupported currentness state for ${metadata.officialCode}.`);
    }
    const provenance = metadata.provenance;
    if (![provenance.lessonsJsonSha256, provenance.approvedPreviewBodySha256, provenance.approvedPreviewSummarySha256].every((value) => typeof value === "string" && SHA256_PATTERN.test(value))) {
      throw new IsmsPMaterializationError("PROVENANCE_GATE_FAILED", `Canonical provenance hashes are incomplete for ${metadata.officialCode}.`);
    }
    if (ids.has(record.content.id) || keys.has(record.content.canonicalKey) || targetIds.has(record.courseLesson.id)) {
      throw new IsmsPMaterializationError("IDENTITY_COLLISION", `Canonical identity collision for ${metadata.officialCode}.`);
    }
    ids.add(record.content.id);
    keys.add(record.content.canonicalKey);
    targetIds.add(record.courseLesson.id);
  }
}

function getCanonicalRegistrySnapshot() {
  let manifest: readonly MaterializationManifestEntry[];
  try {
    manifest = buildIsmsPBatch1MaterializationManifest();
  } catch (error) {
    throw new IsmsPMaterializationError("AUTHORING_AUTHORITY_INVALID", error instanceof Error ? error.message : "Canonical materializer validation failed.");
  }
  const records = getApprovedIsmsPTheoryBatch1Records();
  assertCanonicalRegistry(records, manifest);
  return Object.freeze({
    records: cloneAndFreeze(records),
    manifest: cloneAndFreeze(manifest),
  });
}

function currentnessSnapshot(records: readonly RegistryRecord[]): IsmsPAuthoringAuthority["currentness"] {
  const counts: Record<string, number> = {};
  const unresolvedOfficialCodes: string[] = [];
  for (const record of records) {
    const state = record.metadata.currentness;
    counts[state] = (counts[state] ?? 0) + 1;
    if (state !== "CURRENT") unresolvedOfficialCodes.push(record.metadata.officialCode);
  }
  return Object.freeze({
    status: unresolvedOfficialCodes.length === 0 ? "VERIFIED" : "UNRESOLVED",
    counts: Object.freeze(counts),
    evaluatedRecordCount: records.length,
    unresolvedOfficialCodes: Object.freeze(unresolvedOfficialCodes),
  });
}

function buildAuthority(records: readonly RegistryRecord[]): IsmsPAuthoringAuthority {
  const subjects = records.map(toAuthoringSubject);
  const sourceLessonHashVerification = sourceLessonHashVerificationSummary(
    subjects.map((subject) => subject.provenanceIdentity.sourceLessonHashVerification),
  );
  return Object.freeze({
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    subjects: Object.freeze(subjects),
    provenance: Object.freeze({
      status: "PARTIAL" as const,
      approvedPreviewVerifiedRecordCount: records.length,
      totalRecordCount: records.length,
      sourceLessonHashVerification,
      unresolvedChecks: Object.freeze([
        "SOURCE_LESSONS_HASH_RECOMPUTATION_REQUIRED",
        "FULL_SOURCE_BINDING_VALIDATION_REQUIRED",
      ]),
    }),
    currentness: currentnessSnapshot(records),
  });
}

function sourceLessonHashVerificationSummary(
  verifications: readonly IsmsPSourceLessonHashVerification[],
): IsmsPAuthoringAuthority["provenance"]["sourceLessonHashVerification"] {
  const counts = {
    VERIFIED: 0,
    MISSING: 0,
    MISMATCH: 0,
    IDENTITY_MISMATCH: 0,
    UNRESOLVED: 0,
  } satisfies Record<IsmsPSourceLessonHashVerificationStatus, number>;
  for (const verification of verifications) counts[verification.status] += 1;
  const verifiedCount = counts.VERIFIED;
  return Object.freeze({
    status: verifiedCount === verifications.length
      ? "VERIFIED" as const
      : verifiedCount === 0
        ? "UNRESOLVED" as const
        : "PARTIAL" as const,
    counts: Object.freeze(counts),
  });
}

function buildBridge(records: readonly RegistryRecord[]): readonly IsmsPRuntimeIdentityBridge[] {
  const bridge = records.map((record) => Object.freeze({
    authority: "CURRENT_MAIN_BATCH1_REGISTRY" as const,
    authoringId: authoringId(record),
    authoringRevisionId: authoringRevisionId(record),
    runtimeContentId: record.content.id,
    runtimeCanonicalKey: record.content.canonicalKey,
    runtimeSlug: record.content.slug,
  }));
  if (new Set(bridge.map((entry) => entry.authoringId)).size !== records.length || new Set(bridge.map((entry) => entry.authoringRevisionId)).size !== records.length || new Set(bridge.map((entry) => entry.runtimeContentId)).size !== records.length || new Set(bridge.map((entry) => entry.runtimeCanonicalKey)).size !== records.length || new Set(bridge.map((entry) => entry.runtimeSlug)).size !== records.length) {
    throw new IsmsPMaterializationError("IDENTITY_COLLISION", "The current-main identity bridge is not one-to-one across revision identity and runtime identity.");
  }
  return Object.freeze(bridge);
}

export function getApprovedIsmsPAuthoringAuthority(): IsmsPAuthoringAuthority {
  return buildAuthority(getCanonicalRegistrySnapshot().records);
}

export function getApprovedIsmsPRuntimeIdentityBridge(): readonly IsmsPRuntimeIdentityBridge[] {
  return buildBridge(getCanonicalRegistrySnapshot().records);
}

export function assertApprovedIsmsPRuntimeIdentityBridge(candidate: unknown): void {
  try {
    assertPlainJsonValue(candidate, "identityBridge");
    const approved = getApprovedIsmsPRuntimeIdentityBridge();
    if (stableJson(candidate) !== stableJson(approved)) throw new Error("Only the current-main registry identity bridge is authoritative.");
  } catch (error) {
    throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", error instanceof Error ? error.message : "Identity bridge validation failed.");
  }
}

function buildRuntimeContentProjection(record: RegistryRecord, bridge: IsmsPRuntimeIdentityBridge): RuntimeContentProjection {
  if (record.content.id !== bridge.runtimeContentId || record.content.canonicalKey !== bridge.runtimeCanonicalKey || record.content.slug !== bridge.runtimeSlug) {
    throw new IsmsPMaterializationError("IDENTITY_BRIDGE_INVALID", `Registry content identity does not match its canonical bridge for ${record.metadata.officialCode}.`);
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

function buildRuntimeRevisionProjection(record: RegistryRecord, bridge: IsmsPRuntimeIdentityBridge): RuntimeRevisionProjection {
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
  const runtimeContent = buildRuntimeContentProjection(record, bridge);
  const runtimeRevision = buildRuntimeRevisionProjection(record, bridge);
  return Object.freeze({
    authoringId: bridge.authoringId,
    authoringRevisionId: bridge.authoringRevisionId,
    officialCode: record.metadata.officialCode,
    runtimeContentId: bridge.runtimeContentId,
    runtimeCanonicalKey: bridge.runtimeCanonicalKey,
    runtimeSlug: bridge.runtimeSlug,
    revisionReplayKey: [runtimeRevision.contentType, runtimeRevision.contentId, runtimeRevision.version].join("\u0000"),
    runtimeSemanticHash: null,
    semanticHashDomain: "PENDING_CANONICAL_GOVERNANCE",
    runtimeContent,
    runtimeRevision,
    sourceLessonHashVerification: unresolvedSourceLessonHashVerification(record),
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

function buildReadiness(authority: IsmsPAuthoringAuthority, records: readonly RegistryRecord[]): ReadinessSnapshot {
  const unresolvedOfficialCodes = records.map((record) => record.metadata.officialCode);
  return Object.freeze({
    provenance: authority.provenance,
    currentness: authority.currentness,
    sourceBinding: Object.freeze({
      status: "UNRESOLVED" as const,
      targetCount: ISMS_P_SOURCE_BINDING_TARGETS.length,
      unresolvedOfficialCodes: Object.freeze(unresolvedOfficialCodes),
    }),
    governance: "REQUIRED" as const,
    receipt: "NOT_READY" as const,
  });
}

function computePlanHash(plan: Omit<IsmsPMaterializationPlan, "planHash">) {
  return sha256(stableJson({
    domain: ISMS_P_RUNTIME_PLAN_HASH_DOMAIN,
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    planVersion: ISMS_P_RUNTIME_PLAN_VERSION,
    snapshot: plan.canonicalSnapshot,
    rows: plan.rows,
    mode: plan.mode,
    subjectCount: plan.subjectCount,
    identityCollisionCount: plan.identityCollisionCount,
    status: plan.status,
  }));
}

export function dryRunIsmsPRuntimeMaterialization(): IsmsPMaterializationPlan {
  const canonical = getCanonicalRegistrySnapshot();
  const authority = buildAuthority(canonical.records);
  const bridge = buildBridge(canonical.records);
  const rows = canonical.records.map((record, index) => toDryRunRow(record, bridge[index]));
  const canonicalSnapshot = cloneAndFreeze({
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    hashDomain: ISMS_P_RUNTIME_PLAN_HASH_DOMAIN,
    planVersion: ISMS_P_RUNTIME_PLAN_VERSION,
    registryRecords: canonical.records,
    materializationManifest: canonical.manifest,
    authoringSubjects: authority.subjects,
    identityBridge: bridge,
    rows,
    readiness: buildReadiness(authority, canonical.records),
  });
  const unsignedPlan = {
    contract: ISMS_P_RUNTIME_MATERIALIZATION_CONTRACT,
    mode: "DRY_RUN" as const,
    planVersion: ISMS_P_RUNTIME_PLAN_VERSION,
    subjectCount: authority.subjects.length,
    rows,
    identityCollisionCount: 0,
    canonicalSnapshot,
    status: "WAIT_FOR_AUTHENTICATED_HUMAN_GOVERNANCE" as const,
  };
  return cloneAndFreeze({ ...unsignedPlan, planHash: computePlanHash(unsignedPlan) });
}

function validationError(code: MaterializationErrorCode, message: string) {
  return { code, message } as const;
}

export function validateIsmsPMaterializationPlan(plan: unknown): MaterializationValidation {
  const errors: Readonly<{ code: MaterializationErrorCode; message: string }>[] = [];
  try {
    assertPlainJsonValue(plan);
  } catch (error) {
    return Object.freeze({
      valid: false,
      executionReady: false as const,
      errors: Object.freeze([validationError("PLAN_INPUT_INVALID", error instanceof Error ? error.message : "Plan is not valid JSON data.")]),
      unresolved: Object.freeze([]),
    });
  }
  let fresh: IsmsPMaterializationPlan;
  try {
    fresh = dryRunIsmsPRuntimeMaterialization();
  } catch (error) {
    return Object.freeze({
      valid: false,
      executionReady: false as const,
      errors: Object.freeze([validationError("AUTHORING_AUTHORITY_INVALID", error instanceof Error ? error.message : "Authoring authority validation failed.")]),
      unresolved: Object.freeze([]),
    });
  }
  if (stableJson(plan) !== stableJson(fresh)) {
    errors.push(validationError("PLAN_TAMPERED", "The submitted plan is not structurally equivalent to the current-main canonical plan snapshot."));
  }
  if (!isObject(plan) || plan.mode !== "DRY_RUN" || !Array.isArray(plan.rows) || plan.subjectCount !== fresh.subjectCount || plan.rows.length !== fresh.rows.length) {
    errors.push(validationError("PLAN_TAMPERED", "Only a current-main dry-run plan with the canonical row count is valid."));
  }
  if (!isObject(plan) || plan.planHash !== fresh.planHash) {
    errors.push(validationError("PLAN_HASH_MISMATCH", "The submitted materialization plan hash no longer matches current-main authority."));
  }
  const unresolved = fresh.canonicalSnapshot.readiness.sourceBinding.unresolvedOfficialCodes.length > 0
      ? [
        "PROVENANCE_CANONICAL_SOURCE_HASH_REQUIRED",
        "CURRENTNESS_UNRESOLVED",
        "CANONICAL_SOURCE_BINDING_REQUIRED",
        "AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED",
        "CANONICAL_RECEIPT_NOT_READY",
      ]
    : ["AUTHENTICATED_HUMAN_GOVERNANCE_REQUIRED", "CANONICAL_RECEIPT_NOT_READY"];
  return Object.freeze({
    valid: errors.length === 0,
    executionReady: false as const,
    errors: Object.freeze(errors),
    unresolved: Object.freeze(unresolved),
  });
}

export function materializeGovernedIsmsPRevision(plan: unknown): never {
  const validation = validateIsmsPMaterializationPlan(plan);
  if (!validation.valid) {
    const first = validation.errors[0] ?? validationError("PLAN_TAMPERED", "Invalid materialization plan.");
    throw new IsmsPMaterializationError(first.code, validation.errors.map((error) => error.code).join(","));
  }
  throw new IsmsPMaterializationError(
    "PERSISTENCE_NOT_AVAILABLE_IN_REVIEW_GATE",
    "Persistent materialization requires authenticated governance and a server transaction; this repair remains a dry-run validation gate.",
  );
}

function isCanonicalSemanticHash(value: string | null): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

export function classifyCurrentMainRevisionReplay(input: Readonly<{
  existing: Readonly<{ contentId: string; version: string; semanticHash: string | null; snapshotJson: string }> | null;
  candidate: Readonly<{ contentId: string; version: string; semanticHash: string | null; snapshotJson: string }>;
}>): "CREATE" | "EXACT_REPLAY" | "NEW_IMMUTABLE_REVISION_REQUIRED" | "CONFLICT" {
  if (!input.existing) return "CREATE";
  if (input.existing.contentId !== input.candidate.contentId) return "CONFLICT";
  if (input.existing.version === input.candidate.version && isCanonicalSemanticHash(input.existing.semanticHash) && isCanonicalSemanticHash(input.candidate.semanticHash) && input.existing.semanticHash === input.candidate.semanticHash && input.existing.snapshotJson === input.candidate.snapshotJson) return "EXACT_REPLAY";
  return "NEW_IMMUTABLE_REVISION_REQUIRED";
}

export async function computeCanonicalRuntimeSemanticHash(candidate: GovernedTheoryRevisionCandidate, actorUserId = candidate.governance.humanReviewedBy) {
  try {
    assertTheoryRevisionCandidate(candidate, actorUserId);
    const semanticProjection = { ...candidate };
    delete (semanticProjection as { contentId?: string }).contentId;
    return await computeTheoryRevisionSemanticHash(semanticProjection);
  } catch (error) {
    throw new IsmsPMaterializationError("RUNTIME_SEMANTIC_HASH_INVALID", error instanceof Error ? error.message : "Canonical runtime revision candidate is invalid.");
  }
}

export async function verifyCanonicalRuntimeSemanticHash(input: Readonly<{
  candidate: GovernedTheoryRevisionCandidate;
  submittedHash: string | null;
  actorUserId?: string;
}>): Promise<string> {
  if (!isCanonicalSemanticHash(input.submittedHash)) {
    throw new IsmsPMaterializationError("RUNTIME_SEMANTIC_HASH_INVALID", "A runtime semantic hash must be a canonical SHA-256 digest.");
  }
  const canonicalHash = await computeCanonicalRuntimeSemanticHash(input.candidate, input.actorUserId ?? input.candidate.governance.humanReviewedBy);
  if (canonicalHash !== input.submittedHash) {
    throw new IsmsPMaterializationError("RUNTIME_SEMANTIC_HASH_INVALID", "Submitted runtime semantic hash does not match the canonical governed revision candidate.");
  }
  return canonicalHash;
}

export function assertRuntimeSemanticHashDomain(input: Readonly<{
  runtimeSemanticHash: string;
  authoringRevisionHash?: string | null;
  sourceSha256?: string | null;
  assessmentSemanticHash?: string | null;
}>) {
  if (!isCanonicalSemanticHash(input.runtimeSemanticHash)) {
    throw new IsmsPMaterializationError("RUNTIME_SEMANTIC_HASH_INVALID", "Runtime semantic hash must be a canonical SHA-256 digest.");
  }
  const foreign = [input.authoringRevisionHash, input.sourceSha256, input.assessmentSemanticHash].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (foreign.includes(input.runtimeSemanticHash)) {
    throw new IsmsPMaterializationError(
      "RUNTIME_SEMANTIC_HASH_INVALID",
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
