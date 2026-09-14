import {
  PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  type PublicCourseSearchErrorCode,
  type PublicCourseSearchPath,
  type PublicCourseSearchResult,
} from "./public-course-search-adapter.ts";
import type {
  PublicDiscoverySelectionInput,
  PublicDiscoverySelectionResult,
} from "./public-discovery-selection.ts";

export type PublicDiscoverySearchStatus =
  | "IDLE"
  | "PENDING"
  | "SUCCESS"
  | "EMPTY"
  | "ERROR";

export type PublicDiscoveryOutlineStatus =
  | "IDLE"
  | "PENDING"
  | "SUCCESS"
  | "ERROR";

export type PublicDiscoverySearchConditions = Readonly<{
  query: string;
  path: PublicCourseSearchPath;
}>;

/** UI-owned classification; adapter error codes are kept as their own field. */
export type PublicDiscoverySearchFailure = Readonly<
  | { kind: "ADAPTER_ERROR"; code: PublicCourseSearchErrorCode }
  | { kind: "PROVIDER_ERROR" }
  | { kind: "UNKNOWN_RESULT" }
>;

/** A transport/caller failure, distinct from a selection-service result. */
export type PublicDiscoveryOutlineRequestFailure = Readonly<
  | { kind: "PROVIDER_ERROR" }
  | { kind: "UNKNOWN_RESULT" }
>;

export type PublicDiscoveryOutlineSuccess = Extract<
  PublicDiscoverySelectionResult,
  { status: "OK" }
>;

export type PublicDiscoveryOutlineError = Exclude<
  PublicDiscoverySelectionResult,
  { status: "OK" }
>;

export type PublicDiscoveryViewState = Readonly<{
  search: Readonly<{
    conditions: PublicDiscoverySearchConditions;
    status: PublicDiscoverySearchStatus;
    activeRequestId: string | null;
    result: PublicCourseSearchResult | null;
    /** A retained result is stale while a newer request is pending or failed. */
    stale: boolean;
    error: PublicDiscoverySearchFailure | null;
  }>;
  selection: PublicDiscoverySelectionInput | null;
  outline: Readonly<{
    status: PublicDiscoveryOutlineStatus;
    activeRequestId: string | null;
    result: PublicDiscoveryOutlineSuccess | null;
    error: PublicDiscoveryOutlineError | PublicDiscoveryOutlineRequestFailure | null;
  }>;
}>;

export type PublicDiscoveryViewStateEvent =
  | Readonly<{
      type: "SEARCH_CONDITIONS_CHANGED";
      conditions: PublicDiscoverySearchConditions;
    }>
  | Readonly<{
      type: "SEARCH_REQUEST_STARTED" | "SEARCH_REFRESH_REQUESTED";
      requestId: string;
    }>
  | Readonly<{
      type: "SEARCH_RESULT_RECEIVED";
      requestId: string;
      result: PublicCourseSearchResult;
    }>
  | Readonly<{
      type: "SEARCH_REQUEST_FAILED";
      requestId: string;
      failure: PublicDiscoverySearchFailure;
    }>
  | Readonly<{
      type: "COURSE_SELECTED";
      selection: PublicDiscoverySelectionInput;
    }>
  | Readonly<{
      type: "OUTLINE_REQUEST_STARTED";
      requestId: string;
    }>
  | Readonly<{
      type: "OUTLINE_RESULT_RECEIVED";
      requestId: string;
      selection: PublicDiscoverySelectionInput;
      result: PublicDiscoverySelectionResult;
    }>
  | Readonly<{
      type: "OUTLINE_REQUEST_FAILED";
      requestId: string;
      selection: PublicDiscoverySelectionInput;
      failure: PublicDiscoveryOutlineRequestFailure;
    }>
  | Readonly<{
      type: "BACK_TO_RESULTS" | "COURSE_DESELECTED";
    }>;

export function createInitialPublicDiscoveryViewState(): PublicDiscoveryViewState {
  return freezeState({
    search: {
      conditions: freezeConditions({ query: "", path: "all" }),
      status: "IDLE",
      activeRequestId: null,
      result: null,
      stale: false,
      error: null,
    },
    selection: null,
    outline: createIdleOutlineState(),
  });
}

