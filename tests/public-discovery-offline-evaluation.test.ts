import assert from "node:assert/strict";
import test from "node:test";
import { createPublicCourseOutlineAdapter } from "../lib/services/public-course-outline-adapter.ts";
import {
  createPublicCourseSearchAdapter,
  PublicCourseSearchError,
} from "../lib/services/public-course-search-adapter.ts";
import {
  createPublicDiscoverySelectionService,
  type PublicDiscoverySelectionResult,
} from "../lib/services/public-discovery-selection.ts";
import {
  createSyntheticOutlineCourse,
  createSyntheticSearchRecord,
  createSyntheticSubject,
  createSyntheticTopic,
  SYNTHETIC_COURSE_ID,
  SYNTHETIC_COURSE_SLUG,
  SYNTHETIC_SEARCH_DESCRIPTION,
  SyntheticPublicDiscoveryRepository,
  type SyntheticCall,
} from "../verification/public-discovery-offline-evaluation/fixtures.ts";

class SelectionError extends Error {
  readonly code = "SELECTION_NOT_IN_SEARCH_RESULTS" as const;
}

function selectCourseFromSearch(
  result: Awaited<ReturnType<ReturnType<typeof createPublicCourseSearchAdapter>["searchPublicCourses"]>>,
  courseId: string,
) {
  if (result.status !== "OK") {
    throw new SelectionError("A course cannot be selected from an empty search result.");
  }
  const selected = result.results.find((course) => course.id === courseId);
  if (!selected) {
    throw new SelectionError("The selected course is not present in the search result.");
  }
  return selected;
}

async function searchAndSelect(
  repository: SyntheticPublicDiscoveryRepository,
  courseId = SYNTHETIC_COURSE_ID,
) {
  const searchAdapter = createPublicCourseSearchAdapter(repository);
  const outlineAdapter = createPublicCourseOutlineAdapter(repository);
  const selectionService = createPublicDiscoverySelectionService(outlineAdapter);
  const search = await searchAdapter.searchPublicCourses({
    query: "synthetic",
    limit: 8,
  });
  const selected = selectCourseFromSearch(search, courseId);
  const outline = await selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  return { outline, search, selected, searchAdapter, outlineAdapter, selectionService };
}

function callKinds(calls: readonly SyntheticCall[]) {
  return calls.map((call) => call.kind);
}

function assertUnavailable(
  result: PublicDiscoverySelectionResult,
  reason: Extract<PublicDiscoverySelectionResult, { status: "UNAVAILABLE" }>["reason"],
) {
  assert.deepEqual(result, { status: "UNAVAILABLE", reason });
}

test("A: binds a real search result through the selection service and preserves fixture state", async () => {
  const repository = new SyntheticPublicDiscoveryRepository();
  const before = repository.snapshotData();

  const { outline, search, selected } = await searchAndSelect(repository);

  assert.equal(search.status, "OK");
  assert.equal(selected.id, SYNTHETIC_COURSE_ID);
  assert.equal(selected.slug, SYNTHETIC_COURSE_SLUG);
  assert.equal(outline.status, "OK");
  if (outline.status !== "OK") return;
  assert.deepEqual(
    {
      id: outline.course.id,
      slug: outline.course.slug,
    },
    {
      id: selected.id,
      slug: selected.slug,
    },
  );
  assert.deepEqual(outline.subjects.map((subject) => subject.id), [
    "subject-a",
    "subject-b",
  ]);
  assert.deepEqual(outline.subjects[0]?.topics.map((topic) => topic.id), [
    "topic-a",
    "topic-z",
  ]);
  assert.deepEqual(callKinds(repository.calls), ["search", "course", "curriculum"]);
  assert.deepEqual(repository.calls[0], {
    kind: "search",
    input: { query: "synthetic", path: "all", limit: 9, after: null },
  });
  assert.deepEqual(repository.calls[1], {
    kind: "course",
    slug: selected.slug,
  });
  assert.deepEqual(repository.calls[2], {
    kind: "curriculum",
    courseId: selected.id,
  });
  assert.deepEqual(repository.snapshotData(), before);
});

