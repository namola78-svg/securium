import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutionResult, DatabaseProvider, DatabaseResultMetadata, DatabaseStatement, DatabaseTransaction } from "../db/provider/database-provider.ts";
import { buildRegistrationIdentities } from "../lib/services/content-revision-registration.ts";
import { buildIseWaveACanonicalRegistrationInput } from "../lib/services/ise-wave-a-canonical-registration.ts";
import { buildIseWaveAGovernanceContext, buildIseWaveAReviewedInput, assertIseWaveAGovernanceDependencies } from "../lib/services/ise-wave-a-reviewed-input-adapter.ts";

type Row = Record<string, unknown>;
type Fixture = {
  database: FakeDatabase;
  registration: Row;
  subjects: Row[];
  sources: Row[];
};

class FakeDatabase implements DatabaseProvider {
  readonly kind = "supabase" as const;
  readonly sourceRows: Row[] = [{ id: "ise-source-1", canonical_key: "cq-qualification-reference", source_type: "OFFICIAL_REFERENCE", normalized_identity: "https://www.cq.or.kr/qh_quagm01_020.do", lifecycle_state: "ACTIVE" }];
  registration: Row | null = null;
  subjects: Row[] = [];
  sources: Row[] = [];
  readonly revisions = new Map<string, Row>();

  async query<T extends Row>(statement: DatabaseStatement) {
    const sql = statement.sql;
    const parameter = statement.parameters?.[0];
    let rows: Row[] = [];
    if (sql.includes("FROM courses")) rows = [{ id: "course-ise", active: true, deleted_at: null }];
    else if (sql.includes("FROM source_identities") && sql.includes("normalized_identity = ?")) rows = this.sourceRows.filter((row) => row.normalized_identity === parameter);
    else if (sql.includes("FROM source_identities") && sql.includes("WHERE id = ?")) rows = this.sourceRows.filter((row) => row.id === parameter);
    else if (sql.includes("FROM app_schema_migrations")) rows = [];
    else if (sql.includes("FROM content_revision_registrations") && sql.includes("ORDER BY created_at")) rows = this.registration ? [{ id: this.registration.id }] : [];
    else if (sql.includes("FROM content_revision_registrations")) rows = this.registration ? [this.registration] : [];
    else if (sql.includes("FROM content_revision_registration_subjects r JOIN content_revisions c")) rows = this.subjects;
    else if (sql.includes("FROM content_revision_registration_sources s JOIN source_identities")) rows = this.sources.map((source) => ({ ...source, ...this.sourceRows.find((row) => row.id === source.source_identity_id) }));
    else if (sql.includes("FROM admin_audit_logs")) rows = this.auditRows(sql, parameter);
    else if (sql.includes("FROM content_revisions WHERE id = ?")) rows = this.revisions.get(String(parameter)) ? [this.revisions.get(String(parameter)) as Row] : [];
    return { rows: rows as T[], rowCount: rows.length, metadata: { provider: "supabase" } as DatabaseResultMetadata };
  }

  async queryOne<T extends Row>(statement: DatabaseStatement): Promise<T | null> {
    return (await this.query<T>(statement)).rows[0] ?? null;
  }

