import { and, eq, inArray, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  occupationalRoleAliases,
  occupationalRoles,
  ontologyAliases,
  ontologyConcepts,
  conceptLabels,
  concepts,
  roleSkillRelations,
  skillAliases,
  skillConceptRelations,
  skills,
} from "./schema.ts";
import type * as schema from "./schema.ts";
import {
  SkillGraphError,
  SKILL_GRAPH_LIMITS,
  compareSkillGraphCursorPositions,
  compareSkillGraphStrings,
  type ConceptGraphReference,
  type RoleGraphReference,
  type SkillGraphHop,
  type SkillGraphHopPage,
  type SkillGraphHopReadInput,
  type SkillGraphNodeType,
  type SkillGraphRepository,
  type SkillGraphRepositoryEdge,
  type SkillGraphRepositoryNode,
  type SkillGraphResolution,
} from "../lib/services/skill-graph-query.ts";
import {
  normalizeOccupationalRoleLookup,
  resolveOccupationalRoleRecords,
  type OccupationalRoleAliasRecord,
  type OccupationalRoleRecord,
} from "../lib/services/occupational-role-authority.ts";
import { resolveSkillFromDatabaseUsing } from "./skill-repository-query.ts";
import {
  normalizeConceptLookup,
  resolveCanonicalConceptRecords,
  type CanonicalConceptRecord,
  type StagingConceptRecord,
} from "../lib/services/canonical-concept-authority.ts";

type RawRelationRow = {
  relationId: string;
  relationType: string;
  relationVersion: number;
  relationSourceType: string | null;
  sourceId: string;
  targetId: string | null;
  targetKey: string | null;
  targetLabel: string | null;
  targetSourceType: string | null;
};

type CanonicalConceptDbRow = {
  id: string;
  conceptKey: string;
  label: string;
  normalizedLabel: string;
  status: string;
  sourceType: string | null;
};

const canonicalConceptSelection = {
  id: ontologyConcepts.id,
  conceptKey: ontologyConcepts.conceptKey,
  label: ontologyConcepts.label,
  normalizedLabel: ontologyConcepts.normalizedLabel,
  status: ontologyConcepts.status,
  sourceType: ontologyConcepts.sourceType,
};

/** D1 permits 100 bound parameters; 75 leaves room for predicates and LIMIT. */
export const SKILL_GRAPH_MAX_IDS_PER_D1_IN_QUERY = 75;
const RELATION_SCAN_LIMIT = SKILL_GRAPH_LIMITS.perHopHardMax + 1;

export type SkillGraphDatabase = DrizzleD1Database<typeof schema>;

export type DatabaseSkillGraphRepositoryOptions = {
  db?: SkillGraphDatabase;
  resolveRole?: SkillGraphRepository["resolveRole"];
  resolveSkill?: SkillGraphRepository["resolveSkill"];
  resolveConcept?: SkillGraphRepository["resolveConcept"];
};

export function createDatabaseSkillGraphRepository(options: DatabaseSkillGraphRepositoryOptions = {}): SkillGraphRepository {
  const database = options.db
    ? () => Promise.resolve(options.db as SkillGraphDatabase)
    : loadDatabase;
  return {
    resolveRole: options.resolveRole ?? (options.db ? (reference) => resolveRoleUsingDatabase(database, reference) : resolveRole),
    resolveSkill: options.resolveSkill ?? (options.db ? (reference) => resolveSkillUsingDatabase(database, reference) : resolveSkill),
    resolveConcept: options.resolveConcept ?? (options.db ? (reference) => resolveConceptUsingDatabase(database, reference) : resolveConcept),
    readRoleToSkills: (input) => database().then((db) => readRoleToSkills(db, input)),
    readSkillToRoles: (input) => database().then((db) => readSkillToRoles(db, input)),
    readSkillToConcepts: (input) => database().then((db) => readSkillToConcepts(db, input)),
    readConceptToSkills: (input) => database().then((db) => readConceptToSkills(db, input)),
  };
}

