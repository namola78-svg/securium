export const SYNTHETIC_COMPARISON_VERSION =
  "public-course-search.comparison.v2" as const;
export const SYNTHETIC_NORMALIZER_VERSION =
  "public-course-search.normalizer.nfkc-trim-ko-lower.v1" as const;
export const SYNTHETIC_ORDER_KEY_VERSION =
  "public-course-search.id-order.utf16-code-unit-hex.v1" as const;

export type SyntheticGroup = Readonly<{
  id: string;
  name: string;
  active: boolean;
  deletedAt: string | null;
}>;

export type SyntheticCourse = Readonly<{
  id: string;
  groupId: string;
  name: string;
  shortName: string;
  publicDescription: string;
  audienceLabel: string;
  active: boolean;
  published: boolean;
  deletedAt: string | null;
  displayOrder: number;
  metadataLabel: string;
  canonicalRevision: string;
}>;

export type SyntheticProjectionState =
  | "READY"
  | "STALE"
  | "BUILDING"
  | "FAILED";

export type SyntheticStoredProjection = Readonly<{
  courseId: string;
  searchText: string;
  idOrderKey: string;
  projectionState: SyntheticProjectionState;
  comparisonVersion?: string;
  normalizerVersion?: string;
  orderKeyVersion?: string;
  sourceRevision?: string;
}>;

export const ALPHA_GROUP: SyntheticGroup = {
  id: "group-alpha",
  name: "Alpha Group",
  active: true,
  deletedAt: null,
};

export const BETA_GROUP: SyntheticGroup = {
  id: "group-beta",
  name: "Beta Group",
  active: true,
  deletedAt: null,
};

export const ALPHA_COURSE: SyntheticCourse = {
  id: "course-alpha",
  groupId: "group-alpha",
  name: "Alpha Course",
  shortName: "Alpha",
  publicDescription: "Public alpha description",
  audienceLabel: "Beginners",
  active: true,
  published: true,
  deletedAt: null,
  displayOrder: 1,
  metadataLabel: "thumbnail-alpha-v1",
  canonicalRevision: "course-alpha:r1",
};

export const ALPHA_SEARCH_TEXT =
  "alpha course alpha alpha group public alpha description beginners";
export const ALPHA_ID_ORDER_KEY =
  "0063006F0075007200730065002D0061006C007000680061";

const readyProjection = (
  courseId: string,
  searchText: string,
  idOrderKey: string,
  sourceRevision: string,
): SyntheticStoredProjection => ({
  courseId,
  searchText,
  idOrderKey,
  projectionState: "READY",
  comparisonVersion: SYNTHETIC_COMPARISON_VERSION,
  normalizerVersion: SYNTHETIC_NORMALIZER_VERSION,
  orderKeyVersion: SYNTHETIC_ORDER_KEY_VERSION,
  sourceRevision,
});

