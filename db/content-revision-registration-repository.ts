import { AppError } from "../lib/errors.ts";
import type { DatabaseProvider, DatabaseTransaction } from "./provider/database-provider.ts";
import {
  buildRegistrationIdentities,
  CONTENT_REVISION_REGISTRATION_V1,
  OWNER_ATTESTATION_REQUIRED,
  REGISTERED_REVIEW_PENDING,
  REVIEW_REQUIRED,
  type ContentRevisionRegistrationInput,
  type RegistrationSubjectInput,
} from "../lib/services/content-revision-registration.ts";

type Row = Record<string, unknown>;
export type RegistrationReadback = Readonly<{
  id: string;
  contractVersion: string;
  resourceType: string;
  qualificationId: string;
  packageKey: string;
  packageSemanticIdentity: string;
  provenanceAggregateIdentity: string;
  registrationSemanticIdentity: string;
  state: string;
  createdBy: string;
  auditLogId: string;
  audit: Readonly<{
    actorUserId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    result: string;
    metadataJson: string;
  }>;
  subjects: readonly Readonly<{
    id: string;
    contentRevisionId: string;
    semanticRevisionId: string;
    contentHash: string;
    provenanceIdentity: string;
    sourceLineage: string;
    rightsState: string;
    originalityState: string;
    currentnessState: string;
    responsibleOwnerState: string;
    canonicalContentId: string;
    canonicalContentHash: string;
    canonicalSnapshotJson: string;
    canonicalCourseId: string | null;
    canonicalRevisionStatus: string;
    sources: readonly Readonly<{
      sourceIdentityId: string;
      canonicalKey: string;
      sourceType: string;
      normalizedIdentity: string;
      lifecycleState: string;
      bindingRole: string;
      locator: string;
      expressionReuse: string;
    }>[];
  }>[];
}>;

