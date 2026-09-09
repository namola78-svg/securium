import { eq, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { skillAliases, skills } from "./schema.ts";
import {
  normalizeSkillAlias,
  resolveSkillRecords,
  type SkillRecord,
  type SkillReference,
  type SkillResolution,
} from "../lib/services/skill-authority.ts";
import type * as schema from "./schema.ts";

type SkillDatabase = DrizzleD1Database<typeof schema>;

function mapSkill(row: typeof skills.$inferSelect): SkillRecord {
  return row as SkillRecord;
}

/** Resolve canonical Skills with an explicit skill_aliases -> skills join. */
export async function resolveSkillFromDatabaseUsing(
  db: SkillDatabase,
  reference: SkillReference,
): Promise<SkillResolution> {
  const predicates = [];
  if (reference.id !== undefined) predicates.push(eq(skills.id, reference.id));
  if (reference.skillKey !== undefined) predicates.push(eq(skills.skillKey, reference.skillKey));

  let normalizedAlias: string | undefined;
  if (reference.alias !== undefined) {
    try {
      normalizedAlias = normalizeSkillAlias(reference.alias);
    } catch {
      return { status: "UNRESOLVED", reason: "Invalid Skill alias" };
    }
  }

  const rows = predicates.length
    ? await db.select().from(skills).where(or(...predicates))
    : [];
  const aliasRows = normalizedAlias === undefined
    ? []
    : await db
        .select({ skill: skills })
        .from(skillAliases)
        .innerJoin(skills, eq(skillAliases.skillId, skills.id))
        .where(eq(skillAliases.normalizedAlias, normalizedAlias));

  const canonicalRows = new Map<string, typeof skills.$inferSelect>();
  for (const row of rows) canonicalRows.set(row.id, row);
  for (const row of aliasRows) canonicalRows.set(row.skill.id, row.skill);

  const aliases = canonicalRows.size
    ? await db
        .select()
        .from(skillAliases)
        .where(or(...[...canonicalRows.keys()].map((skillId) => eq(skillAliases.skillId, skillId))))
    : [];

  return resolveSkillRecords(
    [...canonicalRows.values()].map(mapSkill),
    aliases,
    reference,
  );
}
