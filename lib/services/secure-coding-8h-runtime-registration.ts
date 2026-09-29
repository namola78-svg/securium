import { randomUUID } from "node:crypto";
import { AppError } from "../errors.ts";
import bindingCandidateArtifact from "../../content-drafts/secure-coding-8h-foundation/runtime-registration-binding-candidate-v1.json" with { type: "json" };
import {
  COURSE_THEORY_DRAFT,
  NOT_GRANTED,
  RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
  approvalSubjectHash,
  assertRuntimeAuthorityGate,
  type RuntimeAuthoritySubject,
} from "../policy/runtime-authority-binding.ts";
import { sha256Canonical } from "../policy/stable-canonical-hash.ts";
import {
  persistenceRecordsToCanonicalEvents,
  type RuntimeAuthorityPersistenceTransactionOwner,
} from "../policy/runtime-authority-persistence-contract.ts";
import {
  replayAuthorityLedger,
  type AuthorityReference,
  type AuthorityReplayContext,
} from "../policy/runtime-authority-event-ledger.ts";
import { PostgresRuntimeAuthorityPersistence } from "../../db/runtime-authority-postgres-persistence.ts";
import type { PostgresTransactionExecutor } from "../../db/provider/postgres-database-provider.ts";
import { preflightSecureCoding8HQuestionMaterialization } from "./secure-coding-8h-question-materialization-contract.ts";
import { loadSecureCoding8HRuntimeModel } from "./secure-coding-8h-runtime-adapter.ts";
const bindingCandidate = bindingCandidateArtifact as RuntimeRegistrationBindingCandidate;
const AUTHORITY_ID_PREFIX = "runtime-authority-python8h-";

export const SECURE_CODING_8H_REGISTRATION = Object.freeze({
  courseId: bindingCandidate.courseId,
  courseSlug: bindingCandidate.slug,
  courseGroupId: "group-independent",
  courseCode: "SECURE_CODING_8H",
  courseName: "Securium Developer Secure Coding 8H",
  courseShortName: "SC8H",
  packageKey: bindingCandidate.packageKey,
  foundationId: bindingCandidate.foundationId,
  questionCount: bindingCandidate.expectedCounts.questions,
  choiceCount: bindingCandidate.expectedCounts.choices,
  versionCount: bindingCandidate.expectedCounts.versions,
  mappingCount: bindingCandidate.expectedCounts.mappings,
});

type RuntimeRegistrationBindingCandidate = Readonly<{
  schemaVersion: "SECURIUM_PYTHON_8H_RUNTIME_REGISTRATION_BINDING_CANDIDATE_V1";
  candidateStatus: "CANONICAL_SOURCE_CONTENT_CANDIDATE_NOT_APPROVAL";
  courseId: string;
  slug: string;
  packageKey: string;
  selectedPackageIds: readonly string[];
  sourceManifestId: string;
  combinedSourcePackageHash: string;
  foundationId: string;
  foundationHash: string;
  materializationHash: string;
  revisionBindingHash: string;
  runtimeRevisionId: string;
  approvalSubjectHash: string;
  authorityId: string;
  expectedCounts: Readonly<{ questions: number; choices: number; versions: number; mappings: number }>;
  q36VersionIdentity: Readonly<{ foundationQuestionId: string; runtimeQuestionId: string; runtimeQuestionVersionId: string; version: number; sourceRevisionId: string; sourceRevisionVersion: string }>;
  contentReview: Readonly<{ answerIndexes: Readonly<Record<string, number>>; claims: Readonly<Record<string, string>>; unsupportedQuestionCount: number; contentConflictCount: number }>;
  rightsState: Readonly<{ actual: Readonly<{ realKisaEvidenceAttached: boolean; productionRightsGate: string; actualApprovalAllowed: string }>; simulation: Readonly<{ productionEvidence: false; productionAuthorization: false; use: "NON_PRODUCTION_READINESS_ONLY" }> }>;
  runtimeApproval: "NOT_ISSUED";
}>;

type Projection = Awaited<ReturnType<typeof preflightSecureCoding8HQuestionMaterialization>>;
export type SecureCoding8HRegistrationBinding = Readonly<{
  candidate: RuntimeRegistrationBindingCandidate;
  subject: RuntimeAuthoritySubject;
  authorityId: string;
  approvalSubjectHash: string;
  authoritySequence: number;
  projection: Projection;
}>;

