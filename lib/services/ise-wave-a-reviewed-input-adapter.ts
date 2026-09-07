import type { DatabaseProvider, DatabaseTransaction } from "../../db/provider/database-provider.ts";
import { readContentRevisionRegistration } from "../../db/content-revision-registration-repository.ts";
import { AppError } from "../errors.ts";
import { CONTENT_REVIEW_DOMAINS } from "../policy/content-review-judgment.ts";
import { sha256Canonical } from "../policy/stable-canonical-hash.ts";
import {
  buildRegistrationIdentities,
  CONTENT_REVISION_REGISTRATION_V1,
  REGISTERED_REVIEW_PENDING,
  type ContentRevisionRegistrationInput,
  type RegistrationSourceBinding,
} from "./content-revision-registration.ts";
import {
  buildIseWaveACanonicalRegistrationInput,
  ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE,
} from "./ise-wave-a-canonical-registration.ts";
import { ISE_WAVE_A_SUBJECT_IDS } from "./ise-wave-a-canonical-revision-provenance.ts";

export const ISE_WAVE_A_REVIEWED_INPUT_CONTRACT_V1 = "ISE_WAVE_A_GENERIC_REVIEW_INPUT_ADAPTER_V1" as const;
export const ISE_WAVE_A_REVIEW_RESOURCE_TYPE = "CONTENT_REVISION_REGISTRATION" as const;
export const ISE_WAVE_A_REVIEW_SCOPE = "ISE_WAVE_A_EXACT_PACKAGE_2_OF_2" as const;
export const ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS = Object.freeze([
  "TECHNICAL",
  "SAFETY_SECURITY_CONTENT",
  "COPYRIGHT_RIGHTS",
  "CURRENTNESS",
  "SUPPORT_QUALIFICATION",
] as const);

export type IseWaveARequiredReviewDomain = (typeof ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS)[number];
export type IseWaveACurrentnessStatus =
  | "CURRENTNESS_NOT_AVAILABLE"
  | "CURRENTNESS_SCHEMA_AVAILABLE"
  | "CURRENTNESS_AVAILABLE";

export type IseWaveAReviewedSource = Readonly<{
  sourceIdentityId: string;
  canonicalKey: string;
  sourceType: string;
  normalizedIdentity: string;
  lifecycleState: "ACTIVE";
  bindingRole: "SCOPE_REFERENCE";
  locator: string;
  expressionReuse: "NOT_USED";
}>;

export type IseWaveAReviewedSubject = Readonly<{
  subjectIdentity: string;
  resourceRevisionId: string;
  contentSemanticHash: string;
  semanticOrdinal: number;
  contentRevisionId: string;
  provenanceIdentity: string;
  sourceLineage: string;
  sources: readonly IseWaveAReviewedSource[];
}>;

export type IseWaveAReviewedInput = Readonly<{
  contractVersion: typeof ISE_WAVE_A_REVIEWED_INPUT_CONTRACT_V1;
  resourceType: typeof ISE_WAVE_A_REVIEW_RESOURCE_TYPE;
  resourceId: string;
  scope: typeof ISE_WAVE_A_REVIEW_SCOPE;
  qualificationId: string;
  packageKey: string;
  packageSemanticIdentity: string;
  provenanceAggregateIdentity: string;
  registrationSemanticIdentity: string;
  registrationState: typeof REGISTERED_REVIEW_PENDING;
  subjects: readonly IseWaveAReviewedSubject[];
  requiredDomains: readonly IseWaveARequiredReviewDomain[];
  riskClass: "HIGH_TRUST";
  requiredReviewerCount: 2;
  currentnessStatus: IseWaveACurrentnessStatus;
  snapshot: Record<string, unknown>;
  reviewedInputIdentity: string;
}>;

export type IseWaveAGovernanceContext = Readonly<{
  reviewedInput: IseWaveAReviewedInput;
  requiredDomains: readonly IseWaveARequiredReviewDomain[];
  requiredReviewerCount: 2;
  dependencyStatus: "READY" | "DEPENDENCY_INCOMPLETE";
}>;

