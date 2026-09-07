import type { DatabaseProvider, DatabaseValue } from "./provider/database-provider.ts";
import {
  computeContentFinalReviewDecisionIdentity,
  normalizeContentFinalReviewDecision,
  type ContentFinalReviewDecision,
} from "../lib/policy/content-final-review-authority.ts";
import type { ContentFinalReviewAuthorityRecord, ContentFinalReviewAuthoritySubject } from "../lib/services/content-final-review-authority.ts";

const AUTHORITY_ACTION = "CONTENT_FINAL_REVIEW_DECISION_RECORDED";

export type AuthorityWriteInput = Readonly<{
  decision: ContentFinalReviewDecision;
  idempotencyKey: string;
  actorUserId: string;
  actorRole: string;
  requestId?: string | null;
}>;

export type AuthorityWriteResult = Readonly<{
  outcome: "NEW_AUTHORITY" | "IDEMPOTENT_DUPLICATE";
  authority: ContentFinalReviewAuthorityRecord;
}>;

export async function saveContentFinalReviewAuthority(
  input: AuthorityWriteInput,
  database: DatabaseProvider,
): Promise<AuthorityWriteResult> {
  if (database.kind !== "supabase") throw new Error("CONTENT_FINAL_REVIEW_POSTGRES_REQUIRED");
  const decision = normalizeContentFinalReviewDecision(input.decision);
  const semanticDecisionHash = computeContentFinalReviewDecisionIdentity(decision);
  const existing = await database.queryOne<AuthorityRow>({
    sql: "SELECT authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at FROM content_final_review_authorities WHERE idempotency_key = ? LIMIT 1",
    parameters: [input.idempotencyKey],
  });
  if (existing) {
    if (existing.semantic_decision_hash !== semanticDecisionHash) throw new Error("CONTENT_FINAL_REVIEW_IDEMPOTENCY_CONFLICT");
    return { outcome: "IDEMPOTENT_DUPLICATE", authority: await readAuthority(existing, database) };
  }

  const authorityId = crypto.randomUUID();
  const auditLogId = crypto.randomUUID();
  const now = new Date().toISOString();
  const metadata = JSON.stringify({
    contractVersion: decision.contractVersion,
    decisionType: decision.decisionType,
    semanticDecisionHash,
    candidateIdentity: decision.candidateIdentity,
    resourceType: decision.resourceType,
    scope: decision.scope,
    decisionOutcome: decision.decisionOutcome,
    publicationAuthority: decision.publicationAuthority,
  });
  const statements = [
    statement("INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)", [auditLogId, input.actorUserId, input.actorRole, AUTHORITY_ACTION, decision.resourceType, decision.candidateIdentity, input.requestId ?? null, metadata, now]),
    statement("INSERT INTO content_final_review_authorities (authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)", [authorityId, decision.contractVersion, decision.decisionType, semanticDecisionHash, input.idempotencyKey, decision.candidateIdentity, decision.resourceType, decision.scope, decision.decisionOutcome, decision.publicationAuthority, input.actorUserId, input.actorRole, auditLogId, now]),
    ...decision.subjects.map((subject) => statement("INSERT INTO content_final_review_authority_subjects (authority_id, subject_identity, semantic_ordinal) VALUES (?, ?, ?)", [authorityId, subject.subjectIdentity, subject.semanticOrdinal])),
  ];
  try {
    await database.transaction(statements);
  } catch (error) {
    const winner = await database.queryOne<AuthorityRow>({
      sql: "SELECT authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at FROM content_final_review_authorities WHERE idempotency_key = ? LIMIT 1",
      parameters: [input.idempotencyKey],
    });
    const semanticWinner = winner ?? await database.queryOne<AuthorityRow>({
      sql: "SELECT authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at FROM content_final_review_authorities WHERE semantic_decision_hash = ? LIMIT 1",
      parameters: [semanticDecisionHash],
    });
    if (semanticWinner?.semantic_decision_hash === semanticDecisionHash) return { outcome: "IDEMPOTENT_DUPLICATE", authority: await readAuthority(semanticWinner, database) };
    throw error;
  }
  const row = await database.queryOne<AuthorityRow>({
    sql: "SELECT authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at FROM content_final_review_authorities WHERE authority_id = ? LIMIT 1",
    parameters: [authorityId],
  });
  if (!row) throw new Error("CONTENT_FINAL_REVIEW_AUTHORITY_READBACK_MISSING");
  return { outcome: "NEW_AUTHORITY", authority: await readAuthority(row, database) };
}

