import { randomUUID } from "node:crypto";
import type { PostgresTransactionExecutor } from "./provider/postgres-database-provider.ts";
import type {
  CppgDraftPersistenceAdapter,
  CppgDraftTransaction,
  CppgPersistenceStage,
  CppgRuntimeReadbackRequest,
  CppgObservedRuntimeState,
  CppgAuthorityIdentity,
  CppgAuthorityCurrentness,
  CppgCourseTheoryDraftProjection,
  ProjectionRecord,
} from "../lib/services/cppg-runtime-course-registration.ts";
import { sha256Canonical } from "../lib/policy/stable-canonical-hash.ts";

const TABLES: Readonly<Record<ProjectionRecord["kind"], string>> = {
  COURSE: "courses",
  CURRICULUM_TREE: "curriculum_trees",
  SUBJECT: "subjects",
  CURRICULUM_NODE: "curriculum_nodes",
  TOPIC: "topics",
  LEARNING_UNIT: "learning_units",
  CONTENT: "contents",
  LESSON: "lessons",
  COURSE_LESSON: "course_lessons",
  CONTENT_REVISION: "content_revisions",
};

const COLUMNS: Readonly<Record<ProjectionRecord["kind"], readonly string[]>> = {
  COURSE: ["id", "courseGroupId", "code", "slug", "name", "shortName", "description", "totalLevels", "passingScore", "difficulty", "active", "published", "displayOrder", "isSample"],
  CURRICULUM_TREE: ["id", "courseId", "title", "version", "sourceType", "sourceDocument", "status"],
  SUBJECT: ["id", "courseId", "code", "name", "description", "displayOrder", "active", "isSample"],
  CURRICULUM_NODE: ["id", "curriculumTreeId", "parentId", "nodeType", "title", "description", "officialCode", "officialTitle", "sortOrder", "depth", "path", "isRequired", "isPractical", "metadata", "status"],
  TOPIC: ["id", "subjectId", "code", "name", "description", "displayOrder", "active", "isSample"],
  LEARNING_UNIT: ["id", "courseId", "subjectId", "topicId", "code", "title", "description", "displayOrder", "active", "published", "completionPolicy", "minimumProgressPercent", "minimumStudySeconds", "isSample"],
  CONTENT: ["id", "slug", "canonicalKey", "title", "summary", "body", "bodyFormat", "learningObjectivesJson", "coreConceptsJson", "practicalExamplesJson", "diagramsJson", "mediaJson", "version", "status", "createdBy"],
  LESSON: ["id", "learningUnitId", "courseId", "subjectId", "topicId", "code", "title", "summary", "content", "contentFormat", "estimatedMinutes", "displayOrder", "active", "published", "isSample", "version"],
  COURSE_LESSON: ["id", "courseId", "curriculumNodeId", "contentId", "lessonId", "displayTitle", "sortOrder", "estimatedMinutes", "isRequired", "completionRule", "status"],
  CONTENT_REVISION: ["id", "contentType", "contentId", "courseId", "title", "contentDate", "version", "revisionStatus", "snapshotJson", "changeSummary", "isLatest", "createdBy", "semanticHash"],
};

export type CppgCanonicalRegistrationBinding = Readonly<{
  identity: CppgAuthorityIdentity;
  currentness: CppgAuthorityCurrentness & Readonly<{ authoritySequence: number }>;
  projection: CppgCourseTheoryDraftProjection;
  registeredBy: string;
}>;

export class PostgresCppgDraftPersistenceAdapter implements CppgDraftPersistenceAdapter {
  private readonly executor: PostgresTransactionExecutor;
  private readonly binding: CppgCanonicalRegistrationBinding;

  constructor(
    executor: PostgresTransactionExecutor,
    binding: CppgCanonicalRegistrationBinding,
  ) {
    this.executor = executor;
    this.binding = binding;
  }