type RegistrationRow = Record<string, unknown> & { id?: unknown };
type MigrationRow = Record<string, unknown> & { id?: unknown };

/**
 * Rebuilds the exact ISE package from PostgreSQL registration authority. The
 * adapter deliberately does not accept a caller-supplied package, subject,
 * hash, source, reviewed-input, or required-domain value.
 */
export async function buildIseWaveAReviewedInput(
  database: DatabaseProvider,
  options: Readonly<{ expectedReviewedInputIdentity?: string }> = {},
): Promise<IseWaveAReviewedInput> {
  requirePostgresAuthority(database);
  if (!database.transactional) throw new AppError("ISE reviewed-input reconstruction requires a transaction-scoped PostgreSQL connection.", 503, "ISE_REVIEWED_INPUT_TRANSACTION_REQUIRED");
  return database.transactional(async (transaction) => buildIseWaveAReviewedInputInTransaction(transaction, options));
}

export async function buildIseWaveAGovernanceContext(
  database: DatabaseProvider,
  options: Readonly<{ expectedReviewedInputIdentity?: string }> = {},
): Promise<IseWaveAGovernanceContext> {
  const reviewedInput = await buildIseWaveAReviewedInput(database, options);
  return {
    reviewedInput,
    requiredDomains: reviewedInput.requiredDomains,
    requiredReviewerCount: reviewedInput.requiredReviewerCount,
    dependencyStatus: reviewedInput.currentnessStatus === "CURRENTNESS_AVAILABLE" ? "READY" : "DEPENDENCY_INCOMPLETE",
  };
}

export function assertIseWaveAGovernanceDependencies(context: IseWaveAGovernanceContext): void {
  if (context.dependencyStatus !== "READY") throw new AppError("Generic CURRENTNESS infrastructure is not available in this worktree.", 503, "ISE_CURRENTNESS_DEPENDENCY_INCOMPLETE");
}

