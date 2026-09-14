import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  type PublicCourseSearchResult,
} from "../lib/services/public-course-search-adapter.ts";
import type { PublicCourseOutlineSubject } from "../lib/services/public-course-outline-adapter.ts";
import type { PublicDiscoverySelectionInput } from "../lib/services/public-discovery-selection.ts";
import {
  createInitialPublicDiscoveryViewState,
  reducePublicDiscoveryViewState,
  type PublicDiscoveryViewState,
  type PublicDiscoveryViewStateEvent,
} from "../lib/services/public-discovery-view-state.ts";

const selectionA: PublicDiscoverySelectionInput = {
  courseId: "course-a",
  courseSlug: "course-a",
};
const selectionB: PublicDiscoverySelectionInput = {
  courseId: "course-b",
  courseSlug: "course-b",
};

function searchResult(
  status: PublicCourseSearchResult["status"],
  name = "Course A",
): PublicCourseSearchResult {
  return {
    contractVersion: PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
    status,
    results:
      status === "EMPTY"
        ? []
        : [
            {
              id: "course-a",
              groupName: "Group",
              code: "A",
              slug: "course-a",
              name,
              shortName: name,
              description: "Description",
              thumbnailUrl: null,
              totalLevels: 1,
              difficulty: "beginner",
            },
          ],
    page: { limit: 8, hasNext: false, nextCursor: null },
  };
}

function outlineResult(
  selection: PublicDiscoverySelectionInput,
  subjects: readonly PublicCourseOutlineSubject[] = [
    {
      id: `${selection.courseId}-subject`,
      courseId: selection.courseId,
      code: "S1",
      name: "Subject",
      description: null,
      displayOrder: 1,
      isSample: true,
      topics: [],
    },
  ],
) {
  return {
    status: "OK" as const,
    course: {
      id: selection.courseId,
      slug: selection.courseSlug,
      code: selection.courseId.toUpperCase(),
      name: selection.courseId,
      shortName: selection.courseId,
      groupName: "Group",
      description: null,
      difficulty: "beginner",
    },
    subjects,
  };
}

function transition(
  events: readonly PublicDiscoveryViewStateEvent[],
  initial = createInitialPublicDiscoveryViewState(),
): PublicDiscoveryViewState {
  return events.reduce(reducePublicDiscoveryViewState, initial);
}

function startSearch(requestId: string): PublicDiscoveryViewStateEvent {
  return { type: "SEARCH_REQUEST_STARTED", requestId };
}

function startOutline(requestId: string): PublicDiscoveryViewStateEvent {
  return { type: "OUTLINE_REQUEST_STARTED", requestId };
}

test("initial state, conditions, pending, and successful search are distinct", () => {
  const conditions = { query: "  security  ", path: "professional" as const };
  const conditionsBefore = structuredClone(conditions);
  const initial = createInitialPublicDiscoveryViewState();

  const state = transition([
    { type: "SEARCH_CONDITIONS_CHANGED", conditions },
    startSearch("search-1"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-1",
      result: searchResult("OK"),
    },
  ]);

  assert.deepEqual(conditions, conditionsBefore);
  assert.equal(initial.search.status, "IDLE");
  assert.equal(state.search.status, "SUCCESS");
  assert.equal(state.search.activeRequestId, null);
  assert.deepEqual(state.search.conditions, conditions);
  assert.equal(state.search.result?.status, "OK");
  assert.equal(state.search.stale, false);
  assert.equal(state.selection, null);
});