  async inspect(input: CppgRuntimeReadbackRequest): Promise<CppgObservedRuntimeState> {
    if (input.courseId !== "course-cppg") throw new Error("CPPG_REGISTRATION_COURSE_ID_INVALID");
    const result = await this.executor.query<{ recordId: string; recordKind: string; semanticHash: string }>(
      `SELECT "record_id" AS "recordId", "record_kind" AS "recordKind", "semantic_hash" AS "semanticHash"
       FROM public."cppg_runtime_projection_records" WHERE "projection_semantic_hash" = $1 ORDER BY "record_kind", "record_id"`,
      [this.binding.projection.projectionSemanticHash],
    );
    const ids = result.rows.map((row) => row.recordId);
    const hashes = Object.fromEntries(result.rows.map((row) => [row.recordId, row.semanticHash]));
    const registration = await this.executor.query<{ id: string; registrationSemanticIdentity: string; approvalSubjectHash: string; authorityId: string; packageKey: string; projectionSemanticHash: string; courseSlug: string; runtimeRevisionId: string; contentRevisionIds: string[]; sourceManifestId: string; sourcePackageHash: string; foundationId: string; foundationHash: string; authoritySequence: number; state: string; publicationAuthority: string }>(
      `SELECT "id", "registration_semantic_identity" AS "registrationSemanticIdentity",
              "approval_subject_hash" AS "approvalSubjectHash", "authority_id" AS "authorityId",
              "package_key" AS "packageKey", "projection_semantic_hash" AS "projectionSemanticHash",
              "course_slug" AS "courseSlug", "runtime_revision_id" AS "runtimeRevisionId",
              "content_revision_ids" AS "contentRevisionIds", "source_manifest_id" AS "sourceManifestId",
              "source_package_hash" AS "sourcePackageHash", "foundation_id" AS "foundationId",
              "foundation_hash" AS "foundationHash", "authority_sequence" AS "authoritySequence",
              "state", "publication_authority" AS "publicationAuthority"
       FROM public."cppg_runtime_registrations"
       WHERE "course_id" = $1 AND "runtime_revision_id" = $2`,
      [input.courseId, this.binding.identity.subject.runtimeRevisionId],
    );
    const course = await this.executor.query<{ id: string }>(
      `SELECT "id" FROM public."courses" WHERE "id" = $1`,
      [input.courseId],
    );
    if (result.rows.length === 0 && registration.rows.length === 0) {
      return { courseCount: course.rows.length, recordCount: 0, recordIds: [], semanticHashes: {}, duplicateAuthorityCount: 0 };
    }
    if (result.rows.length !== input.recordIds.length || registration.rows.length !== 1) {
      return { courseCount: 1, recordCount: result.rows.length, recordIds: ids, semanticHashes: hashes, duplicateAuthorityCount: registration.rows.length === 1 ? 1 : registration.rows.length + 1 };
    }
    const saved = registration.rows[0]!;
    const expectedRegistrationIdentity = await registrationIdentity(this.binding);
    const expectedRevisionIds = this.binding.projection.contentRevisions.map((record) => record.id);
    if (saved.registrationSemanticIdentity !== expectedRegistrationIdentity || saved.approvalSubjectHash !== this.binding.identity.approvalSubjectHash || saved.authorityId !== this.binding.identity.authorityId || saved.packageKey !== this.binding.identity.subject.packageKey || saved.projectionSemanticHash !== this.binding.projection.projectionSemanticHash || saved.courseSlug !== this.binding.identity.subject.courseSlug || saved.runtimeRevisionId !== this.binding.identity.subject.runtimeRevisionId || JSON.stringify(saved.contentRevisionIds) !== JSON.stringify(expectedRevisionIds) || saved.sourceManifestId !== this.binding.identity.subject.sourceManifestId || saved.sourcePackageHash !== this.binding.identity.subject.sourcePackageHash || saved.foundationId !== this.binding.identity.subject.foundationId || saved.foundationHash !== this.binding.identity.subject.foundationHash || saved.authoritySequence !== this.binding.currentness.authoritySequence || saved.state !== "REGISTERED_UNPUBLISHED" || saved.publicationAuthority !== "NOT_GRANTED") {
      return { courseCount: 1, recordCount: result.rows.length, recordIds: ids, semanticHashes: hashes, duplicateAuthorityCount: 1 };
    }
    return { courseCount: 1, recordCount: result.rows.length, recordIds: ids, semanticHashes: hashes, duplicateAuthorityCount: 0 };
  }

