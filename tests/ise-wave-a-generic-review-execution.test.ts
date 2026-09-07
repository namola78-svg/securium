import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseExecutionResult, DatabaseProvider, DatabaseQueryResult, DatabaseStatement } from "../db/provider/database-provider.ts";
import { saveContentReviewJudgment } from "../db/content-review-judgment-repository.ts";
import { ownerAttestationSemanticIdentity } from "../db/content-review-owner-attestation-repository.ts";
import { CONTENT_REVIEWER_SEPARATION_POLICY_V1, evaluateReviewerSeparation } from "../lib/policy/content-reviewer-separation.ts";
import { semanticReviewIdentity, type ContentReviewJudgmentInput } from "../lib/policy/content-review-judgment.ts";
import { assertJudgmentBoundToReviewedInput, resolveReviewedInputContextByResourceType, type ServerOwnedReviewedInputContext } from "../lib/services/content-review-input-resolver.ts";
import { readFileSync } from "node:fs";
import { getCanonicalFinalReviewEligibility } from "../lib/services/content-final-review-authority.ts";

const subjects = [
  { subjectIdentity: "ise-wave-a-general-lesson-01:revision:1", resourceRevisionId: "revision-01", contentSemanticHash: "1".repeat(64), semanticOrdinal: 0 },
  { subjectIdentity: "ise-wave-a-general-lesson-02:revision:1", resourceRevisionId: "revision-02", contentSemanticHash: "2".repeat(64), semanticOrdinal: 1 },
];
const context: ServerOwnedReviewedInputContext = {
  resourceType: "CONTENT_REVISION_REGISTRATION",
  resourceId: "a".repeat(64),
  scope: "ISE_WAVE_A_EXACT_PACKAGE_2_OF_2",
  reviewedInputIdentity: "b".repeat(64),
  reviewedInputSnapshot: { resourceType: "CONTENT_REVISION_REGISTRATION", packageKey: "ise-wave-a-information-security-general", requiredDomains: ["TECHNICAL", "SAFETY_SECURITY_CONTENT", "COPYRIGHT_RIGHTS", "CURRENTNESS", "SUPPORT_QUALIFICATION"] },
  subjects,
  requiredDomains: ["TECHNICAL", "SAFETY_SECURITY_CONTENT", "COPYRIGHT_RIGHTS", "CURRENTNESS", "SUPPORT_QUALIFICATION"],
  requiredReviewerCount: 2,
  riskClass: "HIGH_TRUST",
  subjectBindingMode: "EXACT",
};

type Stored = Record<string, unknown>;

class FakeAdapterDatabase implements DatabaseProvider {
  readonly kind = "supabase" as const;
  judgments: Stored[] = [];
  judgmentSubjects: Stored[] = [];
  findings: Stored[] = [];
  evaluations: Stored[] = [];
  audits: Stored[] = [];

  async query<Row extends Record<string, unknown>>(statement: DatabaseStatement): Promise<DatabaseQueryResult<Row>> {
    if (statement.sql.includes("FROM content_review_owner_attestations")) return { rows: [this.ownerRow()] as unknown as Row[], rowCount: 1, metadata: { provider: this.kind } };
    if (statement.sql.includes("FROM content_review_policy_evaluations")) return { rows: this.evaluations.filter((row) => row.judgment_id === statement.parameters?.[0]) as Row[], rowCount: 0, metadata: { provider: this.kind } };
    if (statement.sql.includes("FROM content_review_judgment_subjects")) return { rows: this.judgmentSubjects.filter((row) => row.judgment_id === statement.parameters?.[0]).sort((a, b) => Number(a.semantic_ordinal) - Number(b.semantic_ordinal)) as Row[], rowCount: 0, metadata: { provider: this.kind } };
    if (statement.sql.includes("FROM content_review_findings")) return { rows: this.findings.filter((row) => row.judgment_id === statement.parameters?.[0]) as Row[], rowCount: 0, metadata: { provider: this.kind } };
    return { rows: [] as Row[], rowCount: 0, metadata: { provider: this.kind } };
  }

