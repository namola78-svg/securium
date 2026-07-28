import { AppError } from "../../lib/errors.ts";

export type DatabaseErrorCategory =
  | "connection_error"
  | "timeout"
  | "unique_violation"
  | "foreign_key_violation"
  | "not_null_violation"
  | "syntax_error"
  | "transaction_error"
  | "unknown_database_error";

const SAFE_ERRORS: Record<
  DatabaseErrorCategory,
  { code: string; message: string }
> = {
  connection_error: {
    code: "DATABASE_CONNECTION_ERROR",
    message: "The database connection is unavailable.",
  },
  timeout: {
    code: "DATABASE_TIMEOUT",
    message: "The database operation timed out.",
  },
  unique_violation: {
    code: "DATABASE_UNIQUE_VIOLATION",
    message: "The requested record conflicts with an existing record.",
  },
  foreign_key_violation: {
    code: "DATABASE_FOREIGN_KEY_VIOLATION",
    message: "The related record is invalid.",
  },
  not_null_violation: {
    code: "DATABASE_NOT_NULL_VIOLATION",
    message: "A required database value is missing.",
  },
  syntax_error: {
    code: "DATABASE_SYNTAX_ERROR",
    message: "The database operation is invalid.",
  },
  transaction_error: {
    code: "DATABASE_TRANSACTION_ERROR",
    message: "The database transaction could not be completed.",
  },
  unknown_database_error: {
    code: "DATABASE_UNKNOWN_ERROR",
    message: "The database operation could not be completed.",
  },
};

export class DatabaseProviderError extends AppError {
  readonly category: DatabaseErrorCategory;

  constructor(category: DatabaseErrorCategory) {
    const safe = SAFE_ERRORS[category];
    super(safe.message, 500, safe.code);
    this.name = "DatabaseProviderError";
    this.category = category;
  }
}

export function normalizeDatabaseError(
  error: unknown,
  context: "query" | "transaction" | "connection" = "query",
) {
  if (error instanceof DatabaseProviderError) return error;
  const code = readErrorCode(error);
  if (code === "23505") return new DatabaseProviderError("unique_violation");
  if (code === "23503") {
    return new DatabaseProviderError("foreign_key_violation");
  }
  if (code === "23502") return new DatabaseProviderError("not_null_violation");
  if (code === "42601") return new DatabaseProviderError("syntax_error");
  if (
    code === "57014" ||
    code === "CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    readErrorName(error) === "AbortError"
  ) {
    return new DatabaseProviderError("timeout");
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "CONNECTION_CLOSED" ||
    code === "CONNECTION_ENDED" ||
    code === "CONNECTION_DESTROYED"
  ) {
    return new DatabaseProviderError("connection_error");
  }
  if (
    context === "transaction" ||
    code === "25P02" ||
    code === "40001" ||
    code === "40P01"
  ) {
    return new DatabaseProviderError("transaction_error");
  }
  return new DatabaseProviderError(
    context === "connection" ? "connection_error" : "unknown_database_error",
  );
}

function readErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "";
}

function readErrorName(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }
  return "";
}
