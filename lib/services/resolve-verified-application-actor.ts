import type {
  AuthIdentityTuple,
  VerifiedApplicationActorRow,
} from "../../db/user-auth-identity-binding-repository.ts";
import type { AuthIdentityBindingLookupDatabase } from "../../db/user-auth-identity-binding-repository.ts";

export type VerifiedApplicationActor = { userId: string };

export function resolveVerifiedApplicationActorFromRows(
  rows: readonly VerifiedApplicationActorRow[],
): VerifiedApplicationActor | null {
  if (rows.length !== 1) return null;
  const row = rows[0];
  if (row.bindingStatus !== "ACTIVE" || row.applicationUserStatus !== "ACTIVE") return null;
  if (!row.applicationUserId || !row.bindingId) return null;
  return { userId: row.applicationUserId };
}

/** Exact external identity lookup only; email and mutation/repair paths are deliberately absent. */
export async function resolveVerifiedApplicationActor(
  tuple: AuthIdentityTuple,
  database?: AuthIdentityBindingLookupDatabase,
): Promise<VerifiedApplicationActor | null> {
  try {
    const { findVerifiedApplicationActorRows } = await import(
      "../../db/user-auth-identity-binding-repository.ts"
    );
    return resolveVerifiedApplicationActorFromRows(
      await findVerifiedApplicationActorRows(tuple, database),
    );
  } catch {
    return null;
  }
}
