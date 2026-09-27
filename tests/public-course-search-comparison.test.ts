import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicCourseSearchAdapter,
  PublicCourseSearchError,
  type PublicCourseSearchRepositoryInput,
  type PublicCourseSearchSourceRecord,
} from "../lib/services/public-course-search-adapter.ts";
import {
  courseAudienceLabel,
  courseDescription,
} from "../lib/course-display.ts";
import {
  PUBLIC_COURSE_SEARCH_COMPARISON_VERSION,
  PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
  PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES,
  PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
  buildPublicCourseSearchProjection,
  createPublicCourseSearchIdOrderKey,
  isSupportedPublicCourseSearchId,
  normalizePublicCourseSearchQuery,
  normalizePublicCourseSearchText,
} from "../lib/services/public-course-search-comparison.ts";

function sign(value: number) {
  return value === 0 ? 0 : value < 0 ? -1 : 1;
}

function compareJavaScriptStrings(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareAsciiBytes(left: string, right: string) {
  return sign(Buffer.from(left, "ascii").compare(Buffer.from(right, "ascii")));
}

function sourceCourse(
  id: string,
  overrides: Partial<PublicCourseSearchSourceRecord> = {},
): PublicCourseSearchSourceRecord {
  return {
    id,
    groupName: "Security learning",
    groupActive: true,
    groupDeletedAt: null,
    groupDisplayOrder: 1,
    code: id.toUpperCase(),
    slug: `${id}-slug`,
    name: `Course ${id}`,
    shortName: `Short ${id}`,
    description: `Public description for ${id}`,
    thumbnailUrl: null,
    totalLevels: 3,
    passingScore: 80,
    difficulty: "BEGINNER",
    active: true,
    published: true,
    deletedAt: null,
    displayOrder: 1,
    ...overrides,
  };
}

function adapterFixture(rows: readonly PublicCourseSearchSourceRecord[]) {
  const calls: PublicCourseSearchRepositoryInput[] = [];
  const adapter = createPublicCourseSearchAdapter({
    searchPublicCourses: async (input) => {
      calls.push(input);
      return rows;
    },
  });
  return { adapter, calls };
}

function adapterErrorCode(error: unknown) {
  return error instanceof PublicCourseSearchError ? error.code : undefined;
}

function projectionParts(record: PublicCourseSearchSourceRecord) {
  return {
    name: record.name,
    shortName: record.shortName,
    groupName: record.groupName,
    publicDescription: courseDescription(record.description),
    audienceLabel: courseAudienceLabel(record),
  };
}

test("comparison contract versions and query limit are explicit", () => {
  assert.equal(
    PUBLIC_COURSE_SEARCH_COMPARISON_VERSION,
    "public-course-search.comparison.v2",
  );
  assert.equal(
    PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
    "public-course-search.normalizer.nfkc-trim-ko-lower.v1",
  );
  assert.equal(
    PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
    "public-course-search.id-order.utf16-code-unit-hex.v1",
  );
  assert.equal(PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES, 48);
});

test("normalizes ASCII, Korean, width, compatibility, case, and trim", () => {
  const vectors = [
    { input: "  ABC 한글  ", expected: "abc 한글" },
    { input: "𐀀", expected: "𐀀" },
    { input: "ＦＵＬＬＷＩＤＴＨ", expected: "fullwidth" },
    { input: "Cafe\u0301", expected: "café" },
    { input: "①Compatibility", expected: "1compatibility" },
    { input: "\u00a0  Café \u3000", expected: "café" },
    { input: "Literal 100%_\\\\value", expected: "literal 100%_\\\\value" },
  ] as const;

  for (const vector of vectors) {
    assert.equal(normalizePublicCourseSearchText(vector.input), vector.expected);
  }
});

test("query and stored projection use the same normalization but only query has the byte cap", () => {
  const stored = buildPublicCourseSearchProjection({
    name: "Ｆｕｌｌｗｉｄｔｈ",
    shortName: "Cafe\u0301",
    groupName: "①Compatibility",
    publicDescription: "보안 과정",
    audienceLabel: "ABC",
  });

  assert.equal(
    stored,
    "fullwidth café 1compatibility 보안 과정 abc",
  );
  assert.equal(
    normalizePublicCourseSearchQuery("ＦＵＬＬＷＩＤＴＨ"),
    "fullwidth",
  );
  assert.equal(
    normalizePublicCourseSearchQuery("１ＣＯＭＰＡＴＩＢＩＬＩＴＹ"),
    "1compatibility",
  );
  assert.equal(normalizePublicCourseSearchQuery(undefined), "");
  assert.equal(normalizePublicCourseSearchQuery("a".repeat(48)), "a".repeat(48));
  assert.throws(() => normalizePublicCourseSearchQuery("a".repeat(49)), RangeError);
  assert.equal(
    normalizePublicCourseSearchQuery("Ｆ".repeat(48)),
    "f".repeat(48),
  );
  assert.throws(
    () => normalizePublicCourseSearchQuery("Ｆ".repeat(49)),
    RangeError,
  );
  assert.equal(
    normalizePublicCourseSearchQuery("İ".repeat(16)),
    "i\u0307".repeat(16),
  );
  assert.throws(
    () => normalizePublicCourseSearchQuery("İ".repeat(17)),
    RangeError,
  );

  const longStored = buildPublicCourseSearchProjection({
    name: "가".repeat(100),
    shortName: "short",
    groupName: "group",
    publicDescription: "description",
    audienceLabel: "audience",
  });
  assert.ok(longStored.length > PUBLIC_COURSE_SEARCH_MAX_QUERY_BYTES);
  assert.throws(
    () => normalizePublicCourseSearchQuery("가".repeat(25)),
    RangeError,
  );
});

test("projection uses the fixed field order and an explicit field boundary", () => {
  const projection = buildPublicCourseSearchProjection({
    name: "Alpha",
    shortName: "Beta",
    groupName: "Gamma",
    publicDescription: "Delta",
    audienceLabel: "Epsilon",
    extra: "ignored",
  });

  assert.equal(projection, "alpha beta gamma delta epsilon");
  assert.equal(projection.includes("alphabeta"), false);
  assert.equal(projection.includes("alpha beta"), true);
});

test("fixed projection fields match the existing adapter's candidate search semantics", async () => {
  const cases = [
    {
      id: "inside-field",
      record: sourceCourse("inside-field", {
        name: "Alpha",
        shortName: "Beta",
      }),
      query: "alpha",
      expectedIds: ["inside-field"],
    },
    {
      id: "cross-field",
      record: sourceCourse("cross-field", {
        name: "Alpha",
        shortName: "Beta",
      }),
      query: "alphabeta",
      expectedIds: [],
    },
    {
      id: "empty-middle",
      record: sourceCourse("empty-middle", {
        name: "Alpha",
        shortName: "",
        groupName: "Gamma",
      }),
      query: "alpha gamma",
      expectedIds: [],
    },
    {
      id: "empty-middle-exact-spacing",
      record: sourceCourse("empty-middle-exact-spacing", {
        name: "Alpha",
        shortName: "",
        groupName: "Gamma",
      }),
      query: "alpha  gamma",
      expectedIds: ["empty-middle-exact-spacing"],
    },
    {
      id: "internal-spacing",
      record: sourceCourse("internal-spacing", { name: "Alpha  Beta" }),
      query: "alpha  beta",
      expectedIds: ["internal-spacing"],
    },
    {
      id: "wrong-spacing",
      record: sourceCourse("wrong-spacing", { name: "Alpha  Beta" }),
      query: "alpha beta",
      expectedIds: [],
    },
    {
      id: "outer-spacing",
      record: sourceCourse("outer-spacing", { name: "  Alpha  " }),
      query: "alpha",
      expectedIds: ["outer-spacing"],
    },
    {
      id: "field-order",
      record: sourceCourse("field-order", {
        name: "Alpha",
        shortName: "Beta",
        groupName: "Gamma",
      }),
      query: "alpha beta",
      expectedIds: ["field-order"],
    },
    {
      id: "field-order-reversed",
      record: sourceCourse("field-order-reversed", {
        name: "Beta",
        shortName: "Alpha",
        groupName: "Gamma",
      }),
      query: "alpha beta",
      expectedIds: [],
    },
    {
      id: "literal",
      record: sourceCourse("literal", {
        name: "Literal 100%_\\\\value",
        shortName: "",
      }),
      query: "100%_\\\\value",
      expectedIds: ["literal"],
    },
  ] as const;

  for (const vector of cases) {
    const { adapter } = adapterFixture(
      vector.expectedIds.length === 1 ? [vector.record] : [],
    );
    const result = await adapter.searchPublicCourses({ query: vector.query });
    assert.deepEqual(
      result.results.map((course) => course.id),
      vector.expectedIds,
      vector.id,
    );

    const projection = buildPublicCourseSearchProjection(projectionParts(vector.record));
    assert.equal(
      projection.includes(normalizePublicCourseSearchQuery(vector.query)),
      vector.expectedIds.length === 1,
      `${vector.id}: projection expectation`,
    );
  }
});

test("adapter request and source boundaries stay distinct from projection input", async () => {
  const { adapter, calls } = adapterFixture([sourceCourse("public")]);

  await adapter.searchPublicCourses();
  await adapter.searchPublicCourses({ query: undefined });
  assert.equal(calls[0]!.query, "");
  assert.equal(calls[1]!.query, "");
  await assert.rejects(
    () => adapter.searchPublicCourses({ query: "", extra: true }),
    (error: unknown) => adapterErrorCode(error) === "INVALID_INPUT",
  );

  const missingDescription = { ...sourceCourse("missing-description") } as Record<string, unknown>;
  delete missingDescription.description;
  const missingSourceAdapter = createPublicCourseSearchAdapter({
    searchPublicCourses: async () => [missingDescription as PublicCourseSearchSourceRecord],
  });
  await assert.rejects(
    () => missingSourceAdapter.searchPublicCourses(),
    (error: unknown) => adapterErrorCode(error) === "INVALID_SOURCE",
  );

  assert.throws(
    () =>
      buildPublicCourseSearchProjection({
        name: "name",
        shortName: "short",
        groupName: "group",
        publicDescription: "description",
      }),
    TypeError,
  );
});

test("malformed query is rejected before the adapter reaches its repository", async () => {
  const { adapter, calls } = adapterFixture([]);

  await adapter.searchPublicCourses({ query: "𐀀" });
  assert.equal(calls[0]!.query, "𐀀");

  for (const query of [
    "\ud800",
    "\udc00",
    "valid\ud800id",
    "\udc00\ud800",
  ]) {
    await assert.rejects(
      () => adapter.searchPublicCourses({ query }),
      (error: unknown) => {
        assert.equal(adapterErrorCode(error), "INVALID_INPUT");
        assert.equal(error instanceof Error && error.message.includes(query), false);
        return true;
      },
    );
    assert.throws(() => normalizePublicCourseSearchQuery(query), RangeError);
  }
  assert.equal(calls.length, 1);
});

test("normalization is idempotent and preserves literal pattern characters", () => {
  const values = [
    "ABC 한글",
    "Ｆｕｌｌｗｉｄｔｈ",
    "Cafe\u0301",
    "①Compatibility",
    "Literal 100%_\\\\value",
  ];

  for (const value of values) {
    const normalized = normalizePublicCourseSearchText(value);
    assert.equal(normalizePublicCourseSearchText(normalized), normalized);
  }
  assert.equal(
    normalizePublicCourseSearchText("Literal 100%_\\\\value"),
    "literal 100%_\\\\value",
  );
});

test("normalization rejects non-string and malformed Unicode input", () => {
  assert.throws(() => normalizePublicCourseSearchText(123), TypeError);
  assert.throws(() => normalizePublicCourseSearchText(null), TypeError);
  assert.throws(() => normalizePublicCourseSearchText("\ud800"), RangeError);
  assert.throws(
    () =>
      buildPublicCourseSearchProjection({
        name: "name",
        shortName: "short",
        groupName: "group",
        publicDescription: 42,
        audienceLabel: "audience",
      }),
    TypeError,
  );
});

test("UTF-16 order key has fixed-width representative values", () => {
  const vectors = [
    { id: "A", expectedKey: "0041" },
    { id: "a", expectedKey: "0061" },
    { id: "한", expectedKey: "D55C" },
    { id: "𐀀", expectedKey: "D800DC00" },
    { id: "", expectedKey: "E000" },
    { id: "\u0000", expectedKey: "0000" },
    { id: "same", expectedKey: "00730061006D0065" },
    { id: "same\u0000", expectedKey: "00730061006D00650000" },
  ] as const;

  for (const vector of vectors) {
    assert.equal(createPublicCourseSearchIdOrderKey(vector.id), vector.expectedKey);
  }
});

test("UTF-16 key preserves the explicit adapter order and binary key order", () => {
  const ids = [
    "unicode-order-A",
    "unicode-order-a",
    "unicode-order-한",
    "unicode-order-𐀀",
    "unicode-order-",
  ];
  const expectedIds = [
    "unicode-order-A",
    "unicode-order-a",
    "unicode-order-한",
    "unicode-order-𐀀",
    "unicode-order-",
  ];
  const expectedKeys = [
    "0075006E00690063006F00640065002D006F0072006400650072002D0041",
    "0075006E00690063006F00640065002D006F0072006400650072002D0061",
    "0075006E00690063006F00640065002D006F0072006400650072002DD55C",
    "0075006E00690063006F00640065002D006F0072006400650072002DD800DC00",
    "0075006E00690063006F00640065002D006F0072006400650072002DE000",
  ];

  assert.deepEqual(
    ids.map(createPublicCourseSearchIdOrderKey),
    expectedKeys,
  );
  assert.deepEqual(
    [...ids].sort(compareJavaScriptStrings),
    expectedIds,
  );
  assert.deepEqual(
    [...ids].sort((left, right) =>
      compareAsciiBytes(
        createPublicCourseSearchIdOrderKey(left),
        createPublicCourseSearchIdOrderKey(right),
      ),
    ),
    expectedIds,
  );

  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < ids.length; rightIndex += 1) {
      const expected = compareJavaScriptStrings(ids[leftIndex], ids[rightIndex]);
      const actual = compareAsciiBytes(
        createPublicCourseSearchIdOrderKey(ids[leftIndex]),
        createPublicCourseSearchIdOrderKey(ids[rightIndex]),
      );
      assert.equal(actual, expected);
    }
  }
});