export async function findExactContentFinalReviewAuthority(
  decision: ContentFinalReviewDecision,
  database: DatabaseProvider,
): Promise<ContentFinalReviewAuthorityRecord | null> {
  if (database.kind !== "supabase") return null;
  const normalized = normalizeContentFinalReviewDecision(decision);
  const candidateRows = await database.query<AuthorityRow>({
    sql: "SELECT authority_id, contract_version, decision_type, semantic_decision_hash, idempotency_key, candidate_identity, resource_type, scope, decision_outcome, authority_state, publication_authority, actor_user_id, actor_role, audit_log_id, created_at FROM content_final_review_authorities WHERE candidate_identity = ? AND resource_type = ? AND scope = ? AND contract_version = ? AND decision_type = ? AND authority_state = 'ACTIVE'",
    parameters: [normalized.candidateIdentity, normalized.resourceType, normalized.scope, normalized.contractVersion, normalized.decisionType],
  });
  if (candidateRows.rows.length !== 1) return null;
  const matches: ContentFinalReviewAuthorityRecord[] = [];
  for (const row of candidateRows.rows) {
    let authority: ContentFinalReviewAuthorityRecord;
    try { authority = await readAuthority(row, database); } catch { return null; }
    if (authority && authority.semanticDecisionHash === computeContentFinalReviewDecisionIdentity(normalized)) matches.push(authority);
  }
  if (matches.length !== 1 || !subjectsEqual(matches[0].subjects, normalized.subjects) || matches[0].decisionOutcome !== "APPROVED") return null;
  return matches[0];
}

type AuthorityRow = Record<string, unknown> & { authority_id: string; contract_version: string; decision_type: string; semantic_decision_hash: string; idempotency_key: string; candidate_identity: string; resource_type: string; scope: string; decision_outcome: "APPROVED" | "REJECTED"; authority_state: "ACTIVE" | "HISTORICAL" | "INVALIDATED"; publication_authority: "NOT_GRANTED"; actor_user_id: string; actor_role: string; audit_log_id: string; created_at: string };

async function readAuthority(row: AuthorityRow, database: DatabaseProvider): Promise<ContentFinalReviewAuthorityRecord> {
  const subjects = await database.query<SubjectRow>({ sql: "SELECT subject_identity, semantic_ordinal FROM content_final_review_authority_subjects WHERE authority_id = ? ORDER BY semantic_ordinal ASC", parameters: [row.authority_id] });
  if (subjects.rows.length === 0 || new Set(subjects.rows.map((subject) => subject.semantic_ordinal)).size !== subjects.rows.length) throw new Error("CONTENT_FINAL_REVIEW_AUTHORITY_MALFORMED");
  const audit = await database.queryOne<{ actor_user_id: string; action: string; resource_id: string; result: string; metadata_json: string }>({ sql: "SELECT actor_user_id, action, resource_id, result, metadata_json FROM admin_audit_logs WHERE id = ? LIMIT 1", parameters: [row.audit_log_id] });
  if (!audit || audit.actor_user_id !== row.actor_user_id || audit.action !== AUTHORITY_ACTION || audit.resource_id !== row.candidate_identity || audit.result !== "SUCCESS") throw new Error("CONTENT_FINAL_REVIEW_AUDIT_BINDING_INVALID");
  const auditMetadata = JSON.parse(audit.metadata_json) as Record<string, unknown>;
  if (auditMetadata.semanticDecisionHash !== row.semantic_decision_hash || auditMetadata.decisionOutcome !== row.decision_outcome) throw new Error("CONTENT_FINAL_REVIEW_AUDIT_BINDING_INVALID");
  return Object.freeze({ authorityId: row.authority_id, contractVersion: row.contract_version, decisionType: row.decision_type, semanticDecisionHash: row.semantic_decision_hash, idempotencyKey: row.idempotency_key, candidateIdentity: row.candidate_identity, resourceType: row.resource_type, scope: row.scope, decisionOutcome: row.decision_outcome, authorityState: row.authority_state, publicationAuthority: row.publication_authority, actorUserId: row.actor_user_id, actorRole: row.actor_role, auditLogId: row.audit_log_id, createdAt: row.created_at, subjects: Object.freeze(subjects.rows.map((subject) => Object.freeze({ subjectIdentity: subject.subject_identity, semanticOrdinal: Number(subject.semantic_ordinal) }))) });
}

function subjectsEqual(left: readonly ContentFinalReviewAuthoritySubject[], right: readonly { subjectIdentity: string; semanticOrdinal: number }[]) {
  if (left.length !== right.length) return false;
  return left.every((subject, index) => subject.subjectIdentity === right[index].subjectIdentity && subject.semanticOrdinal === right[index].semanticOrdinal);
}

type SubjectRow = { subject_identity: string; semantic_ordinal: number };
function statement(sql: string, parameters: readonly DatabaseValue[]) { return { sql, parameters }; }