  async begin(): Promise<CppgDraftTransaction> {
    let done = false;
    return {
      apply: async (stage, records) => {
        if (done) throw new Error("CPPG_REGISTRATION_TRANSACTION_CLOSED");
        for (const record of records) {
          if (stageForKind(record.kind) !== stage) throw new Error("CPPG_REGISTRATION_STAGE_KIND_MISMATCH");
          await this.insertProjection(record);
        }
      },
      commit: async () => {
        if (done) throw new Error("CPPG_REGISTRATION_TRANSACTION_CLOSED");
        done = true;
        const identity = await registrationIdentity(this.binding);
        await this.executor.query(
          `INSERT INTO public."cppg_runtime_registrations"
            ("id", "course_id", "course_slug", "package_key", "runtime_revision_id", "content_revision_ids", "projection_semantic_hash",
             "source_manifest_id", "source_package_hash", "foundation_id", "foundation_hash", "approval_subject_hash",
             "authority_id", "authority_sequence", "registration_semantic_identity", "state", "publication_authority", "registered_by")
           VALUES ($1,$2,$3,$4,$5,($6::text)::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,'REGISTERED_UNPUBLISHED','NOT_GRANTED',$16)`,
          [randomUUID(), this.binding.projection.courseId, this.binding.identity.subject.courseSlug,
            this.binding.identity.subject.packageKey, this.binding.identity.subject.runtimeRevisionId,
            JSON.stringify(this.binding.projection.contentRevisions.map((record) => record.id)),
            this.binding.projection.projectionSemanticHash, this.binding.identity.subject.sourceManifestId,
            this.binding.identity.subject.sourcePackageHash, this.binding.identity.subject.foundationId,
            this.binding.identity.subject.foundationHash, this.binding.identity.approvalSubjectHash,
            this.binding.identity.authorityId, this.binding.currentness.authoritySequence, identity, this.binding.registeredBy],
        );
      },
      rollback: async () => { done = true; },
    };
  }

  private async insertProjection(record: ProjectionRecord): Promise<void> {
    const columns = COLUMNS[record.kind];
    const values = columns.map((name) => record.payload[name]);
    if (values.some((value) => value === undefined)) throw new Error(`CPPG_REGISTRATION_PAYLOAD_INCOMPLETE:${record.kind}`);
    const names = columns.map(toSnakeCase);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    await this.executor.query(
      `INSERT INTO public."${TABLES[record.kind]}" (${names.map((name) => `"${name}"`).join(",")}) VALUES (${placeholders.join(",")})`,
      values.map((value) => typeof value === "boolean" ? (value ? 1 : 0) : value as string | number | null),
    );
    await this.executor.query(
      `INSERT INTO public."cppg_runtime_projection_records" ("projection_semantic_hash","record_id","record_kind","semantic_hash","payload_json") VALUES ($1,$2,$3,$4,($5::text)::jsonb)`,
      [this.binding.projection.projectionSemanticHash, record.id, record.kind, record.semanticHash, JSON.stringify(record.payload)],
    );
  }
}

export function stageForKind(kind: ProjectionRecord["kind"]): CppgPersistenceStage {
  return kind === "COURSE" ? "COURSE" : kind === "CURRICULUM_TREE" ? "CURRICULUM_TREE" : kind === "SUBJECT" ? "SUBJECTS" : kind === "CURRICULUM_NODE" ? "CURRICULUM_NODES" : kind === "TOPIC" ? "TOPICS" : kind === "LEARNING_UNIT" ? "LEARNING_UNITS" : kind === "CONTENT" ? "CONTENTS" : kind === "LESSON" ? "LESSONS" : kind === "COURSE_LESSON" ? "COURSE_LESSONS" : "CONTENT_REVISIONS";
}

async function registrationIdentity(binding: CppgCanonicalRegistrationBinding): Promise<string> {
  return sha256Canonical({
    contractVersion: "CPPG_CANONICAL_REGISTRATION_V1",
    courseId: binding.projection.courseId,
    courseSlug: binding.identity.subject.courseSlug,
    packageKey: binding.identity.subject.packageKey,
    runtimeRevisionId: binding.identity.subject.runtimeRevisionId,
    projectionSemanticHash: binding.projection.projectionSemanticHash,
    sourceManifestId: binding.identity.subject.sourceManifestId,
    sourcePackageHash: binding.identity.subject.sourcePackageHash,
    foundationId: binding.identity.subject.foundationId,
    foundationHash: binding.identity.subject.foundationHash,
    approvalSubjectHash: binding.identity.approvalSubjectHash,
    authorityId: binding.identity.authorityId,
    authoritySequence: binding.currentness.authoritySequence,
  });
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
}