export async function persistContentRevisionRegistration(
  database: DatabaseProvider,
  input: ContentRevisionRegistrationInput,
): Promise<{ outcome: "NEW_SUCCESS" | "EXACT_REPLAY"; registration: RegistrationReadback }> {
  validateInput(input);
  const identities = await buildRegistrationIdentities(input);
  if (!database.transactional) throw new AppError("Transaction-scoped readback is required.", 503, "TRANSACTION_SCOPED_READBACK_UNAVAILABLE");
  const operation = async (transaction: DatabaseTransaction): Promise<{ outcome: "NEW_SUCCESS" | "EXACT_REPLAY"; registration: RegistrationReadback }> => {
    await revalidateCanonicalAuthority(transaction, input);
    const existing = await transaction.queryOne<Row>({ sql: "SELECT id FROM content_revision_registrations WHERE registration_contract_version = ? AND registration_semantic_identity = ? LIMIT 1", parameters: [CONTENT_REVISION_REGISTRATION_V1, identities.registrationSemanticIdentity] });
    if (existing) {
      const readback = await readContentRevisionRegistration(transaction, required(existing.id, "registration id"));
      assertReadbackMatches(readback, input, identities);
      return { outcome: "EXACT_REPLAY", registration: readback };
    }
    if (input.idempotencyKey) {
      const idempotent = await transaction.queryOne<Row>({ sql: "SELECT id, registration_semantic_identity FROM content_revision_registrations WHERE idempotency_key = ? LIMIT 1", parameters: [input.idempotencyKey] });
      if (idempotent && idempotent.registration_semantic_identity !== identities.registrationSemanticIdentity) throw new AppError("Idempotency key conflicts with registration semantics.", 409, "REGISTRATION_IDEMPOTENCY_CONFLICT");
    }
    const registrationId = crypto.randomUUID();
    const auditLogId = crypto.randomUUID();
    const now = new Date().toISOString();
    const auditMetadata = JSON.stringify({ contractVersion: CONTENT_REVISION_REGISTRATION_V1, registrationSemanticIdentity: identities.registrationSemanticIdentity, packageKey: input.packageKey, subjectIds: input.subjects.map((subject) => subject.semanticRevisionId).sort() });
    await transaction.execute({ sql: `INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, metadata_json, created_at) VALUES (?, ?, 'SERVER_REGISTRATION', 'CONTENT_REVISION_REGISTRATION_CREATED', 'CONTENT_REVISION_REGISTRATION', ?, 'SUCCESS', ?, ?)`, parameters: [auditLogId, input.actorUserId, registrationId, auditMetadata, now] });
    const subjectIds = new Map<string, string>();
    for (const subject of [...input.subjects].sort((a, b) => a.semanticRevisionId.localeCompare(b.semanticRevisionId))) {
      const revision = await findOrCreateRevision(transaction, subject, input, now);
      subjectIds.set(subject.semanticRevisionId, revision.id);
    }
    await transaction.execute({ sql: `INSERT INTO content_revision_registrations (id, registration_contract_version, resource_type, qualification_id, package_key, package_semantic_identity, provenance_aggregate_identity, registration_semantic_identity, state, idempotency_key, created_by, audit_log_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, parameters: [registrationId, CONTENT_REVISION_REGISTRATION_V1, input.resourceType, input.qualificationId, input.packageKey, identities.packageSemanticIdentity, identities.provenanceAggregateIdentity, identities.registrationSemanticIdentity, REGISTERED_REVIEW_PENDING, input.idempotencyKey ?? null, input.actorUserId, auditLogId, now] });
    for (const subject of input.subjects) {
      const subjectRowId = crypto.randomUUID();
      await transaction.execute({ sql: `INSERT INTO content_revision_registration_subjects (id, registration_id, content_revision_id, semantic_revision_id, content_hash, provenance_identity, source_lineage, rights_state, originality_state, currentness_state, responsible_owner_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, parameters: [subjectRowId, registrationId, required(subjectIds.get(subject.semanticRevisionId), "revision id"), subject.semanticRevisionId, subject.contentHash, identities.subjectProvenanceIdentities[subject.semanticRevisionId], subject.sourceLineage, REVIEW_REQUIRED, REVIEW_REQUIRED, REVIEW_REQUIRED, OWNER_ATTESTATION_REQUIRED, now] });
      for (const source of subject.sourceBindings) await transaction.execute({ sql: `INSERT INTO content_revision_registration_sources (id, registration_subject_id, source_identity_id, binding_role, locator, expression_reuse, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, parameters: [crypto.randomUUID(), subjectRowId, source.sourceIdentityId, source.bindingRole, source.locator, source.expressionReuse, now] });
    }
    const registration = await readContentRevisionRegistration(transaction, registrationId);
    assertReadbackMatches(registration, input, identities);
    return { outcome: "NEW_SUCCESS", registration };
  };
  try { return await database.transactional(operation); }
  catch (error) {
    const replay = await database.queryOne<Row>({ sql: "SELECT id FROM content_revision_registrations WHERE registration_contract_version = ? AND registration_semantic_identity = ? LIMIT 1", parameters: [CONTENT_REVISION_REGISTRATION_V1, identities.registrationSemanticIdentity] });
    if (!replay || !database.transactional) throw error;
    return database.transactional(async (transaction) => { const readback = await readContentRevisionRegistration(transaction, required(replay.id, "registration id")); assertReadbackMatches(readback, input, identities); return { outcome: "EXACT_REPLAY", registration: readback }; });
  }
}

export async function readContentRevisionRegistration(database: Pick<DatabaseProvider, "query" | "queryOne" | "execute">, registrationId: string): Promise<RegistrationReadback> {
  const parent = await database.queryOne<Row>({ sql: `SELECT id, registration_contract_version, resource_type, qualification_id, package_key, package_semantic_identity, provenance_aggregate_identity, registration_semantic_identity, state, created_by, audit_log_id FROM content_revision_registrations WHERE id = ? LIMIT 1`, parameters: [registrationId] });
  if (!parent) throw new AppError("Registration aggregate was not found.", 404, "REGISTRATION_NOT_FOUND");
  const subjects = await database.query<Row>({ sql: `SELECT r.id, r.content_revision_id, r.semantic_revision_id, r.content_hash, r.provenance_identity, r.source_lineage, r.rights_state, r.originality_state, r.currentness_state, r.responsible_owner_state, c.content_id AS canonical_content_id, c.semantic_hash AS canonical_content_hash, c.snapshot_json AS canonical_snapshot_json, c.course_id AS canonical_course_id, c.revision_status AS canonical_revision_status FROM content_revision_registration_subjects r JOIN content_revisions c ON c.id = r.content_revision_id WHERE r.registration_id = ? ORDER BY r.semantic_revision_id`, parameters: [registrationId] });
  const sources = await database.query<Row>({ sql: `SELECT s.registration_subject_id, s.source_identity_id, s.binding_role, s.locator, s.expression_reuse, i.canonical_key, i.source_type, i.normalized_identity, i.lifecycle_state FROM content_revision_registration_sources s JOIN source_identities i ON i.id = s.source_identity_id JOIN content_revision_registration_subjects r ON r.id = s.registration_subject_id WHERE r.registration_id = ? ORDER BY s.registration_subject_id, s.source_identity_id, s.locator`, parameters: [registrationId] });
  const audit = await database.queryOne<Row>({ sql: `SELECT actor_user_id, actor_role, action, resource_type, resource_id, result, metadata_json FROM admin_audit_logs WHERE id = ? LIMIT 1`, parameters: [required(parent.audit_log_id, "audit id")] });
  if (!audit) throw new AppError("Registration audit row was not found.", 409, "REGISTRATION_AUDIT_READBACK_FAILURE");
  const sourceMap = new Map<string, Array<RegistrationReadback["subjects"][number]["sources"][number]>>();
  for (const row of sources.rows) {
    const key = required(row.registration_subject_id, "source subject");
    const list = sourceMap.get(key) ?? [];
    list.push({ sourceIdentityId: required(row.source_identity_id, "source id"), canonicalKey: required(row.canonical_key, "canonical key"), sourceType: required(row.source_type, "source type"), normalizedIdentity: required(row.normalized_identity, "normalized identity"), lifecycleState: required(row.lifecycle_state, "source lifecycle"), bindingRole: required(row.binding_role, "binding role"), locator: required(row.locator, "locator"), expressionReuse: required(row.expression_reuse, "expression reuse") });
    sourceMap.set(key, list);
  }
  return { id: required(parent.id, "id"), contractVersion: required(parent.registration_contract_version, "contract"), resourceType: required(parent.resource_type, "resource type"), qualificationId: required(parent.qualification_id, "qualification"), packageKey: required(parent.package_key, "package key"), packageSemanticIdentity: required(parent.package_semantic_identity, "package identity"), provenanceAggregateIdentity: required(parent.provenance_aggregate_identity, "provenance identity"), registrationSemanticIdentity: required(parent.registration_semantic_identity, "registration identity"), state: required(parent.state, "state"), createdBy: required(parent.created_by, "created by"), auditLogId: required(parent.audit_log_id, "audit id"), audit: { actorUserId: required(audit.actor_user_id, "audit actor"), actorRole: required(audit.actor_role, "audit role"), action: required(audit.action, "audit action"), resourceType: required(audit.resource_type, "audit resource type"), resourceId: required(audit.resource_id, "audit resource id"), result: required(audit.result, "audit result"), metadataJson: required(audit.metadata_json, "audit metadata") }, subjects: subjects.rows.map((row) => ({ id: required(row.id, "subject id"), contentRevisionId: required(row.content_revision_id, "revision id"), semanticRevisionId: required(row.semantic_revision_id, "semantic revision id"), contentHash: required(row.content_hash, "content hash"), provenanceIdentity: required(row.provenance_identity, "subject provenance"), sourceLineage: required(row.source_lineage, "lineage"), rightsState: required(row.rights_state, "rights"), originalityState: required(row.originality_state, "originality"), currentnessState: required(row.currentness_state, "currentness"), responsibleOwnerState: required(row.responsible_owner_state, "owner"), canonicalContentId: required(row.canonical_content_id, "canonical content id"), canonicalContentHash: required(row.canonical_content_hash, "canonical content hash"), canonicalSnapshotJson: required(row.canonical_snapshot_json, "canonical snapshot"), canonicalCourseId: row.canonical_course_id === null ? null : required(row.canonical_course_id, "canonical course"), canonicalRevisionStatus: required(row.canonical_revision_status, "canonical revision status"), sources: sourceMap.get(required(row.id, "subject id")) ?? [] })) };
}

async function revalidateCanonicalAuthority(database: DatabaseTransaction, input: ContentRevisionRegistrationInput) {
  await revalidateCanonicalQualification(database, input.qualificationId);
  const subjects = [...input.subjects].sort((a, b) => a.semanticRevisionId.localeCompare(b.semanticRevisionId));
  for (const subject of subjects) await revalidateCanonicalRevision(database, subject, input.qualificationId);
  const sources = subjects.flatMap((subject) => subject.sourceBindings).sort((a, b) => sourceBindingLockKey(a).localeCompare(sourceBindingLockKey(b)));
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.sourceIdentityId)) continue;
    seen.add(source.sourceIdentityId);
    await revalidateCanonicalSource(database, source);
  }
}

async function revalidateCanonicalQualification(database: DatabaseTransaction, qualificationId: string) {
  const row = await database.queryOne<Row>({ sql: "SELECT id, active, deleted_at FROM courses WHERE id = ? FOR SHARE", parameters: [qualificationId] });
  if (!row || row.id !== qualificationId || !isTrue(row.active) || row.deleted_at !== null) throw new AppError("Canonical qualification changed or is unavailable.", 409, "REGISTRATION_QUALIFICATION_STALE");
}

async function revalidateCanonicalRevision(database: DatabaseTransaction, subject: RegistrationSubjectInput, qualificationId: string) {
  const rows = await database.query<Row>({ sql: "SELECT id, content_id, course_id, revision_status, snapshot_json, semantic_hash FROM content_revisions WHERE content_type = ? AND content_id = ? AND version = ? FOR SHARE", parameters: [subject.contentType, subject.contentId, subject.version] });
  if (rows.rows.length > 1) throw new AppError("Multiple canonical revisions matched one semantic revision.", 409, "REGISTRATION_REVISION_AMBIGUOUS");
  if (rows.rows.length === 1) {
    const row = rows.rows[0];
    if (row.content_id !== subject.contentId || row.semantic_hash !== subject.contentHash || row.snapshot_json !== subject.snapshotJson || row.course_id !== qualificationId || row.revision_status !== "review") throw new AppError("Canonical revision drift conflicts with registration.", 409, "REGISTRATION_REVISION_CONFLICT");
  }
}

async function revalidateCanonicalSource(database: DatabaseTransaction, source: RegistrationSubjectInput["sourceBindings"][number]) {
  const row = await database.queryOne<Row>({ sql: "SELECT id, canonical_key, source_type, normalized_identity, lifecycle_state FROM source_identities WHERE id = ? FOR SHARE", parameters: [source.sourceIdentityId] });
  if (!row || row.id !== source.sourceIdentityId || row.canonical_key !== source.canonicalKey || row.source_type !== source.sourceType || row.normalized_identity !== source.normalizedIdentity || row.lifecycle_state !== "ACTIVE") throw new AppError("Canonical source identity changed or is inactive.", 409, "REGISTRATION_SOURCE_STALE");
}

function validateInput(input: ContentRevisionRegistrationInput) {
  if (!input.actorUserId || !input.qualificationId || !input.packageKey || !input.resourceType || input.subjects.length === 0) throw new AppError("Registration input is incomplete.", 400, "REGISTRATION_INPUT_INVALID");
  const ids = new Set(input.subjects.map((subject) => subject.semanticRevisionId));
  if (ids.size !== input.subjects.length) throw new AppError("Registration contains duplicate subjects.", 409, "REGISTRATION_DUPLICATE_SUBJECT");
  if (input.subjects.some((subject) => subject.rightsState !== REVIEW_REQUIRED || subject.originalityState !== REVIEW_REQUIRED || subject.currentnessState !== REVIEW_REQUIRED || subject.responsibleOwnerState !== OWNER_ATTESTATION_REQUIRED)) throw new AppError("Registration review states are not writable by this service.", 409, "REGISTRATION_REVIEW_STATE_FORBIDDEN");
}

async function findOrCreateRevision(database: DatabaseTransaction, subject: RegistrationSubjectInput, input: ContentRevisionRegistrationInput, now: string) {
  const existing = await database.query<Row>({ sql: `SELECT id, content_id, content_type, version, course_id, revision_status, snapshot_json, semantic_hash FROM content_revisions WHERE content_type = ? AND content_id = ? AND version = ? FOR SHARE`, parameters: [subject.contentType, subject.contentId, subject.version] });
  if (existing.rows.length > 1) throw new AppError("Multiple canonical revisions matched one semantic revision.", 409, "REGISTRATION_REVISION_AMBIGUOUS");
  if (existing.rows.length === 1) {
    const row = existing.rows[0];
    if (row.semantic_hash !== subject.contentHash || row.snapshot_json !== subject.snapshotJson || row.course_id !== input.qualificationId || row.revision_status !== "review") throw new AppError("Canonical revision drift conflicts with registration.", 409, "REGISTRATION_REVISION_CONFLICT");
    return { id: required(row.id, "revision id") };
  }
  const id = crypto.randomUUID();
  await database.execute({ sql: `INSERT INTO content_revisions (id, content_type, content_id, course_id, title, content_date, version, revision_status, snapshot_json, change_summary, is_latest, created_by, semantic_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'review', ?, ?, 0, ?, ?, ?, ?)`, parameters: [id, subject.contentType, subject.contentId, input.qualificationId, subject.semanticRevisionId, now.slice(0, 10), subject.version, subject.snapshotJson, "CONTENT_REVISION_REGISTRATION_V1", input.actorUserId, subject.contentHash, now, now] });
  return { id };
}

export function assertReadbackMatches(readback: RegistrationReadback, input: ContentRevisionRegistrationInput, identities: Awaited<ReturnType<typeof buildRegistrationIdentities>>) {
  if (readback.contractVersion !== CONTENT_REVISION_REGISTRATION_V1 || readback.state !== REGISTERED_REVIEW_PENDING || readback.createdBy !== input.actorUserId || readback.qualificationId !== input.qualificationId || readback.packageKey !== input.packageKey || readback.packageSemanticIdentity !== identities.packageSemanticIdentity || readback.provenanceAggregateIdentity !== identities.provenanceAggregateIdentity || readback.registrationSemanticIdentity !== identities.registrationSemanticIdentity) throw new AppError("Registration readback identity mismatch.", 409, "REGISTRATION_READBACK_INTEGRITY_FAILURE");
  const auditMetadata = parseAuditMetadata(readback.audit.metadataJson);
  if (readback.audit.actorUserId !== input.actorUserId || readback.audit.actorRole !== "SERVER_REGISTRATION" || readback.audit.action !== "CONTENT_REVISION_REGISTRATION_CREATED" || readback.audit.resourceType !== "CONTENT_REVISION_REGISTRATION" || readback.audit.resourceId !== readback.id || readback.audit.result !== "SUCCESS" || auditMetadata.contractVersion !== CONTENT_REVISION_REGISTRATION_V1 || auditMetadata.registrationSemanticIdentity !== identities.registrationSemanticIdentity || auditMetadata.packageKey !== input.packageKey || JSON.stringify(auditMetadata.subjectIds) !== JSON.stringify(input.subjects.map((subject) => subject.semanticRevisionId).sort())) throw new AppError("Registration audit readback mismatch.", 409, "REGISTRATION_AUDIT_READBACK_FAILURE");
  if (readback.subjects.length !== input.subjects.length) throw new AppError("Registration readback subject cardinality mismatch.", 409, "REGISTRATION_READBACK_INTEGRITY_FAILURE");
  for (const subject of input.subjects) {
    const stored = readback.subjects.find((candidate) => candidate.semanticRevisionId === subject.semanticRevisionId);
    if (!stored || stored.contentHash !== subject.contentHash || stored.canonicalContentHash !== subject.contentHash || stored.canonicalContentId !== subject.contentId || stored.canonicalCourseId !== input.qualificationId || stored.canonicalSnapshotJson !== subject.snapshotJson || stored.canonicalRevisionStatus !== "review" || stored.provenanceIdentity !== identities.subjectProvenanceIdentities[subject.semanticRevisionId] || stored.sourceLineage !== subject.sourceLineage || stored.rightsState !== REVIEW_REQUIRED || stored.originalityState !== REVIEW_REQUIRED || stored.currentnessState !== REVIEW_REQUIRED || stored.responsibleOwnerState !== OWNER_ATTESTATION_REQUIRED) throw new AppError("Registration subject readback mismatch.", 409, "REGISTRATION_READBACK_INTEGRITY_FAILURE");
    const expectedSources = subject.sourceBindings.map((source) => sourceKey(source)).sort();
    const actualSources = stored.sources.map((source) => sourceKey(source)).sort();
    if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources) || stored.sources.some((source) => source.lifecycleState !== "ACTIVE")) throw new AppError("Registration source readback mismatch.", 409, "REGISTRATION_READBACK_INTEGRITY_FAILURE");
  }
}

function sourceKey(source: { sourceIdentityId: string; canonicalKey: string; sourceType: string; normalizedIdentity: string; lifecycleState: string; bindingRole: string; locator: string; expressionReuse: string }) {
  return [source.sourceIdentityId, source.canonicalKey, source.sourceType, source.normalizedIdentity, source.lifecycleState, source.bindingRole, source.locator, source.expressionReuse].join("\u0000");
}

function sourceBindingLockKey(source: RegistrationSubjectInput["sourceBindings"][number]) {
  return [source.sourceIdentityId, source.canonicalKey, source.sourceType, source.normalizedIdentity].join("\u0000");
}

function parseAuditMetadata(value: string): { contractVersion: string; registrationSemanticIdentity: string; packageKey: string; subjectIds: string[] } {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!Array.isArray(parsed.subjectIds) || parsed.subjectIds.some((id) => typeof id !== "string")) throw new Error("invalid subject ids");
    return { contractVersion: required(parsed.contractVersion, "audit contract"), registrationSemanticIdentity: required(parsed.registrationSemanticIdentity, "audit registration identity"), packageKey: required(parsed.packageKey, "audit package key"), subjectIds: parsed.subjectIds as string[] };
  } catch { throw new AppError("Registration audit metadata is invalid.", 409, "REGISTRATION_AUDIT_READBACK_FAILURE"); }
}

function isTrue(value: unknown) { return value === true || value === 1 || value === "1"; }

function required(value: unknown, label: string): string { if (typeof value !== "string" || value.trim() === "") throw new AppError(`Invalid ${label}.`, 409, "REGISTRATION_READBACK_INTEGRITY_FAILURE"); return value; }
