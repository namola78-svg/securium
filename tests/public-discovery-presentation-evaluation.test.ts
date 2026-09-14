import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicCourseOutlineAdapter,
  type PublicCourseOutlineResult,
} from "../lib/services/public-course-outline-adapter.ts";
import {
  createPublicCourseSearchAdapter,
  type PublicCourseSearchResult,
} from "../lib/services/public-course-search-adapter.ts";
import {
  createPublicDiscoverySelectionService,
  type PublicDiscoverySelectionResult,
} from "../lib/services/public-discovery-selection.ts";
import { formatPublicDiscoveryUserGuidance } from "../lib/services/public-discovery-user-guidance.ts";
import {
  formatPublicSourceDisclosure,
  PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
} from "../lib/services/public-source-disclosure.ts";
import {
  COURSE_A_ID,
  COURSE_A_NAME,
  COURSE_A_SOURCE_INSTITUTION,
  COURSE_B_ID,
  COURSE_B_NAME,
  COURSE_B_SOURCE_INSTITUTION,
  ERROR_SENTINEL,
  INTERNAL_SENTINEL,
  PERSONAL_SENTINEL,
  SHARED_COURSE_SLUG,
  createCompleteSourceProjection,
  createCurriculum,
  createOutlineCourse,
  createPartialSourceProjection,
  PresentationEvaluationRepository,
} from "../verification/public-discovery-presentation-evaluation/fixtures.ts";

function createFlow(repository: PresentationEvaluationRepository) {
  const searchAdapter = createPublicCourseSearchAdapter(repository);
  const outlineAdapter = createPublicCourseOutlineAdapter(repository);
  const selectionService = createPublicDiscoverySelectionService(outlineAdapter);
  return { searchAdapter, outlineAdapter, selectionService };
}

function selectReturnedCourse(
  result: PublicCourseSearchResult,
  courseId: string,
) {
  assert.equal(result.status, "OK");
  const selected = result.results.find((course) => course.id === courseId);
  assert.ok(selected, `expected ${courseId} in the actual search result`);
  return selected;
}

/**
 * This is the evaluation's proposed presentation rule, not a product
 * service. Search output is used to form the selection input; a selection
 * presentation contains only a successful current outline and a disclosure
 * explicitly supplied for that same success.
 */
function composeSearchPresentation(result: PublicCourseSearchResult) {
  return {
    stage: "SEARCH" as const,
    search: result,
    guidance: formatPublicDiscoveryUserGuidance({
      source: "SEARCH_RESULT",
      result,
    }),
    disclosure: formatPublicSourceDisclosure(undefined),
  };
}

function composeSearchErrorPresentation(error: unknown) {
  return {
    stage: "SEARCH" as const,
    search: null,
    guidance: formatPublicDiscoveryUserGuidance({
      source: "SEARCH_ERROR",
      error,
    }),
    disclosure: formatPublicSourceDisclosure(undefined),
  };
}