async function resolveRole(reference: RoleGraphReference): Promise<SkillGraphResolution> {
  const { resolveOccupationalRoleFromDatabase } = await import("./occupational-role-repositories.ts");
  const resolution = await resolveOccupationalRoleFromDatabase(reference);
  if (resolution.kind === "UNKNOWN") return { kind: "INTERNAL_ERROR" };
  if (resolution.kind !== "RESOLVED" || !resolution.role) return resolutionFailure(reference, resolution.kind === "AMBIGUOUS");
  return {
    kind: "RESOLVED",
    node: {
      type: "ROLE",
      id: resolution.role.id,
      canonicalKey: resolution.role.roleKey,
      label: resolution.role.label,
      aliases: resolution.role.aliases ?? [],
      sourceType: nonEmpty(resolution.role.sourceType),
    },
  };
}

async function resolveSkill(reference: { id?: string; skillKey?: string; alias?: string }): Promise<SkillGraphResolution> {
  try {
    const { resolveSkillFromDatabase } = await import("./skill-repositories.ts");
    const resolution = await resolveSkillFromDatabase(reference);
    if (resolution.status !== "RESOLVED") return resolutionFailure(reference, resolution.status === "AMBIGUOUS", resolution.status === "AMBIGUOUS" ? resolution.candidateIds : undefined);
    if (resolution.skill.status !== "ACTIVE") return { kind: "NOT_FOUND" };
    return {
      kind: "RESOLVED",
      node: {
        type: "SKILL",
        id: resolution.skill.id,
        canonicalKey: resolution.skill.skillKey,
        label: resolution.skill.label,
        aliases: resolution.skill.aliases.map((alias) => alias.alias),
        sourceType: nonEmpty(resolution.skill.sourceType),
      },
    };
  } catch {
    return { kind: "INTERNAL_ERROR" };
  }
}

async function resolveConcept(reference: ConceptGraphReference): Promise<SkillGraphResolution> {
  try {
    const { resolveCanonicalConceptFromDatabase } = await import("./canonical-concept-repositories.ts");
    const resolution = await resolveCanonicalConceptFromDatabase(reference);
    if (resolution.kind === "UNKNOWN") return { kind: "INTERNAL_ERROR" };
    if (resolution.kind !== "RESOLVED" || !resolution.concept) return resolutionFailure(reference, resolution.kind === "AMBIGUOUS");
    const node = await loadConceptNode(await loadDatabase(), resolution.concept.id);
    return node ? { kind: "RESOLVED", node } : { kind: "NOT_FOUND" };
  } catch {
    return { kind: "INTERNAL_ERROR" };
  }
}

