import { eq } from "drizzle-orm";
import { getDb } from ".";
import { conceptLabels, conceptVersions, concepts } from "./schema";
import { AppError } from "@/lib/errors";

const HASH = /^[0-9a-f]{64}$/;
const STATUSES = new Set(["DRAFT", "ACTIVE", "RETIRED"]);

function required(value: string, field: string) {
  if (!value.trim()) throw new AppError(`${field} is required.`, 400, "CP_INVALID_INPUT");
  return value.trim();
}

function status(value: string) {
  if (!STATUSES.has(value)) throw new AppError("Invalid governed status.", 400, "CP_INVALID_STATUS");
  return value;
}

function hash(value: string) {
  if (!HASH.test(value)) throw new AppError("Semantic hash must be lowercase SHA-256 hex.", 400, "CP_INVALID_HASH");
  return value;
}

export async function createConcept(input: { id: string; stableKey: string; status?: string }) {
  const stableKey = required(input.stableKey, "stableKey");
  await getDb().insert(concepts).values({ id: required(input.id, "id"), stableKey, status: status(input.status ?? "DRAFT") });
  return { id: input.id, stableKey };
}

export async function createConceptVersion(input: { id: string; conceptId: string; version: number; semanticHash: string; definition: string; scope: string; status?: string }) {
  if (!Number.isInteger(input.version) || input.version < 1) throw new AppError("Version must be positive.", 400, "CP_INVALID_VERSION");
  const semanticHash = hash(input.semanticHash);
  const db = getDb();
  const [parent] = await db.select({ id: concepts.id }).from(concepts).where(eq(concepts.id, input.conceptId)).limit(1);
  if (!parent) throw new AppError("Concept was not found.", 404, "CP_UNKNOWN_PARENT");
  await db.insert(conceptVersions).values({ id: required(input.id, "id"), conceptId: input.conceptId, version: input.version, semanticHash, definition: required(input.definition, "definition"), scope: required(input.scope, "scope"), status: status(input.status ?? "DRAFT") });
  return { id: input.id, conceptId: input.conceptId, version: input.version };
}

export async function addConceptLabel(input: { id: string; conceptId: string; language: string; label: string; normalizedLabel: string; labelType?: "PREF" | "ALT"; status?: string }) {
  await getDb().insert(conceptLabels).values({ id: required(input.id, "id"), conceptId: input.conceptId, language: required(input.language, "language"), label: required(input.label, "label"), normalizedLabel: required(input.normalizedLabel, "normalizedLabel"), labelType: input.labelType ?? "PREF", status: status(input.status ?? "DRAFT") });
  return { id: input.id, conceptId: input.conceptId };
}