test("key keeps prefix, length, BMP, non-BMP, and boundary ordering", () => {
  const ids = [
    "same",
    "same\u0000",
    "same\u0000A",
    "boundary\ud7ff",
    "boundary𐀀",
    "boundary\ue000",
    "nonbmp𐀀",
    "nonbmp𐀁",
    "max\u{10ffff}",
    "max\uffff",
  ];
  const keys = ids.map(createPublicCourseSearchIdOrderKey);

  assert.deepEqual(
    [...ids].sort(compareJavaScriptStrings),
    [
      "boundary\ud7ff",
      "boundary𐀀",
      "boundary\ue000",
      "max\u{10ffff}",
      "max\uffff",
      "nonbmp𐀀",
      "nonbmp𐀁",
      "same",
      "same\u0000",
      "same\u0000A",
    ],
  );
  assert.equal(new Set(keys).size, ids.length);

  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < ids.length; rightIndex += 1) {
      assert.equal(
        compareAsciiBytes(keys[leftIndex], keys[rightIndex]),
        compareJavaScriptStrings(ids[leftIndex], ids[rightIndex]),
      );
    }
  }
});

test("ID order key rejects invalid identity input but does not normalize valid IDs", () => {
  assert.throws(() => createPublicCourseSearchIdOrderKey(""), RangeError);
  assert.throws(() => createPublicCourseSearchIdOrderKey(123), TypeError);
  assert.throws(() => createPublicCourseSearchIdOrderKey("\ud800"), RangeError);
  assert.throws(() => createPublicCourseSearchIdOrderKey("\udc00"), RangeError);
  assert.equal(
    createPublicCourseSearchIdOrderKey(" Ａ "),
    "0020FF210020",
  );
});

test("ID support predicate is limited to non-empty well-formed Unicode strings", () => {
  for (const id of ["ascii", "한글", "", "𐀀", "\u0000"]) {
    assert.equal(isSupportedPublicCourseSearchId(id), true, id);
  }
  for (const id of ["", "\ud800", "\udc00", "valid\ud800id", "\udc00\ud800"]) {
    assert.equal(isSupportedPublicCourseSearchId(id), false, id);
  }
  assert.equal(isSupportedPublicCourseSearchId(123), false);
  assert.equal(isSupportedPublicCourseSearchId(undefined), false);
});
