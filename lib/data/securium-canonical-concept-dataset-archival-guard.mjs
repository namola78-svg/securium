/**
 * Dataset A is retained only as historical evidence and a disposable local
 * fixture. It is not a canonical writer and must never be used against a
 * shared non-production, production, or Dataset B-owned database.
 */

export const SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION = "HISTORICAL_DATASET_A";
export const SECURIUM_CANONICAL_CONCEPT_DATASET_MANIFEST_CLASSIFICATION = "ARCHIVED_EVIDENCE";
export const SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY = "NONE";
export const SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY = "NONE";
export const SECURIUM_CANONICAL_CONCEPT_DATASET_CANONICAL_OWNER =
  "securium-canonical-ontology-dataset-foundation";
export const SECURIUM_CANONICAL_CONCEPT_DATASET_LOCAL_TARGET = "LOCAL_HISTORICAL_TEST";

const FORBIDDEN_TARGETS = new Set([
  "NONPROD",
  "SHARED_NONPROD",
  "AUTHORIZED_NONPROD_SUPABASE_POSTGRESQL",
  "PRODUCTION",
  "PROD",
]);

/** Fail closed before Dataset A SQL can be rendered for a live/shared target. */
export function assertSecuriumCanonicalConceptDatasetHistoricalTarget({
  target = SECURIUM_CANONICAL_CONCEPT_DATASET_LOCAL_TARGET,
  existingState = undefined,
  allowHistoricalFixture = false,
} = {}) {
  const normalizedTarget = String(target).trim().toUpperCase();
  if (normalizedTarget !== SECURIUM_CANONICAL_CONCEPT_DATASET_LOCAL_TARGET) {
    throw new Error("SECURIUM_DATASET_A_WRITER_AUTHORITY_NONE_TARGET_REJECTED");
  }
  if (allowHistoricalFixture !== true) {
    throw new Error("SECURIUM_DATASET_A_LOCAL_FIXTURE_CONFIRM_REQUIRED");
  }

  const environmentTarget = String(process.env.SECURIUM_CANONICAL_ONTOLOGY_TARGET ?? "")
    .trim()
    .toUpperCase();
  if (FORBIDDEN_TARGETS.has(environmentTarget)) {
    throw new Error("SECURIUM_DATASET_A_SHARED_OR_PRODUCTION_ENVIRONMENT_REJECTED");
  }

  const databaseUrl = [
    process.env.SECURIUM_CANONICAL_ONTOLOGY_NONPROD_DATABASE_URL,
    process.env.POSTGRES_VERIFY_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
  ].filter(Boolean).join(" ");
  if (/(?:shared|nonprod|staging|production|prod\b)/i.test(databaseUrl)) {
    throw new Error("SECURIUM_DATASET_A_DATABASE_URL_REJECTED");
  }

  if (isDatasetBOwnedState(existingState)) {
    throw new Error("SECURIUM_DATASET_A_DOWNGRADE_REJECTED");
  }

  return {
    classification: SECURIUM_CANONICAL_CONCEPT_DATASET_CLASSIFICATION,
    target: SECURIUM_CANONICAL_CONCEPT_DATASET_LOCAL_TARGET,
    writerAuthority: SECURIUM_CANONICAL_CONCEPT_DATASET_WRITER_AUTHORITY,
    sharedNonprodWriteAuthority: SECURIUM_CANONICAL_CONCEPT_DATASET_SHARED_NONPROD_WRITE_AUTHORITY,
  };
}

export function isDatasetBOwnedState(state) {
  if (!state) return false;
  const serialized = typeof state === "string" ? state : JSON.stringify(state);
  return /(?:DATASET[_ -]?B|FOUNDATION|canonical-ontology-dataset-foundation|54\s*concept|56\s*alias|ontology[-_:]dataset[-_:]b|manifest[_ -]?hash)/i.test(serialized)
    && /(?:cf8b59d94e55328c5a074ecf1d4e8368bcab94e0570edff554a88084b671dc96|54\s*concept|56\s*alias|DATASET[_ -]?B|FOUNDATION|canonical-ontology-dataset-foundation)/i.test(serialized);
}