test("B: empty or invalid selections do not invoke the outline adapter", async () => {
  const emptyRepository = new SyntheticPublicDiscoveryRepository({ searchRows: [] });
  const emptySearchAdapter = createPublicCourseSearchAdapter(emptyRepository);
  const emptySearch = await emptySearchAdapter.searchPublicCourses({ query: "synthetic" });
  assert.equal(emptySearch.status, "EMPTY");
  assert.throws(
    () => selectCourseFromSearch(emptySearch, SYNTHETIC_COURSE_ID),
    (error: unknown) => error instanceof SelectionError && error.code === "SELECTION_NOT_IN_SEARCH_RESULTS",
  );
  assert.deepEqual(callKinds(emptyRepository.calls), ["search"]);

  const invalidSelectionRepository = new SyntheticPublicDiscoveryRepository();
  const invalidSearchAdapter = createPublicCourseSearchAdapter(invalidSelectionRepository);
  const nonEmptySearch = await invalidSearchAdapter.searchPublicCourses({ query: "synthetic" });
  assert.throws(
    () => selectCourseFromSearch(nonEmptySearch, "not-returned"),
    (error: unknown) => error instanceof SelectionError && error.code === "SELECTION_NOT_IN_SEARCH_RESULTS",
  );
  assert.deepEqual(callKinds(invalidSelectionRepository.calls), ["search"]);

  const invalidInputRepository = new SyntheticPublicDiscoveryRepository();
  const invalidInputOutlineAdapter = createPublicCourseOutlineAdapter(invalidInputRepository);
  const invalidInputSelectionService = createPublicDiscoverySelectionService(
    invalidInputOutlineAdapter,
  );
  assert.deepEqual(
    await invalidInputSelectionService.getSelectedCourseOutline({
      courseId: "",
      courseSlug: SYNTHETIC_COURSE_SLUG,
    }),
    { status: "SELECTION_ERROR", code: "INVALID_INPUT" },
  );
  assert.deepEqual(callKinds(invalidInputRepository.calls), []);
});

test("C: deterministic post-search visibility changes are handled as unavailable lookup", async () => {
  const stateChanges = [
    { label: "unpublished", course: createSyntheticOutlineCourse({ published: false }) },
    { label: "deleted", course: createSyntheticOutlineCourse({ deletedAt: "2026-09-14T00:00:00Z" }) },
    { label: "missing", course: null },
  ] as const;

  for (const stateChange of stateChanges) {
    await testContext(stateChange.label, async () => {
      const repository = new SyntheticPublicDiscoveryRepository();
      const searchAdapter = createPublicCourseSearchAdapter(repository);
      const outlineAdapter = createPublicCourseOutlineAdapter(repository);
      const selectionService = createPublicDiscoverySelectionService(outlineAdapter);
      const search = await searchAdapter.searchPublicCourses({ query: "synthetic" });
      const selected = selectCourseFromSearch(search, SYNTHETIC_COURSE_ID);

      repository.replaceCourse(stateChange.course);
      const outline = await selectionService.getSelectedCourseOutline({
        courseId: selected.id,
        courseSlug: selected.slug,
      });

      assert.deepEqual(outline, { status: "NOT_FOUND" });
      assert.deepEqual(callKinds(repository.calls), ["search", "course"]);
    });
  }
});

