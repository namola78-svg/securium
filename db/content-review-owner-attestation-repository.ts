import type { DatabaseProvider, DatabaseStatement } from "./provider/database-provider.ts";
import { AppError } from "../lib/errors.ts";
import { CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, sha256, type AuthenticatedContentReviewer } from "../lib/policy/content-review-judgment.ts";
import { CONTENT_REVIEWER_SEPARATION_POLICY_V1 } from "../lib/policy/content-reviewer-separation.ts";
import { assertIseWaveAGovernanceDependencies, buildIseWaveAGovernanceContext } from "../lib/services/ise-wave-a-reviewed-input-adapter.ts";

export type OwnerAttestationInput = Readonly<{ resourceType: string; resourceId: string; reviewedInputIdentity: string; attestationType?: "RESPONSIBLE_OWNER"; idempotencyKey: string; supersedesAttestationId?: string | null }>;
export type OwnerAttestationRecord = Readonly<{ attestationId: string; resourceType: string; resourceId: string; reviewedInputIdentity: string; ownerUserId: string; policyVersion: typeof CONTENT_REVIEWER_SEPARATION_POLICY_V1; semanticIdentity: string; idempotencyKey: string; lifecycleState: "ACTIVE" | "HISTORICAL" | "INVALIDATED" | "SUPERSEDED"; supersedesAttestationId: string | null; auditLogId: string; createdAt: string }>;
export type IseWaveAOwnerAttestationIntent = Readonly<{ idempotencyKey: string; supersedesAttestationId?: string | null }>;
type OwnerRow = Record<string, unknown> & { attestation_id: string; resource_type: string; resource_id: string; reviewed_input_identity: string; owner_user_id: string; policy_version: typeof CONTENT_REVIEWER_SEPARATION_POLICY_V1; semantic_identity: string; idempotency_key: string; lifecycle_state: OwnerAttestationRecord["lifecycleState"]; supersedes_attestation_id: string | null; audit_log_id: string; created_at: string };
const select = "attestation_id, resource_type, resource_id, reviewed_input_identity, owner_user_id, policy_version, semantic_identity, idempotency_key, lifecycle_state, supersedes_attestation_id, audit_log_id, created_at";

export async function saveOwnerAttestation(input: OwnerAttestationInput, actor: AuthenticatedContentReviewer, database: DatabaseProvider): Promise<{ outcome: "NEW_ATTESTATION" | "IDEMPOTENT_DUPLICATE"; attestation: OwnerAttestationRecord }> {
  if (!actor || actor.status === "INACTIVE") throw new AppError("Authenticated owner is required.", 401, "UNAUTHENTICATED");
  if (!input.resourceType.trim() || !input.resourceId.trim() || !/^[a-f0-9]{64}$/.test(input.reviewedInputIdentity)) throw new AppError("Owner attestation binding is invalid.", 400, "CONTENT_REVIEW_OWNER_BINDING_INVALID");
  const semanticIdentity = sha256({ contractVersion: CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1, resourceType: input.resourceType, resourceId: input.resourceId, reviewedInputIdentity: input.reviewedInputIdentity, ownerUserId: actor.id, attestationType: input.attestationType ?? "RESPONSIBLE_OWNER", supersedesAttestationId: input.supersedesAttestationId ?? null });
  const byKey = await database.queryOne<OwnerRow>({ sql: `SELECT ${select} FROM content_review_owner_attestations WHERE idempotency_key = ? LIMIT 1`, parameters: [input.idempotencyKey] });
  if (byKey && byKey.semantic_identity !== semanticIdentity) throw new AppError("Owner attestation idempotency conflicts.", 409, "CONTENT_REVIEW_OWNER_IDEMPOTENCY_CONFLICT");
  if (byKey) return { outcome: "IDEMPOTENT_DUPLICATE", attestation: mapOwner(byKey) };
  if (input.supersedesAttestationId) await assertCompatibleOwnerSupersession(input, input.supersedesAttestationId, database);
  const active = await database.query<OwnerRow>({ sql: `SELECT ${select} FROM content_review_owner_attestations WHERE reviewed_input_identity = ? AND resource_type = ? AND resource_id = ? AND lifecycle_state = 'ACTIVE'`, parameters: [input.reviewedInputIdentity, input.resourceType, input.resourceId] });
  if (active.rows.some((row) => row.owner_user_id !== actor.id)) throw new AppError("A conflicting active owner exists.", 409, "CONTENT_REVIEW_OWNER_CONFLICT");
  const attestationId = crypto.randomUUID(); const auditLogId = crypto.randomUUID(); const now = new Date().toISOString();
  const metadata = JSON.stringify({ contractVersion: CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1, reviewedInputIdentity: input.reviewedInputIdentity, semanticIdentity, attestationId });
  const statements: DatabaseStatement[] = [
    { sql: "INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)", parameters: [auditLogId, actor.id, actor.roles.slice().sort().join(","), "CONTENT_REVIEW_OWNER_ATTESTED", "CONTENT_REVIEW_OWNER_ATTESTATION", attestationId, null, metadata, now] },
    { sql: "INSERT INTO content_review_owner_attestations (attestation_id, contract_version, resource_type, resource_id, reviewed_input_identity, owner_user_id, attestation_type, policy_version, semantic_identity, idempotency_key, lifecycle_state, supersedes_attestation_id, audit_log_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)", parameters: [attestationId, CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, input.resourceType, input.resourceId, input.reviewedInputIdentity, actor.id, input.attestationType ?? "RESPONSIBLE_OWNER", CONTENT_REVIEWER_SEPARATION_POLICY_V1, semanticIdentity, input.idempotencyKey, input.supersedesAttestationId ?? null, auditLogId, now] },
  ];
  await database.transaction(statements);
  const row = await database.queryOne<OwnerRow>({ sql: `SELECT ${select} FROM content_review_owner_attestations WHERE attestation_id = ? LIMIT 1`, parameters: [attestationId] });
  if (!row) throw new AppError("Owner attestation readback failed.", 500, "CONTENT_REVIEW_OWNER_READBACK_FAILED");
  return { outcome: "NEW_ATTESTATION", attestation: mapOwner(row) };
}

