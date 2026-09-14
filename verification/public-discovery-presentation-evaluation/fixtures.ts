import type {
  PublicCourseOutlineRepository,
} from "../../lib/services/public-course-outline-adapter.ts";
import type {
  PublicCourseSearchRepository,
  PublicCourseSearchRepositoryInput,
  PublicCourseSearchSourceRecord,
} from "../../lib/services/public-course-search-adapter.ts";
import {
  PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
  type PublicSourceDisclosureProjection,
} from "../../lib/services/public-source-disclosure.ts";

export const COURSE_A_ID = "synthetic-course-a";
export const COURSE_B_ID = "synthetic-course-b";
export const SHARED_COURSE_SLUG = "synthetic-shared-course";
export const COURSE_A_NAME = "Synthetic public course A";
export const COURSE_B_NAME = "Synthetic public course B";
export const COURSE_A_SOURCE_INSTITUTION = "Synthetic Official Institution A";
export const COURSE_B_SOURCE_INSTITUTION = "Synthetic Official Institution B";

export const INTERNAL_SENTINEL = "SYNTHETIC_INTERNAL_SENTINEL";
export const PERSONAL_SENTINEL = "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL";
export const ERROR_SENTINEL = "SYNTHETIC_PROVIDER_ERROR_SENTINEL";

export type PresentationEvaluationCall =
  | Readonly<{
      kind: "search";
      input: PublicCourseSearchRepositoryInput;
    }>
  | Readonly<{
      kind: "course";
      slug: string;
    }>
  | Readonly<{
      kind: "curriculum";
      courseId: string;
    }>;

export type PresentationEvaluationRepositoryOptions = Readonly<{
  searchRows?: unknown;
  course?: unknown;
  curriculum?: unknown;
  searchError?: unknown;
  courseError?: unknown;
  curriculumError?: unknown;
}>;

export function createSearchRecord(
  id: typeof COURSE_A_ID | typeof COURSE_B_ID,
  overrides: Partial<PublicCourseSearchSourceRecord> = {},
): PublicCourseSearchSourceRecord {
  const isCourseA = id === COURSE_A_ID;
  return {
    id,
    groupName: "Synthetic public security learning",
    groupActive: true,
    groupDeletedAt: null,
    groupDisplayOrder: 1,
    code: isCourseA ? "SYN-A" : "SYN-B",
    slug: SHARED_COURSE_SLUG,
    name: isCourseA ? COURSE_A_NAME : COURSE_B_NAME,
    shortName: isCourseA ? "Synthetic A" : "Synthetic B",
    description: `Synthetic public security description ${id}`,
    thumbnailUrl: null,
    totalLevels: 2,
    passingScore: 80,
    difficulty: "FOUNDATION",
    active: true,
    published: true,
    deletedAt: null,
    displayOrder: isCourseA ? 1 : 2,
    isSample: false,
    updatedAt: "2026-09-14T00:00:00.000Z",
    subjectCount: 1,
    topicCount: 1,
    questionCount: 99,
    internalNote: INTERNAL_SENTINEL,
    personalEvidence: PERSONAL_SENTINEL,
    ...overrides,
  } as PublicCourseSearchSourceRecord;
}

export function createOutlineCourse(
  id: typeof COURSE_A_ID | typeof COURSE_B_ID,
  overrides: Record<string, unknown> = {},
) {
  const isCourseA = id === COURSE_A_ID;
  return {
    id,
    slug: SHARED_COURSE_SLUG,
    code: isCourseA ? "SYN-A" : "SYN-B",
    name: isCourseA ? COURSE_A_NAME : COURSE_B_NAME,
    shortName: isCourseA ? "Synthetic A" : "Synthetic B",
    groupName: "Synthetic public security learning",
    description: `Synthetic public security outline ${id}`,
    difficulty: "FOUNDATION",
    active: true,
    published: true,
    deletedAt: null,
    updatedAt: "2026-09-14T00:00:00.000Z",
    internalNote: INTERNAL_SENTINEL,
    personalEvidence: PERSONAL_SENTINEL,
    ...overrides,
  };
}

