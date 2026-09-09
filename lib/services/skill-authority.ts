export const SKILL_AUTHORITY_CONTRACT = {
  authority: "skills / skill_aliases",
  id: "skills.id",
  semanticKey: "skills.skill_key",
  keyPattern: "skill:<namespace>:<identity>",
  lifecycle: ["DRAFT", "ACTIVE", "RETIRED"] as const,
  aliasPolicy: "exact canonical aliases only; printable ASCII normalized identity",
  relations: "ROLE_REQUIRES_SKILL / SKILL_REQUIRES_CONCEPT in Wave B",
} as const;

const KEY_PATTERN = /^skill:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

export type SkillLifecycle = (typeof SKILL_AUTHORITY_CONTRACT.lifecycle)[number];
export type SkillReference = { id?: string; skillKey?: string; alias?: string };
export type SkillRecord = {
  id: string; skillKey: string; label: string; description: string; status: string;
  sourceType: string; sourceId: string | null; provenanceJson: string;
  reviewedBy: string | null; reviewedAt: string | null; reviewEvidenceJson: string;
};
export type SkillAliasRecord = { id: string; skillId: string; alias: string; normalizedAlias: string; language: string; source: string };
export type Skill = SkillRecord & { status: SkillLifecycle; aliases: SkillAliasRecord[] };
export type SkillResolution =
  | { status: "RESOLVED"; skill: Skill }
  | { status: "UNRESOLVED"; reason: string }
  | { status: "AMBIGUOUS"; candidateIds: string[] };

export function normalizeSkillLookup(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeSkillAlias(value: string): string {
  const normalized = normalizeSkillLookup(value);
  if (!PRINTABLE_ASCII.test(normalized)) throw new Error("Skill alias must use printable ASCII canonical identity");
  return normalized;
}

export function assertSkillKey(value: string): string {
  if (typeof value !== "string" || value.length < 9 || value.length > 255 || !KEY_PATTERN.test(value)) {
    throw new Error("Invalid skill_key; expected skill:<namespace>:<identity>");
  }
  return value;
}

export function assertSkillLabel(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error("Skill label is required");
  return value;
}

function toSkill(row: SkillRecord, aliases: SkillAliasRecord[]): Skill {
  if (!SKILL_AUTHORITY_CONTRACT.lifecycle.includes(row.status as SkillLifecycle)) throw new Error("Invalid Skill lifecycle");
  return { ...row, status: row.status as SkillLifecycle, aliases };
}

function finalize(matches: Skill[], supplied: boolean): SkillResolution {
  const byId = new Map(matches.map((skill) => [skill.id, skill]));
  if (byId.size === 0) return { status: "UNRESOLVED", reason: supplied ? "No exact canonical Skill identity matched" : "No Skill identity supplied" };
  if (byId.size > 1) return { status: "AMBIGUOUS", candidateIds: [...byId.keys()].sort() };
  return { status: "RESOLVED", skill: [...byId.values()][0] };
}

export function resolveSkillRecords(rows: SkillRecord[], aliases: SkillAliasRecord[], reference: SkillReference): SkillResolution {
  const matches: Skill[] = [];
  const supplied = Boolean(reference.id || reference.skillKey || reference.alias);
  const aliasRows = aliases.filter((alias) => reference.alias !== undefined && alias.normalizedAlias === normalizeSkillAlias(reference.alias));
  for (const row of rows) {
    const rowAliases = aliasRows.filter((alias) => alias.skillId === row.id);
    if ((reference.id !== undefined && row.id === reference.id) ||
        (reference.skillKey !== undefined && row.skillKey === reference.skillKey) || rowAliases.length > 0) {
      matches.push(toSkill(row, aliases.filter((alias) => alias.skillId === row.id)));
    }
  }
  return finalize(matches, supplied);
}
