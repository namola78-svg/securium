import assert from "node:assert/strict";
import test from "node:test";

import { createPublicCourseOutlineAdapter } from "../lib/services/public-course-outline-adapter.ts";
import {
  createPublicCourseSearchAdapter,
  PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  type PublicCourseSearchResult,
} from "../lib/services/public-course-search-adapter.ts";
import {
  composePublicDiscoveryPresentation,
  type PublicDiscoveryPresentation,
} from "../lib/services/public-discovery-presentation.ts";
import { createPublicDiscoverySelectionService } from "../lib/services/public-discovery-selection.ts";
import {
  formatPublicSourceDisclosure,
  PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
} from "../lib/services/public-source-disclosure.ts";
import {
  SYNTHETIC_COURSE_ID,
  SYNTHETIC_COURSE_SLUG,
  SYNTHETIC_SEARCH_DESCRIPTION,
  SyntheticPublicDiscoveryRepository,
} from "../verification/public-discovery-offline-evaluation/fixtures.ts";

const searchSummary = {
  id: "course-a",
  groupName: "Public security group",
  code: "PUB-A",
  slug: "public-course-a",
  name: "Public course A",
  shortName: "Course A",
  description: "A public course description.",
  thumbnailUrl: null,
  totalLevels: 3,
  difficulty: "FOUNDATION",
  updatedAt: "2026-09-12T00:00:00.000Z",
  subjectCount: 2,
  topicCount: 3,
} as const;

const searchResult: PublicCourseSearchResult = {
  contractVersion: PUBLIC_COURSE_SEARCH_CONTRACT_VERSION,
  status: "OK",
  results: [searchSummary],
  page: { limit: 8, hasNext: false, nextCursor: null },
};

const emptySearchResult: PublicCourseSearchResult = {
  ...searchResult,
  status: "EMPTY",
  results: [],
};

const outlineTopic = {
  id: "topic-a",
  subjectId: "subject-a",
  code: "TOP-A",
  name: "Public topic A",
  description: "Topic description",
  displayOrder: 1,
  isSample: false,
} as const;

const outlineSubject = {
  id: "subject-a",
  courseId: "course-a",
  code: "SUB-A",
  name: "Public subject A",
  description: "Subject description",
  displayOrder: 1,
  isSample: false,
  topics: [outlineTopic],
} as const;

const successfulOutline = {
  status: "OK",
  course: {
    id: "course-a",
    slug: "public-course-a",
    code: "PUB-A",
    name: "Public course A",
    shortName: "Course A",
    groupName: "Public security group",
    description: "A public course description.",
    difficulty: "FOUNDATION",
  },
  subjects: [outlineSubject],
} as const;

const fullSourceProjection = {
  projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
  officialSource: {
    institutionName: "National Standards Body",
    documentTitle: "Public Security Standard",
    sourceUrl: "https://standards.example/public-security-standard",
    editionOrVersion: "2026 edition",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2028-12-31",
    sourceCheckedAt: "2026-09-12",
    reviewStatus: {
      displayLabel: "Securium 확인 상태가 제공됨",
      scope: "공개 확인 범위",
    },
    reviewedAt: "2026-09-12",
    reviewerDisplayRole: "공개 검토 책임 역할",
  },
  securiumExplanation: {
    scope: "Securium의 독립 설명이며 공식 원문을 대체하지 않음",
  },
};

function assertEmptyDisclosure(
  presentation: PublicDiscoveryPresentation,
): void {
  assert.deepEqual(presentation.disclosure, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
}

function assertSelectionFailure(
  result: unknown,
  category: string,
): PublicDiscoveryPresentation {
  const presentation = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: result as never,
  });

  assert.equal(presentation.kind, "SELECTION_RESULT");
  assert.equal(presentation.search, null);
  assert.equal(presentation.outline, null);
  assert.equal(presentation.disclosure, null);
  assert.equal(presentation.guidance.category, category);
  return presentation;
}

test("normal search preserves the public DTO and adds bounded search guidance", () => {
  const presentation = composePublicDiscoveryPresentation({
    source: "SEARCH_RESULT",
    result: searchResult,
  });

  assert.deepEqual(presentation, {
    kind: "SEARCH_RESULT",
    search: searchResult,
    outline: null,
    guidance: {
      category: "SEARCH_RESULTS",
      title: "검색 결과를 확인해 주세요",
      message: "검색 결과를 확인하고 원하는 과정을 선택해 주세요.",
      actions: [],
    },
    disclosure: null,
  });
  assert.equal(presentation.search?.results[0]?.id, "course-a");
  assert.equal(presentation.search?.results[0]?.slug, "public-course-a");
  assert.equal(presentation.search?.results[0]?.name, "Public course A");
});

