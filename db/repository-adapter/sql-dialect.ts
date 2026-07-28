import type {
  DatabaseStatement,
  DatabaseValue,
} from "../provider/database-provider.ts";

export type RepositoryDialect = "d1" | "supabase";
export type SortDirection = "asc" | "desc";

export class RepositorySqlDialect {
  readonly kind: RepositoryDialect;

  constructor(kind: RepositoryDialect) {
    this.kind = kind;
  }

  placeholder(index: number) {
    return this.kind === "d1" ? "?" : `$${index}`;
  }

  placeholders(count: number, startAt = 1) {
    return Array.from({ length: count }, (_, index) =>
      this.placeholder(startAt + index),
    ).join(", ");
  }

  caseInsensitivePredicate(
    columns: readonly string[],
    parameterIndex: number,
  ) {
    const placeholder = this.placeholder(parameterIndex);
    return `(${columns
      .map((column) =>
        this.kind === "d1"
          ? `lower(${quoteIdentifier(column)}) LIKE lower(${placeholder})`
          : `${quoteIdentifier(column)} ILIKE ${placeholder}`,
      )
      .join(" OR ")})`;
  }

  pagination(limitIndex: number, offsetIndex: number) {
    return `LIMIT ${this.placeholder(limitIndex)} OFFSET ${this.placeholder(offsetIndex)}`;
  }

  insertIgnore(
    table: string,
    columns: readonly string[],
    parameters: readonly DatabaseValue[],
    conflictColumns: readonly string[],
  ): DatabaseStatement {
    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    const values = this.placeholders(columns.length);
    if (this.kind === "d1") {
      return {
        sql: `INSERT OR IGNORE INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${values})`,
        parameters,
      };
    }
    const conflict = conflictColumns.map(quoteIdentifier).join(", ");
    return {
      sql: `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${values}) ON CONFLICT (${conflict}) DO NOTHING`,
      parameters,
    };
  }

  returning(columns: readonly string[]) {
    return `RETURNING ${columns.map(quoteIdentifier).join(", ")}`;
  }

  booleanExpression(column: string, parameterIndex: number) {
    return `${quoteIdentifier(column)} = ${this.placeholder(parameterIndex)}`;
  }

  dateComparison(
    column: string,
    operator: "<" | "<=" | ">" | ">=",
    parameterIndex: number,
  ) {
    return `${quoteIdentifier(column)} ${operator} ${this.placeholder(parameterIndex)}`;
  }
}

export function quoteIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new TypeError("Unsafe SQL identifier.");
  }
  return `"${value}"`;
}
