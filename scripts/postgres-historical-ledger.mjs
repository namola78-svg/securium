import { BASELINE_BOUNDARY } from "./postgres-baseline.mjs";
import { BASELINE_RECEIPT_RLS_MIGRATION } from "./postgres-migration-applicability.mjs";
import { expectedHistoricalSupplementaryReceiptChecksum } from "./postgres-historical-supplementary-receipts.mjs";
import {
  expectedMigrationChecksum,
  MigrationGuardError,
} from "./postgres-migration-guard.mjs";

const productionHistoricalOrder = [
  "0001_d1_compatibility_schema",
  "0002_server_only_rls_lockdown",
  "0003_curriculum_tree",
  "0004_shared_content_lesson",
  "0005_course_lesson_lesson_progress",
  "0006_question_attempt_lookup_index",
  "0009_security_certification_taxonomy_cleanup",
  "0007_ai_explainability_feedback",
  "0008_ontology_graph_storage",
  "0010_practical_attempt_evaluation_foundation",
  "0011_canonical_fact_foundation",
  "0012_fact_concept_mapping_governance",
];

// Validate the complete read-only snapshot before classifying applicability.
// Unknown receipts cannot establish historical authority for this runner.
export function validateHistoricalMigrationLedger(
  migrations,
  { migrationRows, baselineRelationExists },
) {
  if (!Array.isArray(migrationRows) || !migrationRows.length ||
      typeof baselineRelationExists !== "boolean") {
    throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_INVALID");
  }
  const registered = new Map(migrations.map(migration => [migration.id, migration]));
  const seen = new Set();
  const appliedMigrations = new Set();
  const numberedRows = [];
  for (const row of migrationRows) {
    if (!row || typeof row.id !== "string" || !row.id) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_INVALID");
    }
    if (seen.has(row.id)) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE");
    }
    seen.add(row.id);

    const migration = registered.get(row.id);
    if (migration) {
      if (row.checksum !== expectedMigrationChecksum(migration)) {
        throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH");
      }
      appliedMigrations.add(row.id);
      numberedRows.push(row);
      continue;
    }

    const supplementaryChecksum =
      expectedHistoricalSupplementaryReceiptChecksum(row.id);
    if (supplementaryChecksum === null) {
      throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_UNKNOWN_RECEIPT");
    }
    if (row.checksum !== supplementaryChecksum) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH");
    }
  }
  if (!numberedRows.some(row => Number(row.id.slice(0, 4)) <= Number(BASELINE_BOUNDARY))) {
    throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_HISTORICAL_RECEIPT_REQUIRED");
  }
  if (
    baselineRelationExists === false &&
    appliedMigrations.has(BASELINE_RECEIPT_RLS_MIGRATION)
  ) {
    throw new MigrationGuardError("POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE");
  }

  // Supplementary seed receipts are validated above but never participate in
  // numbered migration progression. The sole permitted numbered receipt hole is
  // the baseline-only 0058 on an absent historical control table.
  const progression = migrations.filter(migration =>
    migration.id !== BASELINE_RECEIPT_RLS_MIGRATION || baselineRelationExists,
  );
  const prefix = progression.slice(0, numberedRows.length);
  if (prefix.some(migration => !appliedMigrations.has(migration.id))) {
    throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_PROGRESSION_GAP");
  }

  // Published 0002 depends on 0003. Accept that explicit historical bootstrap
  // ordering as well as canonical ordering, without rewriting either ledger.
  const bootstrapPrefixOrder = prefix[0]?.id.startsWith("0001_") &&
    prefix[1]?.id.startsWith("0002_") && prefix[2]?.id.startsWith("0003_") &&
    numberedRows[0]?.id === prefix[0].id &&
    numberedRows[1]?.id === prefix[2].id && numberedRows[2]?.id === prefix[1].id;
  const bootstrapOrder = bootstrapPrefixOrder && numberedRows
    .slice(3)
    .every((row, index) => row.id === prefix[index + 3]?.id);
  const productionOrder = numberedRows.length >= productionHistoricalOrder.length &&
    productionHistoricalOrder.every((id, index) => numberedRows[index]?.id === id) &&
    numberedRows.slice(productionHistoricalOrder.length).every((row, index) =>
      row.id === prefix[productionHistoricalOrder.length + index]?.id,
    );
  const canonicalOrder = numberedRows.every((row, index) => row.id === prefix[index]?.id);
  if (!canonicalOrder && !bootstrapOrder && !productionOrder) {
    throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_PROGRESSION_ORDER_INVALID");
  }
  return true;
}