test("D: rejects slug projection errors and same-slug ID mismatches at the connection boundary", async () => {
  const slugMismatchRepository = new SyntheticPublicDiscoveryRepository();
  const slugMismatch = await searchAndSelectWithRepositoryMutation(
    slugMismatchRepository,
    createSyntheticOutlineCourse({ slug: "different-course-slug" }),
  );
  assertUnavailable(slugMismatch.outline, "INVALID_PUBLIC_PROJECTION");
  assert.deepEqual(callKinds(slugMismatchRepository.calls), ["search", "course"]);

  const idMismatchRepository = new SyntheticPublicDiscoveryRepository();
  const mismatchedCourseId = "different-course-id";
  const idMismatch = await searchAndSelectWithRepositoryMutation(
    idMismatchRepository,
    createSyntheticOutlineCourse({
      id: mismatchedCourseId,
      code: "MISMATCHED-COURSE",
      name: "Mismatched course title",
      groupName: "Mismatched course group",
    }),
    [
      createSyntheticSubject(
        "mismatched-subject",
        1,
        [
          createSyntheticTopic("mismatched-topic", "mismatched-subject", 1, {
            courseId: mismatchedCourseId,
            name: "Mismatched topic title",
          }),
        ],
        { courseId: mismatchedCourseId },
      ),
    ],
  );
  assert.deepEqual(idMismatch.outline, {
    status: "SELECTION_ERROR",
    code: "IDENTITY_MISMATCH",
  });
  const mismatchPayload = JSON.stringify(idMismatch.outline);
  for (const hiddenValue of [
    mismatchedCourseId,
    "MISMATCHED-COURSE",
    "Mismatched course title",
    "Mismatched course group",
    "mismatched-subject",
    "Mismatched topic title",
    "mismatched-topic",
    "SYNTHETIC_INTERNAL_LESSON_BODY",
    "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
  ]) {
    assert.equal(
      mismatchPayload.includes(hiddenValue),
      false,
      `mismatch payload must not disclose ${hiddenValue}`,
    );
  }
  assert.deepEqual(callKinds(idMismatchRepository.calls), ["search", "course", "curriculum"]);
  assert.notDeepEqual(
    idMismatch.outline,
    { status: "OK" },
    "identity mismatch must not be returned as a successful outline",
  );
});

test("E: keeps an empty outline successful and rejects subject/topic over-limit results", async () => {
  const emptyRepository = new SyntheticPublicDiscoveryRepository({ curriculum: [] });
  const empty = await searchAndSelect(emptyRepository);
  assert.deepEqual(empty.outline, {
    status: "OK",
    course: {
      id: SYNTHETIC_COURSE_ID,
      slug: SYNTHETIC_COURSE_SLUG,
      code: "SYN-1",
      name: "Synthetic public course",
      shortName: "Synthetic public",
      groupName: "Synthetic security learning",
      description: SYNTHETIC_SEARCH_DESCRIPTION,
      difficulty: "FOUNDATION",
    },
    subjects: [],
  });

  const tooManySubjects = new SyntheticPublicDiscoveryRepository({
    curriculum: Array.from({ length: 51 }, (_, index) =>
      createSyntheticSubject(`subject-${index}`, index, []),
    ),
  });
  const subjectsResult = await searchAndSelect(tooManySubjects);
  assertUnavailable(subjectsResult.outline, "OUTLINE_LIMIT_EXCEEDED");

  const tooManyTopics = new SyntheticPublicDiscoveryRepository({
    curriculum: [
      createSyntheticSubject(
        "subject-a",
        1,
        Array.from({ length: 201 }, (_, index) =>
          createSyntheticTopic(`topic-${index}`, "subject-a", index),
        ),
      ),
    ],
  });
  const topicsResult = await searchAndSelect(tooManyTopics);
  assertUnavailable(topicsResult.outline, "OUTLINE_LIMIT_EXCEEDED");
  assert.deepEqual(callKinds(tooManyTopics.calls), ["search", "course", "curriculum"]);
});