type Ledger = Readonly<{
  state: "NONE" | "APPROVED_ACTIVE" | "SUPERSEDED" | "REVOKED";
  subject: RuntimeAuthoritySubject | null;
  approvalSubjectHash: string | null;
  authoritySequence: number;
}>;

/** A single server-derived projection. Caller data is limited to an actor ID. */
export async function buildSecureCoding8HRegistrationProjection(): Promise<Projection> {
  assertCandidateRightsBoundary(bindingCandidate);
  const projection = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: {
      sourceRevisionId: bindingCandidate.q36VersionIdentity.sourceRevisionId,
      sourceRevisionVersion: bindingCandidate.q36VersionIdentity.sourceRevisionVersion,
      questionVersionOverrides: { Q36: bindingCandidate.q36VersionIdentity.version },
    },
  });
  if (
    projection.courseId !== SECURE_CODING_8H_REGISTRATION.courseId ||
    projection.courseSlug !== SECURE_CODING_8H_REGISTRATION.courseSlug ||
    projection.counts.questions !== bindingCandidate.expectedCounts.questions ||
    projection.counts.choices !== bindingCandidate.expectedCounts.choices ||
    projection.counts.versions !== bindingCandidate.expectedCounts.versions ||
    projection.counts.courseBindings !== bindingCandidate.expectedCounts.mappings ||
    projection.questionRows.length !== bindingCandidate.expectedCounts.questions ||
    projection.choiceRows.length !== bindingCandidate.expectedCounts.choices ||
    projection.versionRows.length !== bindingCandidate.expectedCounts.versions ||
    projection.courseBindingRows.length !== bindingCandidate.expectedCounts.mappings
  ) {
    throw new AppError("Python 8H canonical projection counts are invalid.", 409, "PYTHON_8H_PROJECTION_COUNTS_INVALID");
  }
  assertProjectionMatchesCandidate(projection, bindingCandidate);
  return projection;
}

export async function deriveSecureCoding8HRegistrationBinding(projection: Projection): Promise<Omit<SecureCoding8HRegistrationBinding, "authoritySequence">> {
  const candidate = bindingCandidate;
  assertCandidateRightsBoundary(candidate);
  assertProjectionMatchesCandidate(projection, candidate);
  const foundationModel = loadSecureCoding8HRuntimeModel({
    runtimeCourse: {
      id: candidate.courseId,
      slug: candidate.slug,
      active: false,
      published: false,
      deletedAt: null,
    },
    exposure: "registration",
  });
  const actualFoundationHash = await sha256Canonical(foundationModel.foundation);
  if (actualFoundationHash !== candidate.foundationHash) throw new AppError("Python 8H Foundation differs from the canonical binding export.", 409, "PYTHON_8H_FOUNDATION_BINDING_MISMATCH");
  const subject: RuntimeAuthoritySubject = Object.freeze({
    contractVersion: RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
    registrationPurpose: COURSE_THEORY_DRAFT,
    courseId: candidate.courseId,
    courseSlug: candidate.slug,
    packageKey: candidate.packageKey,
    sourceManifestId: candidate.sourceManifestId,
    sourcePackageHash: candidate.combinedSourcePackageHash,
    foundationId: candidate.foundationId,
    foundationHash: candidate.foundationHash,
    runtimeRevisionId: candidate.runtimeRevisionId,
    semanticHash: candidate.materializationHash,
    publicationAuthority: NOT_GRANTED,
  });
  const hash = approvalSubjectHash(subject);
  if (hash !== candidate.approvalSubjectHash || `${AUTHORITY_ID_PREFIX}${hash}` !== candidate.authorityId) {
    throw new AppError("Python 8H Runtime Authority subject differs from the canonical binding export.", 409, "PYTHON_8H_AUTHORITY_BINDING_MISMATCH");
  }
  return Object.freeze({
    candidate,
    subject,
    authorityId: candidate.authorityId,
    approvalSubjectHash: hash,
    projection,
  });
}