export function createCurriculum(
  courseId: typeof COURSE_A_ID | typeof COURSE_B_ID,
) {
  const isCourseA = courseId === COURSE_A_ID;
  const subjectId = isCourseA ? "synthetic-subject-a" : "synthetic-subject-b";
  const topicId = isCourseA ? "synthetic-topic-a" : "synthetic-topic-b";
  return [
    {
      id: subjectId,
      courseId,
      code: isCourseA ? "SUB-A" : "SUB-B",
      name: isCourseA ? "Synthetic subject A" : "Synthetic subject B",
      description: "Synthetic public subject",
      displayOrder: 1,
      isSample: false,
      active: true,
      published: true,
      deletedAt: null,
      topics: [
        {
          id: topicId,
          subjectId,
          courseId,
          code: isCourseA ? "TOP-A" : "TOP-B",
          name: isCourseA ? "Synthetic topic A" : "Synthetic topic B",
          description: "Synthetic public topic",
          displayOrder: 1,
          isSample: false,
          active: true,
          published: true,
          deletedAt: null,
          body: INTERNAL_SENTINEL,
          answer: INTERNAL_SENTINEL,
          evidence: PERSONAL_SENTINEL,
        },
      ],
      body: INTERNAL_SENTINEL,
      evidence: PERSONAL_SENTINEL,
    },
  ];
}

export function createCompleteSourceProjection(
  courseId: typeof COURSE_A_ID | typeof COURSE_B_ID,
): PublicSourceDisclosureProjection {
  const isCourseA = courseId === COURSE_A_ID;
  const institutionName = isCourseA
    ? COURSE_A_SOURCE_INSTITUTION
    : COURSE_B_SOURCE_INSTITUTION;
  return {
    projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
    officialSource: {
      institutionName,
      documentTitle: `Synthetic public standard ${courseId}`,
      sourceUrl: `https://example.invalid/sources/${courseId}`,
      editionOrVersion: "Synthetic 2026 edition",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2028-12-31",
      sourceCheckedAt: "2026-09-14",
      reviewStatus: {
        displayLabel: "Synthetic review label",
        scope: "Synthetic display scope",
      },
      reviewedAt: "2026-09-14",
      reviewerDisplayRole: "Synthetic reviewer role",
      sourceId: INTERNAL_SENTINEL,
      internalNote: PERSONAL_SENTINEL,
    },
    securiumExplanation: {
      scope: "Synthetic independent explanation scope",
      sourceHash: INTERNAL_SENTINEL,
    },
  } as unknown as PublicSourceDisclosureProjection;
}

export function createPartialSourceProjection(): PublicSourceDisclosureProjection {
  return {
    projectionKind: PUBLIC_SOURCE_DISCLOSURE_PROJECTION_KIND,
    officialSource: {
      institutionName: "Synthetic partial institution",
      documentTitle: "Synthetic partial document",
    },
    securiumExplanation: null,
  };
}

export class PresentationEvaluationRepository
  implements PublicCourseSearchRepository, PublicCourseOutlineRepository
{
  private searchRows: unknown;
  private course: unknown;
  private curriculum: unknown;
  private readonly searchError: unknown;
  private readonly courseError: unknown;
  private readonly curriculumError: unknown;
  readonly calls: PresentationEvaluationCall[] = [];

  constructor(options: PresentationEvaluationRepositoryOptions = {}) {
    this.searchRows = options.searchRows === undefined
      ? [createSearchRecord(COURSE_A_ID), createSearchRecord(COURSE_B_ID)]
      : options.searchRows;
    this.course = options.course === undefined
      ? createOutlineCourse(COURSE_A_ID)
      : options.course;
    this.curriculum = options.curriculum === undefined
      ? createCurriculum(COURSE_A_ID)
      : options.curriculum;
    this.searchError = options.searchError ?? null;
    this.courseError = options.courseError ?? null;
    this.curriculumError = options.curriculumError ?? null;
  }

  async searchPublicCourses(
    input: PublicCourseSearchRepositoryInput,
  ): Promise<readonly PublicCourseSearchSourceRecord[]> {
    this.calls.push({ kind: "search", input: structuredClone(input) });
    if (this.searchError !== null) throw this.searchError;
    return this.searchRows as readonly PublicCourseSearchSourceRecord[];
  }

  async getPublicCourseBySlug(slug: string): Promise<unknown> {
    this.calls.push({ kind: "course", slug });
    if (this.courseError !== null) throw this.courseError;
    return this.course;
  }

  async listCurriculum(courseId: string): Promise<unknown> {
    this.calls.push({ kind: "curriculum", courseId });
    if (this.curriculumError !== null) throw this.curriculumError;
    return this.curriculum;
  }

  replaceCourse(course: unknown) {
    this.course = course;
  }

  replaceCurriculum(curriculum: unknown) {
    this.curriculum = curriculum;
  }

  snapshotData() {
    return structuredClone({
      searchRows: this.searchRows,
      course: this.course,
      curriculum: this.curriculum,
    });
  }
}
