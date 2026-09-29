import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../lib/policy/stable-canonical-hash.ts";
import { choosePrimaryActorRole, sanitizeAuditMetadata } from "../lib/services/audit-service.ts";
import { loadCppgLedgerState } from "../lib/services/cppg-runtime-course-registration.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import { CppgPublicationRevocationError, getCppgPublicationEffectiveState } from "../lib/services/cppg-runtime-publication-revocation.ts";
import type { CppgPublicationRevocationFailureCode, CppgPublicationRevocationInput, CppgPublicationRevocationResult } from "../lib/services/cppg-runtime-publication-revocation.ts";

/** Test-only seam for synthetic authority in disposable PostgreSQL fixtures. */
export async function revokeCppgPublicationForTesting(
  input: CppgPublicationRevocationInput,
  owner: PostgresRuntimeAuthorityPersistence,
  hooks: Readonly<{ beforeAppend?: () => Promise<void>; afterAppend?: () => Promise<void> }> = {},
): Promise<CppgPublicationRevocationResult> {
  validateInput(input);
  if (!(owner instanceof PostgresRuntimeAuthorityPersistence)) throw new CppgPublicationRevocationError("REVOCATION_POLICY_DENIED", "Canonical PostgreSQL authority persistence is required.", 503);
  const command = {
    contractVersion: "CPPG_PUBLICATION_REVOCATION_V1",
    publicationId: input.publicationId,
    publicationSemanticIdentity: input.publicationSemanticIdentity,
    registrationSemanticIdentity: input.registrationSemanticIdentity,
    authorityId: input.authorityId,
    authoritySequence: input.authoritySequence,
    operation: "REVOKE",
    reasonCode: input.reasonCode,
    details: input.details ?? null,
  };
  const commandHash = await sha256Canonical(command);
  try {
    return await owner.withRegistrationTransaction(async (transactionOwner, executor) => {
      const root = await executor.query<{ authorityId: string }>(
        `SELECT authority_id AS "authorityId" FROM public.runtime_authority_roots
         WHERE authority_id = $1 FOR UPDATE`, [input.authorityId]);
      if (root.rows.length !== 1) throw failure("REVOCATION_AUTHORITY_UNAVAILABLE", "Canonical Runtime Authority root is missing.");
      const publication = await executor.query<PublicationRow>(
        `SELECT publication_id AS "publicationId", publication_semantic_identity AS "publicationSemanticIdentity",
                registration_semantic_identity AS "registrationSemanticIdentity", authority_id AS "authorityId",
                authority_sequence AS "authoritySequence", publication_state AS "publicationState"
         FROM public.cppg_publication_receipts WHERE publication_id = $1 FOR UPDATE`, [input.publicationId]);
      const receipt = publication.rows[0];
      if (!receipt) throw failure("PUBLICATION_NOT_FOUND", "Exact publication receipt was not found.", 404);
      if (receipt.publicationSemanticIdentity !== input.publicationSemanticIdentity || receipt.registrationSemanticIdentity !== input.registrationSemanticIdentity ||
          receipt.authorityId !== input.authorityId || Number(receipt.authoritySequence) !== input.authoritySequence) {
        throw failure("PUBLICATION_IDENTITY_MISMATCH", "Revocation target does not match the immutable publication receipt.");
      }
      if (receipt.publicationState !== "PUBLISHED") throw failure("PUBLICATION_IDENTITY_MISMATCH", "Publication receipt has an invalid immutable state.");
      const prior = await executor.query<RevocationRow>(
        `SELECT revocation_id AS "revocationId", command_hash AS "commandHash", idempotency_key AS "idempotencyKey",
                publication_id AS "publicationId", publication_semantic_identity AS "publicationSemanticIdentity",
                registration_semantic_identity AS "registrationSemanticIdentity", authority_id AS "authorityId",
                authority_sequence AS "authoritySequence", reason_code AS "reasonCode", recorded_at::text AS "recordedAt"
         FROM public.cppg_publication_revocations WHERE publication_id = $1 OR idempotency_key = $2 FOR UPDATE`,
        [input.publicationId, input.idempotencyKey]);
      const existing = prior.rows[0];
      if (existing) {
        if (existing.idempotencyKey === input.idempotencyKey && existing.commandHash === commandHash && existing.publicationId === input.publicationId) {
          return resultFrom("ALREADY_REVOKED", existing, input, commandHash);
        }
        if (existing.idempotencyKey === input.idempotencyKey) throw failure("REVOCATION_IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different revocation command.");
        throw failure("PUBLICATION_ALREADY_REVOKED", "Publication already has a canonical revocation event.");
      }
      const ledger = await loadCppgLedgerState(transactionOwner, input.authorityId);
      if (ledger.state !== "APPROVED_ACTIVE" || ledger.authoritySequence !== input.authoritySequence) {
        throw failure("REVOCATION_AUTHORITY_STALE", "Canonical Runtime Authority is revoked, superseded, or stale.");
      }
      const state = await getCppgPublicationEffectiveState(executor, input.registrationSemanticIdentity);
      if (state.state !== "PUBLISHED" || state.publicationId !== input.publicationId || state.publicationSemanticIdentity !== input.publicationSemanticIdentity) {
        throw failure(state.state === "REVOKED" ? "PUBLICATION_ALREADY_REVOKED" : "PUBLICATION_NOT_PUBLISHED", "Only the exact currently published receipt can be revoked.");
      }
      await hooks.beforeAppend?.();
      const revocationId = randomUUID();
      const inserted = await executor.query<{ recordedAt: string }>(
        `INSERT INTO public.cppg_publication_revocations
          (revocation_id, publication_id, publication_semantic_identity, registration_semantic_identity,
           authority_id, authority_sequence, actor_id, reason_code, details, previous_state, effective_state,
           idempotency_key, command_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PUBLISHED','REVOKED',$10,$11)
         RETURNING recorded_at::text AS "recordedAt"`,
        [revocationId, input.publicationId, input.publicationSemanticIdentity, input.registrationSemanticIdentity,
          input.authorityId, input.authoritySequence, input.actor.id, input.reasonCode, input.details ?? null,
          input.idempotencyKey, commandHash]);
      if (inserted.rowCount !== 1) throw failure("REVOCATION_POLICY_DENIED", "Revocation event append did not create exactly one row.");
      await hooks.afterAppend?.();
      const metadata = sanitizeAuditMetadata("CPPG_PUBLICATION_REVOCATION_SUCCEEDED", {
        revocationId, publicationIdentity: input.publicationSemanticIdentity,
        registrationIdentity: input.registrationSemanticIdentity, authorityId: input.authorityId,
        authoritySequence: input.authoritySequence, reasonCode: input.reasonCode,
        previousState: "PUBLISHED", effectiveState: "REVOKED", idempotencyKey: input.idempotencyKey,
        commandHash, result: "SUCCESS",
      });
      await executor.query(
        `INSERT INTO public.admin_audit_logs
          (id, actor_user_id, actor_role, action, resource_type, resource_id, result, request_id, metadata_json)
         VALUES ($1,$2,$3,'CPPG_PUBLICATION_REVOCATION_SUCCEEDED','CPPG_PUBLICATION',$4,'SUCCESS',$5,$6)`,
        [randomUUID(), input.actor.id, choosePrimaryActorRole(input.actor.roles), input.publicationId, input.requestId ?? null, JSON.stringify(metadata)]);
      const effective = await getCppgPublicationEffectiveState(executor, input.registrationSemanticIdentity);
      if (effective.state !== "REVOKED" || effective.revocationId !== revocationId) throw failure("REVOCATION_POLICY_DENIED", "Revocation effective-state readback failed.");
      const row: RevocationRow = {
        revocationId, commandHash, idempotencyKey: input.idempotencyKey, publicationId: input.publicationId,
        publicationSemanticIdentity: input.publicationSemanticIdentity, registrationSemanticIdentity: input.registrationSemanticIdentity,
        authorityId: input.authorityId, authoritySequence: input.authoritySequence, reasonCode: input.reasonCode,
        recordedAt: inserted.rows[0]!.recordedAt,
      };
      return resultFrom("REVOKED", row, input, commandHash);
    });
  } catch (error) {
    if (error instanceof CppgPublicationRevocationError) throw error;
    throw new CppgPublicationRevocationError("REVOCATION_POLICY_DENIED", "CPPG publication revocation transaction failed and was rolled back.", 503, error);
  }
}