function assertCandidateRightsBoundary(candidate: RuntimeRegistrationBindingCandidate): void {
  const expectedPackages = [
    "SECURIUM_PYTHON_8H_SOURCE_PACKAGE_A_V1",
    "SECURIUM_PYTHON_8H_SOURCE_PACKAGE_B_V1",
    "SECURIUM_PYTHON_8H_SOURCE_PACKAGE_C_V2",
  ];
  if (
    candidate.schemaVersion !== "SECURIUM_PYTHON_8H_RUNTIME_REGISTRATION_BINDING_CANDIDATE_V1" ||
    candidate.candidateStatus !== "CANONICAL_SOURCE_CONTENT_CANDIDATE_NOT_APPROVAL" ||
    JSON.stringify(candidate.selectedPackageIds) !== JSON.stringify(expectedPackages) ||
    candidate.contentReview.answerIndexes.Q18 !== 1 || candidate.contentReview.answerIndexes.Q29 !== 2 ||
    candidate.contentReview.answerIndexes.Q30 !== 1 || candidate.contentReview.answerIndexes.Q37 !== 3 ||
    candidate.contentReview.claims.Q03 !== "DERIVED_BUT_TRACEABLE" ||
    candidate.contentReview.claims.Q38 !== "PEDAGOGICAL_SYNTHESIS" ||
    candidate.contentReview.claims.Q40 !== "PEDAGOGICAL_SYNTHESIS" ||
    candidate.contentReview.unsupportedQuestionCount !== 0 || candidate.contentReview.contentConflictCount !== 0 ||
    candidate.rightsState.actual.realKisaEvidenceAttached !== false ||
    candidate.rightsState.actual.productionRightsGate !== "NO" ||
    candidate.rightsState.actual.actualApprovalAllowed !== "NO" ||
    candidate.rightsState.simulation.productionEvidence !== false ||
    candidate.rightsState.simulation.productionAuthorization !== false ||
    candidate.rightsState.simulation.use !== "NON_PRODUCTION_READINESS_ONLY" ||
    candidate.runtimeApproval !== "NOT_ISSUED"
  ) {
    throw new AppError("Python 8H binding export is invalid or crosses its rights boundary.", 409, "PYTHON_8H_BINDING_EXPORT_INVALID");
  }
  for (const hash of [candidate.combinedSourcePackageHash, candidate.foundationHash, candidate.materializationHash, candidate.revisionBindingHash, candidate.approvalSubjectHash]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new AppError("Python 8H binding export has an invalid hash.", 409, "PYTHON_8H_BINDING_EXPORT_INVALID");
  }
  if (
    candidate.authorityId !== `${AUTHORITY_ID_PREFIX}${candidate.approvalSubjectHash}` ||
    candidate.runtimeRevisionId !== `${candidate.foundationId}:${candidate.revisionBindingHash}` ||
    candidate.expectedCounts.questions !== 40 || candidate.expectedCounts.choices !== 160 ||
    candidate.expectedCounts.versions !== 40 || candidate.expectedCounts.mappings !== 40 ||
    candidate.q36VersionIdentity.foundationQuestionId !== "Q36" || candidate.q36VersionIdentity.version !== 2
  ) {
    throw new AppError("Python 8H binding export identity or expected projection is invalid.", 409, "PYTHON_8H_BINDING_EXPORT_INVALID");
  }
}

function assertProjectionMatchesCandidate(projection: Projection, candidate: RuntimeRegistrationBindingCandidate): void {
  const q36 = projection.versionRows.find((row) => row.questionId === candidate.q36VersionIdentity.runtimeQuestionId);
  const questionById = new Map(projection.versionRows.map((row) => {
    const snapshot = JSON.parse(row.snapshotJson) as { foundation?: { question?: { id?: string; answer?: number } } };
    return [snapshot.foundation?.question?.id ?? "", snapshot.foundation?.question?.answer] as const;
  }));
  const answersMatch = Object.entries(candidate.contentReview.answerIndexes).every(([id, answer]) => questionById.get(id) === answer);
  if (
    projection.source.revisionBindingHash !== candidate.revisionBindingHash ||
    projection.payload.canonicalHash !== candidate.materializationHash ||
    projection.source.candidateId !== candidate.foundationId ||
    projection.courseId !== candidate.courseId || projection.courseSlug !== candidate.slug ||
    !q36 || q36.id !== candidate.q36VersionIdentity.runtimeQuestionVersionId || q36.version !== 2 ||
    projection.source.revisionContext?.sourceRevisionId !== candidate.q36VersionIdentity.sourceRevisionId ||
    projection.source.revisionContext?.sourceRevisionVersion !== candidate.q36VersionIdentity.sourceRevisionVersion ||
    !answersMatch
  ) {
    throw new AppError("Python 8H projection differs from the canonical binding export.", 409, "PYTHON_8H_PROJECTION_BINDING_MISMATCH");
  }
}