test("EMPTY search is distinct from provider failure and has no selection disclosure", () => {
  const empty = composePublicDiscoveryPresentation({
    source: "SEARCH_RESULT",
    result: emptySearchResult,
  });
  assert.equal(empty.kind, "SEARCH_RESULT");
  assert.equal(empty.search?.status, "EMPTY");
  assert.deepEqual(empty.search?.results, []);
  assert.equal(empty.guidance.category, "SEARCH_EMPTY");
  assert.deepEqual(empty.guidance.actions, ["EDIT_SEARCH"]);
  assert.equal(empty.disclosure, null);

  const provider = composePublicDiscoveryPresentation({
    source: "SEARCH_ERROR",
    error: new Error("PRIVATE_SEARCH_PROVIDER_SENTINEL"),
  });
  assert.equal(provider.kind, "SEARCH_ERROR");
  assert.equal(provider.search, null);
  assert.equal(provider.guidance.category, "PROVIDER_ERROR");
  assert.deepEqual(provider.guidance.actions, ["BACK_TO_RESULTS", "REFRESH_RESULTS"]);
  assert.doesNotMatch(JSON.stringify(provider), /PRIVATE_SEARCH_PROVIDER_SENTINEL/);
});

test("successful selection composes the public outline with the existing formatters", () => {
  const presentation = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: successfulOutline,
    sourceProjection: fullSourceProjection,
  });

  assert.equal(presentation.kind, "SELECTION_RESULT");
  assert.deepEqual(presentation.outline, successfulOutline);
  assert.equal(presentation.guidance.category, "OUTLINE_READY");
  assert.deepEqual(presentation.disclosure, {
    officialReference: {
      kind: "OFFICIAL_REFERENCE",
      label: "공식 참고 자료",
      institutionName: "National Standards Body",
      documentTitle: "Public Security Standard",
      sourceUrl: "https://standards.example/public-security-standard",
      editionOrVersion: "2026 edition",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2028-12-31",
      sourceCheckedAt: "2026-09-12",
      review: {
        statusLabel: "Securium 확인 상태가 제공됨",
        scope: "공개 확인 범위",
        reviewedAt: "2026-09-12",
        reviewerDisplayRole: "공개 검토 책임 역할",
      },
    },
    independentExplanation: {
      kind: "SECURIUM_INDEPENDENT_EXPLANATION",
      label: "Securium 독립 설명",
      scope: "Securium의 독립 설명이며 공식 원문을 대체하지 않음",
    },
    notice: null,
  });
});

test("actual search, outline, and selection outputs compose into the public presentation", async () => {
  const repository = new SyntheticPublicDiscoveryRepository();
  const searchAdapter = createPublicCourseSearchAdapter(repository);
  const selectionService = createPublicDiscoverySelectionService(
    createPublicCourseOutlineAdapter(repository),
  );
  const search = await searchAdapter.searchPublicCourses({ query: "synthetic", limit: 8 });
  assert.equal(search.status, "OK");
  const selected = search.results[0];
  assert.ok(selected);
  assert.equal(selected.id, SYNTHETIC_COURSE_ID);
  assert.equal(selected.slug, SYNTHETIC_COURSE_SLUG);

  const searchPresentation = composePublicDiscoveryPresentation({
    source: "SEARCH_RESULT",
    result: search,
  });
  assert.equal(searchPresentation.kind, "SEARCH_RESULT");
  assert.deepEqual(searchPresentation.search, search);
  assert.equal(searchPresentation.outline, null);
  assert.equal(searchPresentation.guidance.category, "SEARCH_RESULTS");
  assert.equal(searchPresentation.disclosure, null);

  const selection = await selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  assert.equal(selection.status, "OK");
  const presentation = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: selection,
    sourceProjection: fullSourceProjection,
  });
  assert.equal(presentation.kind, "SELECTION_RESULT");
  assert.equal(presentation.search, null);
  assert.deepEqual(presentation.outline, selection);
  assert.equal(presentation.outline?.course.id, selected.id);
  assert.equal(presentation.outline?.course.slug, selected.slug);
  assert.equal(presentation.outline?.course.description, SYNTHETIC_SEARCH_DESCRIPTION);
  assert.equal(presentation.guidance.category, "OUTLINE_READY");
  assert.deepEqual(presentation.guidance.actions, []);
  assert.deepEqual(presentation.disclosure, formatPublicSourceDisclosure(fullSourceProjection));
  assert.doesNotMatch(
    JSON.stringify({ searchPresentation, presentation }),
    /SYNTHETIC_(?:INTERNAL|PERSONAL)_|"(?:passingScore|questionCount|active|published|deletedAt)"/,
  );
});

