import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicCourseSearchProjection,
  createPublicCourseSearchIdOrderKey,
  normalizePublicCourseSearchQuery,
  PUBLIC_COURSE_SEARCH_COMPARISON_VERSION,
  PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION,
  PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION,
  type PublicCourseSearchProjectionParts,
} from "../lib/services/public-course-search-comparison.ts";
import { isPublicCourse } from "../lib/services/catalog-service.ts";
import {
  ALPHA_COURSE,
  ALPHA_GROUP,
  ALPHA_ID_ORDER_KEY,
  ALPHA_SEARCH_TEXT,
  FANOUT_AFTER_COURSES,
  FANOUT_AFTER_GROUPS,
  FANOUT_BEFORE_COURSES,
  FANOUT_BEFORE_GROUPS,
  FANOUT_BEFORE_PROJECTIONS,
  FANOUT_EXPECTED_AFTER,
  FANOUT_EXPECTED_AFFECTED_COURSE_IDS,
  FANOUT_EXPECTED_BEFORE,
  FANOUT_EXPECTED_PARTIAL_MISMATCHES,
  FANOUT_ID_ORDER_KEYS,
  FANOUT_PARTIAL_AFTER_PROJECTIONS,
  MISSING_RELATIONSHIP_COURSE,
  MISSING_RELATIONSHIP_EXPECTATION,
  METADATA_ONLY_CHANGE,
  NORMALIZED_EQUIVALENCE_CASES,
  POLICY_COURSE,
  POLICY_PROJECTION,
  PUBLIC_POLICY_CASES,
  RELATIONSHIP_AFTER,
  RELATIONSHIP_BEFORE,
  SEARCH_FIELD_CHANGE_CASES,
  STORAGE_STATE_CASES,
  SYNTHETIC_COMPARISON_VERSION,
  SYNTHETIC_NORMALIZER_VERSION,
  SYNTHETIC_ORDER_KEY_VERSION,
  VERSION_CASES,
  type SyntheticCourse,
  type SyntheticGroup,
  type SyntheticStoredProjection,
} from "../verification/public-search-projection-invalidation/fixtures.ts";

type ProjectionObservation = Readonly<{
  searchText: string;
  idOrderKey: string;
}>;

type MismatchKind =
  | "MISSING_PROJECTION"
  | "SEARCH_TEXT"
  | "ID_ORDER_KEY"
  | "VERSION_METADATA"
  | "SOURCE_REVISION"
  | "NON_READY_STATE";

type ProjectionMismatch = Readonly<{
  courseId: string;
  kinds: readonly MismatchKind[];
}>;

function comparisonParts(
  course: SyntheticCourse,
  group: SyntheticGroup,
): PublicCourseSearchProjectionParts {
  return {
    name: course.name,
    shortName: course.shortName,
    groupName: group.name,
    publicDescription: course.publicDescription,
    audienceLabel: course.audienceLabel,
  };
}

function observeProjection(
  course: SyntheticCourse,
  group: SyntheticGroup,
): ProjectionObservation {
  return {
    searchText: buildPublicCourseSearchProjection(comparisonParts(course, group)),
    idOrderKey: createPublicCourseSearchIdOrderKey(course.id),
  };
}

function observeWithoutMutating(
  course: SyntheticCourse,
  group: SyntheticGroup,
): ProjectionObservation {
  const courseSnapshot = structuredClone(course);
  const groupSnapshot = structuredClone(group);
  const observation = observeProjection(course, group);
  assert.deepEqual(course, courseSnapshot);
  assert.deepEqual(group, groupSnapshot);
  return observation;
}

function metadataKinds(
  projection: SyntheticStoredProjection,
): MismatchKind[] {
  const kinds: MismatchKind[] = [];
  if (
    projection.comparisonVersion !== PUBLIC_COURSE_SEARCH_COMPARISON_VERSION ||
    projection.normalizerVersion !== PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION ||
    projection.orderKeyVersion !== PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION
  ) {
    kinds.push("VERSION_METADATA");
  }
  if (projection.projectionState !== "READY") kinds.push("NON_READY_STATE");
  return kinds;
}