async function buildIseWaveAReviewedInputInTransaction(
  database: DatabaseTransaction,
  options: Readonly<{ expectedReviewedInputIdentity?: string }>,
): Promise<IseWaveAReviewedInput> {
  const registrationId = await resolveCurrentRegistrationId(database);
  const initial = await readContentRevisionRegistration(database, registrationId);
  if (initial.resourceType !== ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE || initial.state !== REGISTERED_REVIEW_PENDING) throw new AppError("ISE registration resource or lifecycle is invalid.", 409, "ISE_REVIEWED_INPUT_REGISTRATION_INVALID");
  await lockCanonicalAuthorityRows(database, initial);
  const registration = await readContentRevisionRegistration(database, registrationId);
  if (registration.resourceType !== ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE || registration.state !== REGISTERED_REVIEW_PENDING) throw new AppError("ISE registration changed during reconstruction.", 409, "ISE_REVIEWED_INPUT_REGISTRATION_STALE");

  const canonicalInput = await buildIseWaveACanonicalRegistrationInput(database, registration.createdBy);
  const canonicalIdentities = await buildRegistrationIdentities(canonicalInput);
  const reconstructedInput = readbackAsRegistrationInput(registration);
  const readbackIdentities = await buildRegistrationIdentities(reconstructedInput);
  assertExactCanonicalRegistration(registration, canonicalInput, canonicalIdentities, readbackIdentities);

  const currentnessStatus = await detectCurrentnessAvailability(database);
  const resourceId = registration.registrationSemanticIdentity;
  const subjects: IseWaveAReviewedSubject[] = registration.subjects
    .slice()
    .sort((a, b) => a.semanticRevisionId.localeCompare(b.semanticRevisionId))
    .map((subject, semanticOrdinal) => {
      const sources: IseWaveAReviewedSource[] = subject.sources.slice().sort(sourceSort).map((source) => ({
        sourceIdentityId: source.sourceIdentityId,
        canonicalKey: source.canonicalKey,
        sourceType: source.sourceType,
        normalizedIdentity: source.normalizedIdentity,
        lifecycleState: "ACTIVE",
        bindingRole: "SCOPE_REFERENCE",
        locator: source.locator,
        expressionReuse: "NOT_USED",
      }));
      return {
        subjectIdentity: subject.semanticRevisionId,
        resourceRevisionId: subject.contentRevisionId,
        contentSemanticHash: subject.contentHash,
        semanticOrdinal,
        contentRevisionId: subject.contentRevisionId,
        provenanceIdentity: subject.provenanceIdentity,
        sourceLineage: subject.sourceLineage,
        sources,
      };
    });
  const snapshot = {
    contractVersion: ISE_WAVE_A_REVIEWED_INPUT_CONTRACT_V1,
    resourceType: ISE_WAVE_A_REVIEW_RESOURCE_TYPE,
    resourceId,
    scope: ISE_WAVE_A_REVIEW_SCOPE,
    qualificationId: registration.qualificationId,
    packageKey: registration.packageKey,
    packageSemanticIdentity: registration.packageSemanticIdentity,
    provenanceAggregateIdentity: registration.provenanceAggregateIdentity,
    registrationSemanticIdentity: registration.registrationSemanticIdentity,
    registrationState: registration.state,
    subjects,
    requiredDomains: [...ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS],
    riskClass: "HIGH_TRUST",
    requiredReviewerCount: 2,
  } satisfies Record<string, unknown>;
  const reviewedInputIdentity = await sha256Canonical(snapshot);
  if (options.expectedReviewedInputIdentity !== undefined && options.expectedReviewedInputIdentity !== reviewedInputIdentity) throw new AppError("Expected ISE reviewed input is stale.", 409, "ISE_REVIEWED_INPUT_STALE");
  return Object.freeze({
    contractVersion: ISE_WAVE_A_REVIEWED_INPUT_CONTRACT_V1,
    resourceType: ISE_WAVE_A_REVIEW_RESOURCE_TYPE,
    resourceId,
    scope: ISE_WAVE_A_REVIEW_SCOPE,
    qualificationId: registration.qualificationId,
    packageKey: registration.packageKey,
    packageSemanticIdentity: registration.packageSemanticIdentity,
    provenanceAggregateIdentity: registration.provenanceAggregateIdentity,
    registrationSemanticIdentity: registration.registrationSemanticIdentity,
    registrationState: registration.state,
    subjects: Object.freeze(subjects),
    requiredDomains: ISE_WAVE_A_REQUIRED_REVIEW_DOMAINS,
    riskClass: "HIGH_TRUST",
    requiredReviewerCount: 2,
    currentnessStatus,
    snapshot,
    reviewedInputIdentity,
  });
}

function requirePostgresAuthority(database: DatabaseProvider): void {
  if (database.kind !== "supabase") throw new AppError("ISE governance authority requires PostgreSQL; D1 is compatibility-only.", 503, "ISE_REVIEWED_INPUT_POSTGRES_REQUIRED");
}

async function resolveCurrentRegistrationId(database: DatabaseTransaction): Promise<string> {
  const result = await database.query<RegistrationRow>({
    sql: `SELECT id FROM content_revision_registrations
      WHERE registration_contract_version = ? AND resource_type = ? AND qualification_id = ?
        AND package_key = ? AND state = ?
      ORDER BY created_at DESC, id DESC LIMIT 2`,
    parameters: [CONTENT_REVISION_REGISTRATION_V1, ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE, "course-ise", "ise-wave-a-information-security-general", REGISTERED_REVIEW_PENDING],
  });
  if (result.rows.length !== 1 || typeof result.rows[0]?.id !== "string") throw new AppError("Exactly one current ISE Wave A registration is required.", 409, "ISE_REVIEWED_INPUT_REGISTRATION_AMBIGUOUS");
  return result.rows[0].id;
}