async function loadCurrentLedger(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  binding: Omit<SecureCoding8HRegistrationBinding, "authoritySequence">,
): Promise<Ledger> {
  return owner.withTransaction(async (transaction) => {
    const root = await transaction.loadAuthorityRoot(binding.authorityId);
    const records = await transaction.loadAcceptedAuthorityEvents(binding.authorityId);
    if (!root && records.length === 0) return { state: "NONE", subject: null, approvalSubjectHash: null, authoritySequence: 0 };
    if (!root) throw new AppError("Python 8H Runtime Authority root is missing.", 503, "PYTHON_8H_AUTHORITY_ROOT_MISSING");

    const successorIds = new Set<string>();
    for (const event of records) {
      if (event.eventType !== "SUPERSESSION_DECLARED") continue;
      const successorId = (event.payload as { successorAuthorityId?: unknown }).successorAuthorityId;
      if (typeof successorId === "string") successorIds.add(successorId);
    }
    const authoritiesById = new Map<string, AuthorityReference>();
    for (const successorId of successorIds) {
      const reference = await transaction.resolveSuccessorAuthority(successorId);
      if (!reference) throw new AppError("Python 8H successor authority is unavailable.", 503, "PYTHON_8H_AUTHORITY_SUCCESSOR_MISSING");
      authoritiesById.set(successorId, reference);
    }
    const context: AuthorityReplayContext = { authoritiesById };
    const events = persistenceRecordsToCanonicalEvents(records, binding.authorityId, context);
    const replay = replayAuthorityLedger(binding.authorityId, events, context);
    if (root.latestSequence !== replay.lastSequence) throw new AppError("Python 8H authority sequence differs from its ledger.", 503, "PYTHON_8H_AUTHORITY_SEQUENCE_MISMATCH");
    return {
      state: replay.state,
      subject: replay.record?.subject ?? null,
      approvalSubjectHash: replay.record?.approvalSubjectHash ?? null,
      authoritySequence: replay.lastSequence,
    };
  });
}

async function assertCurrentAuthority(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  binding: Omit<SecureCoding8HRegistrationBinding, "authoritySequence">,
): Promise<SecureCoding8HRegistrationBinding> {
  const ledger = await loadCurrentLedger(owner, binding);
  await assertRuntimeAuthorityGate({
    expectedSubject: binding.subject,
    resolvedSubject: ledger.subject,
    authorityId: binding.authorityId,
    currentnessResolver: {
      resolveCurrentness: (subject) => ({
        state: "CURRENT",
        runtimeRevisionId: subject.runtimeRevisionId,
        semanticHash: binding.projection.payload.canonicalHash,
      }),
    },
    lifecycleResolver: {
      resolveLifecycle: (_subject, authorityId) => authorityId === binding.authorityId && ledger.state !== "NONE" ? ledger.state : null,
    },
  });
  if (ledger.approvalSubjectHash !== binding.approvalSubjectHash || ledger.authoritySequence < 1) {
    throw new AppError("Python 8H approval subject is not exact and current.", 409, "PYTHON_8H_APPROVAL_BINDING_MISMATCH");
  }
  return Object.freeze({ ...binding, authoritySequence: ledger.authoritySequence });
}