  async execute(statement: DatabaseStatement): Promise<DatabaseExecutionResult> {
    void statement;
    return { affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" } };
  }

  async transaction(statements: readonly DatabaseStatement[]): Promise<DatabaseExecutionResult[]> {
    void statements;
    return [];
  }

  async transactional<T>(callback: (database: DatabaseTransaction) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async healthCheck(): Promise<boolean> { return true; }

  private auditRows(sql: string, parameter: unknown): Row[] {
    if (!this.registration || (sql.includes("WHERE id = ?") && parameter !== this.registration.audit_log_id)) return [];
    return [{ actor_user_id: this.registration.created_by, actor_role: "SERVER_REGISTRATION", action: "CONTENT_REVISION_REGISTRATION_CREATED", resource_type: "CONTENT_REVISION_REGISTRATION", resource_id: this.registration.id, result: "SUCCESS", metadata_json: this.registration.audit_metadata }];
  }
}

async function fixture(mutator?: (fixture: Fixture) => void): Promise<Fixture> {
  const database = new FakeDatabase();
  const canonical = await buildIseWaveACanonicalRegistrationInput(database, "ise-registration-actor");
  const identities = await buildRegistrationIdentities(canonical);
  const subjects = canonical.subjects.map((subject, index) => {
    const contentRevisionId = `revision-db-${index + 1}`;
    const row = {
      id: `registration-subject-${index + 1}`,
      registration_id: "registration-1",
      content_revision_id: contentRevisionId,
      semantic_revision_id: subject.semanticRevisionId,
      content_hash: subject.contentHash,
      provenance_identity: identities.subjectProvenanceIdentities[subject.semanticRevisionId],
      source_lineage: subject.sourceLineage,
      rights_state: "REVIEW_REQUIRED",
      originality_state: "REVIEW_REQUIRED",
      currentness_state: "REVIEW_REQUIRED",
      responsible_owner_state: "OWNER_ATTESTATION_REQUIRED",
      canonical_content_id: subject.contentId,
      canonical_content_hash: subject.contentHash,
      canonical_snapshot_json: subject.snapshotJson,
      canonical_course_id: "course-ise",
      canonical_revision_status: "review",
    };
    database.revisions.set(contentRevisionId, { id: contentRevisionId, content_id: subject.contentId, content_type: "LESSON", version: "1", course_id: "course-ise", revision_status: "review", semantic_hash: subject.contentHash, snapshot_json: subject.snapshotJson });
    database.sources.push({ registration_subject_id: row.id, source_identity_id: subject.sourceBindings[0].sourceIdentityId, binding_role: "SCOPE_REFERENCE", locator: subject.sourceBindings[0].locator, expression_reuse: "NOT_USED" });
    return row;
  });
  const registration: Row = {
    id: "registration-1",
    registration_contract_version: "CONTENT_REVISION_REGISTRATION_V1",
    resource_type: "ISE_WAVE_A_LESSON_PACKAGE",
    qualification_id: "course-ise",
    package_key: "ise-wave-a-information-security-general",
    package_semantic_identity: identities.packageSemanticIdentity,
    provenance_aggregate_identity: identities.provenanceAggregateIdentity,
    registration_semantic_identity: identities.registrationSemanticIdentity,
    state: "REGISTERED_REVIEW_PENDING",
    created_by: "ise-registration-actor",
    audit_log_id: "audit-1",
    audit_metadata: JSON.stringify({ contractVersion: "CONTENT_REVISION_REGISTRATION_V1", registrationSemanticIdentity: identities.registrationSemanticIdentity, packageKey: "ise-wave-a-information-security-general", subjectIds: canonical.subjects.map((subject) => subject.semanticRevisionId).sort() }),
  };
  database.registration = registration;
  database.subjects = subjects;
  const result: Fixture = { database, registration, subjects, sources: database.sources };
  mutator?.(result);
  return result;
}

test("ISE adapter reconstructs exact registration with CURRENTNESS infrastructure available", async () => {
  const { database } = await fixture();
  const context = await buildIseWaveAGovernanceContext(database);
  assert.equal(context.reviewedInput.subjects.length, 2);
  assert.equal(context.reviewedInput.registrationState, "REGISTERED_REVIEW_PENDING");
  assert.equal(context.reviewedInput.resourceId, context.reviewedInput.registrationSemanticIdentity);
  assert.deepEqual(context.requiredDomains, ["TECHNICAL", "SAFETY_SECURITY_CONTENT", "COPYRIGHT_RIGHTS", "CURRENTNESS", "SUPPORT_QUALIFICATION"]);
  assert.equal(context.requiredReviewerCount, 2);
  assert.equal(context.reviewedInput.currentnessStatus, "CURRENTNESS_AVAILABLE");
  assert.equal(context.dependencyStatus, "READY");
  assert.doesNotThrow(() => assertIseWaveAGovernanceDependencies(context));
});

test("expected reviewed-input identity is only a stale assertion", async () => {
  const { database } = await fixture();
  const current = await buildIseWaveAReviewedInput(database);
  await assert.rejects(buildIseWaveAReviewedInput(database, { expectedReviewedInputIdentity: "0".repeat(64) }), (error: unknown) => (error as { code?: string }).code === "ISE_REVIEWED_INPUT_STALE");
  const replay = await buildIseWaveAReviewedInput(database, { expectedReviewedInputIdentity: current.reviewedInputIdentity });
  assert.equal(replay.reviewedInputIdentity, current.reviewedInputIdentity);
});

for (const [name, mutator] of [
  ["wrong qualification", (fixture: Fixture) => { fixture.registration.qualification_id = "course-other"; }],
  ["wrong package", (fixture: Fixture) => { fixture.registration.package_key = "other-package"; }],
  ["missing subject", (fixture: Fixture) => { fixture.subjects.pop(); }],
  ["extra subject", (fixture: Fixture) => { fixture.subjects.push({ ...fixture.subjects[0], id: "registration-subject-extra", semantic_revision_id: "extra:revision:1" }); }],
  ["wrong revision", (fixture: Fixture) => { fixture.subjects[0].semantic_revision_id = "other:revision:1"; }],
  ["wrong hash", (fixture: Fixture) => { fixture.subjects[0].content_hash = "0".repeat(64); }],
  ["wrong source with same count", (fixture: Fixture) => { fixture.sources[0].source_identity_id = "ise-source-unknown"; }],
] as const) {
  test(`server-owned adapter denies ${name}`, async () => {
    const { database } = await fixture(mutator);
    await assert.rejects(buildIseWaveAReviewedInput(database));
  });
}

test("caller-owned governance fields cannot be supplied to the adapter", async () => {
  const { database } = await fixture();
  const input = await buildIseWaveAReviewedInput(database);
  assert.equal(input.requiredReviewerCount, 2);
  assert.equal(input.currentnessStatus, "CURRENTNESS_AVAILABLE");
  assert.equal(input.registrationState, "REGISTERED_REVIEW_PENDING");
});
