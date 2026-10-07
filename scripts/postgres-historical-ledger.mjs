import { BASELINE_BOUNDARY } from "./postgres-baseline.mjs";
import { BASELINE_RECEIPT_RLS_MIGRATION } from "./postgres-migration-applicability.mjs";
import { expectedHistoricalSupplementaryReceiptChecksum } from "./postgres-historical-supplementary-receipts.mjs";
import {
  expectedMigrationChecksum,
  MigrationGuardError,
} from "./postgres-migration-guard.mjs";

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
  const bootstrapOrder = prefix[0]?.id.startsWith("0001_") &&
    prefix[1]?.id.startsWith("0002_") && prefix[2]?.id.startsWith("0003_") &&
    numberedRows[0]?.id === prefix[0].id &&
    numberedRows[1]?.id === prefix[2].id && numberedRows[2]?.id === prefix[1].id;
  for (let index = 0; index < numberedRows.length; index++) {
    const expectedIndex = bootstrapOrder && (index === 1 || index === 2) ? 3 - index : index;
    if (numberedRows[index].id !== prefix[expectedIndex]?.id) {
      throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_PROGRESSION_ORDER_INVALID");
    }
  }
  return true;
}
