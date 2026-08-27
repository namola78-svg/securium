import { AppError } from "../errors.ts";

/** Serialize JSON-compatible values deterministically without normalizing strings. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("CS1A_CANONICAL_VALUE_INVALID");
    return JSON.stringify(value);
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    fail("CS1A_CANONICAL_VALUE_INVALID");
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object") fail("CS1A_CANONICAL_VALUE_INVALID");

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function fail(code: string): never {
  throw new AppError("CS-1A canonical serialization failed.", 400, code);
}
