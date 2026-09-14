export const PUBLIC_COURSE_SEARCH_COMPARISON_VERSION =
  "public-course-search.comparison.v2";
export const PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION =
  "public-course-search.normalizer.nfkc-trim-ko-lower.v1";
export const PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION =
  "public-course-search.id-order.utf16-code-unit-hex.v1";
export const PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES = 48;

export type PublicCourseSearchProjectionParts = Readonly<{
  name: string;
  shortName: string;
  groupName: string;
  publicDescription: string;
  audienceLabel: string;
}>;

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string`);
  }
}

function isWellFormedUnicodeString(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (
        !Number.isInteger(nextCodeUnit) ||
        nextCodeUnit < 0xdc00 ||
        nextCodeUnit > 0xdfff
      ) {
        return false;
      }
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

function assertSupportedText(
  value: unknown,
  field: string,
): asserts value is string {
  assertString(value, field);
  if (!isWellFormedUnicodeString(value)) {
    throw new RangeError(`${field} must contain Unicode scalar values`);
  }
}

export function isWellFormedPublicCourseSearchUnicodeString(
  value: unknown,
): value is string {
  return typeof value === "string" && isWellFormedUnicodeString(value);
}

/**
 * Applies the versioned comparison normalization shared by query and stored
 * public-search projection text. This function does not impose the query
 * byte limit and never mutates or replaces the source value.
 */
export function normalizePublicCourseSearchText(value: unknown): string {
  assertSupportedText(value, "value");
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
}

/**
 * Normalizes a query and applies the adapter's post-normalization UTF-8 byte
 * limit. Stored projection values intentionally do not use this limit.
 */
export function normalizePublicCourseSearchQuery(value: unknown): string {
  if (value === undefined) return "";
  const normalized = normalizePublicCourseSearchText(value);
  const byteLength = new TextEncoder().encode(normalized).byteLength;
  if (byteLength > PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES) {
    throw new RangeError(
      `query must be at most ${PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES} UTF-8 bytes`,
    );
  }
  return normalized;
}

function readProjectionParts(value: unknown): PublicCourseSearchProjectionParts {
  if (value === null || typeof value !== "object") {
    throw new TypeError("projection parts must be an object");
  }

  const parts = value as Record<string, unknown>;
  const fields = [
    "name",
    "shortName",
    "groupName",
    "publicDescription",
    "audienceLabel",
  ] as const;
  for (const field of fields) assertSupportedText(parts[field], field);

  return {
    name: parts.name as string,
    shortName: parts.shortName as string,
    groupName: parts.groupName as string,
    publicDescription: parts.publicDescription as string,
    audienceLabel: parts.audienceLabel as string,
  };
}

/**
 * Builds the stored-search projection from the exact five adapter fields.
 * Field boundaries are represented by one ASCII space, matching the current
 * adapter's joined searchable text. The query byte limit is not applied.
 */
export function buildPublicCourseSearchProjection(value: unknown): string {
  const parts = readProjectionParts(value);
  return normalizePublicCourseSearchText(
    [
      parts.name,
      parts.shortName,
      parts.groupName,
      parts.publicDescription,
      parts.audienceLabel,
    ].join(" "),
  );
}

export function isSupportedPublicCourseSearchId(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    isWellFormedPublicCourseSearchUnicodeString(value)
  );
}

function assertId(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError("id must be a string");
  }
  if (value.length === 0) throw new RangeError("id must not be empty");
  if (!isWellFormedUnicodeString(value)) {
    throw new RangeError("id must contain Unicode scalar values");
  }
}

/**
 * Encodes each JavaScript UTF-16 code unit as four uppercase hexadecimal ASCII
 * characters. The version is intentionally separate from the key: mixing
 * different key versions is invalid and must be rejected by the caller.
 *
 * NUL is a valid input to this pure function and is encoded as 0000. The
 * function does not claim that every database storage boundary accepts NUL.
 */
export function createPublicCourseSearchIdOrderKey(value: unknown): string {
  assertId(value);
  let key = "";
  for (let index = 0; index < value.length; index += 1) {
    key += value.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0");
  }
  return key;
}
