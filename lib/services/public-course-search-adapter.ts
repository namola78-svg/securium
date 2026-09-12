import {
  courseAudienceLabel,
  courseDescription,
  courseTypeLabel,
} from "../course-display.ts";
import { isPublicCourse } from "./catalog-service.ts";

export const PUBLIC_COURSE_SEARCH_CONTRACT_VERSION =
  "public-course-search.v1" as const;
export const PUBLIC_COURSE_SEARCH_CURSOR_VERSION =
  "public-course-search.cursor.v1" as const;
export const PUBLIC_COURSE_SEARCH_DEFAULT_LIMIT = 8;
export const PUBLIC_COURSE_SEARCH_MAX_LIMIT = 12;
export const PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES = 48;
export const PUBLIC_COURSE_SEARCH_MAX_CURSOR_LENGTH = 2048;
export const PUBLIC_COURSE_SEARCH_ORDER_VERSION =
  "group-display-order.course-display-order.id.v1" as const;

export type PublicCourseSearchPath =
  | "all"
  | "certification"
  | "professional";

export type PublicCourseSearchPosition = Readonly<{
  groupDisplayOrder: number;
  displayOrder: number;
  id: string;
}>;

/**
 * Server-owned input to the repository boundary. The repository must apply
 * the public predicate and search condition before executing this bounded
 * read. The adapter repeats the public predicate defensively because this
 * boundary is also used with test repositories.
 */
export type PublicCourseSearchRepositoryInput = Readonly<{
  query: string;
  path: PublicCourseSearchPath;
  limit: number;
  after: PublicCourseSearchPosition | null;
}>;

/**
 * This is intentionally richer than the output DTO. It contains only fields
 * a server-owned repository may use to establish publication and ordering;
 * callers cannot provide or override any of these fields.
 */
export type PublicCourseSearchSourceRecord = Readonly<{
  id: string;
  groupName: string;
  groupActive: boolean;
  groupDeletedAt: string | null;
  groupDisplayOrder: number;
  code: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  thumbnailUrl: string | null;
  totalLevels: number;
  passingScore?: number;
  difficulty: string;
  active: boolean;
  published: boolean;
  deletedAt: string | null;
  displayOrder: number;
  isSample?: boolean;
  updatedAt?: string | null;
  subjectCount?: number | null;
  topicCount?: number | null;
  questionCount?: number | null;
}>;

export type PublicCourseSearchRepository = Readonly<{
  searchPublicCourses(
    input: PublicCourseSearchRepositoryInput,
  ): Promise<readonly PublicCourseSearchSourceRecord[]>;
}>;

export type PublicCourseSummary = Readonly<{
  id: string;
  groupName: string;
  code: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  thumbnailUrl: string | null;
  totalLevels: number;
  difficulty: string;
  updatedAt?: string;
  subjectCount?: number;
  topicCount?: number;
}>;

export type PublicCourseSearchResult = Readonly<{
  contractVersion: typeof PUBLIC_COURSE_SEARCH_CONTRACT_VERSION;
  status: "OK" | "EMPTY";
  results: readonly PublicCourseSummary[];
  page: Readonly<{
    limit: number;
    hasNext: boolean;
    nextCursor: string | null;
  }>;
}>;

export type PublicCourseSearchErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CURSOR"
  | "INVALID_SOURCE";

export class PublicCourseSearchError extends Error {
  readonly code: PublicCourseSearchErrorCode;

  constructor(code: PublicCourseSearchErrorCode, message: string) {
    super(message);
    this.name = "PublicCourseSearchError";
    this.code = code;
  }
}

type NormalizedInput = Readonly<{
  query: string;
  path: PublicCourseSearchPath;
  limit: number;
  cursor?: string;
}>;

const CURSOR_FIELDS = [
  "cursorType",
  "cursorVersion",
  "displayOrder",
  "fingerprint",
  "groupDisplayOrder",
  "id",
  "integrity",
  "limit",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInput(message: string): never {
  throw new PublicCourseSearchError("INVALID_INPUT", message);
}

function normalizeQuery(value: unknown) {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    return invalidInput("Course search query must be a string.");
  }

  const normalized = value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR");
  if (new TextEncoder().encode(normalized).length > PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES) {
    return invalidInput(
      `Course search query cannot exceed ${PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES} UTF-8 bytes.`,
    );
  }
  return normalized;
}

function normalizeLimit(value: unknown) {
  if (value === undefined) return PUBLIC_COURSE_SEARCH_DEFAULT_LIMIT;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > PUBLIC_COURSE_SEARCH_MAX_LIMIT
  ) {
    return invalidInput(
      `Course search limit must be an integer from 1 to ${PUBLIC_COURSE_SEARCH_MAX_LIMIT}.`,
    );
  }
  return value;
}