export function reducePublicDiscoveryViewState(
  state: PublicDiscoveryViewState,
  event: PublicDiscoveryViewStateEvent,
): PublicDiscoveryViewState {
  if (!isRecord(event) || typeof event.type !== "string") return state;

  switch (event.type) {
    case "SEARCH_CONDITIONS_CHANGED":
      if (!isValidConditions(event.conditions)) return state;
      return freezeState({
        search: {
          conditions: freezeConditions(event.conditions),
          status: "IDLE",
          activeRequestId: null,
          result: null,
          stale: false,
          error: null,
        },
        selection: null,
        outline: createIdleOutlineState(),
      });

    case "SEARCH_REQUEST_STARTED":
    case "SEARCH_REFRESH_REQUESTED":
      if (!isRequestId(event.requestId)) return state;
      if (
        state.search.status === "PENDING" &&
        state.search.activeRequestId === event.requestId
      ) {
        return state;
      }
      return startSearch(state, event.requestId);

    case "SEARCH_RESULT_RECEIVED":
      if (
        !isRequestId(event.requestId) ||
        state.search.activeRequestId !== event.requestId ||
        !isSearchResultEnvelope(event.result)
      ) {
        return state;
      }
      return freezeState({
        ...state,
        search: {
          ...state.search,
          status: event.result.status === "OK" ? "SUCCESS" : "EMPTY",
          activeRequestId: null,
          result: event.result,
          stale: false,
          error: null,
        },
      });

    case "SEARCH_REQUEST_FAILED":
      if (
        !isRequestId(event.requestId) ||
        state.search.activeRequestId !== event.requestId ||
        !isSearchFailure(event.failure)
      ) {
        return state;
      }
      return freezeState({
        ...state,
        search: {
          ...state.search,
          status: "ERROR",
          activeRequestId: null,
          stale: state.search.result !== null,
          error: freezeSearchFailure(event.failure),
        },
      });

    case "COURSE_SELECTED":
      if (!isValidSelection(event.selection)) return state;
      return freezeState({
        ...state,
        selection: freezeSelection(event.selection),
        outline: createIdleOutlineState(),
      });

    case "OUTLINE_REQUEST_STARTED":
      if (!isRequestId(event.requestId) || state.selection === null) return state;
      return freezeState({
        ...state,
        outline: {
          status: "PENDING",
          activeRequestId: event.requestId,
          result: null,
          error: null,
        },
      });

    case "OUTLINE_RESULT_RECEIVED":
      if (
        !isRequestId(event.requestId) ||
        state.outline.activeRequestId !== event.requestId ||
        !isValidSelection(event.selection) ||
        state.selection === null ||
        !sameSelection(state.selection, event.selection) ||
        !isSelectionResultEnvelope(event.result)
      ) {
        return state;
      }

      if (event.result.status === "OK") {
        if (event.result.course.id !== state.selection.courseId) {
          return completeOutlineWithError(state, {
            status: "SELECTION_ERROR",
            code: "IDENTITY_MISMATCH",
          });
        }
        return freezeState({
          ...state,
          outline: {
            status: "SUCCESS",
            activeRequestId: null,
            result: event.result,
            error: null,
          },
        });
      }

      return completeOutlineWithError(state, event.result);

    case "OUTLINE_REQUEST_FAILED":
      if (
        !isRequestId(event.requestId) ||
        state.outline.activeRequestId !== event.requestId ||
        !isValidSelection(event.selection) ||
        state.selection === null ||
        !sameSelection(state.selection, event.selection) ||
        !isOutlineRequestFailure(event.failure)
      ) {
        return state;
      }
      return freezeState({
        ...state,
        outline: {
          status: "ERROR",
          activeRequestId: null,
          result: null,
          error: freezeOutlineRequestFailure(event.failure),
        },
      });

    case "BACK_TO_RESULTS":
    case "COURSE_DESELECTED":
      return freezeState({
        ...state,
        selection: null,
        outline: createIdleOutlineState(),
      });

    default:
      return state;
  }
}

function startSearch(
  state: PublicDiscoveryViewState,
  requestId: string,
): PublicDiscoveryViewState {
  return freezeState({
    ...state,
    search: {
      ...state.search,
      status: "PENDING",
      activeRequestId: requestId,
      stale: state.search.result !== null,
      error: null,
    },
    selection: null,
    outline: createIdleOutlineState(),
  });
}

function completeOutlineWithError(
  state: PublicDiscoveryViewState,
  error: PublicDiscoveryOutlineError,
): PublicDiscoveryViewState {
  return freezeState({
    ...state,
    outline: {
      status: "ERROR",
      activeRequestId: null,
      result: null,
      error: freezeOutlineError(error),
    },
  });
}

function createIdleOutlineState(): PublicDiscoveryViewState["outline"] {
  return Object.freeze({
    status: "IDLE" as const,
    activeRequestId: null,
    result: null,
    error: null,
  });
}

function freezeState(state: {
  search: PublicDiscoveryViewState["search"];
  selection: PublicDiscoverySelectionInput | null;
  outline: PublicDiscoveryViewState["outline"];
}): PublicDiscoveryViewState {
  return Object.freeze({
    search: Object.freeze({
      ...state.search,
      conditions: freezeConditions(state.search.conditions),
      error: state.search.error
        ? freezeSearchFailure(state.search.error)
        : null,
    }),
    selection: state.selection ? freezeSelection(state.selection) : null,
    outline: Object.freeze({
      ...state.outline,
      error: state.outline.error !== null
        ? freezeOutlineErrorOrRequestFailure(state.outline.error)
        : null,
    }),
  });
}

function freezeConditions(
  conditions: PublicDiscoverySearchConditions,
): PublicDiscoverySearchConditions {
  return Object.freeze({ query: conditions.query, path: conditions.path });
}