test("EMPTY and adapter/provider errors remain different outcomes", () => {
  const empty = transition([
    startSearch("search-empty"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-empty",
      result: searchResult("EMPTY"),
    },
  ]);
  assert.equal(empty.search.status, "EMPTY");
  assert.equal(empty.search.result?.status, "EMPTY");
  assert.equal(empty.search.error, null);

  const adapterError = transition([
    startSearch("search-input-error"),
    {
      type: "SEARCH_REQUEST_FAILED",
      requestId: "search-input-error",
      failure: { kind: "ADAPTER_ERROR", code: "INVALID_INPUT" },
    },
  ]);
  assert.equal(adapterError.search.status, "ERROR");
  assert.deepEqual(adapterError.search.error, {
    kind: "ADAPTER_ERROR",
    code: "INVALID_INPUT",
  });

  const providerError = transition([
    startSearch("search-provider-error"),
    {
      type: "SEARCH_REQUEST_FAILED",
      requestId: "search-provider-error",
      failure: { kind: "PROVIDER_ERROR" },
    },
  ]);
  assert.deepEqual(providerError.search.error, { kind: "PROVIDER_ERROR" });

  const unknownResult = transition([
    startSearch("search-unknown"),
    {
      type: "SEARCH_REQUEST_FAILED",
      requestId: "search-unknown",
      failure: { kind: "UNKNOWN_RESULT" },
    },
  ]);
  assert.deepEqual(unknownResult.search.error, { kind: "UNKNOWN_RESULT" });
});

test("a newer search response wins and a late success cannot replace it", () => {
  const state = transition([
    startSearch("search-a"),
    startSearch("search-b"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-b",
      result: searchResult("OK", "Course B response"),
    },
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-a",
      result: searchResult("OK", "Late Course A response"),
    },
  ]);

  assert.equal(state.search.status, "SUCCESS");
  assert.equal(state.search.result?.results[0]?.name, "Course B response");
  assert.equal(state.search.activeRequestId, null);
});

test("a late search error cannot overwrite a newer successful result", () => {
  const state = transition([
    startSearch("search-a-error"),
    startSearch("search-b-success"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-b-success",
      result: searchResult("OK", "Current result"),
    },
    {
      type: "SEARCH_REQUEST_FAILED",
      requestId: "search-a-error",
      failure: { kind: "PROVIDER_ERROR" },
    },
  ]);

  assert.equal(state.search.status, "SUCCESS");
  assert.equal(state.search.result?.results[0]?.name, "Current result");
  assert.equal(state.search.error, null);
});

test("changing conditions invalidates the active request and clears old results", () => {
  const pending = transition([
    startSearch("old-search"),
    {
      type: "SEARCH_CONDITIONS_CHANGED",
      conditions: { query: "new", path: "certification" },
    },
  ]);
  const oldResponse = reducePublicDiscoveryViewState(pending, {
    type: "SEARCH_RESULT_RECEIVED",
    requestId: "old-search",
    result: searchResult("OK", "Old response"),
  });

  assert.equal(pending.search.status, "IDLE");
  assert.equal(pending.search.activeRequestId, null);
  assert.equal(pending.search.result, null);
  assert.deepEqual(pending.search.conditions, {
    query: "new",
    path: "certification",
  });
  assert.strictEqual(oldResponse, pending);
});

test("explicit refresh retains a stale result until its response completes", () => {
  const refreshed = transition([
    startSearch("initial-search"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "initial-search",
      result: searchResult("OK", "Previous result"),
    },
    { type: "SEARCH_REFRESH_REQUESTED", requestId: "refresh-1" },
  ]);

  assert.equal(refreshed.search.status, "PENDING");
  assert.equal(refreshed.search.activeRequestId, "refresh-1");
  assert.equal(refreshed.search.stale, true);
  assert.equal(refreshed.search.result?.results[0]?.name, "Previous result");
  assert.equal(refreshed.selection, null);
});

