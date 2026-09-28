import { randomUUID } from "node:crypto";
import { AppError } from "../errors.ts";
import { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";
import { assertCatalogManager } from "./catalog-service.ts";
import { choosePrimaryActorRole, sanitizeAuditMetadata } from "./audit-service.ts";
import {
  CPPG_RUNTIME_COURSE_ID,
  CPPG_RUNTIME_PACKAGE_KEY,
  buildCppgCourseTheoryDraftProjection,
  buildCppgCourseTheoryDraftProjectionFromBundle,
  cppgAuthorityIdentity,
  expectedCppgRuntimeState,
  isCanonicalCppgPredecessor,
  loadCppgLedgerState,
  type CppgCourseTheoryDraftProjection,
  type CppgFoundationBundle,
} from "./cppg-runtime-course-registration.ts";
import {
  computeCppgRegistrationSemanticIdentity,
  type CppgCanonicalRegistrationBinding,
} from "../../db/cppg-runtime-postgres-registration.ts";
import { PostgresRuntimeAuthorityPersistence } from "../../db/runtime-authority-postgres-persistence.ts";
import type { PostgresQueryValue, PostgresTransactionExecutor } from "../../db/provider/postgres-database-provider.ts";

const PUBLICATION_IDENTITY_CONTRACT = "CPPG_PUBLICATION_RECEIPT_V1" as const;

export type CppgPublicationActor = Readonly<{
  id: string;
  roles: readonly string[];
}>;

export type AuthorizeAndPublishCppgRegistrationInput = Readonly<{
  registrationSemanticIdentity: string;
  requestedContentRevisionIds: readonly string[];
  actor: CppgPublicationActor;
  requestId?: string | null;
}>;

export type CppgPublicationResult = Readonly<{
  outcome: "PUBLISHED" | "ALREADY_PUBLISHED";
  publicationId: string;
  publicationSemanticIdentity: string;
  registrationSemanticIdentity: string;
  runtimeRevisionId: string;
  authorityId: string;
  authoritySequence: number;
}>;

export type CppgPublicationFailureCode =
  | "ACTOR_UNAUTHORIZED"
  | "REGISTRATION_NOT_FOUND"
  | "REGISTRATION_NOT_CURRENT"
  | "REGISTRATION_BINDING_MISMATCH"
  | "AUTHORITY_NOT_FOUND"
  | "AUTHORITY_REVOKED"
  | "AUTHORITY_SUPERSEDED"
  | "AUTHORITY_ID_MISMATCH"
  | "APPROVAL_SUBJECT_MISMATCH"
  | "SOURCE_BINDING_MISMATCH"
  | "FOUNDATION_BINDING_MISMATCH"
  | "REVISION_MISMATCH"
  | "PUBLICATION_POLICY_DENIED"
  | "PUBLICATION_RECEIPT_CONFLICT"
  | "PUBLICATION_PERSISTENCE_FAILURE";

export class CppgPublicationError extends AppError {
  declare readonly code: CppgPublicationFailureCode;

  constructor(code: CppgPublicationFailureCode, message: string, status = 409, cause?: unknown) {
    super(message, status, code);
    this.name = "CppgPublicationError";
    this.code = code;
    if (cause !== undefined) Object.defineProperty(this, "cause", { value: cause, configurable: true });
  }
}

type RegistrationRow = Record<string, unknown> & {
  id: string;
  courseId: string;
  courseSlug: string;
  packageKey: string;
  runtimeRevisionId: string;
  contentRevisionIds: unknown;
  projectionSemanticHash: string;
  sourceManifestId: string;
  sourcePackageHash: string;
  foundationId: string;
  foundationHash: string;
  approvalSubjectHash: string;
  authorityId: string;
  authoritySequence: number;
  registrationSemanticIdentity: string;
  state: string;
  publicationAuthority: string;
};

type ReceiptRow = Record<string, unknown> & {
  publicationId: string;
  registrationSemanticIdentity: string;
  courseId: string;
  packageKey: string;
  runtimeRevisionId: string;
  contentRevisionIds: unknown;
  sourceManifestId: string;
  sourcePackageHash: string;
  foundationId: string;
  foundationHash: string;
  approvalSubjectHash: string;
  authorityId: string;
  authoritySequence: number;
  publicationState: string;
  publicationSemanticIdentity: string;
  publishedBy: string;
};

/**
 * Dedicated CPPG publication gate. Actor role authorization and the exact,
 * current Runtime Authority binding are independent required conditions.
 * Every visibility write, receipt append, and success audit event shares the
 * authority-root-locked PostgreSQL transaction.
 */
export async function authorizeAndPublishCppgRegistration(
  input: AuthorizeAndPublishCppgRegistrationInput,
  owner: PostgresRuntimeAuthorityPersistence,
): Promise<CppgPublicationResult> {
  validateInputShape(input);
  if (!(owner instanceof PostgresRuntimeAuthorityPersistence)) {
    throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", "CPPG publication requires the canonical PostgreSQL authority writer.", 503);
  }
  await authorizePublicationActor(input, owner);
  let projection: CppgCourseTheoryDraftProjection;
  try {
    projection = await buildCppgCourseTheoryDraftProjection({ actorUserId: input.actor.id });
  } catch (error) {
    const failure = toPublicationError(error);
    await recordFailureAudit(owner, input, failure).catch(() => {});
    throw failure;
  }
  return publishValidatedProjection(input, owner, projection);
}

/** Test-only transaction seam. Production always uses the canonical source loader above. */
export async function authorizeAndPublishCppgRegistrationForTesting(
  input: AuthorizeAndPublishCppgRegistrationInput,
  owner: PostgresRuntimeAuthorityPersistence,
  bundle: CppgFoundationBundle,
): Promise<CppgPublicationResult> {
  if (process.env.NODE_ENV !== "test" || typeof process.env.NODE_TEST_CONTEXT !== "string") {
    throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", "Test-only CPPG publication seam is disabled outside node:test.", 403);
  }
  validateInputShape(input);
  if (!(owner instanceof PostgresRuntimeAuthorityPersistence)) {
    throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", "CPPG publication requires the canonical PostgreSQL authority writer.", 503);
  }
  await authorizePublicationActor(input, owner);
  const projection = await buildCppgCourseTheoryDraftProjectionFromBundle(bundle, { actorUserId: input.actor.id });
  return publishValidatedProjection(input, owner, projection);
}

async function publishValidatedProjection(
  input: AuthorizeAndPublishCppgRegistrationInput,
  owner: PostgresRuntimeAuthorityPersistence,
  projection: CppgCourseTheoryDraftProjection,
): Promise<CppgPublicationResult> {

  try {
    const identity = await cppgAuthorityIdentity(projection);
    const expectedContentRevisionIds = projection.contentRevisions.map((record) => record.id);
    if (!sameStringArray(input.requestedContentRevisionIds, expectedContentRevisionIds)) {
      throw new CppgPublicationError("REVISION_MISMATCH", "Requested content revisions do not match the canonical projection.");
    }

    return await owner.withRegistrationTransaction(async (transactionAuthorityOwner, executor) => {
      // The scalar subquery discovers the immutable authority ID from the exact
      // registration key; the root is locked before the full registration read.
      const rootLock = await executor.query<{ authorityId: string }>(
        `SELECT root."authority_id" AS "authorityId"
         FROM public."runtime_authority_roots" AS root
         WHERE root."authority_id" = (
           SELECT registration."authority_id"
           FROM public."cppg_runtime_registrations" AS registration
           WHERE registration."registration_semantic_identity" = $1
         )
         FOR UPDATE OF root`,
        [input.registrationSemanticIdentity],
      );
      const registration = await loadRegistration(executor, input.registrationSemanticIdentity);
      if (!registration) throw new CppgPublicationError("REGISTRATION_NOT_FOUND", "Canonical CPPG registration was not found.", 404);
      if (rootLock.rows.length !== 1) throw new CppgPublicationError("AUTHORITY_NOT_FOUND", "Runtime Authority root was not found.", 409);

      const currentness = await loadCppgLedgerState(transactionAuthorityOwner, registration.authorityId);
      await validateAuthorityCurrentness(currentness, registration, identity.subject, identity.authorityId, identity.approvalSubjectHash);
      await validateRegistrationSnapshot(registration, projection, expectedContentRevisionIds, currentness.authoritySequence);
      await validateProjectionRecordSnapshot(executor, registration.projectionSemanticHash, projection);

      const publicationSemanticIdentity = await sha256Canonical({
        contractVersion: PUBLICATION_IDENTITY_CONTRACT,
        registrationSemanticIdentity: registration.registrationSemanticIdentity,
      });
      const existing = await loadReceipt(executor, registration.registrationSemanticIdentity);
      if (existing) {
        if (!receiptMatches(existing, registration, expectedContentRevisionIds, publicationSemanticIdentity)) {
          throw new CppgPublicationError("PUBLICATION_RECEIPT_CONFLICT", "Existing CPPG publication receipt conflicts with the exact registration snapshot.");
        }
        await validateLiveProjectionRows(executor, projection, true);
        return resultFor("ALREADY_PUBLISHED", existing, registration);
      }

      await validateLiveProjectionRows(executor, projection, false);
      await validateDraftVisibilityTarget(executor, projection, expectedContentRevisionIds);
      await applyCppgVisibilityWrites(executor, projection, expectedContentRevisionIds);

      const publicationId = randomUUID();
      await appendReceipt(executor, publicationId, registration, publicationSemanticIdentity, input.actor.id);
      await insertAuditEvent(executor, input, registration, publicationSemanticIdentity, "SUCCESS", "CPPG_CANONICAL_PUBLICATION_SUCCEEDED");

      // Re-read the locked ledger, receipt, registration, and all visibility
      // targets before commit. Any mismatch throws and rolls the entire unit back.
      const finalAuthority = await loadCppgLedgerState(transactionAuthorityOwner, registration.authorityId);
      await validateAuthorityCurrentness(finalAuthority, registration, identity.subject, identity.authorityId, identity.approvalSubjectHash);
      if (finalAuthority.authoritySequence !== currentness.authoritySequence) {
        throw new CppgPublicationError("REGISTRATION_NOT_CURRENT", "Runtime Authority sequence changed during publication.");
      }
      const savedReceipt = await loadReceipt(executor, registration.registrationSemanticIdentity);
      if (!savedReceipt || !receiptMatches(savedReceipt, registration, expectedContentRevisionIds, publicationSemanticIdentity) || savedReceipt.publicationId !== publicationId) {
        throw new CppgPublicationError("PUBLICATION_RECEIPT_CONFLICT", "Publication receipt final readback did not match the committed intent.");
      }
      await assertVisibleState(executor, projection, expectedContentRevisionIds);
      const immutableRegistration = await loadRegistration(executor, registration.registrationSemanticIdentity);
      if (!immutableRegistration || immutableRegistration.state !== "REGISTERED_UNPUBLISHED" || immutableRegistration.publicationAuthority !== "NOT_GRANTED") {
        throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Canonical registration state changed during publication.");
      }
      return resultFor("PUBLISHED", savedReceipt, registration);
    });
  } catch (error) {
    const failure = toPublicationError(error);
    await recordFailureAudit(owner, input, failure).catch(() => {});
    throw failure;
  }
}

async function authorizePublicationActor(input: AuthorizeAndPublishCppgRegistrationInput, owner: PostgresRuntimeAuthorityPersistence): Promise<void> {
  try {
    assertCatalogManager(input.actor.roles);
  } catch {
    const failure = new CppgPublicationError("ACTOR_UNAUTHORIZED", "A catalog manager role is required for CPPG publication.", 403);
    await recordFailureAudit(owner, input, failure).catch(() => {});
    throw failure;
  }
}

function validateInputShape(input: AuthorizeAndPublishCppgRegistrationInput): void {
  if (!input || typeof input !== "object" || !/^[a-f0-9]{64}$/u.test(input.registrationSemanticIdentity)) {
    throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Exact registration semantic identity is required.", 400);
  }
  if (!input.actor || typeof input.actor.id !== "string" || !input.actor.id.trim() || !Array.isArray(input.actor.roles) || input.actor.roles.some((role) => typeof role !== "string")) {
    throw new CppgPublicationError("ACTOR_UNAUTHORIZED", "A trusted actor identity and roles are required.", 401);
  }
  if (!Array.isArray(input.requestedContentRevisionIds) || input.requestedContentRevisionIds.length === 0 || input.requestedContentRevisionIds.some((id) => typeof id !== "string" || id.length === 0) || new Set(input.requestedContentRevisionIds).size !== input.requestedContentRevisionIds.length) {
    throw new CppgPublicationError("REVISION_MISMATCH", "An exact, duplicate-free content revision list is required.", 400);
  }
}

async function loadRegistration(executor: PostgresTransactionExecutor, semanticIdentity: string): Promise<RegistrationRow | null> {
  const result = await executor.query<RegistrationRow>(
    `SELECT "id", "course_id" AS "courseId", "course_slug" AS "courseSlug", "package_key" AS "packageKey",
            "runtime_revision_id" AS "runtimeRevisionId", "content_revision_ids" AS "contentRevisionIds",
            "projection_semantic_hash" AS "projectionSemanticHash", "source_manifest_id" AS "sourceManifestId",
            "source_package_hash" AS "sourcePackageHash", "foundation_id" AS "foundationId",
            "foundation_hash" AS "foundationHash", "approval_subject_hash" AS "approvalSubjectHash",
            "authority_id" AS "authorityId", "authority_sequence" AS "authoritySequence",
            "registration_semantic_identity" AS "registrationSemanticIdentity", "state",
            "publication_authority" AS "publicationAuthority"
     FROM public."cppg_runtime_registrations"
     WHERE "registration_semantic_identity" = $1 FOR UPDATE`,
    [semanticIdentity],
  );
  return result.rows[0] ?? null;
}

async function validateAuthorityCurrentness(
  currentness: Awaited<ReturnType<typeof loadCppgLedgerState>>,
  registration: RegistrationRow,
  expectedSubject: Awaited<ReturnType<typeof cppgAuthorityIdentity>>["subject"],
  expectedAuthorityId: string,
  expectedApprovalSubjectHash: string,
): Promise<void> {
  if (currentness.state === "NONE") throw new CppgPublicationError("AUTHORITY_NOT_FOUND", "Runtime Authority approval was not found.");
  if (currentness.state === "REVOKED") throw new CppgPublicationError("AUTHORITY_REVOKED", "Runtime Authority approval has been revoked.");
  if (currentness.state === "SUPERSEDED") throw new CppgPublicationError("AUTHORITY_SUPERSEDED", "Runtime Authority approval has been superseded.");
  if (registration.authorityId !== expectedAuthorityId) throw new CppgPublicationError("AUTHORITY_ID_MISMATCH", "Registration is bound to a different Runtime Authority.");
  if (currentness.state !== "APPROVED_ACTIVE" || currentness.authoritySequence !== registration.authoritySequence) {
    throw new CppgPublicationError("REGISTRATION_NOT_CURRENT", "Registration does not bind the latest active Runtime Authority sequence.");
  }
  if (currentness.approvalSubjectHash !== expectedApprovalSubjectHash || registration.approvalSubjectHash !== expectedApprovalSubjectHash) {
    throw new CppgPublicationError("APPROVAL_SUBJECT_MISMATCH", "Approval subject hash differs from the canonical projection.");
  }
  if (!currentness.subject || stableCanonicalJson(currentness.subject) !== stableCanonicalJson(expectedSubject)) {
    throw new CppgPublicationError("APPROVAL_SUBJECT_MISMATCH", "Persisted approval subject differs from the canonical projection.");
  }
  if (!await isCanonicalCppgPredecessor(registration.authorityId, currentness.subject, currentness.approvalSubjectHash ?? "")) {
    throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", "Runtime Authority does not satisfy the exact canonical CPPG publication policy.");
  }
}

async function validateRegistrationSnapshot(
  registration: RegistrationRow,
  projection: CppgCourseTheoryDraftProjection,
  contentRevisionIds: readonly string[],
  authoritySequence: number,
): Promise<void> {
  if (registration.courseId !== CPPG_RUNTIME_COURSE_ID || registration.courseSlug !== "cppg" || registration.packageKey !== CPPG_RUNTIME_PACKAGE_KEY || registration.state !== "REGISTERED_UNPUBLISHED" || registration.publicationAuthority !== "NOT_GRANTED") {
    throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Registration is not the exact canonical unpublished CPPG record.");
  }
  if (registration.runtimeRevisionId !== `${CPPG_RUNTIME_PACKAGE_KEY}:revision:${projection.revisionRegistration.identities.registrationSemanticIdentity}` || !sameStringArray(parseStringArray(registration.contentRevisionIds), contentRevisionIds)) {
    throw new CppgPublicationError("REVISION_MISMATCH", "Runtime or content revision differs from the approved registration snapshot.");
  }
  const identity = await cppgAuthorityIdentity(projection);
  if (registration.sourceManifestId !== identity.subject.sourceManifestId || registration.sourcePackageHash !== identity.subject.sourcePackageHash) {
    throw new CppgPublicationError("SOURCE_BINDING_MISMATCH", "Source manifest or package hash differs from the canonical projection.");
  }
  if (registration.foundationId !== identity.subject.foundationId || registration.foundationHash !== identity.subject.foundationHash) {
    throw new CppgPublicationError("FOUNDATION_BINDING_MISMATCH", "Foundation identity or hash differs from the canonical projection.");
  }
  if (registration.approvalSubjectHash !== identity.approvalSubjectHash) throw new CppgPublicationError("APPROVAL_SUBJECT_MISMATCH", "Approval subject differs from the canonical projection.");
  if (registration.authorityId !== identity.authorityId) throw new CppgPublicationError("AUTHORITY_ID_MISMATCH", "Authority ID differs from the canonical projection.");
  if (registration.authoritySequence !== authoritySequence) throw new CppgPublicationError("REGISTRATION_NOT_CURRENT", "Registration authority sequence is stale.");
  if (registration.projectionSemanticHash !== projection.projectionSemanticHash) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Projection semantic hash differs from the canonical registration.");

  const binding: CppgCanonicalRegistrationBinding = {
    identity,
    currentness: { state: "CURRENT", authorityId: identity.authorityId, approvalSubjectHash: identity.approvalSubjectHash, authoritySequence },
    projection,
    registeredBy: "publication-identity-verification",
  };
  const recomputed = await computeCppgRegistrationSemanticIdentity(binding);
  if (registration.registrationSemanticIdentity !== recomputed) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Registration semantic identity does not match the canonical snapshot.");
}

async function validateProjectionRecordSnapshot(
  executor: PostgresTransactionExecutor,
  projectionSemanticHash: string,
  projection: CppgCourseTheoryDraftProjection,
): Promise<void> {
  const expected = expectedCppgRuntimeState(projection);
  const readback = await executor.query<{ recordId: string; recordKind: string; semanticHash: string }>(
    `SELECT "record_id" AS "recordId", "record_kind" AS "recordKind", "semantic_hash" AS "semanticHash"
     FROM public."cppg_runtime_projection_records"
     WHERE "projection_semantic_hash" = $1 ORDER BY "record_kind", "record_id"`,
    [projectionSemanticHash],
  );
  const records = [
    projection.course, projection.curriculumTree, ...projection.subjects, ...projection.curriculumNodes,
    ...projection.topics, ...projection.learningUnits, ...projection.contents, ...projection.lessons,
    ...projection.courseLessons, ...projection.contentRevisions,
  ];
  const expectedKindById = new Map(records.map((record) => [record.id, record.kind]));
  const actual = new Map(readback.rows.map((row) => [row.recordId, row]));
  if (actual.size !== expected.recordIds.length || expected.recordIds.some((id) => actual.get(id)?.semanticHash !== expected.semanticHashes[id] || actual.get(id)?.recordKind !== expectedKindById.get(id))) {
    throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Persisted projection records differ from the canonical registration.");
  }
}

const PROJECTION_TABLES = {
  COURSE: "courses", CURRICULUM_TREE: "curriculum_trees", SUBJECT: "subjects", CURRICULUM_NODE: "curriculum_nodes",
  TOPIC: "topics", LEARNING_UNIT: "learning_units", CONTENT: "contents", LESSON: "lessons",
  COURSE_LESSON: "course_lessons", CONTENT_REVISION: "content_revisions",
} as const;

const PUBLISHED_FIELDS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  COURSE: { active: 1, published: 1 }, CURRICULUM_TREE: { status: "ACTIVE" }, SUBJECT: { active: 1 },
  CURRICULUM_NODE: { status: "ACTIVE" }, TOPIC: { active: 1 }, LEARNING_UNIT: { active: 1, published: 1 },
  CONTENT: { status: "PUBLISHED" }, LESSON: { active: 1, published: 1 }, COURSE_LESSON: { status: "PUBLISHED" },
  CONTENT_REVISION: { revisionStatus: "published", isLatest: 1 },
};

