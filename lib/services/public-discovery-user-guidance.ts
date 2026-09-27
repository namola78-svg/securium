import {
  PUBLIC_COURSE_SEARCH_MAX_LIMIT,
  PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  PublicCourseSearchError,
} from "./public-course-search-adapter.ts";
import type {
  PublicCourseSearchResult,
  PublicCourseSummary,
} from "./public-course-search-adapter.ts";
import type {
  PublicCourseOutlineResult,
  PublicCourseOutlineSubject,
  PublicCourseOutlineTopic,
} from "./public-course-outline-adapter.ts";
import type {
  PublicDiscoverySelectionError,
  PublicDiscoverySelectionResult,
} from "./public-discovery-selection.ts";

export type PublicDiscoveryUserAction =
  | "EDIT_SEARCH"
  | "BACK_TO_RESULTS"
  | "REFRESH_RESULTS";

export type PublicDiscoveryGuidanceCategory =
  | "SEARCH_EMPTY"
  | "SEARCH_RESULTS"
  | "OUTLINE_READY"
  | "OUTLINE_EMPTY"
  | "COURSE_UNAVAILABLE"
  | "IDENTITY_MISMATCH"
  | "INPUT_ERROR"
  | "PROVIDER_ERROR"
  | "PROJECTION_ERROR"
  | "OUTLINE_LIMIT_EXCEEDED"
  | "UNKNOWN_RESULT";

export type PublicDiscoveryUserGuidance = Readonly<{
  category: PublicDiscoveryGuidanceCategory;
  title: string;
  message: string;
  actions: readonly PublicDiscoveryUserAction[];
}>;

export type PublicDiscoveryGuidanceRequest =
  | Readonly<{
      source: "SEARCH_RESULT";
      result: PublicCourseSearchResult;
    }>
  | Readonly<{
      source: "SEARCH_ERROR";
      error: unknown;
    }>
  | Readonly<{
      source: "SELECTION_RESULT";
      result: PublicDiscoverySelectionResult;
    }>;

const SEARCH_ACTIONS = Object.freeze(["EDIT_SEARCH"] as const);
const RESULT_ACTIONS = Object.freeze(["BACK_TO_RESULTS"] as const);
const REFRESH_ACTIONS = Object.freeze([
  "BACK_TO_RESULTS",
  "REFRESH_RESULTS",
] as const);
const NO_ACTIONS = Object.freeze([] as const);

function guidance(
  category: PublicDiscoveryGuidanceCategory,
  title: string,
  message: string,
  actions: readonly PublicDiscoveryUserAction[],
): PublicDiscoveryUserGuidance {
  return Object.freeze({
    category,
    title,
    message,
    actions: Object.freeze([...actions]),
  });
}

function unknownResult(): PublicDiscoveryUserGuidance {
  return guidance(
    "UNKNOWN_RESULT",
    "결과를 확인할 수 없어요",
    "과정 정보를 확인할 수 없어요.",
    RESULT_ACTIONS,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const expected = new Set(keys);
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function safeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return safeInteger(value) && value >= 0;
}

function isSearchSummary(value: unknown): value is PublicCourseSummary {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "id",
      "groupName",
      "code",
      "slug",
      "name",
      "shortName",
      "description",
      "thumbnailUrl",
      "totalLevels",
      "difficulty",
      ...(value.updatedAt !== undefined ? ["updatedAt"] : []),
      ...(value.subjectCount !== undefined ? ["subjectCount"] : []),
      ...(value.topicCount !== undefined ? ["topicCount"] : []),
    ])
  ) {
    return false;
  }
  return (
    nonEmptyString(value.id) &&
    typeof value.groupName === "string" &&
    typeof value.code === "string" &&
    nonEmptyString(value.slug) &&
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    typeof value.description === "string" &&
    nullableString(value.thumbnailUrl) &&
    finiteNumber(value.totalLevels) &&
    typeof value.difficulty === "string" &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string") &&
    (value.subjectCount === undefined || nonNegativeSafeInteger(value.subjectCount)) &&
    (value.topicCount === undefined || nonNegativeSafeInteger(value.topicCount))
  );
}

