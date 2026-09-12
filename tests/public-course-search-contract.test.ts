import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicCourseSearchAdapter,
  type PublicCourseSearchRepository,
  type PublicCourseSearchRepositoryInput,
  type PublicCourseSearchSourceRecord,
  PublicCourseSearchError,
} from "../lib/services/public-course-search-adapter.ts";

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
    isSample: false,
    updatedAt: "2026-09-12T00:00:00.000Z",
    subjectCount: 2,
    topicCount: 4,
    questionCount: 99,
    ...overrides,
  };
}

function fixtureAdapter(
  rows: readonly PublicCourseSearchSourceRecord[],
  responses: readonly (readonly PublicCourseSearchSourceRecord[])[] = [rows],
) {
  const calls: PublicCourseSearchRepositoryInput[] = [];
  let responseIndex = 0;
  const repository: PublicCourseSearchRepository = {
    searchPublicCourses: async (input) => {
      calls.push(input);
      return responses[Math.min(responseIndex++, responses.length - 1)] ?? [];
    },
  };
  return { adapter: createPublicCourseSearchAdapter(repository), calls };
}

function errorCode(error: unknown) {
  return error instanceof PublicCourseSearchError ? error.code : undefined;
}

test("bounded public candidates are projected with an allowlist", async () => {
  const rows = [{
    ...sourceCourse("public", { displayOrder: 2 }),
    lessonBody: "must not escape",
    practiceAnswer: "must not escape",
    internalNote: "must not escape",
  }];
  const input = { query: "  PUBLIC ", limit: 1 };
  const before = structuredClone(rows);
  const { adapter } = fixtureAdapter(rows);

  const result = await adapter.searchPublicCourses(input);

  assert.equal(result.status, "OK");
  assert.deepEqual(result.results.map((course) => course.id), ["public"]);
  assert.deepEqual(Object.keys(result.results[0]!).sort(), [
    "code",
    "description",
    "difficulty",
    "groupName",
    "id",
    "name",
    "shortName",
    "slug",
    "subjectCount",
    "thumbnailUrl",
    "topicCount",
    "totalLevels",
    "updatedAt",
  ]);
  assert.equal("passingScore" in result.results[0]!, false);
  assert.equal("questionCount" in result.results[0]!, false);
  assert.equal("lessonBody" in result.results[0]!, false);
  assert.equal("source" in result.results[0]!, false);
  assert.equal("revision" in result.results[0]!, false);
  assert.equal("asOf" in result.results[0]!, false);
  assert.equal(result.page.limit, 1);
  assert.equal(result.page.hasNext, false);
  assert.equal(result.page.nextCursor, null);
  assert.deepEqual(rows, before);
});

test("repository contract violations are rejected instead of filtered or repaired", async () => {
  const cases: Array<{
    rows: readonly PublicCourseSearchSourceRecord[];
    input?: unknown;
  }> = [
    { rows: [sourceCourse("draft", { published: false })] },
    { rows: [sourceCourse("inactive", { active: false })] },
    { rows: [sourceCourse("deleted", { deletedAt: "2026-09-01T00:00:00Z" })] },
    { rows: [sourceCourse("private-group", { groupActive: false })] },
    {
      rows: [sourceCourse("wrong-query", { description: "Internal description" })],
      input: { query: "public" },
    },
    {
      rows: [sourceCourse("professional", { name: "Secure coding practice" })],
      input: { path: "certification" },
    },
    {
      rows: [
        sourceCourse("later", { displayOrder: 2 }),
        sourceCourse("first", { displayOrder: 1 }),
      ],
    },
    { rows: [sourceCourse("duplicate"), sourceCourse("duplicate", { displayOrder: 2 })] },
    {
      rows: [sourceCourse("one"), sourceCourse("two"), sourceCourse("three")],
      input: { limit: 1 },
    },
  ];

  for (const { rows, input = {} } of cases) {
    const { adapter } = fixtureAdapter(rows);
    await assert.rejects(
      () => adapter.searchPublicCourses(input),
      (error: unknown) => errorCode(error) === "INVALID_SOURCE",
    );
  }
});

test("caller trust fields are rejected and cannot influence public selection", async () => {
  const { adapter } = fixtureAdapter([sourceCourse("public")]);

  await assert.rejects(
    () => adapter.searchPublicCourses({ published: true }),
    (error: unknown) => errorCode(error) === "INVALID_INPUT",
  );
  await assert.rejects(
    () => adapter.searchPublicCourses({ status: "planned" }),
    (error: unknown) => errorCode(error) === "INVALID_INPUT",
  );
});

test("query, path, and page-size validation is strict and bounded", async () => {
  const { adapter } = fixtureAdapter([sourceCourse("public")]);
  const invalidInputs: unknown[] = [
    null,
    { query: 1 },
    { query: "가".repeat(20) },
    { limit: 0 },
    { limit: -1 },
    { limit: 1.5 },
    { limit: 13 },
    { limit: "2" },
    { path: "planned" },
    { cursor: "" },
    { cursor: "a".repeat(2049) },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      () => adapter.searchPublicCourses(input),
      (error: unknown) => errorCode(error) === "INVALID_INPUT",
    );
  }
});

