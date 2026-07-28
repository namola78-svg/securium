import { AppError } from "../../lib/errors.ts";

export type SearchDialect = "d1" | "supabase";
export type SearchMode = "keyword" | "full-text";

export function buildSearchPredicate(
  dialect: SearchDialect,
  columns: readonly string[],
  mode: SearchMode = "keyword",
) {
  if (columns.length === 0) throw invalidSearch();
  const safeColumns = columns.map(identifier);
  if (dialect === "d1") {
    if (mode === "full-text") {
      throw new AppError(
        "D1 full-text search requires a separately managed FTS table.",
        500,
        "D1_FTS_NOT_CONFIGURED",
      );
    }
    return {
      sql: `(${safeColumns
        .map((column) => `lower(${column}) LIKE lower(?)`)
        .join(" OR ")})`,
      parameter: (term: string) => `%${term}%`,
    };
  }
  if (dialect !== "supabase") throw invalidSearch();
  if (mode === "full-text") {
    return {
      sql: `to_tsvector('simple', concat_ws(' ', ${safeColumns
        .map((column) => `coalesce(${column}, '')`)
        .join(", ")})) @@ plainto_tsquery('simple', ?)`,
      parameter: (term: string) => term,
    };
  }
  return {
    sql: `(${safeColumns
      .map((column) => `${column} ILIKE ?`)
      .join(" OR ")})`,
    parameter: (term: string) => `%${term}%`,
  };
}

function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw invalidSearch();
  return `"${value}"`;
}

function invalidSearch() {
  return new AppError(
    "The search configuration is invalid.",
    500,
    "DATABASE_SEARCH_CONFIGURATION_INVALID",
  );
}
