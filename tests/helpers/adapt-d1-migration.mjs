// D1 rejects SQL transaction controls; callers apply this wrapped migration in one batch.
export function adaptMigrationForD1(sql, migrationName) {
  const source = String(sql).trim();
  const prefix = /^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;\s*BEGIN\s+TRANSACTION\s*;/i;
  const suffix = /\s*COMMIT\s*;\s*PRAGMA\s+foreign_keys\s*=\s*ON\s*;\s*$/i;
  const hasOuterPrefix = prefix.test(source);
  const hasOuterSuffix = suffix.test(source);
  const startsWithUnsupportedTransaction = /^\s*(?:BEGIN(?:\s+TRANSACTION)?|START\s+TRANSACTION)\s*;/i.test(source);
  if (!hasOuterPrefix && !hasOuterSuffix && !startsWithUnsupportedTransaction) return source;
  if (!hasOuterPrefix || !hasOuterSuffix) throw new Error(`UNSUPPORTED_D1_TRANSACTION_WRAPPER:${migrationName}`);
  return source.replace(prefix, "PRAGMA foreign_keys=OFF;\n").replace(suffix, "\nPRAGMA foreign_keys=ON;");
}