test("an empty outline remains successful and keeps the disclosure contract", () => {
  let projectionReads = 0;
  const projection = {};
  Object.defineProperty(projection, "projectionKind", {
    get() {
      projectionReads += 1;
      return PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND;
    },
  });

  const presentation = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: { ...successfulOutline, subjects: [] },
    sourceProjection: projection,
  });

  assert.equal(presentation.kind, "SELECTION_RESULT");
  assert.equal(presentation.outline?.status, "OK");
  assert.deepEqual(presentation.outline?.subjects, []);
  assert.equal(presentation.guidance.category, "OUTLINE_EMPTY");
  assert.equal(projectionReads, 1);
  assertEmptyDisclosure(presentation);
});

test("NOT_FOUND, IDENTITY_MISMATCH, provider, projection, and limit failures remove display output", () => {
  const cases = [
    [{ status: "NOT_FOUND" }, "COURSE_UNAVAILABLE"],
    [{ status: "SELECTION_ERROR", code: "IDENTITY_MISMATCH" }, "IDENTITY_MISMATCH"],
    [{ status: "SELECTION_ERROR", code: "INVALID_INPUT" }, "INPUT_ERROR"],
    [{ status: "INVALID_INPUT" }, "INPUT_ERROR"],
    [{ status: "UNAVAILABLE", reason: "PUBLIC_REPOSITORY_ERROR" }, "PROVIDER_ERROR"],
    [{ status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" }, "PROJECTION_ERROR"],
    [{ status: "UNAVAILABLE", reason: "PUBLIC_RELATION_MISMATCH" }, "PROJECTION_ERROR"],
    [{ status: "UNAVAILABLE", reason: "OUTLINE_LIMIT_EXCEEDED" }, "OUTLINE_LIMIT_EXCEEDED"],
  ] as const;

  for (const [result, category] of cases) {
    const presentation = assertSelectionFailure(result, category);
    assert.doesNotMatch(
      JSON.stringify(presentation),
      /course-a|public-course-a|Public course A|subject-a|topic-a|source/i,
    );
  }
});

test("selection failure does not call the disclosure formatter even when projection is supplied", () => {
  let projectionReads = 0;
  const projection = {};
  Object.defineProperty(projection, "projectionKind", {
    get() {
      projectionReads += 1;
      return PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND;
    },
  });

  const presentation = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: { status: "SELECTION_ERROR", code: "IDENTITY_MISMATCH" },
    sourceProjection: projection,
  });

  assert.equal(presentation.outline, null);
  assert.equal(presentation.disclosure, null);
  assert.equal(projectionReads, 0);
});

test("incomplete source disclosure preserves successful outline and guidance", () => {
  const absent = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: successfulOutline,
  });
  assertEmptyDisclosure(absent);

  const partial = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: successfulOutline,
    sourceProjection: {
      projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
      officialSource: {
        institutionName: "Known institution",
        documentTitle: "Known document",
        updatedAt: "2026-09-12T00:00:00.000Z",
        published: true,
        validatorPassed: true,
        sourceHash: "a".repeat(64),
      },
      securiumExplanation: { scope: "Independent explanation" },
    },
  });
  assert.deepEqual(partial.disclosure, {
    officialReference: {
      kind: "OFFICIAL_REFERENCE",
      label: "공식 참고 자료",
      institutionName: "Known institution",
      documentTitle: "Known document",
    },
    independentExplanation: {
      kind: "SECURIUM_INDEPENDENT_EXPLANATION",
      label: "Securium 독립 설명",
      scope: "Independent explanation",
    },
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });

  const malformed = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: successfulOutline,
    sourceProjection: {
      projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
      officialSource: {
        institutionName: 42,
        sourceUrl: "http://private.invalid/source",
        sourceId: "PRIVATE_SOURCE_SENTINEL",
      },
      privateNote: "PRIVATE_NOTE_SENTINEL",
    },
  });
  assertEmptyDisclosure(malformed);
  assert.doesNotMatch(JSON.stringify(malformed), /PRIVATE_SOURCE_SENTINEL|PRIVATE_NOTE_SENTINEL/);

  for (const presentation of [absent, partial, malformed]) {
    assert.equal(presentation.kind, "SELECTION_RESULT");
    assert.equal(presentation.search, null);
    assert.equal(presentation.outline?.status, "OK");
    assert.deepEqual(presentation.outline, successfulOutline);
    assert.equal(presentation.guidance.category, "OUTLINE_READY");
    assert.deepEqual(presentation.guidance.actions, []);
    assert.deepEqual(presentation.guidance, absent.guidance);
  }
});

