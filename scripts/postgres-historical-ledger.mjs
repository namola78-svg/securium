import { BASELINE_BOUNDARY } from "./postgres-baseline.mjs";
import { BASELINE_RECEIPT_RLS_MIGRATION } from "./postgres-migration-applicability.mjs";
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
  const applied = new Set();
  for (const row of migrationRows) {
    if (!row || typeof row.id !== "string" || !row.id) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_INVALID");
    }
    if (applied.has(row.id)) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE");
    }
    const migration = registered.get(row.id);
    if (!migration) {
      throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_UNKNOWN_RECEIPT");
    }
    if (row.checksum !== expectedMigrationChecksum(migration)) {
      throw new MigrationGuardError("MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH");
    }
    applied.add(row.id);
  }
  if (!migrationRows.some(row => Number(row.id.slice(0, 4)) <= Number(BASELINE_BOUNDARY))) {
    throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_HISTORICAL_RECEIPT_REQUIRED");
  }
  if (baselineRelationExists === false && applied.has(BASELINE_RECEIPT_RLS_MIGRATION)) {
    throw new MigrationGuardError("POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE");
  }

  // The sole permitted receipt hole is the baseline-only 0058 on an absent
  // historical control table. This validates progression; it grants no exemption.
  const progression = migrations.filter(migration =>
    migration.id !== BASELINE_RECEIPT_RLS_MIGRATION || baselineRelationExists,
  );
  const prefix = progression.slice(0, migrationRows.length);
  if (prefix.some(migration => !applied.has(migration.id))) {
    throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_PROGRESSION_GAP");
  }

  // Published 0002 depends on 0003. Accept that explicit historical bootstrap
  // ordering as well as canonical ordering, without rewriting either ledger.
  const bootstrapOrder = prefix[0]?.id.startsWith("0001_") &&
    prefix[1]?.id.startsWith("0002_") && prefix[2]?.id.startsWith("0003_") &&
    migrationRows[0]?.id === prefix[0].id &&
    migrationRows[1]?.id === prefix[2].id && migrationRows[2]?.id === prefix[1].id;
  for (let index = 0; index < migrationRows.length; index++) {
    const expectedIndex = bootstrapOrder && (index === 1 || index === 2) ? 3 - index : index;
    if (migrationRows[index].id !== prefix[expectedIndex]?.id) {
      throw new MigrationGuardError("POSTGRES_HISTORICAL_LEDGER_PROGRESSION_ORDER_INVALID");
    }
  }
  return true;
}