async function resolveRoleUsingDatabase(
  database: () => Promise<SkillGraphDatabase>,
  reference: RoleGraphReference,
): Promise<SkillGraphResolution> {
  try {
    const db = await database();
    const directPredicates = [
      reference.id ? eq(occupationalRoles.id, reference.id) : null,
      reference.roleKey ? eq(occupationalRoles.roleKey, reference.roleKey) : null,
    ].filter((predicate): predicate is NonNullable<typeof predicate> => Boolean(predicate));
    const directRows = directPredicates.length
      ? await db.select().from(occupationalRoles).where(or(...directPredicates))
      : [];
    const aliasRows = reference.alias
      ? await db
          .select({ role: occupationalRoles })
          .from(occupationalRoleAliases)
          .innerJoin(occupationalRoles, eq(occupationalRoleAliases.roleId, occupationalRoles.id))
          .where(eq(occupationalRoleAliases.normalizedAlias, normalizeOccupationalRoleLookup(reference.alias)))
          .limit(SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax + 1)
      : [];
    const aliasCandidateIds = [...new Set(aliasRows.map((row) => row.role.id))];
    if (aliasCandidateIds.length > SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax) {
      return resolutionFailure(reference, true, aliasCandidateIds);
    }
    const roleRows = [...new Map([
      ...directRows.map((row) => [row.id, row] as const),
      ...aliasRows.map((row) => [row.role.id, row.role] as const),
    ]).values()];
    const aliases = roleRows.length
      ? await db
          .select({ roleId: occupationalRoleAliases.roleId, alias: occupationalRoleAliases.alias, normalizedAlias: occupationalRoleAliases.normalizedAlias })
          .from(occupationalRoleAliases)
          .where(inArray(occupationalRoleAliases.roleId, roleRows.map((row) => row.id)))
      : [];
    const resolution = resolveOccupationalRoleRecords({
      reference,
      roles: roleRows.map((row) => ({
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
      } satisfies OccupationalRoleRecord)),
      aliases: aliases satisfies OccupationalRoleAliasRecord[],
    });
    if (resolution.kind === "UNKNOWN") return { kind: "INTERNAL_ERROR" };
    if (resolution.kind !== "RESOLVED" || !resolution.role) return resolutionFailure(reference, resolution.kind === "AMBIGUOUS");
    return {
      kind: "RESOLVED",
      node: {
        type: "ROLE",
        id: resolution.role.id,
        canonicalKey: resolution.role.roleKey,
        label: resolution.role.label,
        aliases: resolution.role.aliases ?? [],
        sourceType: nonEmpty(resolution.role.sourceType),
      },
    };
  } catch {
    return { kind: "INTERNAL_ERROR" };
  }
}

