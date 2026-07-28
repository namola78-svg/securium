import { AppError } from "../../lib/errors.ts";
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseValue,
} from "./database-provider.ts";

type DatabaseProviderFactory = () =>
  | DatabaseProvider
  | Promise<DatabaseProvider>;

/**
 * Lets the existing D1 Drizzle repositories execute through the
 * provider-neutral database boundary. The staged PostgreSQL schema preserves
 * the D1 column representation, so existing row mappers remain valid.
 */
export class DrizzleD1CompatibilityDatabase implements D1Database {
  private readonly providerFactory: DatabaseProviderFactory;

  constructor(providerFactory: DatabaseProviderFactory) {
    this.providerFactory = providerFactory;
  }

  prepare(query: string): D1PreparedStatement {
    return new CompatibilityPreparedStatement(this.providerFactory, query, []);
  }

  async batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    const compatible = statements.map((statement) => {
      if (!(statement instanceof CompatibilityPreparedStatement)) {
        throw compatibilityError(
          "A foreign prepared statement cannot be included in a repository transaction.",
        );
      }
      return statement.databaseStatement();
    });
    const provider = await this.providerFactory();
    const results = await provider.transaction(compatible);
    return results.map((result) =>
      d1Result<T>(result.returnedRows as T[], result.affectedRows),
    );
  }

  async exec(query: string): Promise<D1ExecResult> {
    void query;
    throw compatibilityError(
      "Unparameterized multi-statement execution is not supported.",
    );
  }

  async dump(): Promise<ArrayBuffer> {
    throw compatibilityError(
      "Database dumps must use the provider-specific backup workflow.",
    );
  }
}

class CompatibilityPreparedStatement implements D1PreparedStatement {
  private readonly providerFactory: DatabaseProviderFactory;
  private readonly query: string;
  private readonly parameters: readonly DatabaseValue[];

  constructor(
    providerFactory: DatabaseProviderFactory,
    query: string,
    parameters: readonly DatabaseValue[],
  ) {
    this.providerFactory = providerFactory;
    this.query = query;
    this.parameters = parameters;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new CompatibilityPreparedStatement(
      this.providerFactory,
      this.query,
      values.map(databaseValue),
    );
  }

  async first<T = Record<string, unknown>>(
    columnName?: string,
  ): Promise<T | null> {
    const provider = await this.providerFactory();
    const row = await provider.queryOne<Record<string, unknown>>(
      this.databaseStatement(),
    );
    if (!row) return null;
    if (columnName !== undefined) {
      return (row[columnName] ?? null) as T | null;
    }
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const provider = await this.providerFactory();
    const result = await provider.execute(this.databaseStatement());
    return d1Result<T>(result.returnedRows as T[], result.affectedRows);
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const provider = await this.providerFactory();
    const result = await provider.query<Record<string, unknown>>(
      this.databaseStatement(),
    );
    return d1Result<T>(result.rows as T[], result.rowCount);
  }

  async raw<T = unknown[]>(
    options?: { columnNames?: boolean },
  ): Promise<T[]> {
    const provider = await this.providerFactory();
    const result = await provider.query<Record<string, unknown>>(
      this.databaseStatement(),
    );
    const values = result.rows.map((row) => Object.values(row));
    if (options?.columnNames) {
      const columns =
        result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
      return [columns, ...values] as T[];
    }
    return values as T[];
  }

  databaseStatement(): DatabaseStatement {
    return {
      sql: translateD1SqlForProvider(this.query),
      parameters: this.parameters,
    };
  }
}

export function translateD1SqlForProvider(sql: string) {
  return replaceScalarFunction(
    replaceKeywordOutsideQuotes(sql, "like", "ILIKE"),
    "max",
    "greatest",
  );
}

function replaceKeywordOutsideQuotes(
  sql: string,
  source: string,
  replacement: string,
) {
  const lower = sql.toLowerCase();
  let result = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (character === "'" && !doubleQuoted) {
      if (singleQuoted && sql[index + 1] === "'") {
        result += "''";
        index += 1;
        continue;
      }
      singleQuoted = !singleQuoted;
    } else if (character === '"' && !singleQuoted) {
      if (doubleQuoted && sql[index + 1] === '"') {
        result += '""';
        index += 1;
        continue;
      }
      doubleQuoted = !doubleQuoted;
    }
    const candidate = lower.slice(index, index + source.length);
    const previous = lower[index - 1] ?? "";
    const next = lower[index + source.length] ?? "";
    if (
      !singleQuoted &&
      !doubleQuoted &&
      candidate === source &&
      !/[a-z0-9_]/i.test(previous) &&
      !/[a-z0-9_]/i.test(next)
    ) {
      result += replacement;
      index += source.length - 1;
    } else {
      result += character;
    }
  }
  return result;
}

function replaceScalarFunction(
  sql: string,
  sourceName: string,
  targetName: string,
) {
  const pattern = new RegExp(`\\b${sourceName}\\s*\\(`, "gi");
  let result = "";
  let cursor = 0;
  for (const match of sql.matchAll(pattern)) {
    const start = match.index;
    if (start < cursor) continue;
    const open = start + match[0].lastIndexOf("(");
    const close = matchingParenthesis(sql, open);
    if (close === -1) continue;
    const body = sql.slice(open + 1, close);
    if (!hasTopLevelComma(body)) continue;
    result += sql.slice(cursor, start);
    result += `${targetName}(${body})`;
    cursor = close + 1;
  }
  return result + sql.slice(cursor);
}

function matchingParenthesis(sql: string, open: number) {
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  for (let index = open; index < sql.length; index += 1) {
    const character = sql[index];
    const previous = sql[index - 1];
    if (character === "'" && !doubleQuoted && previous !== "\\") {
      singleQuoted = !singleQuoted;
    } else if (character === '"' && !singleQuoted && previous !== "\\") {
      doubleQuoted = !doubleQuoted;
    } else if (!singleQuoted && !doubleQuoted) {
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
  }
  return -1;
}

function hasTopLevelComma(value: string) {
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1];
    if (character === "'" && !doubleQuoted && previous !== "\\") {
      singleQuoted = !singleQuoted;
    } else if (character === '"' && !singleQuoted && previous !== "\\") {
      doubleQuoted = !doubleQuoted;
    } else if (!singleQuoted && !doubleQuoted) {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (character === "," && depth === 0) return true;
    }
  }
  return false;
}

function databaseValue(value: unknown): DatabaseValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw compatibilityError("A repository query contained an unsupported value.");
}

function d1Result<T>(results: T[], affectedRows: number): D1Result<T> {
  return {
    results,
    success: true,
    meta: { changes: affectedRows },
  };
}

function compatibilityError(message: string) {
  return new AppError(message, 500, "DATABASE_COMPATIBILITY_ERROR");
}
