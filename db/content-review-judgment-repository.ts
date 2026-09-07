import type { DatabaseProvider, DatabaseStatement } from "./provider/database-provider.ts";
import { AppError } from "../lib/errors.ts";
import { CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, findingSemanticIdentity, semanticReviewIdentity, sha256, validateContentReviewJudgmentInput, type AuthenticatedContentReviewer, type ContentReviewFindingInput, type ContentReviewJudgmentInput, type ContentReviewLifecycle, type ContentReviewResult, type ContentReviewSubjectBinding } from "../lib/policy/content-review-judgment.ts";
import { CONTENT_REVIEWER_SEPARATION_POLICY_V1, recomputeReviewerSeparationSemanticIdentity, type ReviewerSeparationEvaluation } from "../lib/policy/content-reviewer-separation.ts";
import { findPolicyEvaluationsByJudgmentId } from "./content-review-policy-evaluation-repository.ts";
import { findActiveOwnerAttestation } from "./content-review-owner-attestation-repository.ts";
import { assertJudgmentBoundToReviewedInput, resolveSecureCodingReviewedInputContext, type ServerOwnedReviewedInputResolver } from "../lib/services/content-review-input-resolver.ts";
import { evaluateReviewerSeparation } from "../lib/policy/content-reviewer-separation.ts";

export const CONTENT_REVIEW_JUDGMENT_AUDIT_ACTION = "CONTENT_REVIEW_JUDGMENT_RECORDED";
export type ContentReviewJudgmentRecord = { judgmentId: string; contractVersion: typeof CONTENT_REVIEW_JUDGMENT_CONTRACT_V1; reviewDomain: ContentReviewJudgmentInput["reviewDomain"]; reviewedInputIdentity: string; reviewedInputSnapshot: Record<string, unknown>; semanticReviewIdentity: string; result: ContentReviewResult; lifecycleState: ContentReviewLifecycle; reviewerUserId: string; auditLogId: string; idempotencyKey: string; supersedesJudgmentId: string | null; createdAt: string; subjects: ContentReviewSubjectBinding[]; findings: Array<ContentReviewFindingInput & { findingSemanticIdentity: string }> };
type JudgmentRow = Record<string, unknown> & { judgment_id: string; contract_version: typeof CONTENT_REVIEW_JUDGMENT_CONTRACT_V1; review_domain: ContentReviewJudgmentInput["reviewDomain"]; reviewed_input_identity: string; reviewed_input_snapshot_json: string; semantic_review_identity: string; result: ContentReviewResult; lifecycle_state: ContentReviewLifecycle; reviewer_user_id: string; audit_log_id: string; idempotency_key: string; supersedes_judgment_id: string | null; created_at: string };
const select = "judgment_id, contract_version, review_domain, reviewed_input_identity, reviewed_input_snapshot_json, semantic_review_identity, result, lifecycle_state, reviewer_user_id, audit_log_id, idempotency_key, supersedes_judgment_id, created_at";

