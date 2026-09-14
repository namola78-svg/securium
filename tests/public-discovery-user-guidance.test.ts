import assert from "node:assert/strict";
import test from "node:test";

import {
  PublicCourseSearchError,
  PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
} from "../lib/services/public-course-search-adapter.ts";
import { formatPublicDiscoveryUserGuidance } from "../lib/services/public-discovery-user-guidance.ts";

const searchSummary = {
  id: "course-1",
  groupName: "Synthetic group",
  code: "SYN-1",
  slug: "synthetic-course",
  name: "Synthetic course title",
  shortName: "Synthetic course",
  description: "Synthetic description",
  thumbnailUrl: null,
  totalLevels: 3,
  difficulty: "beginner",
} as const;

const searchResult = {
  contractVersion: PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  status: "OK",
  results: [searchSummary],
  page: { limit: 8, hasNext: false, nextCursor: null },
} as const;

const outlineCourse = {
  id: "course-1",
  slug: "synthetic-course",
  code: "SYN-1",
  name: "Synthetic course title",
  shortName: "Synthetic course",
  groupName: "Synthetic group",
  description: "Synthetic description",
  difficulty: "beginner",
} as const;

const outlineSubject = {
  id: "subject-1",
  courseId: "course-1",
  code: "SUB-1",
  name: "Synthetic subject",
  description: null,
  displayOrder: 1,
  isSample: false,
  topics: [],
} as const;

const successfulOutline = {
  status: "OK",
  course: outlineCourse,
  subjects: [outlineSubject],
} as const;

test("empty search and provider failure have distinct user guidance", () => {
  assert.deepEqual(
    formatPublicDiscoveryUserGuidance({
      source: "SEARCH_RESULT",
      result: {
        ...searchResult,
        status: "EMPTY",
        results: [],
      },
    }),
    {
      category: "SEARCH_EMPTY",
      title: "검색 결과가 없어요",
      message: "조건에 맞는 과정을 찾지 못했어요.",
      actions: ["EDIT_SEARCH"],
    },
  );
  const provider = formatPublicDiscoveryUserGuidance({
    source: "SEARCH_ERROR",
    error: new Error("SECRET_PROVIDER_DETAILS"),
  });
  assert.deepEqual(provider, {
    category: "PROVIDER_ERROR",
    title: "과정 정보를 불러오지 못했어요",
    message: "과정 정보를 불러오지 못했어요.",
    actions: ["BACK_TO_RESULTS", "REFRESH_RESULTS"],
  });
  assert.notEqual(provider.category, "SEARCH_EMPTY");
  assert.equal(JSON.stringify(provider).includes("SECRET_PROVIDER_DETAILS"), false);
});

test("normal search and successful outline use bounded static wording", () => {
  assert.deepEqual(
    formatPublicDiscoveryUserGuidance({ source: "SEARCH_RESULT", result: searchResult }),
    {
      category: "SEARCH_RESULTS",
      title: "검색 결과를 확인해 주세요",
      message: "검색 결과를 확인하고 원하는 과정을 선택해 주세요.",
      actions: [],
    },
  );
  assert.deepEqual(
    formatPublicDiscoveryUserGuidance({
      source: "SELECTION_RESULT",
      result: successfulOutline,
    }),
    {
      category: "OUTLINE_READY",
      title: "과정 개요를 확인했어요",
      message: "선택한 과정의 개요를 확인해 주세요.",
      actions: [],
    },
  );
});

test("empty outline remains a successful but non-availability claim", () => {
  const guidance = formatPublicDiscoveryUserGuidance({
    source: "SELECTION_RESULT",
    result: { ...successfulOutline, subjects: [] },
  });
  assert.deepEqual(guidance, {
    category: "OUTLINE_EMPTY",
    title: "과정 개요가 비어 있어요",
    message: "선택한 과정의 개요가 비어 있어요.",
    actions: ["BACK_TO_RESULTS"],
  });
  assert.equal(/실패|학습 불가|수강 가능/.test(guidance.message), false);
});

test("NOT_FOUND does not guess deleted or unpublished causes", () => {
  const guidance = formatPublicDiscoveryUserGuidance({
    source: "SELECTION_RESULT",
    result: { status: "NOT_FOUND" },
  });
  assert.deepEqual(guidance, {
    category: "COURSE_UNAVAILABLE",
    title: "과정을 현재 확인할 수 없어요",
    message: "선택한 과정을 현재 확인할 수 없어요.",
    actions: ["BACK_TO_RESULTS", "REFRESH_RESULTS"],
  });
  assert.equal(/삭제|비공개|원인/.test(JSON.stringify(guidance)), false);
});

