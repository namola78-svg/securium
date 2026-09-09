import "server-only";
import { eq } from "drizzle-orm";
import { skillAliases, skills } from "./schema";
import { getDb } from "./index";
import { resolveSkillFromDatabaseUsing } from "./skill-repository-query.ts";
import { assertSkillKey, assertSkillLabel, normalizeSkillAlias, type SkillRecord, type SkillReference, type SkillResolution } from "../lib/services/skill-authority.ts";

type CreateSkillDraftInput = { id: string; skillKey: string; label: string; description?: string; sourceType: string; sourceId?: string; provenanceJson: string };
type AddSkillAliasInput = { id: string; skillId: string; alias: string; language?: string; source?: string };

function mapSkill(row: typeof skills.$inferSelect): SkillRecord { return row as SkillRecord; }

export async function createSkillDraft(input: CreateSkillDraftInput): Promise<SkillRecord> {
  assertSkillKey(input.skillKey); assertSkillLabel(input.label);
  if (!input.sourceType.trim() || !input.provenanceJson.trim() || input.provenanceJson.trim() === "{}") throw new Error("Skill provenance is required");
  const db = getDb();
  const [row] = await db.insert(skills).values({ id: input.id, skillKey: input.skillKey, label: input.label, description: input.description ?? "", sourceType: input.sourceType, sourceId: input.sourceId ?? null, provenanceJson: input.provenanceJson, status: "DRAFT" }).returning();
  return mapSkill(row);
}

export async function addSkillAlias(input: AddSkillAliasInput) {
  const alias = normalizeSkillAlias(input.alias);
  const db = getDb();
  const [row] = await db.insert(skillAliases).values({ id: input.id, skillId: input.skillId, alias, normalizedAlias: alias, language: input.language ?? "und", source: input.source ?? "manual" }).returning();
  return row;
}

export async function resolveSkillFromDatabase(reference: SkillReference): Promise<SkillResolution> {
  return resolveSkillFromDatabaseUsing(getDb(), reference);
}

export async function listActiveSkills(): Promise<SkillRecord[]> {
  const db = getDb();
  return (await db.select().from(skills).where(eq(skills.status, "ACTIVE"))).map(mapSkill);
}