async function resolveSkillUsingDatabase(
  database: () => Promise<SkillGraphDatabase>,
  reference: { id?: string; skillKey?: string; alias?: string },
): Promise<SkillGraphResolution> {
  try {
    const db = await database();
    if (reference.alias) {
      const aliasRows = await db
        .select({ skillId: skillAliases.skillId })
        .from(skillAliases)
        .where(eq(skillAliases.normalizedAlias, reference.alias.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")))
        .limit(SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax + 1);
      const candidateIds = [...new Set(aliasRows.map((row) => row.skillId))];
      if (candidateIds.length > SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax) return resolutionFailure(reference, true, candidateIds);
    }
    const resolution = await resolveSkillFromDatabaseUsing(db, reference);
    if (resolution.status !== "RESOLVED") return resolutionFailure(reference, resolution.status === "AMBIGUOUS", resolution.status === "AMBIGUOUS" ? resolution.candidateIds : undefined);
    if (resolution.skill.status !== "ACTIVE") return { kind: "NOT_FOUND" };
    return {
      kind: "RESOLVED",
      node: {
        type: "SKILL",
        id: resolution.skill.id,
        canonicalKey: resolution.skill.skillKey,
        label: resolution.skill.label,
        aliases: resolution.skill.aliases.map((alias) => alias.alias),
        sourceType: nonEmpty(resolution.skill.sourceType),
      },
    };
  } catch {
    return { kind: "INTERNAL_ERROR" };
  }
}

async function resolveConceptUsingDatabase(
  database: () => Promise<SkillGraphDatabase>,
  reference: ConceptGraphReference,
): Promise<SkillGraphResolution> {
  try {
    const db = await database();
    const canonicalRows = await findCanonicalRowsUsingDatabase(db, reference);
    const stagingRows = await findStagingRowsUsingDatabase(db, reference);
    const aliasCandidateIds = [
      ...canonicalRows.map((row) => row.id),
      ...stagingRows.map((row) => row.stableKey),
    ];
    if (reference.alias && new Set(aliasCandidateIds).size > SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax) {
      return resolutionFailure(reference, true, [...new Set(aliasCandidateIds)]);
    }
    const canonical = await hydrateCanonicalResolutionRows(db, canonicalRows);
    const staging = await hydrateStagingResolutionRows(db, stagingRows);
    const resolution = resolveCanonicalConceptRecords({ reference, canonical, staging });
    if (resolution.kind === "UNKNOWN") return { kind: "INTERNAL_ERROR" };
    if (resolution.kind !== "RESOLVED" || !resolution.concept) return resolutionFailure(reference, resolution.kind === "AMBIGUOUS");
    const node = await loadConceptNode(db, resolution.concept.id);
    return node ? { kind: "RESOLVED", node } : { kind: "NOT_FOUND" };
  } catch {
    return { kind: "INTERNAL_ERROR" };
  }
}

async function findCanonicalRowsUsingDatabase(db: SkillGraphDatabase, reference: ConceptGraphReference) {
  if (reference.id) return db.select(canonicalConceptSelection).from(ontologyConcepts).where(eq(ontologyConcepts.id, reference.id)).limit(2);
  const stableKey = reference.stableKey ?? reference.key;
  if (stableKey) return db.select(canonicalConceptSelection).from(ontologyConcepts).where(eq(ontologyConcepts.conceptKey, stableKey)).limit(2);
  if (!reference.alias) return [];
  const normalized = normalizeConceptLookup(reference.alias);
  const [labelRows, aliasRows] = await Promise.all([
    db.select(canonicalConceptSelection).from(ontologyConcepts).where(eq(ontologyConcepts.normalizedLabel, normalized)).limit(SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax + 1),
    db
      .select({ concept: canonicalConceptSelection })
      .from(ontologyAliases)
      .innerJoin(ontologyConcepts, eq(ontologyAliases.conceptId, ontologyConcepts.id))
      .where(eq(ontologyAliases.normalizedAlias, normalized))
      .limit(SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax + 1),
  ]);
  return [...new Map([
    ...labelRows.map((row) => [row.id, row] as const),
    ...aliasRows.map((row) => [row.concept.id, row.concept] as const),
  ]).values()];
}

async function findStagingRowsUsingDatabase(db: SkillGraphDatabase, reference: ConceptGraphReference) {
  if (reference.id) return db.select().from(concepts).where(eq(concepts.id, reference.id)).limit(2);
  const stableKey = reference.stableKey ?? reference.key;
  if (stableKey) return db.select().from(concepts).where(eq(concepts.stableKey, stableKey)).limit(2);
  if (!reference.alias) return [];
  const normalized = normalizeConceptLookup(reference.alias);
  const rows = await db
    .select({ concept: concepts })
    .from(conceptLabels)
    .innerJoin(concepts, eq(conceptLabels.conceptId, concepts.id))
    .where(and(eq(conceptLabels.normalizedLabel, normalized), eq(conceptLabels.status, "ACTIVE")))
    .limit(SKILL_GRAPH_LIMITS.exactAliasCandidateHardMax + 1);
  return rows.map((row) => row.concept);
}

async function hydrateCanonicalResolutionRows(db: SkillGraphDatabase, rows: CanonicalConceptDbRow[]): Promise<CanonicalConceptRecord[]> {
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    stableKey: row.conceptKey,
    label: row.label,
    normalizedLabel: row.normalizedLabel,
    status: row.status,
    aliases: (await db.select({ alias: ontologyAliases.alias }).from(ontologyAliases).where(eq(ontologyAliases.conceptId, row.id))).map((item) => item.alias),
  })));
}

async function hydrateStagingResolutionRows(db: SkillGraphDatabase, rows: Array<typeof concepts.$inferSelect>): Promise<StagingConceptRecord[]> {
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    stableKey: row.stableKey,
    status: row.status,
    labels: await db
      .select({ normalizedLabel: conceptLabels.normalizedLabel, label: conceptLabels.label, status: conceptLabels.status })
      .from(conceptLabels)
      .where(eq(conceptLabels.conceptId, row.id)),
  })));
}