function isSearchResult(value: unknown): value is PublicCourseSearchResult {
  if (!isRecord(value) || !hasExactKeys(value, [
    "contractVersion",
    "status",
    "results",
    "page",
  ])) return false;
  if (
    value.contractVersion !== PUBLIC_COURSE_SEARCH_CONTRACT_VERSION ||
    !Array.isArray(value.results) ||
    !isRecord(value.page) ||
    !hasExactKeys(value.page, ["limit", "hasNext", "nextCursor"]) ||
    !safeInteger(value.page.limit) ||
    value.page.limit < 1 ||
    value.page.limit > PUBLIC_COURSE_SEARCH_MAX_LIMIT ||
    typeof value.page.hasNext !== "boolean" ||
    (value.page.nextCursor !== null && !nonEmptyString(value.page.nextCursor))
  ) return false;

  if (value.status === "EMPTY") {
    return (
      value.results.length === 0 &&
      value.page.hasNext === false &&
      value.page.nextCursor === null
    );
  }
  return (
    value.status === "OK" &&
    value.results.length > 0 &&
    value.results.length <= value.page.limit &&
    (value.page.hasNext
      ? value.results.length === value.page.limit && value.page.nextCursor !== null
      : value.page.nextCursor === null) &&
    value.results.every(isSearchSummary)
  );
}

function isOutlineTopic(value: unknown): value is PublicCourseOutlineTopic {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "subjectId",
      "code",
      "name",
      "description",
      "displayOrder",
      "isSample",
    ]) &&
    nonEmptyString(value.id) &&
    nonEmptyString(value.subjectId) &&
    typeof value.code === "string" &&
    typeof value.name === "string" &&
    nullableString(value.description) &&
    safeInteger(value.displayOrder) &&
    typeof value.isSample === "boolean"
  );
}

function isOutlineSubject(value: unknown): value is PublicCourseOutlineSubject {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "courseId",
      "code",
      "name",
      "description",
      "displayOrder",
      "isSample",
      "topics",
    ]) &&
    nonEmptyString(value.id) &&
    nonEmptyString(value.courseId) &&
    typeof value.code === "string" &&
    typeof value.name === "string" &&
    nullableString(value.description) &&
    safeInteger(value.displayOrder) &&
    typeof value.isSample === "boolean" &&
    Array.isArray(value.topics) &&
    value.topics.every(isOutlineTopic)
  );
}

function isOutlineResult(value: unknown): value is PublicCourseOutlineResult {
  if (!isRecord(value)) return false;
  if (value.status === "INVALID_INPUT" || value.status === "NOT_FOUND") {
    return hasExactKeys(value, ["status"]);
  }
  if (value.status === "UNAVAILABLE") {
    return (
      hasExactKeys(value, ["status", "reason"]) &&
      (value.reason === "OUTLINE_LIMIT_EXCEEDED" ||
        value.reason === "PUBLIC_RELATION_MISMATCH" ||
        value.reason === "INVALID_PUBLIC_PROJECTION" ||
        value.reason === "PUBLIC_REPOSITORY_ERROR")
    );
  }
  if (value.status !== "OK") return false;
  if (
    !hasExactKeys(value, ["status", "course", "subjects"]) ||
    !isRecord(value.course) ||
    !hasExactKeys(value.course, [
      "id",
      "slug",
      "code",
      "name",
      "shortName",
      "groupName",
      "description",
      "difficulty",
    ]) ||
    !nonEmptyString(value.course.id) ||
    !nonEmptyString(value.course.slug) ||
    typeof value.course.code !== "string" ||
    typeof value.course.name !== "string" ||
    !nullableString(value.course.shortName) ||
    !nullableString(value.course.groupName) ||
    !nullableString(value.course.description) ||
    !nullableString(value.course.difficulty) ||
    !Array.isArray(value.subjects)
  ) return false;

  const courseId = value.course.id;
  return value.subjects.every(
    (subject) =>
      isOutlineSubject(subject) &&
      subject.courseId === courseId &&
      subject.topics.every((topic) => topic.subjectId === subject.id),
  );
}

function isSelectionError(value: unknown): value is PublicDiscoverySelectionError {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["status", "code"]) &&
    value.status === "SELECTION_ERROR" &&
    (value.code === "INVALID_INPUT" || value.code === "IDENTITY_MISMATCH")
  );
}

function isSelectionResult(value: unknown): value is PublicDiscoverySelectionResult {
  return isSelectionError(value) || isOutlineResult(value);
}

function formatSearchResult(result: PublicCourseSearchResult) {
  if (result.status === "EMPTY") {
    return guidance(
      "SEARCH_EMPTY",
      "검색 결과가 없어요",
      "조건에 맞는 과정을 찾지 못했어요.",
      SEARCH_ACTIONS,
    );
  }
  return guidance(
    "SEARCH_RESULTS",
    "검색 결과를 확인해 주세요",
    "검색 결과를 확인하고 원하는 과정을 선택해 주세요.",
    NO_ACTIONS,
  );
}