type PublicationRow = { publicationId: string; publicationSemanticIdentity: string; registrationSemanticIdentity: string; authorityId: string; authoritySequence: number; publicationState: string };
type RevocationRow = { revocationId: string; commandHash: string; idempotencyKey: string; publicationId: string; publicationSemanticIdentity: string; registrationSemanticIdentity: string; authorityId: string; authoritySequence: number; reasonCode: string; recordedAt: string };
function resultFrom(outcome: CppgPublicationRevocationResult["outcome"], row: RevocationRow, _input: CppgPublicationRevocationInput, commandHash: string): CppgPublicationRevocationResult {
  return { outcome, revocationId: row.revocationId, publicationId: row.publicationId, publicationSemanticIdentity: row.publicationSemanticIdentity,
    registrationSemanticIdentity: row.registrationSemanticIdentity, authorityId: row.authorityId, authoritySequence: Number(row.authoritySequence),
    reasonCode: row.reasonCode, previousState: "PUBLISHED", effectiveState: "REVOKED", idempotencyKey: row.idempotencyKey,
    commandHash, recordedAt: row.recordedAt };
}
function validateInput(input: CppgPublicationRevocationInput): void {
  if (!input || !/^[a-f0-9-]{36}$/iu.test(input.publicationId) || !/^[a-f0-9]{64}$/u.test(input.publicationSemanticIdentity) || !/^[a-f0-9]{64}$/u.test(input.registrationSemanticIdentity)) throw failure("PUBLICATION_IDENTITY_MISMATCH", "Exact immutable publication and registration identities are required.", 400);
  if (!input.actor?.id?.trim() || !Array.isArray(input.actor.roles) || !Number.isSafeInteger(input.authoritySequence) || input.authoritySequence < 1) throw failure("REVOCATION_POLICY_DENIED", "Actor and exact current authority identity are required.", 400);
  if (!/^[A-Z][A-Z0-9_]{1,63}$/u.test(input.reasonCode) || typeof input.idempotencyKey !== "string" || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200 || (input.details != null && input.details.length > 1000)) throw failure("REVOCATION_POLICY_DENIED", "Reason code, bounded details, or idempotency key is invalid.", 400);
}
function failure(code: CppgPublicationRevocationFailureCode, message: string, status = 409): CppgPublicationRevocationError { return new CppgPublicationRevocationError(code, message, status); }
