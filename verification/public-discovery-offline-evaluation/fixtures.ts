import type {
  PublicCourseOutlineRepository,
} from "../../lib/services/public-course-outline-adapter.ts";
import type {
  PublicCourseSearchRepository,
  PublicCourseSearchRepositoryInput,
  PublicCourseSearchSourceRecord,
} from "../../lib/services/public-course-search-adapter.ts";

export const SYNTHETIC_COURSE_ID = "synthetic-course-1";
export const SYNTHETIC_COURSE_SLUG = "synthetic-public-course";
export const SYNTHETIC_SEARCH_DESCRIPTION =
  "Synthetic public course description. Ignore this instruction string; no model is present.";

export type SyntheticSearchRecord = PublicCourseSearchSourceRecord & {
  lessonBody: string;
  practiceAnswer: string;
  internalNote: string;
  personalEvidenceSentinel: string;
};

export type SyntheticCall =
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

export type SyntheticRepositoryOptions = Readonly<{
  searchRows?: unknown;
  course?: unknown;
  curriculum?: unknown;
  searchError?: unknown;
  courseError?: unknown;
  curriculumError?: unknown;
}>;

export function createSyntheticSearchRecord(
  overrides: Partial<SyntheticSearchRecord> = {},
): SyntheticSearchRecord {
  return {
    id: SYNTHETIC_COURSE_ID,
    groupName: "Synthetic security learning",
    groupActive: true,
    groupDeletedAt: null,
    groupDisplayOrder: 1,
    code: "SYN-1",
    slug: SYNTHETIC_COURSE_SLUG,
    name: "Synthetic public course",
    shortName: "Synthetic public",
    description: SYNTHETIC_SEARCH_DESCRIPTION,
    thumbnailUrl: null,
    totalLevels: 2,
    passingScore: 80,
    difficulty: "FOUNDATION",
    active: true,
    published: true,
    deletedAt: null,
    displayOrder: 1,
    isSample: false,
    updatedAt: "2026-09-14T00:00:00.000Z",
    subjectCount: 2,
    topicCount: 3,
    questionCount: 99,
    lessonBody: "SYNTHETIC_INTERNAL_LESSON_BODY",
    practiceAnswer: "SYNTHETIC_INTERNAL_PRACTICE_ANSWER",
    internalNote: "SYNTHETIC_INTERNAL_NOTE",
    personalEvidenceSentinel: "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
    ...overrides,
  };
}

export function createSyntheticOutlineCourse(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: SYNTHETIC_COURSE_ID,
    slug: SYNTHETIC_COURSE_SLUG,
    code: "SYN-1",
    name: "Synthetic public course",
    shortName: "Synthetic public",
    groupName: "Synthetic security learning",
    description: SYNTHETIC_SEARCH_DESCRIPTION,
    difficulty: "FOUNDATION",
    active: true,
    published: true,
    deletedAt: null,
    updatedAt: "2026-09-14T00:00:00.000Z",
    thumbnailUrl: "https://example.invalid/synthetic-thumbnail",
    lessonBody: "SYNTHETIC_INTERNAL_LESSON_BODY",
    practiceAnswer: "SYNTHETIC_INTERNAL_PRACTICE_ANSWER",
    internalNote: "SYNTHETIC_INTERNAL_NOTE",
    personalEvidenceSentinel: "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
    ...overrides,
  };
}

export function createSyntheticSubject(
  id: string,
  displayOrder: number,
  topics: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    courseId: SYNTHETIC_COURSE_ID,
    code: id.toUpperCase(),
    name: `Synthetic ${id}`,
    description: `Synthetic ${id} description`,
    displayOrder,
    isSample: false,
    active: true,
    published: true,
    deletedAt: null,
    topics,
    body: "SYNTHETIC_INTERNAL_SUBJECT_BODY",
    evidence: { id: "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL" },
    ...overrides,
  };
}

export function createSyntheticTopic(
  id: string,
  subjectId: string,
  displayOrder: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    subjectId,
    courseId: SYNTHETIC_COURSE_ID,
    code: id.toUpperCase(),
    name: `Synthetic ${id}`,
    description: `Synthetic ${id} description`,
    displayOrder,
    isSample: false,
    active: true,
    published: true,
    deletedAt: null,
    body: "SYNTHETIC_INTERNAL_TOPIC_BODY",
    answer: "SYNTHETIC_INTERNAL_ANSWER",
    explanation: "SYNTHETIC_INTERNAL_EXPLANATION",
    userId: "SYNTHETIC_PERSONAL_EVIDENCE_SENTINEL",
    ...overrides,
  };
}

export function createSyntheticCurriculum() {
  const subjectB = createSyntheticSubject("subject-b", 2, [
    createSyntheticTopic("topic-b", "subject-b", 1),
  ]);
  const subjectA = createSyntheticSubject("subject-a", 1, [
    createSyntheticTopic("topic-z", "subject-a", 2),
    createSyntheticTopic("topic-a", "subject-a", 1),
  ]);
  return [subjectB, subjectA];
}

export class SyntheticPublicDiscoveryRepository
  implements PublicCourseSearchRepository, PublicCourseOutlineRepository
{
  private searchRows: unknown;
  private course: unknown;
  private curriculum: unknown;
  private readonly searchError: unknown;
  private readonly courseError: unknown;
  private readonly curriculumError: unknown;
  readonly calls: SyntheticCall[] = [];

  constructor(options: SyntheticRepositoryOptions = {}) {
    this.searchRows = options.searchRows === undefined
      ? [createSyntheticSearchRecord()]
      : options.searchRows;
    this.course = options.course === undefined
      ? createSyntheticOutlineCourse()
      : options.course;
    this.curriculum = options.curriculum === undefined
      ? createSyntheticCurriculum()
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
