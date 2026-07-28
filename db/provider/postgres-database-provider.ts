import { AppError } from "../../lib/errors.ts";
import {
  assertSafeStatement,
  type DatabaseExecutionResult,
  type DatabaseProvider,
  type DatabaseStatement,
  type DatabaseValue,
} from "./database-provider.ts";

export type PostgresQueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
};

export interface PostgresTransactionExecutor {
  query<Row extends Record<string, unknown>>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<PostgresQueryResult<Row>>;
}

export interface PostgresExecutor extends PostgresTransactionExecutor {
  transaction<T>(
    callback: (executor: PostgresTransactionExecutor) => Promise<T>,
  ): Promise<T>;
  close?(): Promise<void>;
}

export class PostgresDatabaseProvider implements DatabaseProvider {
  readonly kind = "supabase" as const;
  private readonly executor: PostgresExecutor;

  constructor(executor: PostgresExecutor) {
    this.executor = executor;
  }

  async query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ) {
    assertSafeStatement(statement);
    const normalized = normalizePostgresStatement(statement);
    const result = await this.executor.query<Row>(
      normalized.sql,
      normalized.parameters,
    );
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<Row | null> {
    const result = await this.query<Row>(statement);
    return result.rows[0] ?? null;
  }

  async execute(
    statement: DatabaseStatement,
  ): Promise<DatabaseExecutionResult> {
    assertSafeStatement(statement);
    const normalized = normalizePostgresStatement(statement);
    const result = await this.executor.query<Record<string, unknown>>(
      normalized.sql,
      normalized.parameters,
    );
    return {
      affectedRows: result.rowCount,
      returnedRows: result.rows,
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements: readonly DatabaseStatement[]) {
    for (const statement of statements) assertSafeStatement(statement);
    if (statements.length === 0) return [];
    return this.executor.transaction(async (transaction) => {
      const results: DatabaseExecutionResult[] = [];
      for (const statement of statements) {
        const normalized = normalizePostgresStatement(statement);
        const result = await transaction.query<Record<string, unknown>>(
          normalized.sql,
          normalized.parameters,
        );
        results.push({
          affectedRows: result.rowCount,
          returnedRows: result.rows,
          metadata: { provider: this.kind },
        });
      }
      return results;
    });
  }

  async healthCheck() {
    const row = await this.queryOne<{ ok: number }>({
      sql: "SELECT 1 AS ok",
    });
    return row?.ok === 1;
  }
}

export function normalizePostgresStatement(statement: DatabaseStatement) {
  const parameters = statement.parameters ?? [];
  let parameterIndex = 0;
  const nativeParameterIndexes = new Set<number>();
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let sql = "";

  for (let index = 0; index < statement.sql.length; index += 1) {
    const character = statement.sql[index];
    const previous = statement.sql[index - 1];
    if (character === "'" && !inDoubleQuote && previous !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (character === '"' && !inSingleQuote && previous !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    }
    if (character === "?" && !inSingleQuote && !inDoubleQuote) {
      parameterIndex += 1;
      sql += `$${parameterIndex}`;
    } else if (
      character === "$" &&
      !inSingleQuote &&
      !inDoubleQuote &&
      /\d/.test(statement.sql[index + 1] ?? "")
    ) {
      let end = index + 1;
      while (/\d/.test(statement.sql[end] ?? "")) end += 1;
      const nativeIndex = Number(statement.sql.slice(index + 1, end));
      nativeParameterIndexes.add(nativeIndex);
      sql += statement.sql.slice(index, end);
      index = end - 1;
    } else {
      sql += character;
    }
  }
  if (
    (parameterIndex > 0 && nativeParameterIndexes.size > 0) ||
    (parameterIndex > 0 && parameterIndex !== parameters.length) ||
    (parameterIndex === 0 &&
      !nativeParametersMatch(nativeParameterIndexes, parameters.length))
  ) {
    throw new AppError(
      "The database parameter count does not match the statement.",
      500,
      "DATABASE_PARAMETER_MISMATCH",
    );
  }
  return { sql, parameters };
}

function nativeParametersMatch(indexes: Set<number>, parameterCount: number) {
  if (indexes.size === 0) return parameterCount === 0;
  if (indexes.size !== parameterCount) return false;
  for (let index = 1; index <= parameterCount; index += 1) {
    if (!indexes.has(index)) return false;
  }
  return true;
}