async function validateLiveProjectionRows(
  executor: PostgresTransactionExecutor,
  projection: CppgCourseTheoryDraftProjection,
  published: boolean,
  persistedPayloads?: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
): Promise<void> {
  const records = [projection.course, projection.curriculumTree, ...projection.subjects, ...projection.curriculumNodes,
    ...projection.topics, ...projection.learningUnits, ...projection.contents, ...projection.lessons,
    ...projection.courseLessons, ...projection.contentRevisions];
  const storedPayloads = persistedPayloads ?? await loadPersistedProjectionPayloads(executor, projection.projectionSemanticHash);
  for (const record of records) {
    const table = PROJECTION_TABLES[record.kind];
    const expected = storedPayloads.get(record.id);
    if (!expected || String(expected.id) !== record.id) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Immutable registration projection payload is missing.");
    const result = await executor.query<{ row: unknown }>(
      `SELECT to_jsonb(target) AS "row" FROM public."${table}" AS target WHERE target.id = ANY($1::text[]) FOR UPDATE OF target`,
      [postgresTextArray([record.id])],
    );
    if (result.rows.length !== 1) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", `Registered ${record.kind} projection row is missing or duplicated.`);
    const actual = parseJsonObject(result.rows[0]!.row);
    for (const [field, approvedValue] of Object.entries(expected)) {
      const column = camelToSnake(field);
      const expectedValue = published ? PUBLISHED_FIELDS[record.kind]?.[field] ?? approvedValue : approvedValue;
      if (stableCanonicalJson(normalizeDbProjectionValue(actual[column])) !== stableCanonicalJson(normalizeDbProjectionValue(expectedValue))) {
        throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", `Live ${record.kind} projection field ${field} drifted from its immutable registration snapshot.`);
      }
    }
  }
}