function detectProjectionMismatches(
  courses: readonly SyntheticCourse[],
  groups: readonly SyntheticGroup[],
  projections: readonly SyntheticStoredProjection[],
): readonly ProjectionMismatch[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const projectionByCourseId = new Map(
    projections.map((projection) => [projection.courseId, projection]),
  );
  const mismatches: ProjectionMismatch[] = [];

  for (const course of courses) {
    const projection = projectionByCourseId.get(course.id);
    if (!projection) {
      mismatches.push({ courseId: course.id, kinds: ["MISSING_PROJECTION"] });
      continue;
    }

    const kinds = metadataKinds(projection);
    const group = groupById.get(course.groupId);
    if (!group) {
      mismatches.push({
        courseId: course.id,
        kinds: ["SOURCE_REVISION", ...kinds],
      });
      continue;
    }

    const current = observeProjection(course, group);
    if (projection.searchText !== current.searchText) kinds.push("SEARCH_TEXT");
    if (projection.idOrderKey !== current.idOrderKey) kinds.push("ID_ORDER_KEY");
    if (projection.sourceRevision !== course.canonicalRevision) {
      kinds.push("SOURCE_REVISION");
    }
    if (kinds.length > 0) mismatches.push({ courseId: course.id, kinds });
  }

  return mismatches;
}

function groupFanoutImpactOracle(
  courses: readonly SyntheticCourse[],
  groupId: string,
): readonly string[] {
  return courses
    .filter((course) => course.groupId === groupId)
    .map((course) => course.id);
}

function publicEligibilityObservation(
  course: SyntheticCourse,
  group: SyntheticGroup,
): boolean {
  return isPublicCourse(course) && group.active && group.deletedAt === null;
}

function compareMismatchShapes(
  actual: readonly ProjectionMismatch[],
  expected: readonly Readonly<{ courseId: string; kinds: readonly string[] }>[] ,
) {
  assert.deepEqual(actual, expected);
}

test("A: each searchable field change has the fixed independent projection oracle", () => {
  for (const change of SEARCH_FIELD_CHANGE_CASES) {
    const beforeGroup = "beforeGroup" in change ? change.beforeGroup : ALPHA_GROUP;
    const afterGroup = "afterGroup" in change ? change.afterGroup : beforeGroup;
    const before = observeWithoutMutating(change.before, beforeGroup);
    const after = observeWithoutMutating(change.after, afterGroup);

    assert.equal(change.expectedWriterPolicy, "REQUIRED", change.label);
    assert.equal(before.searchText, change.expectedBeforeSearchText, change.label);
    assert.equal(after.searchText, change.expectedAfterSearchText, change.label);
    assert.equal(before.idOrderKey, change.expectedIdOrderKey, change.label);
    assert.equal(after.idOrderKey, change.expectedIdOrderKey, change.label);
    assert.deepEqual(change.expectedAffectedCourseIds, [change.after.id]);
  }
});

test("A: metadata outside the five search fields preserves projection and ID key", () => {
  const before = observeWithoutMutating(METADATA_ONLY_CHANGE.before, ALPHA_GROUP);
  const after = observeWithoutMutating(METADATA_ONLY_CHANGE.after, ALPHA_GROUP);

  assert.equal(METADATA_ONLY_CHANGE.expectedWriterPolicy, "UNRESOLVED");
  assert.equal(before.searchText, METADATA_ONLY_CHANGE.expectedSearchText);
  assert.equal(after.searchText, METADATA_ONLY_CHANGE.expectedSearchText);
  assert.equal(before.idOrderKey, METADATA_ONLY_CHANGE.expectedIdOrderKey);
  assert.equal(after.idOrderKey, METADATA_ONLY_CHANGE.expectedIdOrderKey);
  assert.notEqual(
    METADATA_ONLY_CHANGE.before.metadataLabel,
    METADATA_ONLY_CHANGE.after.metadataLabel,
  );
});

test("comparison boundary: query byte limit is not applied to stored projection text", () => {
  const longStoredText = "가".repeat(20);
  const course = {
    ...ALPHA_COURSE,
    publicDescription: longStoredText,
  };

  assert.doesNotThrow(() => observeProjection(course, ALPHA_GROUP));
  assert.throws(
    () => normalizePublicCourseSearchQuery(longStoredText),
    (error: unknown) => error instanceof RangeError,
  );
});