async function loadConceptNode(db: SkillGraphDatabase, id: string): Promise<SkillGraphRepositoryNode | null> {
  const [row] = await db
    .select({
      id: ontologyConcepts.id,
      canonicalKey: ontologyConcepts.conceptKey,
      label: ontologyConcepts.label,
      sourceType: ontologyConcepts.sourceType,
    })
    .from(ontologyConcepts)
    .where(and(eq(ontologyConcepts.id, id), eq(ontologyConcepts.status, "ACTIVE")))
    .limit(1);
  if (!row) return null;
  const aliases = await loadAliases(db, "CONCEPT", [id]);
  return {
    type: "CONCEPT",
    id: row.id,
    canonicalKey: row.canonicalKey,
    label: row.label,
    aliases: aliases.get(id) ?? [],
    sourceType: nonEmpty(row.sourceType),
  };
}

async function readRoleToSkills(db: SkillGraphDatabase, input: SkillGraphHopReadInput) {
  if (!input.sourceIds.length) return emptyPage();
  const rows = await readRelationRowsInChunks(input.sourceIds, (sourceIds) => db
    .select({
      relationId: roleSkillRelations.id,
      relationType: roleSkillRelations.relationType,
      relationVersion: roleSkillRelations.relationVersion,
      relationSourceType: roleSkillRelations.sourceType,
      sourceId: roleSkillRelations.roleId,
      targetId: skills.id,
      targetKey: skills.skillKey,
      targetLabel: skills.label,
      targetSourceType: skills.sourceType,
    })
    .from(roleSkillRelations)
    .leftJoin(skills, and(eq(skills.id, roleSkillRelations.skillId), eq(skills.status, "ACTIVE")))
    .where(and(inArray(roleSkillRelations.roleId, sourceIds), eq(roleSkillRelations.status, "ACTIVE")))
    .limit(RELATION_SCAN_LIMIT));
  return hydrateRelationRows(db, rows, input.limit, "ROLE_REQUIRES_SKILL", "SKILL", false, input.after);
}

async function readSkillToRoles(db: SkillGraphDatabase, input: SkillGraphHopReadInput) {
  if (!input.sourceIds.length) return emptyPage();
  const rows = await readRelationRowsInChunks(input.sourceIds, (sourceIds) => db
    .select({
      relationId: roleSkillRelations.id,
      relationType: roleSkillRelations.relationType,
      relationVersion: roleSkillRelations.relationVersion,
      relationSourceType: roleSkillRelations.sourceType,
      sourceId: roleSkillRelations.skillId,
      targetId: occupationalRoles.id,
      targetKey: occupationalRoles.roleKey,
      targetLabel: occupationalRoles.label,
      targetSourceType: occupationalRoles.sourceType,
    })
    .from(roleSkillRelations)
    .leftJoin(occupationalRoles, and(eq(occupationalRoles.id, roleSkillRelations.roleId), eq(occupationalRoles.status, "ACTIVE")))
    .where(and(inArray(roleSkillRelations.skillId, sourceIds), eq(roleSkillRelations.status, "ACTIVE")))
    .limit(RELATION_SCAN_LIMIT));
  return hydrateRelationRows(db, rows, input.limit, "ROLE_REQUIRES_SKILL", "ROLE", true, input.after);
}

async function readSkillToConcepts(db: SkillGraphDatabase, input: SkillGraphHopReadInput) {
  if (!input.sourceIds.length) return emptyPage();
  const rows = await readRelationRowsInChunks(input.sourceIds, (sourceIds) => db
    .select({
      relationId: skillConceptRelations.id,
      relationType: skillConceptRelations.relationType,
      relationVersion: skillConceptRelations.relationVersion,
      relationSourceType: skillConceptRelations.sourceType,
      sourceId: skillConceptRelations.skillId,
      targetId: ontologyConcepts.id,
      targetKey: ontologyConcepts.conceptKey,
      targetLabel: ontologyConcepts.label,
      targetSourceType: ontologyConcepts.sourceType,
    })
    .from(skillConceptRelations)
    .leftJoin(ontologyConcepts, and(eq(ontologyConcepts.id, skillConceptRelations.conceptId), eq(ontologyConcepts.status, "ACTIVE")))
    .where(and(inArray(skillConceptRelations.skillId, sourceIds), eq(skillConceptRelations.status, "ACTIVE")))
    .limit(RELATION_SCAN_LIMIT));
  return hydrateRelationRows(db, rows, input.limit, "SKILL_REQUIRES_CONCEPT", "CONCEPT", false, input.after);
}