export async function saveContentReviewJudgment(input: ContentReviewJudgmentInput, actor: AuthenticatedContentReviewer, database: DatabaseProvider, policyEvaluation: ReviewerSeparationEvaluation, resolver: ServerOwnedReviewedInputResolver = resolveSecureCodingReviewedInputContext): Promise<{ outcome: "NEW_JUDGMENT" | "IDEMPOTENT_DUPLICATE"; judgment: ContentReviewJudgmentRecord }> {
  const canonical = await rebuildCanonicalWriteContext(input, actor, database, policyEvaluation, resolver);
  input = canonical.input;
  policyEvaluation = canonical.evaluation;
  validateContentReviewJudgmentInput(input);
  const semanticIdentity = semanticReviewIdentity(input);
  const conflictSlotIdentity = contentReviewConflictSlotIdentity(input);
  if (!policyEvaluation || policyEvaluation.result !== "ALLOW" || policyEvaluation.reviewer.id !== actor.id || policyEvaluation.reviewedInputIdentity !== input.reviewedInputIdentity || policyEvaluation.judgmentSemanticIdentity !== semanticIdentity || policyEvaluation.semanticIdentity !== recomputeReviewerSeparationSemanticIdentity(policyEvaluation)) throw new AppError("A current server policy evaluation is required.", 409, "CONTENT_REVIEW_POLICY_EVALUATION_REQUIRED");
  const byKey = await database.queryOne<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE idempotency_key = ? LIMIT 1`, parameters: [input.idempotencyKey] });
  if (byKey && byKey.semantic_review_identity !== semanticIdentity) throw new AppError("Content review idempotency identity conflicts with the semantic judgment.", 409, "CONTENT_REVIEW_IDEMPOTENCY_CONFLICT");
  if (byKey) return { outcome: "IDEMPOTENT_DUPLICATE", judgment: await readContentReviewJudgment(byKey, database) };
  const bySemantic = await database.queryOne<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE semantic_review_identity = ? AND reviewer_user_id = ? LIMIT 1`, parameters: [semanticIdentity, actor.id] });
  if (bySemantic) return { outcome: "IDEMPOTENT_DUPLICATE", judgment: await readContentReviewJudgment(bySemantic, database) };
  if (input.supersedesJudgmentId) await assertCompatibleSupersession(input, input.supersedesJudgmentId, database);
  const judgmentId = crypto.randomUUID(); const auditLogId = crypto.randomUUID(); const evaluationId = crypto.randomUUID(); const now = new Date().toISOString();
  const metadata = JSON.stringify({ contractVersion: CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, reviewDomain: input.reviewDomain, reviewedInputIdentity: input.reviewedInputIdentity, semanticReviewIdentity: semanticIdentity, result: input.result, judgmentId, policyVersion: policyEvaluation.policyVersion, policyEvaluationId: evaluationId });
  const statements: DatabaseStatement[] = [
    { sql: "INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)", parameters: [auditLogId, actor.id, actor.roles.slice().sort().join(","), CONTENT_REVIEW_JUDGMENT_AUDIT_ACTION, "CONTENT_REVIEW_JUDGMENT", judgmentId, null, metadata, now] },
    { sql: "INSERT INTO content_review_judgments (judgment_id, contract_version, review_domain, reviewed_input_identity, reviewed_input_snapshot_json, semantic_review_identity, result, lifecycle_state, reviewer_user_id, audit_log_id, idempotency_key, supersedes_judgment_id, created_at, conflict_slot_identity) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?)", parameters: [judgmentId, CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, input.reviewDomain, input.reviewedInputIdentity, JSON.stringify(input.reviewedInputSnapshot), semanticIdentity, input.result, actor.id, auditLogId, input.idempotencyKey, input.supersedesJudgmentId ?? null, now, conflictSlotIdentity] },
    ...input.subjects.map((subject) => ({ sql: "INSERT INTO content_review_judgment_subjects (judgment_id, subject_identity, resource_revision_id, content_semantic_hash, semantic_ordinal) VALUES (?, ?, ?, ?, ?)", parameters: [judgmentId, subject.subjectIdentity, subject.resourceRevisionId, subject.contentSemanticHash, subject.semanticOrdinal] })),
    ...input.findings.map((finding) => ({ sql: "INSERT INTO content_review_findings (finding_id, judgment_id, finding_semantic_identity, subject_identity, category, severity, disposition, material_facts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", parameters: [crypto.randomUUID(), judgmentId, findingSemanticIdentity(finding, input.reviewDomain, input.reviewedInputIdentity), finding.subjectIdentity ?? null, finding.category.trim(), finding.severity, finding.disposition, JSON.stringify(finding.materialFacts)] })),
    { sql: "INSERT INTO content_review_policy_evaluations (evaluation_id, judgment_id, policy_version, reviewed_input_identity, resource_type, resource_id, judgment_semantic_identity, reviewer_user_id, owner_attestation_id, author_user_id, owner_user_id, material_editor_user_ids_json, material_editor_provenance, provenance_class, risk_class, required_reviewer_count, reviewer_slot, evaluation_result, reason_codes_json, semantic_identity, idempotency_key, audit_log_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ALLOW', ?, ?, ?, ?, ?)", parameters: [evaluationId, judgmentId, CONTENT_REVIEWER_SEPARATION_POLICY_V1, policyEvaluation.reviewedInputIdentity, policyEvaluation.resourceType, policyEvaluation.resourceId, policyEvaluation.judgmentSemanticIdentity, actor.id, policyEvaluation.ownerAttestationId ?? null, policyEvaluation.authorUserId, policyEvaluation.ownerUserId, JSON.stringify([...policyEvaluation.materialEditorUserIds].sort()), policyEvaluation.materialEditorProvenance ?? "KNOWN", policyEvaluation.provenanceClass, policyEvaluation.riskClass, policyEvaluation.requiredReviewerCount, policyEvaluation.reviewerSlot ?? 1, JSON.stringify(policyEvaluation.reasonCodes), policyEvaluation.semanticIdentity, `policy-${policyEvaluation.semanticIdentity}`, auditLogId, now] },
  ];
  try { await database.transaction(statements); } catch (error) {
    const raced = await database.queryOne<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE idempotency_key = ? LIMIT 1`, parameters: [input.idempotencyKey] });
    if (raced?.semantic_review_identity === semanticIdentity) return { outcome: "IDEMPOTENT_DUPLICATE", judgment: await readContentReviewJudgment(raced, database) };
    if (isActiveSlotConflict(error)) throw new AppError("A conflicting active content review judgment occupies this slot.", 409, "CONTENT_REVIEW_ACTIVE_SLOT_CONFLICT");
    throw error;
  }
  const row = await database.queryOne<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE judgment_id = ? LIMIT 1`, parameters: [judgmentId] });
  if (!row) throw new AppError("Content review judgment readback failed.", 500, "CONTENT_REVIEW_READBACK_FAILED");
  const evaluations = await findPolicyEvaluationsByJudgmentId(judgmentId, database);
  if (evaluations.length !== 1 || evaluations[0]?.evaluationResult !== "ALLOW" || evaluations[0]?.semanticIdentity !== policyEvaluation.semanticIdentity) throw new AppError("Content review policy evaluation readback failed.", 500, "CONTENT_REVIEW_POLICY_EVALUATION_READBACK_FAILED");
  return { outcome: "NEW_JUDGMENT", judgment: await readContentReviewJudgment(row, database) };
}

function isActiveSlotConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "23514" && typeof candidate.message === "string" && candidate.message.includes("Conflicting active content review judgment occupies this slot");
}

function contentReviewConflictSlotIdentity(input: ContentReviewJudgmentInput): string {
  return sha256({
    reviewedInputIdentity: input.reviewedInputIdentity,
    reviewDomain: input.reviewDomain,
    subjects: input.subjects.map((subject) => ({
      subjectIdentity: subject.subjectIdentity,
      resourceRevisionId: subject.resourceRevisionId,
      contentSemanticHash: subject.contentSemanticHash,
      semanticOrdinal: subject.semanticOrdinal,
    })),
  });
}

async function rebuildCanonicalWriteContext(input: ContentReviewJudgmentInput, actor: AuthenticatedContentReviewer, database: DatabaseProvider, suppliedEvaluation: ReviewerSeparationEvaluation, resolver: ServerOwnedReviewedInputResolver): Promise<{ input: ContentReviewJudgmentInput; evaluation: ReviewerSeparationEvaluation }> {
  const canonical = await resolver(database);
  assertJudgmentBoundToReviewedInput(input, canonical);
  const candidate = { ...input };
  const owner = await findActiveOwnerAttestation(canonical.reviewedInputIdentity, database);
  const revisionId = candidate.subjects[0]?.resourceRevisionId ?? "";
  const revision = revisionId ? await database.queryOne<{ created_by: string | null }>({ sql: "SELECT created_by FROM content_revisions WHERE id = ? LIMIT 1", parameters: [revisionId] }) : null;
  const authorUserId = revision?.created_by ?? null;
  const expectedEvaluation = evaluateReviewerSeparation({
    reviewedInputIdentity: candidate.reviewedInputIdentity,
    resourceType: canonical.resourceType,
    resourceId: canonical.resourceId || revisionId || "SERVER_RESOLVED",
    judgmentSemanticIdentity: semanticReviewIdentity(candidate),
    reviewer: actor,
    authorUserId,
    ownerUserId: owner?.ownerUserId ?? null,
    ownerAttestationId: owner?.attestationId ?? null,
    materialEditorUserIds: [],
    materialEditorProvenance: "UNKNOWN",
    provenanceClass: authorUserId ? "KNOWN_AUTHOR" : "UNKNOWN_AUTHOR",
    riskClass: canonical.riskClass,
    requiredReviewerCount: canonical.requiredReviewerCount,
    reviewerSlot: 1,
  });
  if (suppliedEvaluation?.semanticIdentity !== expectedEvaluation.semanticIdentity || suppliedEvaluation.reviewer.id !== actor.id || suppliedEvaluation.result !== expectedEvaluation.result) throw new AppError("A current server policy evaluation is required.", 409, "CONTENT_REVIEW_POLICY_EVALUATION_REQUIRED");
  return { input: candidate, evaluation: expectedEvaluation };
}

