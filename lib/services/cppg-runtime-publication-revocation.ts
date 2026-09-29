import { AppError } from "../errors.ts";
import { PostgresRuntimeAuthorityPersistence } from "../../db/runtime-authority-postgres-persistence.ts";
import type { PostgresTransactionExecutor } from "../../db/provider/postgres-database-provider.ts";

export const PRODUCTION_REVOCATION_AUTHORIZED = false as const;

export type CppgPublicationEffectiveState = "UNPUBLISHED" | "PUBLISHED" | "REVOKED";
export type CppgPublicationEffectiveStateResult = Readonly<{
  state: CppgPublicationEffectiveState;
  publicationId: string | null;
  publicationSemanticIdentity: string | null;
  registrationSemanticIdentity: string;
  revocationId: string | null;
}>;

export type CppgPublicationRevocationInput = Readonly<{
  publicationId: string;
  publicationSemanticIdentity: string;
  registrationSemanticIdentity: string;
  authorityId: string;
  authoritySequence: number;
  actor: Readonly<{ id: string; roles: readonly string[] }>;
  reasonCode: string;
  details?: string | null;
  idempotencyKey: string;
  requestId?: string | null;
}>;

export type CppgPublicationRevocationResult = Readonly<{
  outcome: "REVOKED" | "ALREADY_REVOKED";
  revocationId: string;
  publicationId: string;
  publicationSemanticIdentity: string;
  registrationSemanticIdentity: string;
  authorityId: string;
  authoritySequence: number;
  reasonCode: string;
  previousState: "PUBLISHED";
  effectiveState: "REVOKED";
  idempotencyKey: string;
  commandHash: string;
  recordedAt: string;
}>;

export type CppgPublicationRevocationFailureCode =
  | "REVOCATION_AUTHORITY_UNAVAILABLE" | "REVOCATION_AUTHORITY_STALE"
  | "PUBLICATION_NOT_FOUND" | "PUBLICATION_IDENTITY_MISMATCH"
  | "PUBLICATION_NOT_PUBLISHED" | "REVOCATION_IDEMPOTENCY_CONFLICT"
  | "PUBLICATION_ALREADY_REVOKED" | "REVOCATION_POLICY_DENIED";

export class CppgPublicationRevocationError extends AppError {
  declare readonly code: CppgPublicationRevocationFailureCode;
  constructor(code: CppgPublicationRevocationFailureCode, message: string, status = 409, cause?: unknown) {
    super(message, status, code);
    this.name = "CppgPublicationRevocationError";
    this.code = code;
    if (cause !== undefined) Object.defineProperty(this, "cause", { value: cause, configurable: true });
  }
}

/** Exact central projection; a receipt stays PUBLISHED as an immutable fact. */
export async function getCppgPublicationEffectiveState(
  executor: PostgresTransactionExecutor,
  registrationSemanticIdentity: string,
): Promise<CppgPublicationEffectiveStateResult> {
  if (!/^[a-f0-9]{64}$/u.test(registrationSemanticIdentity)) throw new CppgPublicationRevocationError("PUBLICATION_IDENTITY_MISMATCH", "Exact registration identity is required.", 400);
  const result = await executor.query<{ publicationId: string; publicationSemanticIdentity: string; registrationSemanticIdentity: string; revocationId: string | null }>(
    `SELECT p.publication_id AS "publicationId", p.publication_semantic_identity AS "publicationSemanticIdentity",
            p.registration_semantic_identity AS "registrationSemanticIdentity", r.revocation_id AS "revocationId"
     FROM public.cppg_publication_receipts p
     LEFT JOIN public.cppg_publication_revocations r ON r.publication_id = p.publication_id
     WHERE p.registration_semantic_identity = $1`, [registrationSemanticIdentity]);
  const row = result.rows[0];
  if (!row) return { state: "UNPUBLISHED", publicationId: null, publicationSemanticIdentity: null, registrationSemanticIdentity, revocationId: null };
  return {
    state: row.revocationId ? "REVOKED" : "PUBLISHED",
    publicationId: row.publicationId,
    publicationSemanticIdentity: row.publicationSemanticIdentity,
    registrationSemanticIdentity: row.registrationSemanticIdentity,
    revocationId: row.revocationId,
  };
}

/** Production remains closed until a canonical publication-revocation policy is established. */
export async function revokeCppgPublication(
  _input: CppgPublicationRevocationInput,
  _owner: PostgresRuntimeAuthorityPersistence,
): Promise<CppgPublicationRevocationResult> {
  void _input;
  void _owner;
  throw new CppgPublicationRevocationError("REVOCATION_POLICY_DENIED", "Production CPPG publication revocation authority has not been established.", 403);
}