/** Server-owned ISE boundary: binding fields are reconstructed, never accepted from the caller. */
export async function saveIseWaveAOwnerAttestation(intent: IseWaveAOwnerAttestationIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider) {
  const context = await buildIseWaveAGovernanceContext(database);
  assertIseWaveAGovernanceDependencies(context);
  const reviewed = context.reviewedInput;
  return saveOwnerAttestation({
    resourceType: reviewed.resourceType,
    resourceId: reviewed.resourceId,
    reviewedInputIdentity: reviewed.reviewedInputIdentity,
    idempotencyKey: intent.idempotencyKey,
    supersedesAttestationId: intent.supersedesAttestationId ?? null,
  }, actor, database);
}

export async function findActiveOwnerAttestation(reviewedInputIdentity: string, database: DatabaseProvider): Promise<OwnerAttestationRecord | null> {
  const rows = await database.query<OwnerRow>({ sql: `SELECT ${select} FROM content_review_owner_attestations WHERE reviewed_input_identity = ? AND lifecycle_state = 'ACTIVE'`, parameters: [reviewedInputIdentity] });
  if (rows.rows.length > 1) throw new AppError("Conflicting active owners exist.", 409, "CONTENT_REVIEW_OWNER_CONFLICT");
  return rows.rows[0] ? mapOwner(rows.rows[0]) : null;
}

export function ownerAttestationSemanticIdentity(input: { resourceType: string; resourceId: string; reviewedInputIdentity: string; ownerUserId: string; attestationType: string; supersedesAttestationId: string | null }) {
  return sha256({ contractVersion: CONTENT_REVIEW_JUDGMENT_CONTRACT_V1, policyVersion: CONTENT_REVIEWER_SEPARATION_POLICY_V1, resourceType: input.resourceType, resourceId: input.resourceId, reviewedInputIdentity: input.reviewedInputIdentity, ownerUserId: input.ownerUserId, attestationType: input.attestationType, supersedesAttestationId: input.supersedesAttestationId });
}

function mapOwner(row: OwnerRow): OwnerAttestationRecord {
  const expected = ownerAttestationSemanticIdentity({ resourceType: row.resource_type, resourceId: row.resource_id, reviewedInputIdentity: row.reviewed_input_identity, ownerUserId: row.owner_user_id, attestationType: "RESPONSIBLE_OWNER", supersedesAttestationId: row.supersedes_attestation_id });
  if (expected !== row.semantic_identity) throw new AppError("Owner attestation semantic identity is invalid.", 409, "CONTENT_REVIEW_OWNER_IDENTITY_INVALID");
  return { attestationId: row.attestation_id, resourceType: row.resource_type, resourceId: row.resource_id, reviewedInputIdentity: row.reviewed_input_identity, ownerUserId: row.owner_user_id, policyVersion: row.policy_version, semanticIdentity: row.semantic_identity, idempotencyKey: row.idempotency_key, lifecycleState: row.lifecycle_state, supersedesAttestationId: row.supersedes_attestation_id, auditLogId: row.audit_log_id, createdAt: row.created_at };
}

async function assertCompatibleOwnerSupersession(input: OwnerAttestationInput, predecessorId: string, database: DatabaseProvider) {
  if (!predecessorId.trim()) throw new AppError("Owner supersession predecessor is invalid.", 409, "CONTENT_REVIEW_OWNER_SUPERSESSION_INVALID");
  const predecessor = await database.queryOne<OwnerRow>({ sql: `SELECT ${select} FROM content_review_owner_attestations WHERE attestation_id = ? LIMIT 1`, parameters: [predecessorId] });
  if (!predecessor || predecessor.resource_type !== input.resourceType || predecessor.resource_id !== input.resourceId || predecessor.reviewed_input_identity !== input.reviewedInputIdentity || predecessor.policy_version !== CONTENT_REVIEWER_SEPARATION_POLICY_V1 || predecessor.lifecycle_state !== "ACTIVE") throw new AppError("Owner supersession scope is incompatible.", 409, "CONTENT_REVIEW_OWNER_SUPERSESSION_SCOPE_INVALID");
}