  async queryOne<Row extends Record<string, unknown>>(statement: DatabaseStatement): Promise<Row | null> {
    if (statement.sql.includes("FROM content_revisions")) return { created_by: null } as unknown as Row;
    if (statement.sql.includes("FROM content_review_policy_evaluations")) return (this.evaluations.find((row) => row.evaluation_id === statement.parameters?.[0]) ?? null) as Row | null;
    if (statement.sql.includes("FROM content_review_judgments WHERE idempotency_key")) return (this.judgments.find((row) => row.idempotency_key === statement.parameters?.[0]) ?? null) as Row | null;
    if (statement.sql.includes("FROM content_review_judgments WHERE semantic_review_identity")) return (this.judgments.find((row) => row.semantic_review_identity === statement.parameters?.[0]) ?? null) as Row | null;
    if (statement.sql.includes("FROM content_review_judgments WHERE judgment_id")) return (this.judgments.find((row) => row.judgment_id === statement.parameters?.[0]) ?? null) as Row | null;
    if (statement.sql.includes("FROM admin_audit_logs")) return (this.audits.find((row) => row.id === statement.parameters?.[0]) ?? null) as Row | null;
    return null;
  }

  async execute(): Promise<DatabaseExecutionResult> { return { affectedRows: 0, returnedRows: [], metadata: { provider: this.kind } }; }

  async transaction(statements: readonly DatabaseStatement[]) {
    for (const statement of statements) {
      const p = statement.parameters ?? [];
      if (statement.sql.includes("INSERT INTO admin_audit_logs")) this.audits.push({ id: p[0], actor_user_id: p[1], action: p[3], resource_id: p[5], result: "SUCCESS", metadata_json: p[7] });
      else if (statement.sql.includes("INSERT INTO content_review_judgments (")) this.judgments.push({ judgment_id: p[0], contract_version: p[1], review_domain: p[2], reviewed_input_identity: p[3], reviewed_input_snapshot_json: p[4], semantic_review_identity: p[5], result: p[6], lifecycle_state: "ACTIVE", reviewer_user_id: p[7], audit_log_id: p[8], idempotency_key: p[9], supersedes_judgment_id: p[10], created_at: p[11] });
      else if (statement.sql.includes("INSERT INTO content_review_judgment_subjects")) this.judgmentSubjects.push({ judgment_id: p[0], subject_identity: p[1], resource_revision_id: p[2], content_semantic_hash: p[3], semantic_ordinal: p[4] });
      else if (statement.sql.includes("INSERT INTO content_review_findings")) this.findings.push({ finding_id: p[0], judgment_id: p[1], finding_semantic_identity: p[2], subject_identity: p[3], category: p[4], severity: p[5], disposition: p[6], material_facts_json: p[7] });
      else if (statement.sql.includes("INSERT INTO content_review_policy_evaluations")) this.evaluations.push({ evaluation_id: p[0], judgment_id: p[1], policy_version: p[2], reviewed_input_identity: p[3], resource_type: p[4], resource_id: p[5], judgment_semantic_identity: p[6], reviewer_user_id: p[7], owner_attestation_id: p[8], author_user_id: p[9], owner_user_id: p[10], material_editor_user_ids_json: p[11], material_editor_provenance: p[12], provenance_class: p[13], risk_class: p[14], required_reviewer_count: p[15], reviewer_slot: p[16], evaluation_result: "ALLOW", reason_codes_json: p[17], semantic_identity: p[18], idempotency_key: p[19], audit_log_id: p[20], created_at: p[21] });
    }
    return [];
  }

  async healthCheck() { return true; }

  private ownerRow() {
    return { attestation_id: "owner-attestation", resource_type: context.resourceType, resource_id: context.resourceId, reviewed_input_identity: context.reviewedInputIdentity, owner_user_id: "owner", policy_version: CONTENT_REVIEWER_SEPARATION_POLICY_V1, semantic_identity: ownerAttestationSemanticIdentity({ resourceType: context.resourceType, resourceId: context.resourceId, reviewedInputIdentity: context.reviewedInputIdentity, ownerUserId: "owner", attestationType: "RESPONSIBLE_OWNER", supersedesAttestationId: null }), idempotency_key: "owner-key", lifecycle_state: "ACTIVE", supersedes_attestation_id: null, audit_log_id: "owner-audit", created_at: new Date().toISOString() };
  }
}