test("selection B invalidates A outline responses", () => {
  const selectedB = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-a"),
    { type: "COURSE_SELECTED", selection: selectionB },
    startOutline("outline-b"),
  ]);
  const withB = reducePublicDiscoveryViewState(selectedB, {
    type: "OUTLINE_RESULT_RECEIVED",
    requestId: "outline-b",
    selection: selectionB,
    result: outlineResult(selectionB),
  });
  const lateA = reducePublicDiscoveryViewState(withB, {
    type: "OUTLINE_RESULT_RECEIVED",
    requestId: "outline-a",
    selection: selectionA,
    result: outlineResult(selectionA),
  });
  const lateAError = reducePublicDiscoveryViewState(withB, {
    type: "OUTLINE_REQUEST_FAILED",
    requestId: "outline-a",
    selection: selectionA,
    failure: { kind: "PROVIDER_ERROR" },
  });

  assert.deepEqual(withB.selection, selectionB);
  assert.equal(withB.outline.status, "SUCCESS");
  assert.equal(withB.outline.result?.course.id, "course-b");
  assert.strictEqual(lateA, withB);
  assert.strictEqual(lateAError, withB);
});

test("deselecting or changing search conditions invalidates outline responses", () => {
  const selected = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-a"),
  ]);
  const deselected = reducePublicDiscoveryViewState(selected, {
    type: "COURSE_DESELECTED",
  });
  const lateAfterDeselect = reducePublicDiscoveryViewState(deselected, {
    type: "OUTLINE_RESULT_RECEIVED",
    requestId: "outline-a",
    selection: selectionA,
    result: outlineResult(selectionA),
  });
  assert.equal(deselected.selection, null);
  assert.equal(deselected.outline.status, "IDLE");
  assert.strictEqual(lateAfterDeselect, deselected);

  const changed = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-after-search-change"),
    {
      type: "SEARCH_CONDITIONS_CHANGED",
      conditions: { query: "changed", path: "all" },
    },
  ]);
  const lateAfterSearchChange = reducePublicDiscoveryViewState(changed, {
    type: "OUTLINE_RESULT_RECEIVED",
    requestId: "outline-after-search-change",
    selection: selectionA,
    result: outlineResult(selectionA),
  });
  assert.equal(changed.selection, null);
  assert.strictEqual(lateAfterSearchChange, changed);
});

test("outline errors and an empty outline preserve their product meanings", () => {
  const notFound = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-not-found"),
    {
      type: "OUTLINE_RESULT_RECEIVED",
      requestId: "outline-not-found",
      selection: selectionA,
      result: { status: "NOT_FOUND" },
    },
  ]);
  assert.equal(notFound.outline.status, "ERROR");
  assert.deepEqual(notFound.outline.error, { status: "NOT_FOUND" });

  const identityMismatch = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-mismatch"),
    {
      type: "OUTLINE_RESULT_RECEIVED",
      requestId: "outline-mismatch",
      selection: selectionA,
      result: outlineResult(selectionB),
    },
  ]);
  assert.deepEqual(identityMismatch.outline.error, {
    status: "SELECTION_ERROR",
    code: "IDENTITY_MISMATCH",
  });
  assert.equal(identityMismatch.outline.result, null);

  const emptyOutline = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-empty"),
    {
      type: "OUTLINE_RESULT_RECEIVED",
      requestId: "outline-empty",
      selection: selectionA,
      result: outlineResult(selectionA, []),
    },
  ]);
  assert.equal(emptyOutline.outline.status, "SUCCESS");
  assert.deepEqual(emptyOutline.outline.result?.subjects, []);

  const unavailable = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-limit"),
    {
      type: "OUTLINE_RESULT_RECEIVED",
      requestId: "outline-limit",
      selection: selectionA,
      result: { status: "UNAVAILABLE", reason: "OUTLINE_LIMIT_EXCEEDED" },
    },
  ]);
  assert.deepEqual(unavailable.outline.error, {
    status: "UNAVAILABLE",
    reason: "OUTLINE_LIMIT_EXCEEDED",
  });
});