async function lockCanonicalAuthorityRows(database: DatabaseTransaction, registration: Awaited<ReturnType<typeof readContentRevisionRegistration>>): Promise<void> {
  const course = await database.queryOne<Record<string, unknown>>({ sql: "SELECT id, active, deleted_at FROM courses WHERE id = ? FOR SHARE", parameters: [registration.qualificationId] });
  if (!course || course.id !== "course-ise" || course.deleted_at !== null || !isTrue(course.active)) throw new AppError("Canonical ISE qualification is unavailable.", 409, "ISE_REVIEWED_INPUT_QUALIFICATION_STALE");
  for (const subject of registration.subjects.slice().sort((a, b) => a.contentRevisionId.localeCompare(b.contentRevisionId))) {
    const revision = await database.queryOne<Record<string, unknown>>({ sql: "SELECT id, content_id, content_type, version, course_id, revision_status, semantic_hash, snapshot_json FROM content_revisions WHERE id = ? FOR SHARE", parameters: [subject.contentRevisionId] });
    if (!revision || revision.id !== subject.contentRevisionId || revision.content_type !== "LESSON" || revision.version !== "1" || revision.course_id !== registration.qualificationId || revision.semantic_hash !== subject.contentHash || revision.revision_status !== "review") throw new AppError("Canonical ISE revision changed during reconstruction.", 409, "ISE_REVIEWED_INPUT_REVISION_STALE");
  }
  const sourceIds = registration.subjects.flatMap((subject) => subject.sources.map((source) => source.sourceIdentityId)).sort();
  for (const sourceId of [...new Set(sourceIds)]) {
    const source = await database.queryOne<Record<string, unknown>>({ sql: "SELECT id, canonical_key, source_type, normalized_identity, lifecycle_state FROM source_identities WHERE id = ? FOR SHARE", parameters: [sourceId] });
    if (!source || source.id !== sourceId || source.lifecycle_state !== "ACTIVE") throw new AppError("Canonical ISE source changed during reconstruction.", 409, "ISE_REVIEWED_INPUT_SOURCE_STALE");
  }
}

function readbackAsRegistrationInput(registration: Awaited<ReturnType<typeof readContentRevisionRegistration>>): ContentRevisionRegistrationInput {
  return {
    actorUserId: registration.createdBy,
    resourceType: registration.resourceType,
    qualificationId: registration.qualificationId,
    packageKey: registration.packageKey,
    subjects: registration.subjects.map((subject) => ({
      semanticRevisionId: subject.semanticRevisionId,
      contentId: subject.canonicalContentId,
      contentType: "LESSON",
      version: "1",
      contentHash: subject.contentHash,
      snapshotJson: subject.canonicalSnapshotJson,
      sourceLineage: subject.sourceLineage,
      sourceBindings: subject.sources.map((source): RegistrationSourceBinding => ({
        sourceIdentityId: source.sourceIdentityId,
        canonicalKey: source.canonicalKey,
        sourceType: source.sourceType,
        normalizedIdentity: source.normalizedIdentity,
        lifecycleState: "ACTIVE",
        bindingRole: "SCOPE_REFERENCE",
        locator: source.locator,
        expressionReuse: "NOT_USED",
      })),
      rightsState: "REVIEW_REQUIRED",
      originalityState: "REVIEW_REQUIRED",
      currentnessState: "REVIEW_REQUIRED",
      responsibleOwnerState: "OWNER_ATTESTATION_REQUIRED",
    })),
  };
}

