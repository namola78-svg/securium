import { MigrationGuardError } from "./postgres-migration-error.mjs";

// Recognize only one outer transaction. Preserve body bytes, including dollar
// quoted function/DO bodies; a regex cannot distinguish their BEGIN/END tokens.
export function migrationTransactionBody(sql) {
  const invalid = () => { throw new MigrationGuardError("MIGRATION_GUARD_TRANSACTION_WRAPPER_INVALID"); };
  if (typeof sql !== "string") invalid();
  const statements = [];
  let words = [];
  let tokenCount = 0;
  let start = null;
  for (let i = 0; i < sql.length;) {
    const tail = sql.slice(i);
    if (/^\s/.test(tail)) { i++; continue; }
    if (tail.startsWith("--")) { const end = sql.indexOf("\n", i); i = end < 0 ? sql.length : end + 1; continue; }
    if (tail.startsWith("/*")) {
      let depth = 1; i += 2;
      while (depth && i < sql.length) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) invalid();
      continue;
    }
    if (start === null) start = i;
    const dollar = tail.match(/^(\$[a-zA-Z_][a-zA-Z0-9_]*\$|\$\$)/)?.[0];
    if (dollar) {
      tokenCount++;
      const end = sql.indexOf(dollar, i + dollar.length);
      if (end < 0) invalid();
      i = end + dollar.length; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      tokenCount++;
      const quote = sql[i];
      const escaped = quote === "'" && /[eE]/.test(sql[i - 1] ?? "") && !/[a-zA-Z0-9_$]/.test(sql[i - 2] ?? "");
      let closed = false; i++;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) invalid();
      continue;
    }
    if (sql[i] === ";") {
      statements.push({ start, end: i + 1, words, tokenCount });
      words = []; tokenCount = 0; start = null; i++; continue;
    }
    const word = tail.match(/^[a-zA-Z_][a-zA-Z0-9_$]*/)?.[0];
    if (word) { tokenCount++; words.push(word.toUpperCase()); i += word.length; continue; }
    if (sql[i] === "\\") invalid();
    tokenCount++; i++;
  }
  if (start !== null || statements.length < 3) invalid();
  const first = statements[0], last = statements.at(-1);
  if (first.tokenCount !== 1 || last.tokenCount !== 1 || first.words[0] !== "BEGIN" || last.words[0] !== "COMMIT") invalid();
  for (const statement of statements.slice(1, -1)) {
    if (/^(BEGIN|COMMIT|END|ROLLBACK|ABORT|START|SAVEPOINT|RELEASE|PREPARE)$/.test(statement.words[0] ?? "")) invalid();
  }
  return sql.slice(first.end, last.start);
}