function composeSelectionPresentation(
  result: PublicDiscoverySelectionResult,
  sourceProjection: unknown = undefined,
) {
  const guidance = formatPublicDiscoveryUserGuidance({
    source: "SELECTION_RESULT",
    result,
  });
  const displayableOutline =
    result.status === "OK" &&
    (guidance.category === "OUTLINE_READY" || guidance.category === "OUTLINE_EMPTY");
  return {
    stage: "SELECTION" as const,
    outline: displayableOutline ? result : null,
    guidance,
    disclosure: formatPublicSourceDisclosure(
      displayableOutline ? sourceProjection : undefined,
    ),
  };
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

function assertAbsent(value: unknown, hiddenValues: readonly string[]) {
  const output = serialized(value);
  for (const hiddenValue of hiddenValues) {
    assert.equal(output.includes(hiddenValue), false, `output must not contain ${hiddenValue}`);
  }
}

function assertActionDescriptor(actions: readonly string[]) {
  assert.deepEqual(
    actions.filter((action) =>
      ["EDIT_SEARCH", "BACK_TO_RESULTS", "REFRESH_RESULTS"].includes(action),
    ),
    actions,
  );
}

test("A: composes actual search, same-course selection, guidance, and disclosure", async () => {
  const repository = new PresentationEvaluationRepository();
  const flow = createFlow(repository);
  const before = repository.snapshotData();

  const search = await flow.searchAdapter.searchPublicCourses({
    query: "security",
    limit: 8,
  });
  const selected = selectReturnedCourse(search, COURSE_A_ID);
  const selection = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  const presentation = composeSelectionPresentation(
    selection,
    createCompleteSourceProjection(COURSE_A_ID),
  );

  assert.equal(search.status, "OK");
  assert.equal(selected.slug, SHARED_COURSE_SLUG);
  assert.equal(selection.status, "OK");
  assert.equal(presentation.guidance.category, "OUTLINE_READY");
  assert.deepEqual(presentation.guidance.actions, []);
  assertActionDescriptor(presentation.guidance.actions);
  assert.equal(presentation.outline?.course.id, selected.id);
  assert.equal(presentation.outline?.course.slug, selected.slug);
  assert.equal(
    presentation.disclosure.officialReference?.institutionName,
    COURSE_A_SOURCE_INSTITUTION,
  );
  assert.equal(presentation.disclosure.notice, null);
  assert.equal("availability" in presentation, false);
  assert.equal("authorized" in presentation, false);
  assert.equal("enrollment" in presentation, false);
  assertAbsent(presentation, [INTERNAL_SENTINEL, PERSONAL_SENTINEL]);
  assert.deepEqual(
    repository.calls.map((call) => call.kind),
    ["search", "course", "curriculum"],
  );
  assert.deepEqual(repository.snapshotData(), before);
});

test("B: EMPTY search composes a search-empty guide without outline or prior disclosure", async () => {
  const repository = new PresentationEvaluationRepository({ searchRows: [] });
  const flow = createFlow(repository);

  const search = await flow.searchAdapter.searchPublicCourses({
    query: "security",
  });
  const presentation = composeSearchPresentation(search);

  assert.deepEqual(search, {
    contractVersion: "public-course-search.v1",
    status: "EMPTY",
    results: [],
    page: { limit: 8, hasNext: false, nextCursor: null },
  });
  assert.equal(presentation.guidance.category, "SEARCH_EMPTY");
  assert.deepEqual(presentation.guidance.actions, ["EDIT_SEARCH"]);
  assertActionDescriptor(presentation.guidance.actions);
  assert.equal(presentation.disclosure.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
  assertAbsent(presentation, [
    COURSE_A_ID,
    COURSE_A_NAME,
    COURSE_A_SOURCE_INSTITUTION,
    INTERNAL_SENTINEL,
    PERSONAL_SENTINEL,
  ]);
  assert.deepEqual(repository.calls.map((call) => call.kind), ["search"]);
});

test("C: same-slug different-ID selection is an identity mismatch with no other-course presentation data", async () => {
  const repository = new PresentationEvaluationRepository();
  const flow = createFlow(repository);
  const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
  const selected = selectReturnedCourse(search, COURSE_A_ID);

  repository.replaceCourse(createOutlineCourse(COURSE_B_ID));
  repository.replaceCurriculum(createCurriculum(COURSE_B_ID));
  const selection = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  const presentation = composeSelectionPresentation(selection);

  assert.deepEqual(selection, {
    status: "SELECTION_ERROR",
    code: "IDENTITY_MISMATCH",
  });
  assert.equal(presentation.guidance.category, "IDENTITY_MISMATCH");
  assert.deepEqual(presentation.guidance.actions, ["BACK_TO_RESULTS"]);
  assertActionDescriptor(presentation.guidance.actions);
  assert.equal(presentation.outline, null);
  assert.equal(presentation.disclosure.officialReference, null);
  assert.equal(presentation.disclosure.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
  assertAbsent(presentation, [
    COURSE_B_ID,
    COURSE_B_NAME,
    SHARED_COURSE_SLUG,
    "synthetic-subject-b",
    "synthetic-topic-b",
    COURSE_B_SOURCE_INSTITUTION,
    INTERNAL_SENTINEL,
    PERSONAL_SENTINEL,
  ]);
  assert.deepEqual(repository.calls.map((call) => call.kind), [
    "search",
    "course",
    "curriculum",
  ]);
});

test("D: a post-search NOT_FOUND does not reuse successful outline or source data", async () => {
  const repository = new PresentationEvaluationRepository();
  const flow = createFlow(repository);
  const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
  const selected = selectReturnedCourse(search, COURSE_A_ID);

  const successful = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  const successfulPresentation = composeSelectionPresentation(
    successful,
    createCompleteSourceProjection(COURSE_A_ID),
  );
  assert.equal(successfulPresentation.outline?.course.name, COURSE_A_NAME);
  assert.equal(
    successfulPresentation.disclosure.officialReference?.institutionName,
    COURSE_A_SOURCE_INSTITUTION,
  );

  repository.replaceCourse(null);
  const afterMutation = repository.snapshotData();
  const unavailable = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  const presentation = composeSelectionPresentation(unavailable);

  assert.deepEqual(unavailable, { status: "NOT_FOUND" });
  assert.equal(presentation.guidance.category, "COURSE_UNAVAILABLE");
  assert.deepEqual(presentation.guidance.actions, [
    "BACK_TO_RESULTS",
    "REFRESH_RESULTS",
  ]);
  assertActionDescriptor(presentation.guidance.actions);
  assert.equal(presentation.outline, null);
  assert.equal(presentation.disclosure.officialReference, null);
  assert.equal(presentation.disclosure.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
  assertAbsent(presentation, [
    COURSE_A_ID,
    COURSE_A_NAME,
    COURSE_A_SOURCE_INSTITUTION,
    INTERNAL_SENTINEL,
    PERSONAL_SENTINEL,
  ]);
  assert.deepEqual(repository.snapshotData(), afterMutation);
  assert.deepEqual(repository.calls.map((call) => call.kind), [
    "search",
    "course",
    "curriculum",
    "course",
  ]);
});

test("E: search and outline provider failures remain errors and do not retry or fall back", async () => {
  const searchFailureRepository = new PresentationEvaluationRepository({
    searchError: new Error(ERROR_SENTINEL),
  });
  const searchFailureFlow = createFlow(searchFailureRepository);
  let searchError: unknown;
  try {
    await searchFailureFlow.searchAdapter.searchPublicCourses({ query: "security" });
  } catch (error) {
    searchError = error;
  }
  assert.ok(searchError instanceof Error);
  const searchFailurePresentation = composeSearchErrorPresentation(searchError);
  assert.equal(searchFailurePresentation.guidance.category, "PROVIDER_ERROR");
  assert.notEqual(searchFailurePresentation.guidance.category, "SEARCH_EMPTY");
  assert.deepEqual(searchFailurePresentation.guidance.actions, [
    "BACK_TO_RESULTS",
    "REFRESH_RESULTS",
  ]);
  assertActionDescriptor(searchFailurePresentation.guidance.actions);
  assertAbsent(searchFailurePresentation, [ERROR_SENTINEL, INTERNAL_SENTINEL]);
  assert.deepEqual(searchFailureRepository.calls.map((call) => call.kind), ["search"]);

  for (const errorOption of ["courseError", "curriculumError"] as const) {
    const repository = new PresentationEvaluationRepository({
      [errorOption]: new Error(ERROR_SENTINEL),
    });
    const flow = createFlow(repository);
    const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
    const selected = selectReturnedCourse(search, COURSE_A_ID);
    const selection = await flow.selectionService.getSelectedCourseOutline({
      courseId: selected.id,
      courseSlug: selected.slug,
    });
    const presentation = composeSelectionPresentation(selection);

    assert.deepEqual(selection, {
      status: "UNAVAILABLE",
      reason: "PUBLIC_REPOSITORY_ERROR",
    });
    assert.equal(presentation.guidance.category, "PROVIDER_ERROR");
    assert.notEqual(presentation.guidance.category, "SEARCH_EMPTY");
    assert.equal(presentation.outline, null);
    assert.equal(presentation.disclosure.officialReference, null);
    assertAbsent(presentation, [ERROR_SENTINEL, COURSE_B_NAME, INTERNAL_SENTINEL]);
    assert.deepEqual(
      repository.calls.map((call) => call.kind),
      errorOption === "courseError"
        ? ["search", "course"]
        : ["search", "course", "curriculum"],
    );
  }
});

test("F: an empty curriculum is successful content state, independent of source disclosure", async () => {
  const repository = new PresentationEvaluationRepository({ curriculum: [] });
  const flow = createFlow(repository);
  const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
  const selected = selectReturnedCourse(search, COURSE_A_ID);
  const selection = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });
  const presentation = composeSelectionPresentation(
    selection,
    createCompleteSourceProjection(COURSE_A_ID),
  );

  assert.equal(selection.status, "OK");
  if (selection.status !== "OK") return;
  assert.deepEqual(selection.subjects, []);
  assert.equal(presentation.guidance.category, "OUTLINE_EMPTY");
  assert.deepEqual(presentation.guidance.actions, ["BACK_TO_RESULTS"]);
  assertActionDescriptor(presentation.guidance.actions);
  assert.equal(presentation.outline?.subjects.length, 0);
  assert.equal(presentation.disclosure.notice, null);
  assert.equal("availability" in presentation, false);
  assert.equal("learnable" in presentation, false);
  assertAbsent(presentation, ["PROVIDER_ERROR", "UNAVAILABLE", INTERNAL_SENTINEL]);
});

test("G: missing or partial source projection does not change successful outline guidance", async () => {
  const repository = new PresentationEvaluationRepository();
  const flow = createFlow(repository);
  const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
  const selected = selectReturnedCourse(search, COURSE_A_ID);
  const selection = await flow.selectionService.getSelectedCourseOutline({
    courseId: selected.id,
    courseSlug: selected.slug,
  });

  const missing = composeSelectionPresentation(selection);
  const partial = composeSelectionPresentation(
    selection,
    createPartialSourceProjection(),
  );

  assert.equal(selection.status, "OK");
  assert.equal(missing.guidance.category, "OUTLINE_READY");
  assert.equal(partial.guidance.category, "OUTLINE_READY");
  assert.equal(missing.outline?.course.id, COURSE_A_ID);
  assert.equal(partial.outline?.course.id, COURSE_A_ID);
  assert.deepEqual(missing.disclosure, {
    officialReference: null,
    independentExplanation: null,
    notice: PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE,
  });
  assert.equal(
    partial.disclosure.officialReference?.institutionName,
    "Synthetic partial institution",
  );
  assert.equal(partial.disclosure.officialReference?.documentTitle, "Synthetic partial document");
  assert.equal(partial.disclosure.officialReference?.sourceCheckedAt, undefined);
  assert.equal(partial.disclosure.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
  assertAbsent(partial, ["approved", "verified", "current", INTERNAL_SENTINEL]);
});

test("H: sequential evaluations have independent presentation outputs and immutable fixture reads", async () => {
  const repository = new PresentationEvaluationRepository();
  const flow = createFlow(repository);
  const initial = repository.snapshotData();
  const search = await flow.searchAdapter.searchPublicCourses({ query: "security" });
  const selectedA = selectReturnedCourse(search, COURSE_A_ID);
  const selectedB = selectReturnedCourse(search, COURSE_B_ID);

  const outlineA = await flow.selectionService.getSelectedCourseOutline({
    courseId: selectedA.id,
    courseSlug: selectedA.slug,
  });
  const presentationA = composeSelectionPresentation(
    outlineA,
    createCompleteSourceProjection(COURSE_A_ID),
  );
  assert.equal(presentationA.outline?.course.name, COURSE_A_NAME);
  assert.equal(
    presentationA.disclosure.officialReference?.institutionName,
    COURSE_A_SOURCE_INSTITUTION,
  );
  assert.deepEqual(repository.snapshotData(), initial);

  repository.replaceCourse(null);
  const notFoundState = repository.snapshotData();
  const outlineAfterA = await flow.selectionService.getSelectedCourseOutline({
    courseId: selectedA.id,
    courseSlug: selectedA.slug,
  });
  const failurePresentation = composeSelectionPresentation(outlineAfterA);
  assert.deepEqual(outlineAfterA, { status: "NOT_FOUND" });
  assert.equal(failurePresentation.outline, null);
  assert.equal(failurePresentation.disclosure.officialReference, null);
  assertAbsent(failurePresentation, [COURSE_A_NAME, COURSE_A_SOURCE_INSTITUTION]);
  assert.deepEqual(repository.snapshotData(), notFoundState);

  repository.replaceCourse(createOutlineCourse(COURSE_B_ID));
  repository.replaceCurriculum(createCurriculum(COURSE_B_ID));
  const courseBState = repository.snapshotData();
  const outlineB = await flow.selectionService.getSelectedCourseOutline({
    courseId: selectedB.id,
    courseSlug: selectedB.slug,
  });
  const presentationB = composeSelectionPresentation(
    outlineB,
    createCompleteSourceProjection(COURSE_B_ID),
  );
  assert.equal(presentationB.outline?.course.name, COURSE_B_NAME);
  assert.equal(
    presentationB.disclosure.officialReference?.institutionName,
    COURSE_B_SOURCE_INSTITUTION,
  );
  assertAbsent(presentationB, [COURSE_A_NAME, COURSE_A_SOURCE_INSTITUTION]);
  assert.deepEqual(repository.snapshotData(), courseBState);

  const repeatedOutlineB = await flow.selectionService.getSelectedCourseOutline({
    courseId: selectedB.id,
    courseSlug: selectedB.slug,
  });
  const repeatedPresentationB = composeSelectionPresentation(
    repeatedOutlineB,
    createCompleteSourceProjection(COURSE_B_ID),
  );
  assert.deepEqual(repeatedPresentationB, presentationB);
  assert.deepEqual(repository.snapshotData(), courseBState);
});

test("malformed presentation inputs stay in the formatter's unknown boundary", () => {
  const malformedSelection = {
    status: "OK",
    course: { id: COURSE_A_ID, slug: SHARED_COURSE_SLUG },
    subjects: [],
  } as unknown as PublicCourseOutlineResult;
  const presentation = composeSelectionPresentation(malformedSelection);

  assert.equal(presentation.guidance.category, "UNKNOWN_RESULT");
  assert.equal(presentation.outline, null);
  assert.equal(presentation.disclosure.notice, PUBLIC_SOURCE_DISCLOSURE_MISSING_NOTICE);
});