test("outline provider/projection failures are caller classifications, not retries", () => {
  const provider = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-provider"),
    {
      type: "OUTLINE_REQUEST_FAILED",
      requestId: "outline-provider",
      selection: selectionA,
      failure: { kind: "PROVIDER_ERROR" },
    },
  ]);
  assert.deepEqual(provider.outline.error, { kind: "PROVIDER_ERROR" });
  assert.equal(provider.outline.activeRequestId, null);

  const projection = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-projection"),
    {
      type: "OUTLINE_RESULT_RECEIVED",
      requestId: "outline-projection",
      selection: selectionA,
      result: { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" },
    },
  ]);
  assert.deepEqual(projection.outline.error, {
    status: "UNAVAILABLE",
    reason: "INVALID_PUBLIC_PROJECTION",
  });

  const unknownResult = transition([
    { type: "COURSE_SELECTED", selection: selectionA },
    startOutline("outline-unknown"),
    {
      type: "OUTLINE_REQUEST_FAILED",
      requestId: "outline-unknown",
      selection: selectionA,
      failure: { kind: "UNKNOWN_RESULT" },
    },
  ]);
  assert.deepEqual(unknownResult.outline.error, { kind: "UNKNOWN_RESULT" });
});

test("duplicate completion events are ignored after a request completes", () => {
  const completed = transition([
    startSearch("search-once"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "search-once",
      result: searchResult("OK", "First"),
    },
  ]);
  const duplicateSuccess = reducePublicDiscoveryViewState(completed, {
    type: "SEARCH_RESULT_RECEIVED",
    requestId: "search-once",
    result: searchResult("OK", "Duplicate"),
  });
  const duplicateError = reducePublicDiscoveryViewState(completed, {
    type: "SEARCH_REQUEST_FAILED",
    requestId: "search-once",
    failure: { kind: "PROVIDER_ERROR" },
  });

  assert.strictEqual(duplicateSuccess, completed);
  assert.strictEqual(duplicateError, completed);
  assert.equal(completed.search.result?.results[0]?.name, "First");
});

test("state and event inputs are not mutated and output is deterministic", () => {
  const conditions = { query: "query", path: "all" as const };
  const event: PublicDiscoveryViewStateEvent = {
    type: "SEARCH_CONDITIONS_CHANGED",
    conditions,
  };
  const eventBefore = structuredClone(event);
  const initial = createInitialPublicDiscoveryViewState();
  const first = reducePublicDiscoveryViewState(initial, event);
  const second = reducePublicDiscoveryViewState(
    createInitialPublicDiscoveryViewState(),
    event,
  );

  assert.deepEqual(event, eventBefore);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first, initial);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.search), true);
  assert.equal(first.selection, null);
});

test("malformed runtime events are no-ops and do not echo raw errors", () => {
  const initial = createInitialPublicDiscoveryViewState();
  const malformedEvents: readonly unknown[] = [
    { type: "SEARCH_REQUEST_STARTED", requestId: "   " },
    { type: "SEARCH_CONDITIONS_CHANGED", conditions: { query: 1, path: "all" } },
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "missing-request",
      result: { status: "OK", message: "raw internal error" },
    },
    { type: "COURSE_SELECTED", selection: { courseId: "a", courseSlug: " a " } },
    { type: "OUTLINE_REQUEST_STARTED", requestId: "outline-without-selection" },
  ];

  for (const malformedEvent of malformedEvents) {
    const next = reducePublicDiscoveryViewState(
      initial,
      malformedEvent as PublicDiscoveryViewStateEvent,
    );
    assert.strictEqual(next, initial);
    assert.equal(JSON.stringify(next).includes("raw internal error"), false);
  }
});

test("caller must use a fresh request ID; the reducer has no request history", () => {
  const completed = transition([
    startSearch("reused-id"),
    {
      type: "SEARCH_RESULT_RECEIVED",
      requestId: "reused-id",
      result: searchResult("OK", "First request"),
    },
  ]);
  const reused = transition(
    [
      startSearch("reused-id"),
      {
        type: "SEARCH_RESULT_RECEIVED",
        requestId: "reused-id",
        result: searchResult("OK", "Reused request"),
      },
    ],
    completed,
  );

  assert.equal(reused.search.result?.results[0]?.name, "Reused request");
});