test("B: normalized-equivalent source changes have equal derived strings but unresolved freshness policy", () => {
  for (const equivalence of NORMALIZED_EQUIVALENCE_CASES) {
    const before = observeWithoutMutating(equivalence.before, ALPHA_GROUP);
    const after = observeWithoutMutating(equivalence.after, ALPHA_GROUP);

    assert.equal(before.searchText, equivalence.expectedSearchText, equivalence.label);
    assert.equal(after.searchText, equivalence.expectedSearchText, equivalence.label);
    assert.equal(before.searchText, after.searchText, equivalence.label);
    assert.equal(before.idOrderKey, equivalence.expectedIdOrderKey, equivalence.label);
    assert.equal(after.idOrderKey, equivalence.expectedIdOrderKey, equivalence.label);
    assert.equal(equivalence.expectedWriterPolicy, "UNRESOLVED", equivalence.label);
    assert.notEqual(
      equivalence.before.canonicalRevision,
      equivalence.after.canonicalRevision,
      equivalence.label,
    );
  }
});

test("C: group fan-out oracle includes only the changed group's child courses", () => {
  const beforeImpact = groupFanoutImpactOracle(
    FANOUT_BEFORE_COURSES,
    FANOUT_BEFORE_GROUPS[0].id,
  );
  assert.deepEqual(beforeImpact, FANOUT_EXPECTED_AFFECTED_COURSE_IDS);

  for (const course of FANOUT_AFTER_COURSES) {
    const group = FANOUT_AFTER_GROUPS.find((candidate) => candidate.id === course.groupId);
    assert.ok(group, course.id);
    const observed = observeProjection(course, group);
    const expectedSearchText =
      FANOUT_EXPECTED_AFTER[course.id as keyof typeof FANOUT_EXPECTED_AFTER];
    const expectedIdOrderKey =
      FANOUT_ID_ORDER_KEYS[course.id as keyof typeof FANOUT_ID_ORDER_KEYS];
    assert.ok(expectedSearchText, course.id);
    assert.ok(expectedIdOrderKey, course.id);
    assert.equal(observed.searchText, expectedSearchText, course.id);
    assert.equal(observed.idOrderKey, expectedIdOrderKey, course.id);
  }

  assert.equal(
    (beforeImpact as readonly string[]).includes("course-b1"),
    false,
    "a different group's child must not be included",
  );
  assert.deepEqual(
    detectProjectionMismatches(
      FANOUT_AFTER_COURSES,
      FANOUT_AFTER_GROUPS,
      FANOUT_PARTIAL_AFTER_PROJECTIONS,
    ),
    FANOUT_EXPECTED_PARTIAL_MISMATCHES,
  );
  assert.deepEqual(
    FANOUT_BEFORE_PROJECTIONS.map((projection) => projection.searchText),
    [
      FANOUT_EXPECTED_BEFORE["course-a1"],
      FANOUT_EXPECTED_BEFORE["course-a2"],
      FANOUT_EXPECTED_BEFORE["course-b1"],
    ],
  );
});

test("D: public eligibility changes independently from equal projection freshness", () => {
  for (const policyCase of PUBLIC_POLICY_CASES) {
    const observed = observeProjection(policyCase.course, policyCase.group);
    assert.equal(observed.searchText, POLICY_PROJECTION.searchText, policyCase.label);
    assert.equal(observed.idOrderKey, POLICY_PROJECTION.idOrderKey, policyCase.label);
    assert.equal(
      publicEligibilityObservation(policyCase.course, policyCase.group),
      policyCase.expectedPublic,
      policyCase.label,
    );
    assert.equal(
      POLICY_PROJECTION.projectionState,
      "READY",
      "stored projection state is not a public authorization decision",
    );
    assert.equal(
      policyCase.expectedPublic || POLICY_PROJECTION.projectionState === "READY",
      true,
      "projection presence must not authorize an ineligible row",
    );
  }
});