function formatSearchError(error: unknown) {
  if (error instanceof PublicCourseSearchError) {
    if (error.code === "INVALID_INPUT" || error.code === "INVALID_CURSOR") {
      return guidance(
        "INPUT_ERROR",
        "요청을 확인할 수 없어요",
        "검색 요청을 확인할 수 없어요.",
        SEARCH_ACTIONS,
      );
    }
    if (error.code === "INVALID_SOURCE") {
      return guidance(
        "PROJECTION_ERROR",
        "과정 정보를 확인할 수 없어요",
        "과정 정보를 확인할 수 없어요.",
        REFRESH_ACTIONS,
      );
    }
  }
  return guidance(
    "PROVIDER_ERROR",
    "과정 정보를 불러오지 못했어요",
    "과정 정보를 불러오지 못했어요.",
    REFRESH_ACTIONS,
  );
}

function formatSelectionResult(result: PublicDiscoverySelectionResult) {
  if (isSelectionError(result)) {
    if (result.code === "IDENTITY_MISMATCH") {
      return guidance(
        "IDENTITY_MISMATCH",
        "선택한 과정 정보를 다시 확인해 주세요",
        "선택한 과정 정보를 다시 확인해 주세요.",
        RESULT_ACTIONS,
      );
    }
    return guidance(
      "INPUT_ERROR",
      "요청을 확인할 수 없어요",
      "선택한 과정 정보를 확인할 수 없어요.",
      RESULT_ACTIONS,
    );
  }
  if (result.status === "OK") {
    if (result.subjects.length === 0) {
      return guidance(
        "OUTLINE_EMPTY",
        "과정 개요가 비어 있어요",
        "선택한 과정의 개요가 비어 있어요.",
        RESULT_ACTIONS,
      );
    }
    return guidance(
      "OUTLINE_READY",
      "과정 개요를 확인했어요",
      "선택한 과정의 개요를 확인해 주세요.",
      NO_ACTIONS,
    );
  }
  if (result.status === "NOT_FOUND") {
    return guidance(
      "COURSE_UNAVAILABLE",
      "과정을 현재 확인할 수 없어요",
      "선택한 과정을 현재 확인할 수 없어요.",
      REFRESH_ACTIONS,
    );
  }
  if (result.status === "INVALID_INPUT") {
    return guidance(
      "INPUT_ERROR",
      "요청을 확인할 수 없어요",
      "선택한 과정 정보를 확인할 수 없어요.",
      RESULT_ACTIONS,
    );
  }
  if (result.status !== "UNAVAILABLE") return unknownResult();
  if (result.reason === "OUTLINE_LIMIT_EXCEEDED") {
    return guidance(
      "OUTLINE_LIMIT_EXCEEDED",
      "과정 개요를 표시할 수 없어요",
      "과정 개요를 표시할 수 없어요.",
      RESULT_ACTIONS,
    );
  }
  if (result.reason === "PUBLIC_REPOSITORY_ERROR") {
    return guidance(
      "PROVIDER_ERROR",
      "과정 정보를 불러오지 못했어요",
      "과정 정보를 불러오지 못했어요.",
      REFRESH_ACTIONS,
    );
  }
  return guidance(
    "PROJECTION_ERROR",
    "과정 정보를 확인할 수 없어요",
    "과정 정보를 확인할 수 없어요.",
    REFRESH_ACTIONS,
  );
}

/**
 * Converts already-produced public discovery results into bounded Korean
 * guidance. It does not validate authorization, authenticity, publication,
 * currentness, or any external state beyond the result shape needed here.
 */
export function formatPublicDiscoveryUserGuidance(
  input: unknown,
): PublicDiscoveryUserGuidance {
  if (!isRecord(input)) return unknownResult();
  if (input.source === "SEARCH_RESULT") {
    if (!hasExactKeys(input, ["source", "result"]) || !isSearchResult(input.result)) {
      return unknownResult();
    }
    return formatSearchResult(input.result);
  }
  if (input.source === "SEARCH_ERROR") {
    if (!hasExactKeys(input, ["source", "error"])) return unknownResult();
    return formatSearchError(input.error);
  }
  if (input.source === "SELECTION_RESULT") {
    if (!hasExactKeys(input, ["source", "result"]) || !isSelectionResult(input.result)) {
      return unknownResult();
    }
    return formatSelectionResult(input.result);
  }
  return unknownResult();
}
