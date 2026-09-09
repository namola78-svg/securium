import { eq, or } from "drizzle-orm";
import { getDb } from ".";
import { occupationalRoleAliases, occupationalRoles } from "./schema";
import { AppError } from "../lib/errors.ts";
import {
  assertOccupationalRoleKey,
  assertOccupationalRoleAlias,
  assertOccupationalRoleLabel,
  normalizeOccupationalRoleLookup,
  resolveOccupationalRoleRecords,
  type OccupationalRole,
  type OccupationalRoleAliasRecord,
  type OccupationalRoleRecord,
  type OccupationalRoleReference,
  type OccupationalRoleResolution,
} from "../lib/services/occupational-role-authority.ts";
import { resolveCanonicalConceptFromDatabase } from "./canonical-concept-repositories.ts";
import type { CanonicalConceptReference, CanonicalConceptResolution } from "../lib/services/canonical-concept-authority.ts";

/** Server-only canonical Occupational Role persistence. No RBAC table is imported. */
export async function createOccupationalRoleDraft(input: {
  id?: string;
  roleKey: string;
  label: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  provenanceJson?: string;
}) {
  const roleKey = assertOccupationalRoleKey(input.roleKey);
  const label = assertOccupationalRoleLabel(input.label);
  const id = input.id?.trim() || crypto.randomUUID();
  await getDb().insert(occupationalRoles).values({
    id,
    roleKey,
    label,
    description: input.description?.trim() ?? "",
    status: "DRAFT",
    sourceType: input.sourceType?.trim() || "SECURIUM_AUTHORED",
    sourceId: input.sourceId?.trim() || null,
    provenanceJson: input.provenanceJson?.trim() || "{}",
    reviewedBy: null,
    reviewedAt: null,
    reviewEvidenceJson: "[]",
  });
  return { id, roleKey, status: "DRAFT" as const };
}

export async function addOccupationalRoleAlias(input: {
  id?: string;
  roleId: string;
  alias: string;
  language?: string;
  source?: string;
}) {
  const alias = assertOccupationalRoleAlias(input.alias);
  const role = await getDb()
    .select({ id: occupationalRoles.id, status: occupationalRoles.status })
    .from(occupationalRoles)
    .where(eq(occupationalRoles.id, input.roleId))
    .limit(1);
  if (!role[0]) throw new Error("OCCUPATIONAL_ROLE_NOT_FOUND");
  try {
    await getDb().insert(occupationalRoleAliases).values({
      id: input.id?.trim() || crypto.randomUUID(),
      roleId: input.roleId,
      alias,
      normalizedAlias: alias,
      language: input.language?.trim() || "und",
      source: input.source?.trim() || "manual",
    });
  } catch (error) {
    if (isOccupationalRoleAliasUniqueViolation(error)) {
      throw new AppError(
        "Occupational Role alias is already registered.",
        409,
        "OCCUPATIONAL_ROLE_ALIAS_CONFLICT",
      );
    }
    throw error;
  }
  return { roleId: input.roleId, alias };
}

export async function resolveOccupationalRoleFromDatabase(reference: OccupationalRoleReference): Promise<OccupationalRoleResolution> {
  try {
    const db = getDb();
    const roleRows = await findRoleRows(db, reference);
    const aliases = await hydrateAliases(db, roleRows.map((row) => row.id));
    return resolveOccupationalRoleRecords({
      reference,
      roles: hydrateRoleRecords(roleRows, aliases),
      aliases,
    });
  } catch {
    return { kind: "UNKNOWN" };
  }
}

export async function listActiveOccupationalRoles(): Promise<OccupationalRole[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(occupationalRoles)
      .where(eq(occupationalRoles.status, "ACTIVE"));
    const aliases = await hydrateAliases(db, rows.map((row) => row.id));
    return hydrateRoleRecords(rows, aliases)
      .map((row) => resolveOccupationalRoleRecords({ reference: { id: row.id }, roles: [row] }).role)
      .filter((role): role is OccupationalRole => Boolean(role));
  } catch {
    return [];
  }
}

/** Role authoring may reference Concepts only through the approved canonical resolver. */
export function resolveOccupationalRoleConcept(reference: CanonicalConceptReference): Promise<CanonicalConceptResolution> {
  return resolveCanonicalConceptFromDatabase(reference);
}

async function findRoleRows(db: ReturnType<typeof getDb>, reference: OccupationalRoleReference) {
  const rows: Array<typeof occupationalRoles.$inferSelect> = [];
  const directPredicates = [
    reference.id ? eq(occupationalRoles.id, reference.id) : null,
    reference.roleKey ? eq(occupationalRoles.roleKey, reference.roleKey) : null,
  ].filter((predicate): predicate is NonNullable<typeof predicate> => Boolean(predicate));

  if (directPredicates.length) {
    rows.push(...(await db.select().from(occupationalRoles).where(or(...directPredicates))));
  }

  if (reference.alias) {
    const aliasRows = await db
      .select({ role: occupationalRoles })
      .from(occupationalRoleAliases)
      .innerJoin(occupationalRoles, eq(occupationalRoleAliases.roleId, occupationalRoles.id))
      .where(eq(occupationalRoleAliases.normalizedAlias, normalizeOccupationalRoleLookup(reference.alias)));
    rows.push(...aliasRows.map((row) => row.role));
  }

  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function hydrateAliases(db: ReturnType<typeof getDb>, roleIds: string[]): Promise<OccupationalRoleAliasRecord[]> {
  if (!roleIds.length) return [];
  const rows = await db
    .select({ roleId: occupationalRoleAliases.roleId, alias: occupationalRoleAliases.alias, normalizedAlias: occupationalRoleAliases.normalizedAlias })
    .from(occupationalRoleAliases)
    .where(or(...roleIds.map((roleId) => eq(occupationalRoleAliases.roleId, roleId))));
  return rows;
}

function hydrateRoleRecords(rows: Array<typeof occupationalRoles.$inferSelect>, aliases: readonly OccupationalRoleAliasRecord[]): OccupationalRoleRecord[] {
  return rows.map((row) => ({
      id: row.id,
      roleKey: row.roleKey,
      label: row.label,
      description: row.description,
      status: row.status,
      sourceType: row.sourceType,
      sourceId: row.sourceId ?? undefined,
      provenanceJson: row.provenanceJson,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      reviewEvidenceJson: row.reviewEvidenceJson,
      aliases: aliases.filter((alias) => alias.roleId === row.id).map((alias) => alias.alias),
    } satisfies OccupationalRoleRecord));
}

export function isOccupationalRoleAliasUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "23505" || code === "SQLITE_CONSTRAINT_UNIQUE" || /UNIQUE constraint failed|duplicate key value violates unique constraint/i.test(message);
}
