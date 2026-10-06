import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { userAuthIdentityBindings, users } from "./schema.ts";

export type AuthIdentityBindingLookupDatabase = DrizzleD1Database<
  typeof import("./schema.ts")
>;

export type AuthIdentityTuple = {
  authSystem: string;
  authProvider: string;
  authIssuer: string;
  authProjectRef: string;
  environmentClass: string;
  authSubject: string;
};

export type VerifiedApplicationActorRow = {
  bindingId: string;
  bindingStatus: string;
  applicationUserId: string;
  applicationUserStatus: string;
};

/** Reads every exact tuple match (bounded at two) so unexpected ambiguity fails closed. */
export async function findVerifiedApplicationActorRows(
  tuple: AuthIdentityTuple,
  database?: AuthIdentityBindingLookupDatabase,
): Promise<VerifiedApplicationActorRow[]> {
  const db = database ?? (await import("./index.ts")).getDb();
  return db
    .select({
      bindingId: userAuthIdentityBindings.id,
      bindingStatus: userAuthIdentityBindings.status,
      applicationUserId: users.id,
      applicationUserStatus: users.status,
    })
    .from(userAuthIdentityBindings)
    .innerJoin(users, eq(userAuthIdentityBindings.applicationUserId, users.id))
    .where(and(
      eq(userAuthIdentityBindings.authSystem, tuple.authSystem),
      eq(userAuthIdentityBindings.authProvider, tuple.authProvider),
      eq(userAuthIdentityBindings.authIssuer, tuple.authIssuer),
      eq(userAuthIdentityBindings.authProjectRef, tuple.authProjectRef),
      eq(userAuthIdentityBindings.environmentClass, tuple.environmentClass),
      eq(userAuthIdentityBindings.authSubject, tuple.authSubject),
    ))
    .limit(2);
}