function freezeSelection(
  selection: PublicDiscoverySelectionInput,
): PublicDiscoverySelectionInput {
  return Object.freeze({
    courseId: selection.courseId,
    courseSlug: selection.courseSlug,
  });
}

function freezeSearchFailure(
  failure: PublicDiscoverySearchFailure,
): PublicDiscoverySearchFailure {
  if (failure.kind === "ADAPTER_ERROR") {
    return Object.freeze({ kind: failure.kind, code: failure.code });
  }
  return Object.freeze({ kind: failure.kind });
}

function freezeOutlineRequestFailure(
  failure: PublicDiscoveryOutlineRequestFailure,
): PublicDiscoveryOutlineRequestFailure {
  return Object.freeze({ kind: failure.kind });
}

function freezeOutlineError(
  error: PublicDiscoveryOutlineError,
): PublicDiscoveryOutlineError {
  if (error.status === "UNAVAILABLE") {
    return Object.freeze({ status: error.status, reason: error.reason });
  }
  if (error.status === "SELECTION_ERROR") {
    return Object.freeze({ status: error.status, code: error.code });
  }
  return Object.freeze({ status: error.status });
}

function freezeOutlineErrorOrRequestFailure(
  error: NonNullable<PublicDiscoveryViewState["outline"]["error"]>,
): NonNullable<PublicDiscoveryViewState["outline"]["error"]> {
  if ("kind" in error) return freezeOutlineRequestFailure(error);
  return freezeOutlineError(error);
}

function isValidConditions(value: unknown): value is PublicDiscoverySearchConditions {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => key !== "query" && key !== "path")) {
    return false;
  }
  return (
    typeof value.query === "string" &&
    (value.path === "all" ||
      value.path === "certification" ||
      value.path === "professional")
  );
}

function isValidSelection(value: unknown): value is PublicDiscoverySelectionInput {
  if (!isRecord(value)) return false;
  if (
    Object.keys(value).some((key) => key !== "courseId" && key !== "courseSlug")
  ) {
    return false;
  }
  return (
    typeof value.courseId === "string" &&
    value.courseId.trim().length > 0 &&
    typeof value.courseSlug === "string" &&
    value.courseSlug.length > 0 &&
    value.courseSlug === value.courseSlug.trim()
  );
}

function isRequestId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSearchFailure(value: unknown): value is PublicDiscoverySearchFailure {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "PROVIDER_ERROR" || value.kind === "UNKNOWN_RESULT") {
    return Object.keys(value).length === 1;
  }
  return (
    value.kind === "ADAPTER_ERROR" &&
    Object.keys(value).length === 2 &&
    (value.code === "INVALID_INPUT" ||
      value.code === "INVALID_CURSOR" ||
      value.code === "INVALID_SOURCE")
  );
}

function isOutlineRequestFailure(
  value: unknown,
): value is PublicDiscoveryOutlineRequestFailure {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    (value.kind === "PROVIDER_ERROR" || value.kind === "UNKNOWN_RESULT")
  );
}

/** Envelope checks only; full adapter/service validation remains a caller duty. */
function isSearchResultEnvelope(value: unknown): value is PublicCourseSearchResult {
  if (!isRecord(value)) return false;
  if (
    value.contractVersion !== PUBLIC_COURSE_SEARCH_CONTRACT_VERSION ||
    (value.status !== "OK" && value.status !== "EMPTY") ||
    !Array.isArray(value.results) ||
    !isRecord(value.page)
  ) {
    return false;
  }
  return (
    typeof value.page.limit === "number" &&
    typeof value.page.hasNext === "boolean" &&
    (typeof value.page.nextCursor === "string" || value.page.nextCursor === null)
  );
}

/** Discriminant and required envelope checks only; this is not a projection validator. */
function isSelectionResultEnvelope(
  value: unknown,
): value is PublicDiscoverySelectionResult {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  switch (value.status) {
    case "OK":
      return (
        isRecord(value.course) &&
        typeof value.course.id === "string" &&
        Array.isArray(value.subjects)
      );
    case "INVALID_INPUT":
    case "NOT_FOUND":
      return Object.keys(value).length === 1;
    case "UNAVAILABLE":
      return (
        Object.keys(value).length === 2 &&
        (value.reason === "OUTLINE_LIMIT_EXCEEDED" ||
          value.reason === "PUBLIC_RELATION_MISMATCH" ||
          value.reason === "INVALID_PUBLIC_PROJECTION" ||
          value.reason === "PUBLIC_REPOSITORY_ERROR")
      );
    case "SELECTION_ERROR":
      return (
        Object.keys(value).length === 2 &&
        (value.code === "INVALID_INPUT" || value.code === "IDENTITY_MISMATCH")
      );
    default:
      return false;
  }
}

function sameSelection(
  left: PublicDiscoverySelectionInput,
  right: PublicDiscoverySelectionInput,
): boolean {
  return left.courseId === right.courseId && left.courseSlug === right.courseSlug;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