export const SEARCH_FIELD_CHANGE_CASES = [
  {
    label: "name",
    before: ALPHA_COURSE,
    after: {
      ...ALPHA_COURSE,
      name: "Alpha Advanced Course",
      canonicalRevision: "course-alpha:r2-name",
    },
    expectedBeforeSearchText: ALPHA_SEARCH_TEXT,
    expectedAfterSearchText:
      "alpha advanced course alpha alpha group public alpha description beginners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedAffectedCourseIds: ["course-alpha"],
    expectedWriterPolicy: "REQUIRED",
  },
  {
    label: "shortName",
    before: ALPHA_COURSE,
    after: {
      ...ALPHA_COURSE,
      shortName: "Alpha Pro",
      canonicalRevision: "course-alpha:r2-short-name",
    },
    expectedBeforeSearchText: ALPHA_SEARCH_TEXT,
    expectedAfterSearchText:
      "alpha course alpha pro alpha group public alpha description beginners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedAffectedCourseIds: ["course-alpha"],
    expectedWriterPolicy: "REQUIRED",
  },
  {
    label: "groupName",
    before: ALPHA_COURSE,
    after: {
      ...ALPHA_COURSE,
      canonicalRevision: "course-alpha:r2-group-name",
    },
    beforeGroup: ALPHA_GROUP,
    afterGroup: {
      ...ALPHA_GROUP,
      name: "Renamed Group",
    },
    expectedBeforeSearchText: ALPHA_SEARCH_TEXT,
    expectedAfterSearchText:
      "alpha course alpha renamed group public alpha description beginners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedAffectedCourseIds: ["course-alpha"],
    expectedWriterPolicy: "REQUIRED",
  },
  {
    label: "publicDescription",
    before: ALPHA_COURSE,
    after: {
      ...ALPHA_COURSE,
      publicDescription: "Updated public description",
      canonicalRevision: "course-alpha:r2-description",
    },
    expectedBeforeSearchText: ALPHA_SEARCH_TEXT,
    expectedAfterSearchText:
      "alpha course alpha alpha group updated public description beginners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedAffectedCourseIds: ["course-alpha"],
    expectedWriterPolicy: "REQUIRED",
  },
  {
    label: "audienceLabel",
    before: ALPHA_COURSE,
    after: {
      ...ALPHA_COURSE,
      audienceLabel: "Professional Learners",
      canonicalRevision: "course-alpha:r2-audience",
    },
    expectedBeforeSearchText: ALPHA_SEARCH_TEXT,
    expectedAfterSearchText:
      "alpha course alpha alpha group public alpha description professional learners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedAffectedCourseIds: ["course-alpha"],
    expectedWriterPolicy: "REQUIRED",
  },
] as const;

export const METADATA_ONLY_CHANGE = {
  before: ALPHA_COURSE,
  after: {
    ...ALPHA_COURSE,
    displayOrder: 8,
    metadataLabel: "thumbnail-alpha-v2",
    canonicalRevision: "course-alpha:r2-metadata",
  },
  expectedSearchText: ALPHA_SEARCH_TEXT,
  expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
  expectedWriterPolicy: "UNRESOLVED",
} as const;

export const NORMALIZED_EQUIVALENCE_CASES = [
  {
    label: "fullwidth and ASCII name",
    before: {
      ...ALPHA_COURSE,
      name: "Ａｌｐｈａ Course",
      canonicalRevision: "course-alpha:r-fullwidth",
    },
    after: {
      ...ALPHA_COURSE,
      name: "Alpha Course",
      canonicalRevision: "course-alpha:r-ascii",
    },
    expectedSearchText: ALPHA_SEARCH_TEXT,
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedWriterPolicy: "UNRESOLVED",
  },
  {
    label: "decomposed and composed accent",
    before: {
      ...ALPHA_COURSE,
      name: "Cafe\u0301 Course",
      canonicalRevision: "course-alpha:r-decomposed",
    },
    after: {
      ...ALPHA_COURSE,
      name: "Café Course",
      canonicalRevision: "course-alpha:r-composed",
    },
    expectedSearchText:
      "café course alpha alpha group public alpha description beginners",
    expectedIdOrderKey: ALPHA_ID_ORDER_KEY,
    expectedWriterPolicy: "UNRESOLVED",
  },
] as const;

export const FANOUT_COURSE_A1: SyntheticCourse = {
  id: "course-a1",
  groupId: "group-alpha",
  name: "Alpha One",
  shortName: "A1",
  publicDescription: "First public course",
  audienceLabel: "Everyone",
  active: true,
  published: true,
  deletedAt: null,
  displayOrder: 1,
  metadataLabel: "metadata-a1",
  canonicalRevision: "course-a1:r1",
};

export const FANOUT_COURSE_A2: SyntheticCourse = {
  id: "course-a2",
  groupId: "group-alpha",
  name: "Alpha Two",
  shortName: "A2",
  publicDescription: "Second public course",
  audienceLabel: "Everyone",
  active: true,
  published: true,
  deletedAt: null,
  displayOrder: 2,
  metadataLabel: "metadata-a2",
  canonicalRevision: "course-a2:r1",
};

