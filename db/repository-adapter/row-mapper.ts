import type { DatabaseValue } from "../provider/database-provider.ts";

export type RepositoryFieldMap = Record<string, string>;

export type RowMapping = {
  fields: RepositoryFieldMap;
  booleans?: readonly string[];
  dates?: readonly string[];
  json?: readonly string[];
};

export function mapDatabaseRow<T extends Record<string, unknown>>(
  row: Record<string, unknown>,
  mapping: RowMapping,
): T {
  const result: Record<string, unknown> = {};
  for (const [property, column] of Object.entries(mapping.fields)) {
    const value = row[column];
    if (mapping.booleans?.includes(property)) {
      result[property] = value === true || value === 1 || value === "1";
    } else if (mapping.dates?.includes(property)) {
      result[property] = normalizeDateTime(value);
    } else if (mapping.json?.includes(property)) {
      result[property] = parseJson(value);
    } else {
      result[property] = value ?? null;
    }
  }
  return result as T;
}

export function serializeRepositoryValues(
  values: Record<string, unknown>,
  mapping: RowMapping,
  allowedProperties: readonly string[],
) {
  const serialized: Record<string, DatabaseValue> = {};
  for (const [property, value] of Object.entries(values)) {
    if (!allowedProperties.includes(property)) {
      throw new TypeError(`Repository field is not allowed: ${property}`);
    }
    const column = mapping.fields[property];
    if (!column) {
      throw new TypeError(`Repository field is not mapped: ${property}`);
    }
    serialized[column] = serializeValue(property, value, mapping);
  }
  return serialized;
}

export function normalizeDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") {
    throw new TypeError("Database datetime must be a string or Date.");
  }
  const withTimeSeparator = value.includes("T")
    ? value
    : value.replace(" ", "T");
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(withTimeSeparator)
    ? withTimeSeparator
    : `${withTimeSeparator}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Database datetime is invalid.");
  }
  return date.toISOString();
}

function serializeValue(
  property: string,
  value: unknown,
  mapping: RowMapping,
): DatabaseValue {
  if (value === null || value === undefined) return null;
  if (mapping.booleans?.includes(property)) return value ? 1 : 0;
  if (mapping.dates?.includes(property)) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") {
      return normalizeDateTime(value);
    }
    throw new TypeError(`Repository datetime is invalid: ${property}`);
  }
  if (mapping.json?.includes(property)) return JSON.stringify(value);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new TypeError(`Repository value is invalid: ${property}`);
}

function parseJson(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