function normalizePath(value: unknown): PublicCourseSearchPath {
  if (value === undefined) return "all";
  if (value === "all" || value === "certification" || value === "professional") {
    return value;
  }
  return invalidInput("Course search path is invalid.");
}

function normalizeInput(input: unknown): NormalizedInput {
  if (input === undefined) input = {};
  if (!isRecord(input)) return invalidInput("Course search input must be an object.");

  const allowedFields = new Set(["query", "path", "limit", "cursor"]);
  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    return invalidInput("Course search input contains an unsupported field.");
  }

  const cursor = input.cursor;
  if (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0)) {
    return invalidInput("Course search cursor must be a non-empty string.");
  }
  if (typeof cursor === "string" && cursor.length > PUBLIC_COURSE_SEARCH_MAX_CURSOR_LENGTH) {
    return invalidInput("Course search cursor is too large.");
  }

  return {
    query: normalizeQuery(input.query),
    path: normalizePath(input.path),
    limit: normalizeLimit(input.limit),
    ...(typeof cursor === "string" ? { cursor } : {}),
  };
}

function compareStrings(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function comparePublicCourseSearchPositions(
  left: PublicCourseSearchPosition,
  right: PublicCourseSearchPosition,
) {
  return (
    left.groupDisplayOrder - right.groupDisplayOrder ||
    left.displayOrder - right.displayOrder ||
    compareStrings(left.id, right.id)
  );
}

function positionOf(record: PublicCourseSearchSourceRecord): PublicCourseSearchPosition {
  if (
    !Number.isSafeInteger(record.groupDisplayOrder) ||
    !Number.isSafeInteger(record.displayOrder) ||
    typeof record.id !== "string" ||
    record.id.length === 0
  ) {
    throw new PublicCourseSearchError(
      "INVALID_SOURCE",
      "Course search source has an invalid ordering identity.",
    );
  }
  return {
    groupDisplayOrder: record.groupDisplayOrder,
    displayOrder: record.displayOrder,
    id: record.id,
  };
}

function isPublicCourseSource(record: PublicCourseSearchSourceRecord) {
  return (
    isPublicCourse(record) &&
    record.groupActive === true &&
    record.groupDeletedAt === null
  );
}

function searchableText(record: PublicCourseSearchSourceRecord) {
  return [
    record.name,
    record.shortName,
    record.groupName,
    courseDescription(record.description),
    courseAudienceLabel(record),
  ]
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR");
}

function matchesQuery(
  record: PublicCourseSearchSourceRecord,
  query: string,
) {
  return query.length === 0 || searchableText(record).includes(query);
}

function matchesPath(
  record: PublicCourseSearchSourceRecord,
  path: PublicCourseSearchPath,
) {
  if (path === "all") return true;
  const isCertification = courseTypeLabel(record) === "자격시험";
  return path === "certification" ? isCertification : !isCertification;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function projectCourse(record: PublicCourseSearchSourceRecord): PublicCourseSummary {
  const projection: PublicCourseSummary = {
    id: record.id,
    groupName: record.groupName,
    code: record.code,
    slug: record.slug,
    name: record.name,
    shortName: record.shortName,
    description: courseDescription(record.description),
    thumbnailUrl: record.thumbnailUrl,
    totalLevels: record.totalLevels,
    difficulty: record.difficulty,
    ...(typeof record.updatedAt === "string" ? { updatedAt: record.updatedAt } : {}),
    ...(isNonNegativeInteger(record.subjectCount)
      ? { subjectCount: record.subjectCount }
      : {}),
    ...(isNonNegativeInteger(record.topicCount) ? { topicCount: record.topicCount } : {}),
  };
  return Object.freeze(projection);
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("invalid base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

async function queryFingerprint(query: string, path: PublicCourseSearchPath) {
  return sha256(
    JSON.stringify({
      contractVersion: PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
      orderVersion: PUBLIC_COURSE_SEARCH_ORDER_VERSION,
      path,
      query,
    }),
  );
}

async function encodeCursor(
  fingerprint: string,
  limit: number,
  position: PublicCourseSearchPosition,
) {
  const body = JSON.stringify({
    cursorType: "public-course-search",
    cursorVersion: PUBLIC_COURSE_SEARCH_CURSOR_VERSION,
    displayOrder: position.displayOrder,
    fingerprint,
    groupDisplayOrder: position.groupDisplayOrder,
    id: position.id,
    limit,
  });
  const payload = {
    cursorType: "public-course-search",
    cursorVersion: PUBLIC_COURSE_SEARCH_CURSOR_VERSION,
    displayOrder: position.displayOrder,
    fingerprint,
    groupDisplayOrder: position.groupDisplayOrder,
    id: position.id,
    integrity: await sha256(body),
    limit,
  };
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

function assertCursorFields(value: Record<string, unknown>): asserts value is Record<
  (typeof CURSOR_FIELDS)[number],
  unknown
> {
  if (
    Object.keys(value).sort().join("\u0000") !==
    [...CURSOR_FIELDS].sort().join("\u0000")
  ) {
    throw new Error("cursor fields");
  }
}

async function decodeCursor(
  value: string,
  fingerprint: string,
  limit: number,
): Promise<PublicCourseSearchPosition> {
  try {
    const bytes = decodeBase64Url(value);
    if (bytes.length > PUBLIC_COURSE_SEARCH_MAX_CURSOR_LENGTH) throw new Error("cursor payload");
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    assertCursorFields(decoded);
    if (
      decoded.cursorType !== "public-course-search" ||
      decoded.cursorVersion !== PUBLIC_COURSE_SEARCH_CURSOR_VERSION ||
      decoded.fingerprint !== fingerprint ||
      decoded.limit !== limit ||
      !isNonNegativeInteger(decoded.groupDisplayOrder) ||
      !isNonNegativeInteger(decoded.displayOrder) ||
      typeof decoded.id !== "string" ||
      decoded.id.length === 0 ||
      typeof decoded.integrity !== "string"
    ) {
      throw new Error("cursor mismatch");
    }
    const body = JSON.stringify({
      cursorType: decoded.cursorType,
      cursorVersion: decoded.cursorVersion,
      displayOrder: decoded.displayOrder,
      fingerprint: decoded.fingerprint,
      groupDisplayOrder: decoded.groupDisplayOrder,
      id: decoded.id,
      limit: decoded.limit,
    });
    if (decoded.integrity !== await sha256(body)) throw new Error("cursor integrity");
    return {
      groupDisplayOrder: decoded.groupDisplayOrder,
      displayOrder: decoded.displayOrder,
      id: decoded.id,
    };
  } catch {
    throw new PublicCourseSearchError(
      "INVALID_CURSOR",
      "Course search cursor is invalid for this query.",
    );
  }
}

/**
 * Creates an unregistered internal adapter. It has no route, MCP registry,
 * Agents API, or database connection of its own; those integrations must pass
 * a server-owned repository implementing the bounded query contract.
 */
export function createPublicCourseSearchAdapter(
  repository: PublicCourseSearchRepository,
) {
  async function searchPublicCourses(
    input: unknown = {},
  ): Promise<PublicCourseSearchResult> {
    const normalized = normalizeInput(input);
    const fingerprint = await queryFingerprint(normalized.query, normalized.path);
    const after = normalized.cursor
      ? await decodeCursor(normalized.cursor, fingerprint, normalized.limit)
      : null;

    const sourceRows = await repository.searchPublicCourses({
      query: normalized.query,
      path: normalized.path,
      // One look-ahead row is enough to derive hasNext without an unbounded read.
      limit: normalized.limit + 1,
      after,
    });
    if (!Array.isArray(sourceRows)) {
      throw new PublicCourseSearchError(
        "INVALID_SOURCE",
        "Course search repository returned an invalid result.",
      );
    }

    const unique = new Map<string, PublicCourseSearchSourceRecord>();
    for (const row of sourceRows) {
      positionOf(row);
      if (
        isPublicCourseSource(row) &&
        matchesQuery(row, normalized.query) &&
        matchesPath(row, normalized.path) &&
        (!after || comparePublicCourseSearchPositions(positionOf(row), after) > 0)
      ) {
        unique.set(row.id, row);
      }
    }

    const ordered = [...unique.values()].sort((left, right) =>
      comparePublicCourseSearchPositions(positionOf(left), positionOf(right)),
    );
    const pageWithLookAhead = ordered.slice(0, normalized.limit + 1);
    const hasNext = pageWithLookAhead.length > normalized.limit;
    const page = pageWithLookAhead.slice(0, normalized.limit);
    const last = page.at(-1);
    const nextCursor = hasNext && last
      ? await encodeCursor(fingerprint, normalized.limit, positionOf(last))
      : null;

    return {
      contractVersion: PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
      status: page.length > 0 ? "OK" : "EMPTY",
      results: page.map(projectCourse),
      page: {
        limit: normalized.limit,
        hasNext,
        nextCursor,
      },
    };
  }

  return Object.freeze({ searchPublicCourses });
}

export type PublicCourseSearchAdapter = ReturnType<
  typeof createPublicCourseSearchAdapter
>;