export const FANOUT_COURSE_B1: SyntheticCourse = {
  id: "course-b1",
  groupId: "group-beta",
  name: "Beta One",
  shortName: "B1",
  publicDescription: "Beta public course",
  audienceLabel: "Everyone",
  active: true,
  published: true,
  deletedAt: null,
  displayOrder: 1,
  metadataLabel: "metadata-b1",
  canonicalRevision: "course-b1:r1",
};

export const FANOUT_EXPECTED_BEFORE = {
  "course-a1": "alpha one a1 alpha group first public course everyone",
  "course-a2": "alpha two a2 alpha group second public course everyone",
  "course-b1": "beta one b1 beta group beta public course everyone",
} as const;

export const FANOUT_EXPECTED_AFTER = {
  "course-a1": "alpha one a1 alpha group renamed first public course everyone",
  "course-a2": "alpha two a2 alpha group renamed second public course everyone",
  "course-b1": FANOUT_EXPECTED_BEFORE["course-b1"],
} as const;

export const FANOUT_ID_ORDER_KEYS = {
  "course-a1": "0063006F0075007200730065002D00610031",
  "course-a2": "0063006F0075007200730065002D00610032",
  "course-b1": "0063006F0075007200730065002D00620031",
} as const;

export const FANOUT_BEFORE_GROUPS = [ALPHA_GROUP, BETA_GROUP] as const;
export const FANOUT_AFTER_GROUPS = [
  { ...ALPHA_GROUP, name: "Alpha Group Renamed" },
  BETA_GROUP,
] as const;
export const FANOUT_BEFORE_COURSES = [
  FANOUT_COURSE_A1,
  FANOUT_COURSE_A2,
  FANOUT_COURSE_B1,
] as const;
export const FANOUT_AFTER_COURSES = [
  { ...FANOUT_COURSE_A1, canonicalRevision: "course-a1:r2-group-name" },
  { ...FANOUT_COURSE_A2, canonicalRevision: "course-a2:r2-group-name" },
  FANOUT_COURSE_B1,
] as const;

export const FANOUT_BEFORE_PROJECTIONS = [
  readyProjection(
    "course-a1",
    FANOUT_EXPECTED_BEFORE["course-a1"],
    FANOUT_ID_ORDER_KEYS["course-a1"],
    FANOUT_COURSE_A1.canonicalRevision,
  ),
  readyProjection(
    "course-a2",
    FANOUT_EXPECTED_BEFORE["course-a2"],
    FANOUT_ID_ORDER_KEYS["course-a2"],
    FANOUT_COURSE_A2.canonicalRevision,
  ),
  readyProjection(
    "course-b1",
    FANOUT_EXPECTED_BEFORE["course-b1"],
    FANOUT_ID_ORDER_KEYS["course-b1"],
    FANOUT_COURSE_B1.canonicalRevision,
  ),
] as const;

export const FANOUT_PARTIAL_AFTER_PROJECTIONS = [
  readyProjection(
    "course-a1",
    FANOUT_EXPECTED_AFTER["course-a1"],
    FANOUT_ID_ORDER_KEYS["course-a1"],
    "course-a1:r2-group-name",
  ),
  FANOUT_BEFORE_PROJECTIONS[1],
  FANOUT_BEFORE_PROJECTIONS[2],
] as const;

export const FANOUT_EXPECTED_AFFECTED_COURSE_IDS = [
  "course-a1",
  "course-a2",
] as const;

export const FANOUT_EXPECTED_PARTIAL_MISMATCHES = [
  {
    courseId: "course-a2",
    kinds: ["SEARCH_TEXT", "SOURCE_REVISION"],
  },
] as const;

export const POLICY_COURSE: SyntheticCourse = {
  id: "course-policy",
  groupId: "group-alpha",
  name: "Policy Course",
  shortName: "Policy",
  publicDescription: "Policy description",
  audienceLabel: "Everyone",
  active: true,
  published: true,
  deletedAt: null,
  displayOrder: 3,
  metadataLabel: "policy-metadata",
  canonicalRevision: "course-policy:r1",
};

export const POLICY_SEARCH_TEXT =
  "policy course policy alpha group policy description everyone";
export const POLICY_ID_ORDER_KEY =
  "0063006F0075007200730065002D0070006F006C006900630079";