async function readConceptToSkills(db: SkillGraphDatabase, input: SkillGraphHopReadInput) {
  if (!input.sourceIds.length) return emptyPage();
  const rows = await readRelationRowsInChunks(input.sourceIds, (sourceIds) => db
    .select({
      relationId: skillConceptRelations.id,
      relationType: skillConceptRelations.relationType,
      relationVersion: skillConceptRelations.relationVersion,
      relationSourceType: skillConceptRelations.sourceType,
      sourceId: skillConceptRelations.conceptId,
      targetId: skills.id,
      targetKey: skills.skillKey,
      targetLabel: skills.label,
      targetSourceType: skills.sourceType,
    })
    .from(skillConceptRelations)
    .leftJoin(skills, and(eq(skills.id, skillConceptRelations.skillId), eq(skills.status, "ACTIVE")))
    .where(and(inArray(skillConceptRelations.conceptId, sourceIds), eq(skillConceptRelations.status, "ACTIVE")))
    .limit(RELATION_SCAN_LIMIT));
  return hydrateRelationRows(db, rows, input.limit, "SKILL_REQUIRES_CONCEPT", "SKILL", true, input.after);
}

async function readRelationRowsInChunks(
  sourceIds: readonly string[],
  readChunk: (sourceIds: readonly string[]) => Promise<RawRelationRow[]>,
) {
  const rows: RawRelationRow[] = [];
  for (const sourceIdChunk of chunkValues(sourceIds, SKILL_GRAPH_MAX_IDS_PER_D1_IN_QUERY)) {
    rows.push(...await readChunk(sourceIdChunk));
    if (rows.length >= RELATION_SCAN_LIMIT) return rows.slice(0, RELATION_SCAN_LIMIT);
  }
  return rows;
}

async function hydrateRelationRows(
  db: SkillGraphDatabase,
  rows: RawRelationRow[],
  limit: number,
  relationType: SkillGraphRepositoryEdge["type"],
  targetType: SkillGraphNodeType,
  reverse: boolean,
  after?: SkillGraphHopReadInput["after"],
): Promise<SkillGraphHopPage> {
  for (const row of rows) {
    if (!row.targetId || !row.targetKey || !row.targetLabel) {
      throw new SkillGraphError("ORPHAN_RELATION", "A graph relation points to a missing or inactive canonical node.", 500);
    }
    if (row.relationType !== relationType || !Number.isInteger(Number(row.relationVersion)) || Number(row.relationVersion) < 1) {
      throw new SkillGraphError("INTERNAL_ERROR", "Canonical graph relation metadata is invalid.", 500);
    }
  }
  const ordered = [...rows].sort((left, right) => compareSkillGraphStrings(left.targetKey ?? "", right.targetKey ?? "")
    || compareSkillGraphStrings(left.targetId ?? "", right.targetId ?? "")
    || compareSkillGraphStrings(left.relationId, right.relationId));
  const eligible = after
    ? ordered.filter((row) => compareSkillGraphCursorPositions({ canonicalKey: row.targetKey as string, stableId: row.targetId as string }, after) > 0)
    : ordered;
  const overflow = eligible.length > limit;
  const hardOverflow = rows.length > SKILL_GRAPH_LIMITS.perHopHardMax;
  const selected = eligible.slice(0, limit);
  const aliases = await loadAliases(db, targetType, selected.map((row) => row.targetId as string));
  const hops = selected.map((row) => {
    const targetId = row.targetId as string;
    const canonicalSourceType = relationType === "ROLE_REQUIRES_SKILL" ? "ROLE" : "SKILL";
    const canonicalTargetType = relationType === "ROLE_REQUIRES_SKILL" ? "SKILL" : "CONCEPT";
    const edge: SkillGraphRepositoryEdge = {
      id: row.relationId,
      type: relationType,
      source: { type: canonicalSourceType, id: reverse ? targetId : row.sourceId },
      target: { type: canonicalTargetType, id: reverse ? row.sourceId : targetId },
      relationVersion: Number(row.relationVersion),
      sourceType: nonEmpty(row.relationSourceType),
    };
    const target: SkillGraphRepositoryNode = {
      type: targetType,
      id: targetId,
      canonicalKey: row.targetKey as string,
      label: row.targetLabel as string,
      aliases: aliases.get(targetId) ?? [],
      sourceType: nonEmpty(row.targetSourceType),
    };
    return { edge, target } satisfies SkillGraphHop;
  });
  const last = hops.at(-1)?.target;
  return {
    hops,
    hasMore: overflow,
    overflow,
    hardOverflow,
    last: last ? { canonicalKey: last.canonicalKey, stableId: last.id } : undefined,
  };
}

