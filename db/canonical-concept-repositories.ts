import { and, asc, eq, like, or } from "drizzle-orm";
import { getDb } from ".";
import {
  conceptLabels,
  concepts,
  contents,
  ontologyAliases,
  ontologyConcepts,
} from "./schema";
import {
  normalizeConceptLookup,
  resolveCanonicalConceptRecords,
  type CanonicalConcept,
  type CanonicalConceptReference,
  type CanonicalConceptResolution,
  type CanonicalConceptRecord,
  type StagingConceptRecord,
} from "../lib/services/canonical-concept-authority.ts";

export async function resolveCanonicalConceptFromDatabase(reference: CanonicalConceptReference): Promise<CanonicalConceptResolution> {
  try {
    const db = getDb();
    const canonicalRows = await findCanonicalRows(db, reference);
    const stagingRows = await findStagingRows(db, reference);
    const staging = await hydrateStagingRows(db, stagingRows);
    const canonical = await hydrateCanonicalRows(db, canonicalRows);
    return resolveCanonicalConceptRecords({ reference, canonical, staging });
  } catch {
    return { kind: "UNKNOWN" };
  }
}

export async function searchCanonicalConceptCandidatesFromDatabase(input: { query: string; limit: number }) {
  try {
    const db = getDb();
    const normalizedQuery = normalizeConceptLookup(input.query);
    const pattern = `%${normalizedQuery}%`;
    const rows = await db
      .select({
        id: ontologyConcepts.id,
        stableKey: ontologyConcepts.conceptKey,
        label: ontologyConcepts.label,
        normalizedLabel: ontologyConcepts.normalizedLabel,
        alias: ontologyAliases.normalizedAlias,
      })
      .from(ontologyConcepts)
      .leftJoin(ontologyAliases, eq(ontologyAliases.conceptId, ontologyConcepts.id))
      .where(and(
        eq(ontologyConcepts.status, "ACTIVE"),
        or(
          like(ontologyConcepts.conceptKey, pattern),
          like(ontologyConcepts.normalizedLabel, pattern),
          like(ontologyAliases.normalizedAlias, pattern),
        ),
      ))
      .orderBy(asc(ontologyConcepts.conceptKey))
      .limit(Math.max(1, Math.min(input.limit, 50)));
    const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
    return unique.map((row) => ({
      reference: { id: row.id, stableKey: row.stableKey },
      score: row.normalizedLabel === normalizedQuery || row.alias === normalizedQuery ? 1 : 0.5,
    }));
  } catch {
    return [];
  }
}

export async function loadCanonicalConceptState(input: { canonicalId: string }) {
  try {
    const [row] = await getDb()
      .select({ id: ontologyConcepts.id, status: ontologyConcepts.status })
      .from(ontologyConcepts)
      .where(and(eq(ontologyConcepts.id, input.canonicalId), eq(ontologyConcepts.status, "ACTIVE")))
      .limit(1);
    return row
      ? {
          canonicalId: row.id,
          publication: "UNKNOWN" as const,
          access: "UNKNOWN" as const,
          mappingStatus: null,
          provenanceSourceType: "UNKNOWN" as const,
          revision: "UNKNOWN" as const,
        }
      : null;
  } catch {
    return null;
  }
}

export async function loadCanonicalLearningContentState(input: { canonicalId: string }) {
  try {
    const [row] = await getDb()
      .select({ id: contents.id })
      .from(contents)
      .where(and(eq(contents.id, input.canonicalId), eq(contents.status, "PUBLISHED")))
      .limit(1);
    return row
      ? {
          canonicalId: row.id,
          publication: "PUBLISHED" as const,
          access: "UNKNOWN" as const,
          mappingStatus: null,
          provenanceSourceType: "UNKNOWN" as const,
          revision: "UNKNOWN" as const,
        }
      : null;
  } catch {
    return null;
  }
}

async function findCanonicalRows(db: ReturnType<typeof getDb>, reference: CanonicalConceptReference) {
  if (reference.id) {
    return db.select().from(ontologyConcepts).where(eq(ontologyConcepts.id, reference.id)).limit(2);
  }
  const stableKey = reference.stableKey ?? reference.key;
  if (stableKey) {
    return db.select().from(ontologyConcepts).where(eq(ontologyConcepts.conceptKey, stableKey)).limit(2);
  }
  if (reference.alias) {
    return db
      .select({ concept: ontologyConcepts })
      .from(ontologyConcepts)
      .leftJoin(ontologyAliases, eq(ontologyAliases.conceptId, ontologyConcepts.id))
      .where(or(
        eq(ontologyConcepts.normalizedLabel, normalizeConceptLookup(reference.alias)),
        eq(ontologyAliases.normalizedAlias, normalizeConceptLookup(reference.alias)),
      ))
      .limit(20)
      .then((rows) => rows.map((row) => row.concept));
  }
  return [];
}

async function findStagingRows(db: ReturnType<typeof getDb>, reference: CanonicalConceptReference) {
  if (reference.id) return db.select().from(concepts).where(eq(concepts.id, reference.id)).limit(2);
  const stableKey = reference.stableKey ?? reference.key;
  if (stableKey) return db.select().from(concepts).where(eq(concepts.stableKey, stableKey)).limit(2);
  if (reference.alias) {
    return db
      .select({ concept: concepts })
      .from(conceptLabels)
      .innerJoin(concepts, eq(conceptLabels.conceptId, concepts.id))
      .where(and(eq(conceptLabels.normalizedLabel, normalizeConceptLookup(reference.alias)), eq(conceptLabels.status, "ACTIVE")))
      .limit(20)
      .then((rows) => rows.map((row) => row.concept));
  }
  return [];
}

async function hydrateCanonicalRows(db: ReturnType<typeof getDb>, rows: Array<typeof ontologyConcepts.$inferSelect>): Promise<CanonicalConceptRecord[]> {
  return Promise.all(rows.map(async (row) => {
    const aliases = await db
      .select({ alias: ontologyAliases.alias })
      .from(ontologyAliases)
      .where(eq(ontologyAliases.conceptId, row.id));
    return {
      id: row.id,
      stableKey: row.conceptKey,
      label: row.label,
      normalizedLabel: row.normalizedLabel,
      status: row.status,
      aliases: aliases.map((item) => item.alias),
    } satisfies CanonicalConceptRecord;
  }));
}

async function hydrateStagingRows(db: ReturnType<typeof getDb>, rows: Array<typeof concepts.$inferSelect>): Promise<StagingConceptRecord[]> {
  return Promise.all(rows.map(async (row) => {
    const labels = await db
      .select({ normalizedLabel: conceptLabels.normalizedLabel, label: conceptLabels.label, status: conceptLabels.status })
      .from(conceptLabels)
      .where(eq(conceptLabels.conceptId, row.id));
    return {
      id: row.id,
      stableKey: row.stableKey,
      status: row.status,
      labels,
    } satisfies StagingConceptRecord;
  }));
}

export type { CanonicalConcept, CanonicalConceptReference, CanonicalConceptResolution };
