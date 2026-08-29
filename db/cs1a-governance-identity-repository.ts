import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors.ts";
import { sanitizeAuditMetadata } from "../lib/services/audit-service.ts";
import { normalizeDatabaseError, DatabaseProviderError } from "./provider/database-error.ts";
import type { DatabaseProvider, DatabaseStatement } from "./provider/database-provider.ts";
import type { Cs1aHumanDecisionSubject } from "../lib/policy/cs1a-human-decision.ts";

export type Cs1aGovernanceIdentityInput = Readonly<{
  database: DatabaseProvider;
  actor: Readonly<{ id: string; roles: readonly string[] }>;
  contractVersion: string;
  humanDecisionHash: string;
  subjects: readonly Cs1aHumanDecisionSubject[];
  decision: string;
  reasonCode: string;
  publicationAuthority: string;
  requestId?: string | null;
}>;

export type Cs1aGovernanceDecisionRead = Readonly<{
  id: string;
  contractVersion: string;
  humanDecisionHash: string;
  decision: string;
  reasonCode: string;
  publicationAuthority: string;
  subjectCount: number;
  subjects: readonly Record<string, unknown>[];
  audit: Readonly<{ id: string; actorUserId: string; action: string; result: string; metadata: Record<string, unknown> }>;
}>;

/**
 * The only G1 write authority. All four writes are submitted through one
 * provider transaction; the provider owns the actual PostgreSQL BEGIN/COMMIT.
 */
export async function persistCs1aGovernanceDecision(input: Cs1aGovernanceIdentityInput) {
  const subjectIds = input.subjects.map((subject) => subject.resourceRevisionId);
  if (subjectIds.length === 0 || new Set(subjectIds).size !== subjectIds.length) {
    throw new AppError("The governance decision contains duplicate subjects.", 400, "CS1A_DUPLICATE_SUBJECT");
  }

  const decisionId = randomUUID();
  const auditLogId = randomUUID();
  const requestId = input.requestId ?? randomUUID();
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO cs1a_governance_decisions
        (id, contract_version, human_decision_hash, decision, reason_code, publication_authority, subject_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parameters: [decisionId, input.contractVersion, input.humanDecisionHash, input.decision, input.reasonCode, input.publicationAuthority, input.subjects.length],
    },
    ...input.subjects.map((subject) => subjectInsert(decisionId, subject)),
    {
      sql: `INSERT INTO admin_audit_logs
        (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json)
        VALUES (?, ?, ?, 'CS1A_GOVERNANCE_DECISION_CONFIRMED', 'CONTENT_REVISION', ?, 'SUCCESS', ?, ?)`,
      parameters: [
        auditLogId,
        input.actor.id,
        input.actor.roles[0] ?? "UNKNOWN",
        input.subjects[0]?.resourceId ?? "CS1A_DECISION",
        requestId,
        JSON.stringify(sanitizeAuditMetadata("CS1A_GOVERNANCE_DECISION_CONFIRMED", {
          policyVersion: input.subjects[0]?.policyVersion,
          resourceType: input.subjects[0]?.resourceType,
          resourceId: input.subjects[0]?.resourceId,
          resourceRevisionId: input.subjects[0]?.resourceRevisionId,
          revisionHash: input.subjects[0]?.revisionHash,
          decision: input.decision,
          reasonCode: input.reasonCode,
          sourceSetHash: input.subjects[0]?.sourceSetHash ?? input.humanDecisionHash,
          humanDecisionHash: input.humanDecisionHash,
          rightsDisposition: input.subjects[0]?.rightsDisposition,
          currentnessDisposition: input.subjects[0]?.currentnessDisposition,
          contentClass: input.subjects[0]?.contentClass,
          publicationAuthority: input.publicationAuthority,
        })),
      ],
    },
    {
      sql: `INSERT INTO cs1a_governance_decision_audits (decision_id, audit_log_id) VALUES (?, ?)`,
      parameters: [decisionId, auditLogId],
    },
  ];

  try {
    await input.database.transaction(statements);
  } catch (error) {
    const safe = normalizeDatabaseError(error, "transaction");
    if (safe instanceof DatabaseProviderError && safe.category === "unique_violation") {
      if (await hasCompleteExactDecision(input)) {
        throw new AppError("The exact governance decision already exists.", 409, "DUPLICATE_EXACT_GOVERNANCE_DECISION");
      }
      throw new AppError("Governance decision persistence violated database integrity.", 409, "CS1A_GOVERNANCE_INTEGRITY_FAILURE");
    }
    throw safe;
  }

  const read = await readCs1aGovernanceDecision(input.database, input.contractVersion, input.humanDecisionHash);
  const readSubjectIds = read?.subjects.map((subject) => String(subject.canonicalSubjectIdentity ?? "")).sort() ?? [];
  if (!read || read.subjectCount !== subjectIds.length || readSubjectIds.length !== subjectIds.length || new Set(readSubjectIds).size !== subjectIds.length || readSubjectIds.join("\u0000") !== [...subjectIds].sort().join("\u0000") || read.decision !== input.decision || read.reasonCode !== input.reasonCode || read.publicationAuthority !== input.publicationAuthority || !read.subjects.every((subject) => subject.publicationAuthority === input.subjects.find((candidate) => candidate.resourceRevisionId === subject.canonicalSubjectIdentity)?.publicationAuthority)) {
    throw new AppError("Governance decision read-back failed.", 409, "CS1A_GOVERNANCE_READBACK_INVALID");
  }
  return { decisionId, actorAuditLogId: auditLogId, decision: read };
}