function judgment(): ContentReviewJudgmentInput {
  return { reviewDomain: "CURRENTNESS", reviewedInputIdentity: context.reviewedInputIdentity, reviewedInputSnapshot: context.reviewedInputSnapshot, result: "REVIEW_PERFORMED_PASS", subjects: [...subjects], findings: [], idempotencyKey: "ise-currentness-judgment" };
}

test("resource-type dispatch rejects unknown resources and does not default to Secure Coding", async () => {
  await assert.rejects(() => resolveReviewedInputContextByResourceType("UNKNOWN_RESOURCE", new FakeAdapterDatabase()), (error: unknown) => (error as { code?: string }).code === "CONTENT_REVIEW_RESOURCE_TYPE_UNSUPPORTED");
  assert.equal(await getCanonicalFinalReviewEligibility("UNKNOWN_RESOURCE", new FakeAdapterDatabase()), null);
  const source = readFileSync("lib/services/content-review-input-resolver.ts", "utf8");
  assert.match(source, /CONTENT_REVISION_REGISTRATION/);
  assert.match(source, /CONTENT_REVIEW_RESOURCE_TYPE_UNSUPPORTED/);
});

test("ISE persistence context binds the judgment to the exact registration resource and CURRENTNESS domain", async () => {
  const db = new FakeAdapterDatabase();
  const value = judgment();
  const evaluation = evaluateReviewerSeparation({ reviewedInputIdentity: context.reviewedInputIdentity, resourceType: context.resourceType, resourceId: context.resourceId, judgmentSemanticIdentity: semanticReviewIdentity(value), reviewer: { id: "reviewer-a", roles: ["CONTENT_REVIEWER"] }, authorUserId: null, ownerUserId: "owner", ownerAttestationId: "owner-attestation", materialEditorUserIds: [], materialEditorProvenance: "UNKNOWN", provenanceClass: "UNKNOWN_AUTHOR", riskClass: "HIGH_TRUST", requiredReviewerCount: 2 });
  const result = await saveContentReviewJudgment(value, { id: "reviewer-a", roles: ["CONTENT_REVIEWER"] }, db, evaluation, async () => context);
  assert.equal(result.outcome, "NEW_JUDGMENT");
  assert.equal(result.judgment.reviewedInputIdentity, context.reviewedInputIdentity);
  assert.equal(db.evaluations[0]?.resource_type, "CONTENT_REVISION_REGISTRATION");
  assert.equal(db.evaluations[0]?.resource_id, context.resourceId);
});

test("ISE exact subject scope and required-domain omission fail closed", () => {
  const value = judgment();
  assert.doesNotThrow(() => assertJudgmentBoundToReviewedInput(value, context));
  assert.throws(() => assertJudgmentBoundToReviewedInput({ ...value, subjects: [subjects[0]] }, context), (error: unknown) => (error as { code?: string }).code === "CONTENT_REVIEW_SUBJECT_SCOPE_INVALID");
  assert.throws(() => assertJudgmentBoundToReviewedInput({ ...value, reviewDomain: "TECHNICAL" }, { ...context, requiredDomains: ["COPYRIGHT_RIGHTS"] }), (error: unknown) => (error as { code?: string }).code === "CONTENT_REVIEW_DOMAIN_NOT_REQUIRED");
});

test("every required ISE domain is independently mandatory", () => {
  for (const domain of context.requiredDomains) {
    const remaining = context.requiredDomains.filter((candidate) => candidate !== domain);
    assert.throws(() => assertJudgmentBoundToReviewedInput({ ...judgment(), reviewDomain: domain }, { ...context, requiredDomains: remaining }), (error: unknown) => (error as { code?: string }).code === "CONTENT_REVIEW_DOMAIN_NOT_REQUIRED");
  }
});
