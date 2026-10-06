import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { roles, userRoles, users } from "./schema.ts";

export type ApplicationUserAuthDatabase = DrizzleD1Database<
  typeof import("./schema.ts")
>;

export async function findUserWithRoleCodesById(
  userId: string,
  database?: ApplicationUserAuthDatabase,
) {
  const db = database ?? (await import("./index.ts")).getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      status: users.status,
      roleCode: roles.code,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(users.id, userId));
  const first = rows[0];
  if (!first) return null;
  return {
    id: first.id,
    email: first.email,
    displayName: first.displayName,
    status: first.status,
    roles: rows.map((row) => row.roleCode).filter((code): code is string => Boolean(code)),
  };
}