test("query normalization applies before the UTF-8 byte bound", async () => {
  const { adapter, calls } = fixtureAdapter([sourceCourse("public")]);

  await adapter.searchPublicCourses({ query: "  ＰＵＢＬＩＣ  " });

  assert.equal(calls[0]!.query, "public");
  assert.equal(
    new TextEncoder().encode(String.fromCodePoint(0x00e9).repeat(24)).length,
    48,
  );
});

test("deterministic tie-breaking provides contiguous cursor pages without duplicates", async () => {
  const rows = [
    sourceCourse("c-3", { groupDisplayOrder: 2, displayOrder: 0 }),
    sourceCourse("c-b", { groupDisplayOrder: 1, displayOrder: 1 }),
    sourceCourse("c-a", { groupDisplayOrder: 1, displayOrder: 1 }),
  ];
  const { adapter, calls } = fixtureAdapter(rows, [
    [rows[2]!, rows[1]!, rows[0]!],
    [rows[0]!],
  ]);

  const first = await adapter.searchPublicCourses({ limit: 2 });
  const second = await adapter.searchPublicCourses({ limit: 2, cursor: first.page.nextCursor! });

  assert.deepEqual(first.results.map((course) => course.id), ["c-a", "c-b"]);
  assert.deepEqual(second.results.map((course) => course.id), ["c-3"]);
  assert.deepEqual(
    [...first.results, ...second.results].map((course) => course.id),
    ["c-a", "c-b", "c-3"],
  );
  assert.equal(first.page.hasNext, true);
  assert.equal(second.page.hasNext, false);
  assert.equal(second.page.nextCursor, null);
  assert.equal(calls[0]!.limit, 3);
  assert.equal(calls[1]!.limit, 3);
  assert.deepEqual(calls[1]!.after, {
    groupDisplayOrder: 1,
    displayOrder: 1,
    id: "c-b",
  });
});

test("path filtering follows the existing display category and is not authorization", async () => {
  const rows = [sourceCourse("cert", { name: "정보보안기사 certification" })];
  const { adapter } = fixtureAdapter(rows);

  const result = await adapter.searchPublicCourses({ path: "certification" });

  assert.deepEqual(result.results.map((course) => course.id), ["cert"]);
  assert.equal(result.page.hasNext, false);
});

test("empty and last pages expose exact page metadata", async () => {
  const { adapter } = fixtureAdapter([sourceCourse("public")], [
    [],
    [sourceCourse("public")],
  ]);

  const empty = await adapter.searchPublicCourses({ query: "no matching course" });
  assert.equal(empty.status, "EMPTY");
  assert.deepEqual(empty.results, []);
  assert.equal(empty.page.hasNext, false);
  assert.equal(empty.page.nextCursor, null);

  const last = await adapter.searchPublicCourses({ limit: 1 });
  assert.equal(last.status, "OK");
  assert.equal(last.page.hasNext, false);
  assert.equal(last.page.nextCursor, null);
});

test("cursor is bound to its search conditions and page size", async () => {
  const { adapter } = fixtureAdapter([
    sourceCourse("one"),
    sourceCourse("two", { displayOrder: 2 }),
  ]);
  const first = await adapter.searchPublicCourses({ query: "course", limit: 1 });
  const cursor = first.page.nextCursor;
  assert.ok(cursor);

  for (const input of [
    { query: "other", limit: 1, cursor },
    { query: "course", limit: 2, cursor },
    { query: "course", path: "certification", limit: 1, cursor },
  ]) {
    await assert.rejects(
      () => adapter.searchPublicCourses(input),
      (error: unknown) => errorCode(error) === "INVALID_CURSOR",
    );
  }
});

test("cursor version, required fields, extra fields, and digest changes are rejected", async () => {
  const { adapter } = fixtureAdapter([
    sourceCourse("one"),
    sourceCourse("two", { displayOrder: 2 }),
  ]);
  const first = await adapter.searchPublicCourses({ limit: 1 });
  assert.ok(first.page.nextCursor);

  const payload = JSON.parse(
    Buffer.from(first.page.nextCursor!, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  const invalidCursors = [
    "not-base64",
    encode({ ...payload, cursorVersion: "public-course-search.cursor.v0" }),
    encode({ ...payload, extra: true }),
    encode(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "id"))),
    encode({ ...payload, id: "tampered" }),
  ];

  for (const cursor of invalidCursors) {
    await assert.rejects(
      () => adapter.searchPublicCourses({ limit: 1, cursor }),
      (error: unknown) => errorCode(error) === "INVALID_CURSOR",
    );
  }
});

test("provider order fields reject NULL while allowing signed integer positions", async () => {
  const malformed = sourceCourse("null-order", {
    groupDisplayOrder: null as unknown as number,
  });
  const { adapter: malformedAdapter } = fixtureAdapter([malformed]);
  await assert.rejects(
    () => malformedAdapter.searchPublicCourses(),
    (error: unknown) => errorCode(error) === "INVALID_SOURCE",
  );

  const rows = [
    sourceCourse("negative", { groupDisplayOrder: -1 }),
    sourceCourse("zero", { groupDisplayOrder: 0 }),
  ];
  const { adapter } = fixtureAdapter(rows, [rows, [rows[1]!]]);
  const first = await adapter.searchPublicCourses({ limit: 1 });
  assert.equal(first.results[0]!.id, "negative");
  assert.ok(first.page.nextCursor);
  const next = await adapter.searchPublicCourses({
    limit: 1,
    cursor: first.page.nextCursor!,
  });
  assert.deepEqual(next.results.map((course) => course.id), ["zero"]);
});
