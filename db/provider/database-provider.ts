import { AppError } from "../../lib/errors.ts";

export type DatabaseValue =
  | string
  | number
  | boolean
  | null
  | Uint8Array;

export type DatabaseStatement = {
  sql: string;
  parameters?: readonly DatabaseValue[];
};

export type DatabaseResultMetadata = {
  provider: "d1" | "supabase";
};

export type DatabaseQueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
  metadata: DatabaseResultMetadata;
};

export type DatabaseExecutionResult = {
  affectedRows: number;
  returnedRows: Record<string, unknown>[];
  metadata: DatabaseResultMetadata;
};

export interface DatabaseProvider {
  readonly kind: "d1" | "supabase";
  query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<DatabaseQueryResult<Row>>;
  queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<Row | null>;
  execute(statement: DatabaseStatement): Promise<DatabaseExecutionResult>;
  transaction(
    statements: readonly DatabaseStatement[],
  ): Promise<DatabaseExecutionResult[]>;
  healthCheck(): Promise<boolean>;
}

export function assertSafeStatement(statement: DatabaseStatement) {
  const sql = statement.sql.trim();
  if (!sql || sql.includes("\u0000") || sql.length > 1_000_000) {
    throw new AppError(
      "The database statement is invalid.",
      500,
      "DATABASE_STATEMENT_INVALID",
    );
  }
  if (hasMultipleStatements(sql)) {
    throw new AppError(
      "Only one parameterized statement is allowed per operation.",
      500,
      "DATABASE_MULTIPLE_STATEMENTS",
    );
  }
}

function hasMultipleStatements(sql: string) {
  const withoutTrailing = sql.replace(/;\s*$/, "");
  return withoutTrailing.includes(";");
}