function assertExactCanonicalRegistration(
  registration: Awaited<ReturnType<typeof readContentRevisionRegistration>>,
  canonicalInput: ContentRevisionRegistrationInput & Awaited<ReturnType<typeof buildRegistrationIdentities>>,
  canonicalIdentities: Awaited<ReturnType<typeof buildRegistrationIdentities>>,
  readbackIdentities: Awaited<ReturnType<typeof buildRegistrationIdentities>>,
): void {
  if (registration.contractVersion !== CONTENT_REVISION_REGISTRATION_V1 || registration.qualificationId !== "course-ise" || registration.packageKey !== "ise-wave-a-information-security-general" || registration.packageSemanticIdentity !== canonicalIdentities.packageSemanticIdentity || registration.provenanceAggregateIdentity !== canonicalIdentities.provenanceAggregateIdentity || registration.registrationSemanticIdentity !== canonicalIdentities.registrationSemanticIdentity) throw new AppError("ISE registration identity does not match server-owned canonical state.", 409, "ISE_REVIEWED_INPUT_CANONICAL_STATE_REQUIRED");
  if (registration.subjects.length !== 2 || registration.subjects.map((subject) => subject.semanticRevisionId).sort().join("\u0000") !== ISE_WAVE_A_SUBJECT_IDS.slice().sort().join("\u0000")) throw new AppError("ISE Wave A requires the exact 2/2 subject set.", 409, "ISE_REVIEWED_INPUT_SUBJECT_SET_INVALID");
  if (readbackIdentities.packageSemanticIdentity !== registration.packageSemanticIdentity || readbackIdentities.provenanceAggregateIdentity !== registration.provenanceAggregateIdentity || readbackIdentities.registrationSemanticIdentity !== registration.registrationSemanticIdentity) throw new AppError("Persisted ISE registration identities do not recompute from canonical readback.", 409, "ISE_REVIEWED_INPUT_IDENTITY_INVALID");
  const canonicalSubjects = new Map(canonicalInput.subjects.map((subject) => [subject.semanticRevisionId, subject]));
  for (const subject of registration.subjects) {
    const expected = canonicalSubjects.get(subject.semanticRevisionId);
    const expectedSources = expected?.sourceBindings.map(sourceBindingKey).sort() ?? [];
    const actualSources = subject.sources.map(sourceReadbackKey).sort();
    if (!expected || subject.contentHash !== expected.contentHash || subject.canonicalSnapshotJson !== expected.snapshotJson || subject.sourceLineage !== expected.sourceLineage || subject.provenanceIdentity !== canonicalIdentities.subjectProvenanceIdentities[subject.semanticRevisionId] || JSON.stringify(actualSources) !== JSON.stringify(expectedSources)) throw new AppError("Persisted ISE registration subject does not match canonical state.", 409, "ISE_REVIEWED_INPUT_SUBJECT_INVALID");
  }
}

async function detectCurrentnessAvailability(database: DatabaseTransaction): Promise<IseWaveACurrentnessStatus> {
  const currentnessDomain: string = "CURRENTNESS";
  const domainInCode = CONTENT_REVIEW_DOMAINS.some((domain) => domain === currentnessDomain);
  if (!domainInCode) {
    try {
      const migration = await database.queryOne<MigrationRow>({ sql: "SELECT id FROM app_schema_migrations WHERE id = ? LIMIT 1", parameters: ["0029_generic_review_currentness_domain"] });
      if (migration?.id === "0029_generic_review_currentness_domain") return "CURRENTNESS_SCHEMA_AVAILABLE";
    } catch {
      return "CURRENTNESS_NOT_AVAILABLE";
    }
    return "CURRENTNESS_NOT_AVAILABLE";
  }
  return "CURRENTNESS_AVAILABLE";
}

function sourceSort(a: { sourceIdentityId: string; bindingRole: string; locator: string }, b: { sourceIdentityId: string; bindingRole: string; locator: string }): number {
  return [a.sourceIdentityId, a.bindingRole, a.locator].join("\u0000").localeCompare([b.sourceIdentityId, b.bindingRole, b.locator].join("\u0000"));
}

function sourceBindingKey(source: RegistrationSourceBinding): string {
  return [source.sourceIdentityId, source.canonicalKey, source.sourceType, source.normalizedIdentity, source.lifecycleState, source.bindingRole, source.locator, source.expressionReuse].join("\u0000");
}

function sourceReadbackKey(source: Awaited<ReturnType<typeof readContentRevisionRegistration>>["subjects"][number]["sources"][number]): string {
  return [source.sourceIdentityId, source.canonicalKey, source.sourceType, source.normalizedIdentity, source.lifecycleState, source.bindingRole, source.locator, source.expressionReuse].join("\u0000");
}

function isTrue(value: unknown): boolean { return value === true || value === 1 || value === "1"; }