/** Canonical Python 8H entry point. D1 and test-only authority owners are rejected. */
export async function registerSecureCoding8HRuntime(
  actorUserId: string,
  authorityOwner: RuntimeAuthorityPersistenceTransactionOwner,
): Promise<Readonly<{ outcome: "REGISTERED" | "EXACT_REPLAY"; registrationId: string; binding: SecureCoding8HRegistrationBinding }>> {
  if (typeof actorUserId !== "string" || actorUserId.trim() !== actorUserId || actorUserId.length === 0) {
    throw new AppError("A canonical registration actor is required.", 400, "PYTHON_8H_ACTOR_INVALID");
  }
  if (bindingCandidate.rightsState.actual.actualApprovalAllowed !== "YES"
    && !(process.env.NODE_ENV === "test" && process.env.SECURIUM_PYTHON_8H_TEST_AUTHORITY === "1")) {
    throw new AppError("Python 8H production rights are not cleared; only an explicitly marked disposable TEST_AUTHORITY may exercise registration.", 403, "PYTHON_8H_PRODUCTION_RIGHTS_GATE_CLOSED");
  }
  if (!(authorityOwner instanceof PostgresRuntimeAuthorityPersistence)) {
    throw new AppError("Python 8H canonical registration requires PostgreSQL authority persistence.", 503, "PYTHON_8H_POSTGRES_REQUIRED");
  }
  const projection = await buildSecureCoding8HRegistrationProjection();
  const derived = await deriveSecureCoding8HRegistrationBinding(projection);
  return authorityOwner.withRegistrationTransaction(async (transactionAuthorityOwner, executor) => {
    const binding = await assertCurrentAuthority(transactionAuthorityOwner, derived);
    const result = await persistProjection(executor, actorUserId, binding);
    const latest = await assertCurrentAuthority(transactionAuthorityOwner, derived);
    if (
      latest.authorityId !== binding.authorityId ||
      latest.approvalSubjectHash !== binding.approvalSubjectHash ||
      latest.authoritySequence !== binding.authoritySequence
    ) throw new AppError("Python 8H Runtime Authority changed during registration.", 409, "PYTHON_8H_AUTHORITY_CHANGED_DURING_TRANSACTION");
    return { ...result, binding };
  });
}