async function loadPersistedProjectionPayloads(executor: PostgresTransactionExecutor, projectionHash: string): Promise<Map<string, Readonly<Record<string, unknown>>>> {
  const result = await executor.query<{ recordId: string; payload: unknown }>(
    `SELECT "record_id" AS "recordId", "payload_json" AS "payload" FROM public."cppg_runtime_projection_records" WHERE "projection_semantic_hash"=$1`,
    [projectionHash],
  );
  return new Map(result.rows.map((row) => [row.recordId, parseJsonObject(row.payload)]));
}

function parseJsonObject(value: unknown): Readonly<Record<string, unknown>> {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Persisted projection payload is malformed.");
  return parsed as Readonly<Record<string, unknown>>;
}

function camelToSnake(value: string): string { return value.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`); }
function normalizeDbProjectionValue(value: unknown): unknown {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return value.map(normalizeDbProjectionValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDbProjectionValue(item)]));
  return value;
}

async function loadReceipt(executor: PostgresTransactionExecutor, registrationSemanticIdentity: string): Promise<ReceiptRow | null> {
  const result = await executor.query<ReceiptRow>(
    `SELECT "publication_id" AS "publicationId", "registration_semantic_identity" AS "registrationSemanticIdentity",
            "course_id" AS "courseId", "package_key" AS "packageKey", "runtime_revision_id" AS "runtimeRevisionId",
            "content_revision_ids" AS "contentRevisionIds", "source_manifest_id" AS "sourceManifestId",
            "source_package_hash" AS "sourcePackageHash", "foundation_id" AS "foundationId",
            "foundation_hash" AS "foundationHash", "approval_subject_hash" AS "approvalSubjectHash",
            "authority_id" AS "authorityId", "authority_sequence" AS "authoritySequence",
            "publication_state" AS "publicationState", "publication_semantic_identity" AS "publicationSemanticIdentity",
            "published_by" AS "publishedBy"
     FROM public."cppg_publication_receipts"
     WHERE "registration_semantic_identity" = $1`,
    [registrationSemanticIdentity],
  );
  return result.rows[0] ?? null;
}

function receiptMatches(receipt: ReceiptRow, registration: RegistrationRow, revisions: readonly string[], publicationSemanticIdentity: string): boolean {
  return receipt.registrationSemanticIdentity === registration.registrationSemanticIdentity &&
    receipt.courseId === registration.courseId && receipt.packageKey === registration.packageKey &&
    receipt.runtimeRevisionId === registration.runtimeRevisionId && sameStringArray(parseStringArray(receipt.contentRevisionIds), revisions) &&
    receipt.sourceManifestId === registration.sourceManifestId && receipt.sourcePackageHash === registration.sourcePackageHash &&
    receipt.foundationId === registration.foundationId && receipt.foundationHash === registration.foundationHash &&
    receipt.approvalSubjectHash === registration.approvalSubjectHash && receipt.authorityId === registration.authorityId &&
    Number(receipt.authoritySequence) === Number(registration.authoritySequence) && receipt.publicationState === "PUBLISHED" &&
    receipt.publicationSemanticIdentity === publicationSemanticIdentity && typeof receipt.publishedBy === "string" && receipt.publishedBy.length > 0;
}

async function validateDraftVisibilityTarget(executor: PostgresTransactionExecutor, projection: CppgCourseTheoryDraftProjection, revisions: readonly string[]): Promise<void> {
  const revisionRows = await executor.query<{ id: string; contentId: string; revisionStatus: string; isLatest: number | boolean; semanticHash: string; createdAt: string }>(
    `SELECT id, content_id AS "contentId", revision_status AS "revisionStatus", is_latest AS "isLatest",
            semantic_hash AS "semanticHash", created_at AS "createdAt"
     FROM public.content_revisions WHERE id = ANY($1::text[]) FOR UPDATE`, [postgresTextArray(revisions)]);
  if (revisionRows.rows.length !== revisions.length) throw new CppgPublicationError("REVISION_MISMATCH", "A registered content revision is missing.");
  const expectedRevisionById = new Map(projection.contentRevisions.map((record) => [record.id, record.payload]));
  const contentIds = [...new Set(projection.contentRevisions.map((record) => String(record.payload.contentId)))];
  for (const row of revisionRows.rows) {
    const expected = expectedRevisionById.get(row.id);
    if (!expected || row.contentId !== expected.contentId || row.semanticHash !== expected.semanticHash || row.revisionStatus !== "draft" || isTruthyDatabaseBoolean(row.isLatest)) {
      throw new CppgPublicationError("REVISION_MISMATCH", "A registered content revision is stale, changed, or already published.");
    }
  }
  const laterRows = await executor.query<{ id: string }>(
    `SELECT later.id
     FROM public.content_revisions AS later
     JOIN public.content_revisions AS target ON target.content_id = later.content_id
     WHERE target.id = ANY($1::text[]) AND later.id <> target.id
       AND (later.is_latest = 1 OR later.created_at::timestamptz > target.created_at::timestamptz)`, [postgresTextArray(revisions)]);
  if (laterRows.rows.length > 0 || contentIds.length !== revisions.length) throw new CppgPublicationError("REVISION_MISMATCH", "A newer or duplicate content revision supersedes the registered publication target.");
}

async function applyCppgVisibilityWrites(executor: PostgresTransactionExecutor, projection: CppgCourseTheoryDraftProjection, revisions: readonly string[]): Promise<void> {
  const updates: readonly [string, string, readonly PostgresQueryValue[], number][] = [
    ["courses", `UPDATE public.courses SET active = 1, published = 1, updated_at = now()::text WHERE id = $1 AND slug = 'cppg' AND active = 0 AND published = 0 AND deleted_at IS NULL`, [projection.course.id], 1],
    ["curriculum_trees", `UPDATE public.curriculum_trees SET status = 'ACTIVE', updated_at = now()::text WHERE id = $1 AND course_id = $2 AND status = 'DRAFT'`, [projection.curriculumTree.id, CPPG_RUNTIME_COURSE_ID], 1],
    ["subjects", `UPDATE public.subjects SET active = 1, updated_at = now()::text WHERE id = ANY($1::text[]) AND course_id = $2 AND active = 0`, [postgresTextArray(projection.subjects.map((record) => record.id)), CPPG_RUNTIME_COURSE_ID], projection.subjects.length],
    ["curriculum_nodes", `UPDATE public.curriculum_nodes SET status = 'ACTIVE', updated_at = now()::text WHERE id = ANY($1::text[]) AND curriculum_tree_id = $2 AND status = 'INACTIVE'`, [postgresTextArray(projection.curriculumNodes.map((record) => record.id)), projection.curriculumTree.id], projection.curriculumNodes.length],
    ["topics", `UPDATE public.topics SET active = 1, updated_at = now()::text WHERE id = ANY($1::text[]) AND active = 0`, [postgresTextArray(projection.topics.map((record) => record.id))], projection.topics.length],
    ["learning_units", `UPDATE public.learning_units SET active = 1, published = 1, updated_at = now()::text WHERE id = ANY($1::text[]) AND course_id = $2 AND active = 0 AND published = 0`, [postgresTextArray(projection.learningUnits.map((record) => record.id)), CPPG_RUNTIME_COURSE_ID], projection.learningUnits.length],
    ["contents", `UPDATE public.contents SET status = 'PUBLISHED', updated_at = now()::text WHERE id = ANY($1::text[]) AND status = 'DRAFT' AND deleted_at IS NULL`, [postgresTextArray(projection.contents.map((record) => record.id))], projection.contents.length],
    ["lessons", `UPDATE public.lessons SET active = 1, published = 1, updated_at = now()::text WHERE id = ANY($1::text[]) AND course_id = $2 AND active = 0 AND published = 0 AND deleted_at IS NULL`, [postgresTextArray(projection.lessons.map((record) => record.id)), CPPG_RUNTIME_COURSE_ID], projection.lessons.length],
    ["course_lessons", `UPDATE public.course_lessons SET status = 'PUBLISHED', updated_at = now()::text WHERE id = ANY($1::text[]) AND course_id = $2 AND status = 'DRAFT' AND deleted_at IS NULL`, [postgresTextArray(projection.courseLessons.map((record) => record.id)), CPPG_RUNTIME_COURSE_ID], projection.courseLessons.length],
    ["content_revisions", `UPDATE public.content_revisions SET revision_status = 'published', is_latest = 1, published_at = now()::text, updated_at = now()::text WHERE id = ANY($1::text[]) AND revision_status = 'draft' AND is_latest = 0`, [postgresTextArray(revisions)], revisions.length],
  ];
  for (const [table, statement, parameters, expectedCount] of updates) {
    const result = await executor.query<Record<string, unknown>>(statement, parameters);
    if (result.rowCount !== expectedCount) throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", `Visibility update did not match the exact ${table} projection.`);
  }
}

async function assertVisibleState(executor: PostgresTransactionExecutor, projection: CppgCourseTheoryDraftProjection, revisions: readonly string[]): Promise<void> {
  const predicates: readonly [string, string, readonly PostgresQueryValue[], number][] = [
    ["courses", `SELECT count(*)::int AS count FROM public.courses WHERE id=$1 AND slug='cppg' AND active=1 AND published=1 AND deleted_at IS NULL`, [projection.course.id], 1],
    ["curriculum_trees", `SELECT count(*)::int AS count FROM public.curriculum_trees WHERE id=$1 AND status='ACTIVE'`, [projection.curriculumTree.id], 1],
    ["subjects", `SELECT count(*)::int AS count FROM public.subjects WHERE id = ANY($1::text[]) AND course_id=$2 AND active=1`, [postgresTextArray(projection.subjects.map((r) => r.id)), CPPG_RUNTIME_COURSE_ID], projection.subjects.length],
    ["curriculum_nodes", `SELECT count(*)::int AS count FROM public.curriculum_nodes WHERE id = ANY($1::text[]) AND status='ACTIVE'`, [postgresTextArray(projection.curriculumNodes.map((r) => r.id))], projection.curriculumNodes.length],
    ["topics", `SELECT count(*)::int AS count FROM public.topics WHERE id = ANY($1::text[]) AND active=1`, [postgresTextArray(projection.topics.map((r) => r.id))], projection.topics.length],
    ["learning_units", `SELECT count(*)::int AS count FROM public.learning_units WHERE id = ANY($1::text[]) AND course_id=$2 AND active=1 AND published=1`, [postgresTextArray(projection.learningUnits.map((r) => r.id)), CPPG_RUNTIME_COURSE_ID], projection.learningUnits.length],
    ["contents", `SELECT count(*)::int AS count FROM public.contents WHERE id = ANY($1::text[]) AND status='PUBLISHED' AND deleted_at IS NULL`, [postgresTextArray(projection.contents.map((r) => r.id))], projection.contents.length],
    ["lessons", `SELECT count(*)::int AS count FROM public.lessons WHERE id = ANY($1::text[]) AND course_id=$2 AND active=1 AND published=1 AND deleted_at IS NULL`, [postgresTextArray(projection.lessons.map((r) => r.id)), CPPG_RUNTIME_COURSE_ID], projection.lessons.length],
    ["course_lessons", `SELECT count(*)::int AS count FROM public.course_lessons WHERE id = ANY($1::text[]) AND course_id=$2 AND status='PUBLISHED' AND deleted_at IS NULL`, [postgresTextArray(projection.courseLessons.map((r) => r.id)), CPPG_RUNTIME_COURSE_ID], projection.courseLessons.length],
    ["content_revisions", `SELECT count(*)::int AS count FROM public.content_revisions WHERE id = ANY($1::text[]) AND revision_status='published' AND is_latest=1`, [postgresTextArray(revisions)], revisions.length],
  ];
  for (const [table, statement, parameters, expected] of predicates) {
    const result = await executor.query<{ count: number }>(statement, parameters);
    if (Number(result.rows[0]?.count) !== expected) throw new CppgPublicationError("PUBLICATION_POLICY_DENIED", `Final visibility readback failed for ${table}.`);
  }
}

async function appendReceipt(executor: PostgresTransactionExecutor, publicationId: string, registration: RegistrationRow, semanticIdentity: string, actorId: string): Promise<void> {
  const result = await executor.query<Record<string, unknown>>(
    `INSERT INTO public.cppg_publication_receipts
      (publication_id, registration_semantic_identity, course_id, package_key, runtime_revision_id,
       content_revision_ids, source_manifest_id, source_package_hash, foundation_id, foundation_hash,
       approval_subject_hash, authority_id, authority_sequence, publication_state,
       publication_semantic_identity, published_by)
     VALUES ($1,$2,$3,$4,$5,$6::text::jsonb,$7,$8,$9,$10,$11,$12,$13,'PUBLISHED',$14,$15)`,
    [publicationId, registration.registrationSemanticIdentity, registration.courseId, registration.packageKey,
      registration.runtimeRevisionId, JSON.stringify(parseStringArray(registration.contentRevisionIds)),
      registration.sourceManifestId, registration.sourcePackageHash, registration.foundationId,
      registration.foundationHash, registration.approvalSubjectHash, registration.authorityId,
      registration.authoritySequence, semanticIdentity, actorId],
  );
  if (result.rowCount !== 1) throw new CppgPublicationError("PUBLICATION_RECEIPT_CONFLICT", "Publication receipt append did not create exactly one row.");
}

async function insertAuditEvent(executor: PostgresTransactionExecutor, input: AuthorizeAndPublishCppgRegistrationInput, registration: RegistrationRow, publicationSemanticIdentity: string, result: "SUCCESS" | "DENIED" | "FAILURE", action: string, reasonCode?: string): Promise<void> {
  const metadata = sanitizeAuditMetadata(action, {
    registrationIdentity: registration.registrationSemanticIdentity,
    publicationIdentity: publicationSemanticIdentity,
    runtimeRevisionId: registration.runtimeRevisionId,
    authorityId: registration.authorityId,
    authoritySequence: registration.authoritySequence,
    reasonCode,
    result,
  });
  await executor.query(
    `INSERT INTO public.admin_audit_logs
      (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json)
     VALUES ($1,$2,$3,$4,'CPPG_PUBLICATION',$5,$6,$7,$8)`,
    [randomUUID(), input.actor.id, choosePrimaryActorRole(input.actor.roles), action, registration.registrationSemanticIdentity, result, input.requestId ?? null, JSON.stringify(metadata)],
  );
}

async function recordFailureAudit(owner: PostgresRuntimeAuthorityPersistence, input: AuthorizeAndPublishCppgRegistrationInput, failure: CppgPublicationError): Promise<void> {
  if (!input.actor?.id || !Array.isArray(input.actor.roles)) return;
  await owner.withRegistrationTransaction(async (_authorityOwner, executor) => {
    const action = "CPPG_CANONICAL_PUBLICATION_DENIED";
    const metadata = sanitizeAuditMetadata(action, {
      registrationIdentity: input.registrationSemanticIdentity,
      reasonCode: failure.code,
      result: "DENIED",
    });
    await executor.query(
      `INSERT INTO public.admin_audit_logs
        (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json)
       VALUES ($1,$2,$3,$4,'CPPG_PUBLICATION',$5,'DENIED',$6,$7)`,
      [randomUUID(), input.actor.id, choosePrimaryActorRole(input.actor.roles), action, input.registrationSemanticIdentity || "unknown", input.requestId ?? null, JSON.stringify(metadata)],
    );
  });
}

function resultFor(outcome: CppgPublicationResult["outcome"], receipt: ReceiptRow, registration: RegistrationRow): CppgPublicationResult {
  return {
    outcome,
    publicationId: receipt.publicationId,
    publicationSemanticIdentity: receipt.publicationSemanticIdentity,
    registrationSemanticIdentity: registration.registrationSemanticIdentity,
    runtimeRevisionId: registration.runtimeRevisionId,
    authorityId: registration.authorityId,
    authoritySequence: Number(registration.authoritySequence),
  };
}

function parseStringArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new CppgPublicationError("REGISTRATION_BINDING_MISMATCH", "Persisted revision identity is malformed.");
  return parsed;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function postgresTextArray(values: readonly string[]): PostgresQueryValue {
  // postgres-js encodes native arrays as PostgreSQL text arrays; its JSONB
  // encoder treats JSON.stringify(string[]) as one JSON string scalar.
  return [...values] as unknown as PostgresQueryValue;
}

function isTruthyDatabaseBoolean(value: number | boolean): boolean {
  return value === true || value === 1;
}

function toPublicationError(error: unknown): CppgPublicationError {
  if (error instanceof CppgPublicationError) return error;
  if (error instanceof AppError && error.code === "ADMIN_FORBIDDEN") return new CppgPublicationError("ACTOR_UNAUTHORIZED", "A catalog manager role is required for CPPG publication.", 403);
  if (error instanceof Error && "code" in error && typeof (error as Error & { code?: unknown }).code === "string") {
    const code = (error as Error & { code: string }).code;
    if (code === "CPPG_SOURCE_REVALIDATION_BLOCKED" || code === "CPPG_CANONICAL_VALIDATOR_UNAVAILABLE") {
      return new CppgPublicationError("SOURCE_BINDING_MISMATCH", "Canonical CPPG source package could not be revalidated.", 409, error);
    }
    if (code === "CPPG_CANONICAL_IDENTITY_MISMATCH") {
      return new CppgPublicationError("FOUNDATION_BINDING_MISMATCH", "Canonical CPPG Foundation identity could not be verified.", 409, error);
    }
    if (["REGISTRATION_NOT_FOUND", "REGISTRATION_NOT_CURRENT", "REGISTRATION_BINDING_MISMATCH", "AUTHORITY_NOT_FOUND", "AUTHORITY_REVOKED", "AUTHORITY_SUPERSEDED", "AUTHORITY_ID_MISMATCH", "APPROVAL_SUBJECT_MISMATCH", "SOURCE_BINDING_MISMATCH", "FOUNDATION_BINDING_MISMATCH", "REVISION_MISMATCH", "PUBLICATION_POLICY_DENIED", "PUBLICATION_RECEIPT_CONFLICT", "ACTOR_UNAUTHORIZED"].includes(code)) {
      return new CppgPublicationError(code as CppgPublicationFailureCode, "CPPG publication authorization failed.");
    }
  }
  return new CppgPublicationError("PUBLICATION_PERSISTENCE_FAILURE", "CPPG publication transaction failed.", 503, error);
}