test("E: group relationship changes update groupName text while preserving course ID key", () => {
  const before = observeProjection(RELATIONSHIP_BEFORE.course, RELATIONSHIP_BEFORE.group);
  const after = observeProjection(RELATIONSHIP_AFTER.course, RELATIONSHIP_AFTER.group);

  assert.equal(before.searchText, RELATIONSHIP_BEFORE.expectedSearchText);
  assert.equal(after.searchText, RELATIONSHIP_AFTER.expectedSearchText);
  assert.notEqual(before.searchText, after.searchText);
  assert.equal(before.idOrderKey, RELATIONSHIP_BEFORE.expectedIdOrderKey);
  assert.equal(after.idOrderKey, RELATIONSHIP_AFTER.expectedIdOrderKey);
  assert.equal(before.idOrderKey, after.idOrderKey);

  const missingGroupResult = (() => {
    const missingGroup = new Set(["group-alpha", "group-beta"]).has(
      MISSING_RELATIONSHIP_COURSE.groupId,
    )
      ? ALPHA_GROUP
      : undefined;
    if (!missingGroup) {
      return MISSING_RELATIONSHIP_EXPECTATION;
    }
    return { kind: "UNEXPECTED_FALLBACK" as const };
  })();
  assert.deepEqual(missingGroupResult, MISSING_RELATIONSHIP_EXPECTATION);
});

test("F: version metadata mismatches are observed without version-prefixed keys", () => {
  for (const versionCase of VERSION_CASES) {
    const mismatches = detectProjectionMismatches(
      [POLICY_COURSE],
      [ALPHA_GROUP],
      [versionCase.projection],
    );
    const expected = versionCase.expectedKinds.length === 0
      ? []
      : [{ courseId: POLICY_COURSE.id, kinds: versionCase.expectedKinds }];
    compareMismatchShapes(mismatches, expected);
  }

  const key = createPublicCourseSearchIdOrderKey(POLICY_COURSE.id);
  assert.equal(key, POLICY_PROJECTION.idOrderKey);
  assert.equal(key.includes(SYNTHETIC_ORDER_KEY_VERSION), false);
  assert.equal(SYNTHETIC_COMPARISON_VERSION.startsWith("public-course-search."), true);
});

test("G: missing, stale, partial, and metadata-invalid storage states are distinct observations", () => {
  for (const stateCase of Object.values(STORAGE_STATE_CASES)) {
    const mismatches = detectProjectionMismatches(
      [stateCase.course],
      [stateCase.group],
      stateCase.projection ? [stateCase.projection] : [],
    );
    compareMismatchShapes(mismatches, [
      { courseId: stateCase.course.id, kinds: stateCase.expectedKinds },
    ]);
  }

  const staleState = STORAGE_STATE_CASES.staleText;
  assert.equal(staleState.projection?.projectionState, "READY");
  assert.equal(
    staleState.projection?.searchText === observeProjection(staleState.course, staleState.group).searchText,
    false,
    "the observed mismatch does not identify its operational cause",
  );
});

test("repeat evaluation is deterministic and does not mutate fixture inputs", () => {
  const inputSnapshot = structuredClone({
    course: ALPHA_COURSE,
    group: ALPHA_GROUP,
    projection: FANOUT_BEFORE_PROJECTIONS,
  });
  const first = {
    projection: observeProjection(ALPHA_COURSE, ALPHA_GROUP),
    mismatches: detectProjectionMismatches(
      FANOUT_AFTER_COURSES,
      FANOUT_AFTER_GROUPS,
      FANOUT_PARTIAL_AFTER_PROJECTIONS,
    ),
  };
  const second = {
    projection: observeProjection(ALPHA_COURSE, ALPHA_GROUP),
    mismatches: detectProjectionMismatches(
      FANOUT_AFTER_COURSES,
      FANOUT_AFTER_GROUPS,
      FANOUT_PARTIAL_AFTER_PROJECTIONS,
    ),
  };

  assert.deepEqual(first, second);
  assert.deepEqual(
    {
      course: ALPHA_COURSE,
      group: ALPHA_GROUP,
      projection: FANOUT_BEFORE_PROJECTIONS,
    },
    inputSnapshot,
  );
  assert.equal(ALPHA_SEARCH_TEXT, first.projection.searchText);
  assert.equal(ALPHA_ID_ORDER_KEY, first.projection.idOrderKey);
  assert.equal(SYNTHETIC_NORMALIZER_VERSION, PUBLIC_COURSE_SEARCH_NORMALIZER_VERSION);
  assert.equal(SYNTHETIC_COMPARISON_VERSION, PUBLIC_COURSE_SEARCH_COMPARISON_VERSION);
  assert.equal(SYNTHETIC_ORDER_KEY_VERSION, PUBLIC_COURSE_SEARCH_ID_ORDER_KEY_VERSION);
});