async function persistProjection(
  executor: PostgresTransactionExecutor,
  actorUserId: string,
  binding: SecureCoding8HRegistrationBinding,
) {
  const course = SECURE_CODING_8H_REGISTRATION;
  const receiptIdentity = await sha256Canonical({
    contractVersion: "SECURIUM_PYTHON_8H_RUNTIME_REGISTRATION_V1",
    courseId: course.courseId,
    courseSlug: course.courseSlug,
    packageKey: course.packageKey,
    sourceManifestId: binding.candidate.sourceManifestId,
    sourcePackageHash: binding.subject.sourcePackageHash,
    foundationId: binding.subject.foundationId,
    foundationHash: binding.subject.foundationHash,
    materializationHash: binding.projection.payload.canonicalHash,
    revisionBindingHash: binding.projection.source.revisionBindingHash,
    approvalSubjectHash: binding.approvalSubjectHash,
    authorityId: binding.authorityId,
    authoritySequence: binding.authoritySequence,
    questionProjectionHash: binding.projection.payload.canonicalHash,
  });
  const priorReceipt = await executor.query<Record<string, unknown>>(
    `SELECT id,registration_semantic_identity AS "registrationSemanticIdentity" FROM public.secure_coding_8h_runtime_registrations WHERE course_id = $1 OR registration_semantic_identity = $2 FOR UPDATE`,
    [course.courseId, receiptIdentity],
  );
  if (priorReceipt.rows.length > 1) throw new AppError("Python 8H registration receipt identity collides.", 409, "PYTHON_8H_RECEIPT_COLLISION");
  if (priorReceipt.rows.length === 0) {
    const legacy = await executor.query<{ count: number | string }>(
      `SELECT (SELECT count(*) FROM public.questions WHERE id LIKE $1) +
              (SELECT count(*) FROM public.question_choices WHERE question_id LIKE $1) +
              (SELECT count(*) FROM public.question_versions WHERE question_id LIKE $1) +
              (SELECT count(*) FROM public.question_courses WHERE course_id = $2 AND question_id LIKE $1) AS count`,
      [`question-${course.courseId}-%`, course.courseId],
    );
    if (Number(legacy.rows[0]?.count ?? 0) !== 0) {
      throw new AppError("Python 8H legacy question rows cannot satisfy canonical registration.", 409, "PYTHON_8H_LEGACY_COLLISION");
    }
  }
  const saved = await executor.query<Record<string, unknown>>(
    `SELECT id, course_group_id AS "courseGroupId", code, slug, name, short_name AS "shortName",thumbnail_url AS "thumbnailUrl",
            description, total_levels AS "totalLevels", passing_score AS "passingScore", difficulty,
            active, published, display_order AS "displayOrder", is_sample AS "isSample", deleted_at AS "deletedAt"
       FROM public.courses WHERE id = $1 OR code = $2 OR slug = $3 FOR UPDATE`,
    [course.courseId, course.courseCode, course.courseSlug],
  );
  if (saved.rows.length > 1) throw new AppError("Python 8H course identity collides with existing rows.", 409, "PYTHON_8H_COURSE_COLLISION");
  const expectedCourse = {
    id: course.courseId, courseGroupId: course.courseGroupId, code: course.courseCode,
    slug: course.courseSlug, name: course.courseName, shortName: course.courseShortName,
    description: course.courseName, thumbnailUrl: null, totalLevels: 8, passingScore: 60, difficulty: "INTERMEDIATE",
    active: 0, published: 0, displayOrder: 8, isSample: 0, deletedAt: null,
  };
  if (saved.rows.length === 1) assertRowMatches(saved.rows[0]!, expectedCourse, "PYTHON_8H_COURSE_CONFLICT");
  else {
    const group = await executor.query<{ id: string }>(`SELECT id FROM public.course_groups WHERE id = $1`, [course.courseGroupId]);
    if (group.rows.length !== 1) throw new AppError("Independent course group is unavailable.", 409, "PYTHON_8H_COURSE_GROUP_MISSING");
    await executor.query(
      `INSERT INTO public.courses (id,course_group_id,code,slug,name,short_name,description,total_levels,passing_score,difficulty,active,published,display_order,is_sample)
       VALUES ($1,$2,$3,$4,$5,$6,$7,8,60,'INTERMEDIATE',0,0,8,0)`,
      [course.courseId, course.courseGroupId, course.courseCode, course.courseSlug, course.courseName, course.courseShortName, course.courseName],
    );
  }

  const actor = await executor.query<{ id: string }>(`SELECT id FROM public.users WHERE id = $1`, [actorUserId]);
  if (actor.rows.length !== 1) throw new AppError("Registration actor is not a canonical user.", 403, "PYTHON_8H_ACTOR_UNKNOWN");
  for (const question of binding.projection.questionRows) {
    const found = await executor.query<Record<string, unknown>>(`SELECT id,title,content,type,difficulty,explanation,wrong_answer_explanation AS "wrongAnswerExplanation",status,source,source_date AS "sourceDate",version,answer_config_json AS "answerConfigJson",is_sample AS "isSample",created_by AS "createdBy",reviewed_by AS "reviewedBy",published_at AS "publishedAt",archived_at AS "archivedAt" FROM public.questions WHERE id = $1 FOR UPDATE`, [question.id]);
    const expected = { ...question, reviewedBy: null, publishedAt: null, archivedAt: null };
    if (found.rows.length > 1) throw new AppError("Python 8H question identity is duplicated.", 409, "PYTHON_8H_QUESTION_COLLISION");
    if (found.rows.length === 1) assertRowMatches(found.rows[0]!, expected, "PYTHON_8H_QUESTION_CONFLICT");
    else await executor.query(
      `INSERT INTO public.questions (id,title,content,type,difficulty,explanation,wrong_answer_explanation,status,source,source_date,version,answer_config_json,is_sample,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13)`,
      [question.id,question.title,question.content,question.type,question.difficulty,question.explanation,question.wrongAnswerExplanation,question.status,question.source,question.sourceDate,question.version,question.answerConfigJson,actorUserId],
    );
  }
  for (const choice of binding.projection.choiceRows) {
    const found = await executor.query<Record<string, unknown>>(`SELECT id,question_id AS "questionId",content,display_order AS "displayOrder",is_correct AS "isCorrect",explanation FROM public.question_choices WHERE id = $1 FOR UPDATE`, [choice.id]);
    const expected = { ...choice, isCorrect: choice.isCorrect ? 1 : 0 };
    if (found.rows.length === 1) assertRowMatches(found.rows[0]!, expected, "PYTHON_8H_CHOICE_CONFLICT");
    else if (found.rows.length === 0) await executor.query(`INSERT INTO public.question_choices (id,question_id,content,display_order,is_correct,explanation) VALUES ($1,$2,$3,$4,$5,$6)`, [choice.id,choice.questionId,choice.content,choice.displayOrder,choice.isCorrect ? 1 : 0,choice.explanation]);
    else throw new AppError("Python 8H choice identity is duplicated.", 409, "PYTHON_8H_CHOICE_COLLISION");
  }
  for (const version of binding.projection.versionRows) {
    const found = await executor.query<Record<string, unknown>>(`SELECT id,question_id AS "questionId",version,snapshot_json AS "snapshotJson",semantic_hash AS "semanticHash",blueprint_id AS "blueprintId",qualification_json AS "qualificationJson",provenance_json AS "provenanceJson",governance_json AS "governanceJson",human_review_hash AS "humanReviewHash",created_by AS "createdBy" FROM public.question_versions WHERE id = $1 OR (question_id = $2 AND version = $3) FOR UPDATE`, [version.id, version.questionId, version.version]);
    const expected = { ...version };
    if (found.rows.length === 1) assertRowMatches(found.rows[0]!, expected, "PYTHON_8H_VERSION_CONFLICT");
    else if (found.rows.length === 0) await executor.query(`INSERT INTO public.question_versions (id,question_id,version,snapshot_json,review_comment,semantic_hash,blueprint_id,qualification_json,provenance_json,governance_json,human_review_hash,created_by) VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11)`, [version.id,version.questionId,version.version,version.snapshotJson,version.semanticHash,version.blueprintId,version.qualificationJson,version.provenanceJson,version.governanceJson,version.humanReviewHash,actorUserId]);
    else throw new AppError("Python 8H question version identity collides.", 409, "PYTHON_8H_VERSION_COLLISION");
  }
  for (const mapping of binding.projection.courseBindingRows) {
    const found = await executor.query<Record<string, unknown>>(`SELECT question_id AS "questionId",course_id AS "courseId",weight FROM public.question_courses WHERE question_id = $1 AND course_id = $2 FOR UPDATE`, [mapping.questionId,mapping.courseId]);
    if (found.rows.length === 1) assertRowMatches(found.rows[0]!, mapping, "PYTHON_8H_MAPPING_CONFLICT");
    else if (found.rows.length === 0) await executor.query(`INSERT INTO public.question_courses (question_id,course_id,weight) VALUES ($1,$2,$3)`, [mapping.questionId,mapping.courseId,mapping.weight]);
    else throw new AppError("Python 8H mapping identity is duplicated.", 409, "PYTHON_8H_MAPPING_COLLISION");
  }

  const counts = await executor.query<Record<string, unknown>>(
    `SELECT (SELECT count(*) FROM public.questions WHERE id LIKE $1) AS questions,
            (SELECT count(*) FROM public.question_choices WHERE question_id LIKE $1) AS choices,
            (SELECT count(*) FROM public.question_versions WHERE question_id LIKE $1) AS versions,
            (SELECT count(*) FROM public.question_courses WHERE course_id = $2 AND question_id LIKE $1) AS mappings`,
    [`question-${course.courseId}-%`, course.courseId],
  );
  const countRow = counts.rows[0];
  const expectedCounts = binding.candidate.expectedCounts;
  if (!countRow || Number(countRow.questions) !== expectedCounts.questions || Number(countRow.choices) !== expectedCounts.choices || Number(countRow.versions) !== expectedCounts.versions || Number(countRow.mappings) !== expectedCounts.mappings) {
    throw new AppError("Persisted Python 8H row counts differ from the canonical projection.", 409, "PYTHON_8H_PERSISTED_COUNT_MISMATCH");
  }
  const existingReceipt = await executor.query<Record<string, unknown>>(`SELECT id,registration_semantic_identity AS "registrationSemanticIdentity",course_id AS "courseId",course_slug AS "courseSlug",package_key AS "packageKey",source_manifest_id AS "sourceManifestId",source_package_hash AS "sourcePackageHash",foundation_id AS "foundationId",foundation_hash AS "foundationHash",materialization_hash AS "materializationHash",revision_binding_hash AS "revisionBindingHash",approval_subject_hash AS "approvalSubjectHash",authority_id AS "authorityId",authority_sequence AS "authoritySequence",question_projection_hash AS "questionProjectionHash",questions_count AS "questionsCount",choices_count AS "choicesCount",versions_count AS "versionsCount",mappings_count AS "mappingsCount",state,publication_authority AS "publicationAuthority" FROM public.secure_coding_8h_runtime_registrations WHERE course_id = $1 OR registration_semantic_identity = $2 FOR UPDATE`, [course.courseId, receiptIdentity]);
  const receipt = {
    registrationSemanticIdentity: receiptIdentity, courseId: course.courseId, courseSlug: course.courseSlug,
    packageKey: course.packageKey, sourceManifestId: binding.candidate.sourceManifestId,
    sourcePackageHash: binding.subject.sourcePackageHash, foundationId: binding.subject.foundationId,
    foundationHash: binding.subject.foundationHash, materializationHash: binding.projection.payload.canonicalHash,
    revisionBindingHash: binding.projection.source.revisionBindingHash, approvalSubjectHash: binding.approvalSubjectHash,
    authorityId: binding.authorityId, authoritySequence: binding.authoritySequence,
    questionProjectionHash: binding.projection.payload.canonicalHash, questionsCount: expectedCounts.questions, choicesCount: expectedCounts.choices,
    versionsCount: expectedCounts.versions, mappingsCount: expectedCounts.mappings, state: "REGISTERED_UNPUBLISHED", publicationAuthority: "NOT_GRANTED",
  };
  let createdRegistrationId: string | undefined;
  if (existingReceipt.rows.length > 1) throw new AppError("Python 8H registration receipt identity collides.", 409, "PYTHON_8H_RECEIPT_COLLISION");
  if (existingReceipt.rows.length === 1) assertRowMatches(existingReceipt.rows[0]!, receipt, "PYTHON_8H_RECEIPT_CONFLICT");
  else {
    const registrationId = randomUUID();
    createdRegistrationId = registrationId;
    await executor.query(
    `INSERT INTO public.secure_coding_8h_runtime_registrations (id,course_id,course_slug,package_key,source_manifest_id,source_package_hash,foundation_id,foundation_hash,materialization_hash,revision_binding_hash,approval_subject_hash,authority_id,authority_sequence,question_projection_hash,questions_count,choices_count,versions_count,mappings_count,registration_semantic_identity,state,publication_authority,registered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'REGISTERED_UNPUBLISHED','NOT_GRANTED',$20)`,
      [registrationId,course.courseId,course.courseSlug,course.packageKey,binding.candidate.sourceManifestId,binding.subject.sourcePackageHash,binding.subject.foundationId,binding.subject.foundationHash,binding.projection.payload.canonicalHash,binding.projection.source.revisionBindingHash,binding.approvalSubjectHash,binding.authorityId,binding.authoritySequence,binding.projection.payload.canonicalHash,expectedCounts.questions,expectedCounts.choices,expectedCounts.versions,expectedCounts.mappings,receiptIdentity,actorUserId],
    );
  }
  return { outcome: existingReceipt.rows.length === 1 ? "EXACT_REPLAY" as const : "REGISTERED" as const, registrationId: existingReceipt.rows.length === 1 ? String(existingReceipt.rows[0]!.id) : createdRegistrationId! };
}

function assertRowMatches(actual: Record<string, unknown>, expected: Record<string, unknown>, code: string): void {
  for (const [key, value] of Object.entries(expected)) {
    let observed = actual[key];
    const normalizedExpected = ["active", "published", "isSample", "isCorrect"].includes(key) && typeof value === "boolean" ? (value ? 1 : 0) : value;
    if ((key === "active" || key === "published" || key === "isSample" || key === "isCorrect") && typeof observed === "boolean") observed = observed ? 1 : 0;
    if (observed !== normalizedExpected) throw new AppError(`Existing Python 8H row conflicts at ${key}.`, 409, code);
  }
}