async function loadAliases(db: SkillGraphDatabase, type: SkillGraphNodeType, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const grouped = new Map<string, Array<{ alias: string; normalizedAlias: string }>>();
  if (!uniqueIds.length) return new Map<string, string[]>();
  for (const idChunk of chunkValues(uniqueIds, SKILL_GRAPH_MAX_IDS_PER_D1_IN_QUERY)) {
    if (type === "ROLE") {
      const rows = await db.select({ id: occupationalRoleAliases.roleId, alias: occupationalRoleAliases.alias, normalizedAlias: occupationalRoleAliases.normalizedAlias }).from(occupationalRoleAliases).where(inArray(occupationalRoleAliases.roleId, idChunk));
      for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
    } else if (type === "SKILL") {
      const rows = await db.select({ id: skillAliases.skillId, alias: skillAliases.alias, normalizedAlias: skillAliases.normalizedAlias }).from(skillAliases).where(inArray(skillAliases.skillId, idChunk));
      for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
    } else {
      const rows = await db.select({ id: ontologyAliases.conceptId, alias: ontologyAliases.alias, normalizedAlias: ontologyAliases.normalizedAlias }).from(ontologyAliases).where(inArray(ontologyAliases.conceptId, idChunk));
      for (const row of rows) grouped.set(row.id, [...(grouped.get(row.id) ?? []), row]);
    }
  }
  return new Map([...grouped.entries()].map(([id, rows]) => [
    id,
    [...new Map(rows.sort((left, right) => compareSkillGraphStrings(left.normalizedAlias, right.normalizedAlias) || compareSkillGraphStrings(left.alias, right.alias)).map((row) => [row.alias, row.alias])).values()],
  ]));
}

function resolutionFailure(reference: object, ambiguous: boolean, candidateIds?: string[]): SkillGraphResolution {
  if (!ambiguous) return { kind: "NOT_FOUND" };
  const identityCount = Object.values(reference).filter((value) => typeof value === "string" && value.trim()).length;
  return identityCount === 1 && "alias" in reference
    ? { kind: "AMBIGUOUS_ALIAS", candidateIds }
    : { kind: "IDENTITY_CONFLICT", candidateIds };
}

function nonEmpty(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function emptyPage(): SkillGraphHopPage {
  return { hops: [], hasMore: false, overflow: false, hardOverflow: false };
}

function chunkValues<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) chunks.push([...values.slice(offset, offset + size)]);
  return chunks;
}

async function loadDatabase(): Promise<SkillGraphDatabase> {
  const { getDb } = await import("./index.ts");
  return getDb() as SkillGraphDatabase;
}