export async function readCs1aGovernanceDecision(database: DatabaseProvider, contractVersion: string, humanDecisionHash: string): Promise<Cs1aGovernanceDecisionRead | null> {
  const header = await database.queryOne<Record<string, unknown>>({
    sql: `SELECT id, contract_version, human_decision_hash, decision, reason_code, publication_authority, subject_count
      FROM cs1a_governance_decisions WHERE contract_version = ? AND human_decision_hash = ?`,
    parameters: [contractVersion, humanDecisionHash],
  });
  if (!header) return null;
  const subjectRows = await database.query<Record<string, unknown>>({
    sql: `SELECT * FROM cs1a_governance_decision_subjects WHERE decision_id = ? ORDER BY canonical_subject_identity`,
    parameters: [header.id as string],
  });
  const subjects = subjectRows.rows.map((row) => ({
    ...row,
    canonicalSubjectIdentity: row.canonical_subject_identity,
    publicationAuthority: row.publication_authority,
  }));
  const audit = await database.queryOne<Record<string, unknown>>({
    sql: `SELECT a.id, a.actor_user_id, a.action, a.result, a.metadata_json
      FROM cs1a_governance_decision_audits b JOIN admin_audit_logs a ON a.id = b.audit_log_id
      WHERE b.decision_id = ?`,
    parameters: [header.id as string],
  });
  if (!audit) throw new AppError("Governance decision is incomplete.", 409, "CS1A_GOVERNANCE_INCOMPLETE");
  if (Number(header.subject_count) !== subjects.length || subjects.some((subject) => typeof subject.publicationAuthority !== "string" || subject.publicationAuthority.length === 0)) {
    throw new AppError("Governance decision subject read-back is inconsistent.", 409, "CS1A_GOVERNANCE_INTEGRITY_FAILURE");
  }
  return {
    id: header.id as string,
    contractVersion: header.contract_version as string,
    humanDecisionHash: header.human_decision_hash as string,
    decision: header.decision as string,
    reasonCode: header.reason_code as string,
    publicationAuthority: header.publication_authority as string,
    subjectCount: Number(header.subject_count),
    subjects,
    audit: {
      id: audit.id as string,
      actorUserId: audit.actor_user_id as string,
      action: audit.action as string,
      result: audit.result as string,
      metadata: parseJson(audit.metadata_json),
    },
  };
}

function subjectInsert(decisionId: string, subject: Cs1aHumanDecisionSubject): DatabaseStatement {
  return {
    sql: `INSERT INTO cs1a_governance_decision_subjects
      (id, decision_id, canonical_subject_identity, governance_scope, resource_type, resource_id, content_hash, revision_hash, policy_version, decision, reason_code, rights_disposition, currentness_disposition, authoring_origin, content_class, source_origin, publication_authority, source_authority, source_manifest_ref, source_set_hash, parent_revision_id, immutable_provenance_identity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    parameters: [randomUUID(), decisionId, subject.resourceRevisionId, subject.governanceScope, subject.resourceType, subject.resourceId, subject.contentHash, subject.revisionHash, subject.policyVersion, subject.decision, subject.reasonCode, subject.rightsDisposition, subject.currentnessDisposition, subject.authoringOrigin, subject.contentClass, subject.sourceOrigin, subject.publicationAuthority, subject.sourceAuthority ?? null, subject.sourceManifestRef ?? null, subject.sourceSetHash ?? null, subject.parentRevisionId ?? null, subject.immutableProvenanceIdentity ?? null],
  };
}

function parseJson(value: unknown): Record<string, unknown> {
  try { return JSON.parse(String(value ?? "{}")) as Record<string, unknown>; } catch { return {}; }
}

async function hasCompleteExactDecision(input: Cs1aGovernanceIdentityInput): Promise<boolean> {
  try {
    const existing = await readCs1aGovernanceDecision(input.database, input.contractVersion, input.humanDecisionHash);
    if (!existing || existing.subjectCount !== input.subjects.length || existing.decision !== input.decision || existing.reasonCode !== input.reasonCode || existing.publicationAuthority !== input.publicationAuthority) return false;
    const expected = input.subjects.map((subject) => subject.resourceRevisionId).sort();
    const actual = existing.subjects.map((subject) => String(subject.canonicalSubjectIdentity ?? "")).sort();
    return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  } catch {
    return false;
  }
}