test("malformed inputs and result envelopes fail closed without promoting success", () => {
  const malformedInputs: unknown[] = [
    null,
    [],
    "SEARCH_RESULT",
    42,
    { source: "UNSUPPORTED", result: searchResult },
    { source: "SEARCH_RESULT" },
    { source: "SEARCH_ERROR" },
    { source: "SEARCH_RESULT", result: { status: "OK", results: [], page: {} } },
    {
      source: "SELECTION_RESULT",
      result: { status: "OK", course: { id: "PRIVATE_ID_SENTINEL" }, subjects: [] },
    },
    {
      source: "SELECTION_RESULT",
      result: {
        status: "SELECTION_ERROR",
        code: "IDENTITY_MISMATCH",
        courseId: "PRIVATE_ID_SENTINEL",
      },
    },
  ];

  for (const input of malformedInputs) {
    const presentation = composePublicDiscoveryPresentation(input);
    assert.equal(presentation.kind, "UNKNOWN");
    assert.equal(presentation.search, null);
    assert.equal(presentation.outline, null);
    assert.equal(presentation.disclosure, null);
    assert.equal(presentation.guidance.category, "UNKNOWN_RESULT");
    assert.doesNotMatch(JSON.stringify(presentation), /PRIVATE_ID_SENTINEL/);
  }

  const privateSummary = {
    ...searchSummary,
    internalNote: "SYNTHETIC_INTERNAL_NOTE",
    personalEvidence: "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
  };
  const privateResult = {
    ...searchResult,
    results: [privateSummary],
  };
  const privatePresentation = composePublicDiscoveryPresentation({
    source: "SEARCH_RESULT",
    result: privateResult,
  });
  assert.equal(privatePresentation.kind, "UNKNOWN");
  assert.doesNotMatch(
    JSON.stringify(privatePresentation),
    /SYNTHETIC_INTERNAL_NOTE|SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL/,
  );
});

test("A success, A failure, B success, and repeated B isolate source disclosure", () => {
  const secondOutline = {
    ...successfulOutline,
    course: {
      ...successfulOutline.course,
      id: "course-b",
      slug: "public-course-b",
      code: "PUB-B",
      name: "Public course B",
      shortName: "Course B",
    },
    subjects: [{
      ...outlineSubject,
      id: "subject-b",
      courseId: "course-b",
      code: "SUB-B",
      name: "Public subject B",
      topics: [{
        ...outlineTopic,
        id: "topic-b",
        subjectId: "subject-b",
        code: "TOP-B",
        name: "Public topic B",
      }],
    }],
  };
  const secondProjection = {
    projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
    officialSource: {
      institutionName: "Course B Standards Body",
      documentTitle: "Course B Standard",
      sourceUrl: "https://standards.example/course-b",
      sourceCheckedAt: "2026-09-13",
    },
    securiumExplanation: { scope: "Course B independent explanation" },
  };
  const projectionsBefore = structuredClone([fullSourceProjection, secondProjection]);
  const first = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: successfulOutline,
    sourceProjection: fullSourceProjection,
  });
  const failure = composePublicDiscoveryPresentation({
    source: "SELECTION_RESULT",
    result: { status: "NOT_FOUND" },
    sourceProjection: fullSourceProjection,
  });
  const secondInput = {
    source: "SELECTION_RESULT" as const,
    result: secondOutline,
    sourceProjection: secondProjection,
  };
  const second = composePublicDiscoveryPresentation(secondInput);
  const repeated = composePublicDiscoveryPresentation(secondInput);

  assert.deepEqual(first.outline, successfulOutline);
  assert.deepEqual(first.disclosure, formatPublicSourceDisclosure(fullSourceProjection));
  assert.equal(failure.outline, null);
  assert.equal(failure.disclosure, null);
  assert.equal(failure.guidance.category, "COURSE_UNAVAILABLE");
  assert.deepEqual(second.outline, secondOutline);
  assert.deepEqual(second.disclosure, formatPublicSourceDisclosure(secondProjection));
  assert.doesNotMatch(
    JSON.stringify(second),
    /course-a|subject-a|topic-a|National Standards Body|Public Security Standard|public-security-standard/,
  );
  assert.deepEqual(repeated, second);
  assert.deepEqual([fullSourceProjection, secondProjection], projectionsBefore);
});

test("equal inputs are deterministic, input objects remain unchanged, and sentinels are not copied", () => {
  const input = {
    source: "SELECTION_RESULT" as const,
    result: successfulOutline,
    sourceProjection: {
      ...fullSourceProjection,
      privateSourceId: "PRIVATE_SOURCE_ID_SENTINEL",
      internalNote: "INTERNAL_NOTE_SENTINEL",
    },
  };
  const before = JSON.stringify(input);

  const first = composePublicDiscoveryPresentation(input);
  const second = composePublicDiscoveryPresentation(input);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
  assert.notStrictEqual(first, input);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(JSON.stringify(first).includes("PRIVATE_SOURCE_ID_SENTINEL"), false);
  assert.equal(JSON.stringify(first).includes("INTERNAL_NOTE_SENTINEL"), false);
  assert.equal(JSON.stringify(first).includes("Public course A"), true);
});