test("F: propagates search failure and maps outline failure or malformed projection distinctly", async () => {
  const searchFailure = new Error("SYNTHETIC_SEARCH_PROVIDER_FAILURE");
  const failedSearchRepository = new SyntheticPublicDiscoveryRepository({
    searchError: searchFailure,
  });
  const failedSearchAdapter = createPublicCourseSearchAdapter(failedSearchRepository);
  await assert.rejects(
    () => failedSearchAdapter.searchPublicCourses({ query: "synthetic" }),
    (error: unknown) => error === searchFailure,
  );
  assert.deepEqual(callKinds(failedSearchRepository.calls), ["search"]);

  const outlineFailureRepository = new SyntheticPublicDiscoveryRepository({
    curriculumError: new Error("SYNTHETIC_OUTLINE_PROVIDER_FAILURE"),
  });
  const outlineFailure = await searchAndSelect(outlineFailureRepository);
  assertUnavailable(outlineFailure.outline, "PUBLIC_REPOSITORY_ERROR");
  assert.equal(JSON.stringify(outlineFailure.outline).includes("SYNTHETIC_OUTLINE_PROVIDER_FAILURE"), false);

  const malformedSearchRepository = new SyntheticPublicDiscoveryRepository({
    searchRows: [{ ...createSyntheticSearchRecord(), groupDisplayOrder: null }],
  });
  const malformedSearchAdapter = createPublicCourseSearchAdapter(malformedSearchRepository);
  await assert.rejects(
    () => malformedSearchAdapter.searchPublicCourses({ query: "synthetic" }),
    (error: unknown) => error instanceof PublicCourseSearchError && error.code === "INVALID_SOURCE",
  );
  assert.deepEqual(callKinds(malformedSearchRepository.calls), ["search"]);

  const malformedOutlineRepository = new SyntheticPublicDiscoveryRepository({
    course: createSyntheticOutlineCourse({ published: undefined }),
  });
  const malformedOutline = await searchAndSelect(malformedOutlineRepository);
  assertUnavailable(malformedOutline.outline, "INVALID_PUBLIC_PROJECTION");
  assert.deepEqual(callKinds(malformedOutlineRepository.calls), ["search", "course"]);
});

test("G: search and outline outputs exclude internal and personal sentinel fields", async () => {
  const repository = new SyntheticPublicDiscoveryRepository();
  const { outline, search } = await searchAndSelect(repository);
  assert.equal(search.status, "OK");
  assert.equal(outline.status, "OK");
  const serialized = JSON.stringify({ search, outline });
  for (const sentinel of [
    "SYNTHETIC_INTERNAL_LESSON_BODY",
    "SYNTHETIC_INTERNAL_PRACTICE_ANSWER",
    "SYNTHETIC_INTERNAL_NOTE",
    "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
    "SYNTHETIC_INTERNAL_SUBJECT_BODY",
    "SYNTHETIC_INTERNAL_TOPIC_BODY",
    "SYNTHETIC_INTERNAL_ANSWER",
    "SYNTHETIC_INTERNAL_EXPLANATION",
  ]) {
    assert.equal(serialized.includes(sentinel), false, sentinel);
  }
  assert.equal(serialized.includes(SYNTHETIC_SEARCH_DESCRIPTION), true);
  assert.equal(serialized.includes("source"), false);
  assert.equal(serialized.includes("revision"), false);
  assert.equal(serialized.includes("asOf"), false);
});

async function searchAndSelectWithRepositoryMutation(
  repository: SyntheticPublicDiscoveryRepository,
  replacementCourse: unknown,
  replacementCurriculum?: unknown,
) {
  const searchAdapter = createPublicCourseSearchAdapter(repository);
  const outlineAdapter = createPublicCourseOutlineAdapter(repository);
  const selectionService = createPublicDiscoverySelectionService(outlineAdapter);
  const search = await searchAdapter.searchPublicCourses({ query: "synthetic" });
  const selected = selectCourseFromSearch(search, SYNTHETIC_COURSE_ID);
  repository.replaceCourse(replacementCourse);
  if (replacementCurriculum !== undefined) {
    repository.replaceCurriculum(replacementCurriculum);
  }
  const outline = await selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  return { outline, selected };
}

async function testContext(_label: string, callback: () => Promise<void>) {
  await callback();
}