test("identity mismatch is redacted at the guidance boundary", () => {
  const guidance = formatPublicDiscoveryUserGuidance({
    source: "SELECTION_RESULT",
    result: { status: "SELECTION_ERROR", code: "IDENTITY_MISMATCH" },
  });
  assert.deepEqual(guidance, {
    category: "IDENTITY_MISMATCH",
    title: "선택한 과정 정보를 다시 확인해 주세요",
    message: "선택한 과정 정보를 다시 확인해 주세요.",
    actions: ["BACK_TO_RESULTS"],
  });
  const serialized = JSON.stringify(guidance);
  for (const hidden of ["course-2", "other-slug", "다른 과정 제목", "SENTINEL"]) {
    assert.equal(serialized.includes(hidden), false);
  }
});

test("input, provider, projection, and outline-limit states remain distinct", () => {
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SELECTION_RESULT",
      result: { status: "SELECTION_ERROR", code: "INVALID_INPUT" },
    }).category,
    "INPUT_ERROR",
  );
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SEARCH_ERROR",
      error: new PublicCourseSearchError("INVALID_INPUT", "SECRET_INPUT"),
    }).category,
    "INPUT_ERROR",
  );
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SEARCH_ERROR",
      error: new PublicCourseSearchError("INVALID_SOURCE", "SECRET_SOURCE"),
    }).category,
    "PROJECTION_ERROR",
  );
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SELECTION_RESULT",
      result: { status: "UNAVAILABLE", reason: "PUBLIC_REPOSITORY_ERROR" },
    }).category,
    "PROVIDER_ERROR",
  );
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SELECTION_RESULT",
      result: { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" },
    }).category,
    "PROJECTION_ERROR",
  );
  assert.equal(
    formatPublicDiscoveryUserGuidance({
      source: "SELECTION_RESULT",
      result: { status: "UNAVAILABLE", reason: "OUTLINE_LIMIT_EXCEEDED" },
    }).category,
    "OUTLINE_LIMIT_EXCEEDED",
  );
});

test("malformed, null, primitive, array, and unknown results never become success", () => {
  const malformedResults: unknown[] = [
    null,
    [],
    "OK",
    7,
    { status: "UNKNOWN" },
    { status: "OK", results: [], page: {} },
    { status: "UNAVAILABLE", reason: "SECRET_REASON" },
  ];
  for (const result of malformedResults) {
    const guidance = formatPublicDiscoveryUserGuidance({
      source: "SEARCH_RESULT",
      result,
    });
    assert.equal(guidance.category, "UNKNOWN_RESULT");
    assert.notEqual(guidance.category, "SEARCH_RESULTS");
    assert.notEqual(guidance.category, "OUTLINE_READY");
  }
  assert.equal(formatPublicDiscoveryUserGuidance(null).category, "UNKNOWN_RESULT");
  assert.equal(formatPublicDiscoveryUserGuidance([]).category, "UNKNOWN_RESULT");
  assert.equal(formatPublicDiscoveryUserGuidance("unknown").category, "UNKNOWN_RESULT");
});

test("output is allowlisted and does not reflect query, title, ID, slug, URL, or errors", () => {
  const sentinel = "SECRET_QUERY_TITLE_ID_SLUG_URL_ERROR";
  const input = {
    source: "SEARCH_RESULT" as const,
    result: {
      ...searchResult,
      results: [{
        ...searchSummary,
        id: `${sentinel}-id`,
        slug: `${sentinel}-slug`,
        name: sentinel,
        thumbnailUrl: `https://${sentinel}.invalid`,
      }],
    },
  };
  const before = JSON.stringify(input);
  const guidance = formatPublicDiscoveryUserGuidance(input);
  assert.deepEqual(Object.keys(guidance), ["category", "title", "message", "actions"]);
  assert.deepEqual(guidance.actions, []);
  assert.equal(JSON.stringify(guidance).includes(sentinel), false);
  assert.equal(JSON.stringify(input), before);

  const queryInUnsupportedEnvelope = formatPublicDiscoveryUserGuidance({
    ...input,
    query: sentinel,
  });
  assert.equal(queryInUnsupportedEnvelope.category, "UNKNOWN_RESULT");
  assert.equal(JSON.stringify(queryInUnsupportedEnvelope).includes(sentinel), false);
});

test("repeated calls are deterministic and have no execution side effects", () => {
  const request = { source: "SELECTION_RESULT" as const, result: successfulOutline };
  const before = JSON.stringify(request);
  const first = formatPublicDiscoveryUserGuidance(request);
  const second = formatPublicDiscoveryUserGuidance(request);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(request), before);
  assert.deepEqual(
    first.actions.filter((action) =>
      ["EDIT_SEARCH", "BACK_TO_RESULTS", "REFRESH_RESULTS"].includes(action),
    ),
    first.actions,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.actions), true);
});