export async function findActiveContentReviewJudgments(reviewedInputIdentity: string, reviewDomain: ContentReviewJudgmentInput["reviewDomain"], database: DatabaseProvider) {
  const result = await database.query<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE reviewed_input_identity = ? AND review_domain = ? AND lifecycle_state = 'ACTIVE' AND judgment_id NOT IN (SELECT supersedes_judgment_id FROM content_review_judgments WHERE supersedes_judgment_id IS NOT NULL AND lifecycle_state = 'ACTIVE') AND EXISTS (SELECT 1 FROM content_review_policy_evaluations policy_eval WHERE policy_eval.judgment_id = content_review_judgments.judgment_id AND policy_eval.reviewed_input_identity = content_review_judgments.reviewed_input_identity AND policy_eval.evaluation_result = 'ALLOW' AND policy_eval.policy_version = 'CONTENT_REVIEWER_SEPARATION_POLICY_V1') ORDER BY created_at ASC`, parameters: [reviewedInputIdentity, reviewDomain] });
  const records: ContentReviewJudgmentRecord[] = [];
  for (const row of result.rows) { try { records.push(await readContentReviewJudgment(row, database)); } catch { return []; } }
  return records;
}

async function readContentReviewJudgment(row: JudgmentRow, database: DatabaseProvider): Promise<ContentReviewJudgmentRecord> {
  const subjects = await database.query<{ subject_identity: string; resource_revision_id: string; content_semantic_hash: string; semantic_ordinal: number }>({ sql: "SELECT subject_identity, resource_revision_id, content_semantic_hash, semantic_ordinal FROM content_review_judgment_subjects WHERE judgment_id = ? ORDER BY semantic_ordinal ASC", parameters: [row.judgment_id] });
  const findings = await database.query<{ finding_semantic_identity: string; subject_identity: string | null; category: string; severity: ContentReviewFindingInput["severity"]; disposition: ContentReviewFindingInput["disposition"]; material_facts_json: string }>({ sql: "SELECT finding_semantic_identity, subject_identity, category, severity, disposition, material_facts_json FROM content_review_findings WHERE judgment_id = ? ORDER BY finding_semantic_identity ASC", parameters: [row.judgment_id] });
  const audit = await database.queryOne<{ actor_user_id: string; action: string; resource_id: string; result: string; metadata_json: string }>({ sql: "SELECT actor_user_id, action, resource_id, result, metadata_json FROM admin_audit_logs WHERE id = ? LIMIT 1", parameters: [row.audit_log_id] });
  if (!audit || audit.actor_user_id !== row.reviewer_user_id || audit.action !== CONTENT_REVIEW_JUDGMENT_AUDIT_ACTION || audit.resource_id !== row.judgment_id || audit.result !== "SUCCESS") throw new AppError("Content review audit binding is invalid.", 409, "CONTENT_REVIEW_AUDIT_BINDING_INVALID");
  const metadata = JSON.parse(audit.metadata_json) as Record<string, unknown>;
  if (metadata.semanticReviewIdentity !== row.semantic_review_identity) throw new AppError("Content review audit semantic binding is invalid.", 409, "CONTENT_REVIEW_AUDIT_SEMANTIC_BINDING_INVALID");
  const subjectBindings = subjects.rows.map((s) => ({ subjectIdentity: s.subject_identity, resourceRevisionId: s.resource_revision_id, contentSemanticHash: s.content_semantic_hash, semanticOrdinal: s.semantic_ordinal }));
  const findingInputs = findings.rows.map((f) => ({ subjectIdentity: f.subject_identity, category: f.category, severity: f.severity, disposition: f.disposition, materialFacts: JSON.parse(f.material_facts_json) as Record<string, unknown>, findingSemanticIdentity: f.finding_semantic_identity }));
  for (const finding of findingInputs) if (finding.findingSemanticIdentity !== findingSemanticIdentity(finding, row.review_domain, row.reviewed_input_identity)) throw new AppError("Content review finding identity is invalid.", 409, "CONTENT_REVIEW_FINDING_IDENTITY_INVALID");
  const rebuiltInput: ContentReviewJudgmentInput = { contractVersion: row.contract_version, reviewDomain: row.review_domain, reviewedInputIdentity: row.reviewed_input_identity, reviewedInputSnapshot: JSON.parse(row.reviewed_input_snapshot_json) as Record<string, unknown>, result: row.result, subjects: subjectBindings, findings: findingInputs, idempotencyKey: row.idempotency_key, supersedesJudgmentId: row.supersedes_judgment_id };
  if (semanticReviewIdentity(rebuiltInput) !== row.semantic_review_identity) throw new AppError("Content review semantic identity is invalid.", 409, "CONTENT_REVIEW_SEMANTIC_IDENTITY_INVALID");
  return { judgmentId: row.judgment_id, contractVersion: row.contract_version, reviewDomain: row.review_domain, reviewedInputIdentity: row.reviewed_input_identity, reviewedInputSnapshot: rebuiltInput.reviewedInputSnapshot, semanticReviewIdentity: row.semantic_review_identity, result: row.result, lifecycleState: row.lifecycle_state, reviewerUserId: row.reviewer_user_id, auditLogId: row.audit_log_id, idempotencyKey: row.idempotency_key, supersedesJudgmentId: row.supersedes_judgment_id, createdAt: row.created_at, subjects: subjectBindings, findings: findingInputs };
}

async function assertCompatibleSupersession(input: ContentReviewJudgmentInput, predecessorId: string, database: DatabaseProvider): Promise<void> {
  const predecessor = await database.queryOne<JudgmentRow>({ sql: `SELECT ${select} FROM content_review_judgments WHERE judgment_id = ? LIMIT 1`, parameters: [predecessorId] });
  if (!predecessor || predecessor.review_domain !== input.reviewDomain || predecessor.reviewed_input_identity !== input.reviewedInputIdentity || predecessor.lifecycle_state !== "ACTIVE") throw new AppError("Supersession scope is incompatible.", 409, "CONTENT_REVIEW_SUPERSESSION_SCOPE_INVALID");
  const priorSubjects = await database.query<{ subject_identity: string; resource_revision_id: string; content_semantic_hash: string; semantic_ordinal: number }>({ sql: "SELECT subject_identity, resource_revision_id, content_semantic_hash, semantic_ordinal FROM content_review_judgment_subjects WHERE judgment_id = ? ORDER BY semantic_ordinal ASC", parameters: [predecessorId] });
  if (priorSubjects.rows.length !== input.subjects.length || priorSubjects.rows.some((subject, index) => subject.subject_identity !== input.subjects[index]?.subjectIdentity || subject.resource_revision_id !== input.subjects[index]?.resourceRevisionId || subject.content_semantic_hash !== input.subjects[index]?.contentSemanticHash || Number(subject.semantic_ordinal) !== input.subjects[index]?.semanticOrdinal)) throw new AppError("Supersession subject scope is incompatible.", 409, "CONTENT_REVIEW_SUPERSESSION_SUBJECTS_INVALID");
}