export const POLICY_PROJECTION = readyProjection(
  POLICY_COURSE.id,
  POLICY_SEARCH_TEXT,
  POLICY_ID_ORDER_KEY,
  POLICY_COURSE.canonicalRevision,
);

export const PUBLIC_POLICY_CASES = [
  {
    label: "public baseline",
    course: POLICY_COURSE,
    group: ALPHA_GROUP,
    expectedPublic: true,
  },
  {
    label: "course unpublished",
    course: { ...POLICY_COURSE, published: false },
    group: ALPHA_GROUP,
    expectedPublic: false,
  },
  {
    label: "course inactive",
    course: { ...POLICY_COURSE, active: false },
    group: ALPHA_GROUP,
    expectedPublic: false,
  },
  {
    label: "course deleted",
    course: { ...POLICY_COURSE, deletedAt: "2026-09-14T00:00:00.000Z" },
    group: ALPHA_GROUP,
    expectedPublic: false,
  },
  {
    label: "group inactive",
    course: POLICY_COURSE,
    group: { ...ALPHA_GROUP, active: false },
    expectedPublic: false,
  },
  {
    label: "group deleted",
    course: POLICY_COURSE,
    group: { ...ALPHA_GROUP, deletedAt: "2026-09-14T00:00:00.000Z" },
    expectedPublic: false,
  },
] as const;

export const RELATIONSHIP_BEFORE = {
  course: {
    ...POLICY_COURSE,
    id: "course-rel",
    groupId: "group-alpha",
    canonicalRevision: "course-rel:r1",
  },
  group: ALPHA_GROUP,
  expectedSearchText:
    "policy course policy alpha group policy description everyone",
  expectedIdOrderKey:
    "0063006F0075007200730065002D00720065006C",
} as const;

export const RELATIONSHIP_AFTER = {
  course: {
    ...RELATIONSHIP_BEFORE.course,
    groupId: "group-beta",
    canonicalRevision: "course-rel:r2-group-rebind",
  },
  group: BETA_GROUP,
  expectedSearchText:
    "policy course policy beta group policy description everyone",
  expectedIdOrderKey: RELATIONSHIP_BEFORE.expectedIdOrderKey,
} as const;

export const VERSION_CASES = [
  {
    label: "all metadata current",
    projection: POLICY_PROJECTION,
    expectedKinds: [],
  },
  {
    label: "normalizer metadata missing",
    projection: {
      ...POLICY_PROJECTION,
      normalizerVersion: undefined,
    },
    expectedKinds: ["VERSION_METADATA"],
  },
  {
    label: "different projection version",
    projection: {
      ...POLICY_PROJECTION,
      comparisonVersion: "public-course-search.comparison.v1",
    },
    expectedKinds: ["VERSION_METADATA"],
  },
  {
    label: "different order-key version",
    projection: {
      ...POLICY_PROJECTION,
      orderKeyVersion: "public-course-search.id-order.utf16-code-unit-hex.v0",
    },
    expectedKinds: ["VERSION_METADATA"],
  },
] as const;

export const STORAGE_STATE_CASES = {
  missing: {
    course: ALPHA_COURSE,
    group: ALPHA_GROUP,
    projection: undefined,
    expectedKinds: ["MISSING_PROJECTION"],
  },
  staleText: {
    course: ALPHA_COURSE,
    group: ALPHA_GROUP,
    projection: readyProjection(
      ALPHA_COURSE.id,
      "old alpha search text",
      ALPHA_ID_ORDER_KEY,
      ALPHA_COURSE.canonicalRevision,
    ),
    expectedKinds: ["SEARCH_TEXT"],
  },
} as const;

export const MISSING_RELATIONSHIP_COURSE = {
  ...RELATIONSHIP_AFTER.course,
  groupId: "group-absent",
} as const;

export const MISSING_RELATIONSHIP_EXPECTATION = {
  kind: "UNRESOLVED_RELATIONSHIP",
  policy: "DO_NOT_FALL_BACK_TO_EMPTY_GROUP_NAME",
} as const;
