export const BASELINE_RECEIPT_RLS_MIGRATION =
  "0058_app_schema_baseline_receipts_rls_hardening";

export function classifyMigrationApplicability(
  migrations,
  { databaseState, baselineRelationExists, appliedMigrationIds },
) {
  const applicable = [];
  const notApplicable = [];
  for (const migration of migrations) {
    // A historical installation never received the fresh-baseline control table.
    // Leave both the absent table and migration receipt absent: no SQL was run.
    if (
      migration.id === BASELINE_RECEIPT_RLS_MIGRATION &&
      databaseState === "HISTORICAL_DATABASE" &&
      baselineRelationExists === false
    ) {
      if (!Array.isArray(appliedMigrationIds)) {
        throw new Error("POSTGRES_MIGRATION_APPLICABILITY_LEDGER_REQUIRED");
      }
      if (appliedMigrationIds.includes(migration.id)) {
        throw new Error("POSTGRES_BASELINE_RLS_RECEIPT_WITHOUT_TABLE");
      }
      notApplicable.push(migration);
    } else {
      applicable.push(migration);
    }
  }
  return { applicable, notApplicable };
}
