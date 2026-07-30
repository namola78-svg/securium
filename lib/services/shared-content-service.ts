import { AppError } from "../errors.ts";

export type SharedContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SharedContentRecord = {
  id: string;
  status: SharedContentStatus | string;
};

export type CourseLessonScope = {
  id: string;
  courseId: string;
  contentId: string;
  status: SharedContentStatus;
};

export type SharedContentPresentation = {
  contentId: string;
  courseLessonId: string;
  title: string;
  summary: string;
  body: string;
  examPoints: string[];
  practicalNotes: string;
  legalNotes: string;
  standardNotes: string;
  evidenceNotes: string;
  commonMistakes: string;
};

export function normalizeCanonicalKey(value: string) {
  return value.trim().toLowerCase();
}

export function assertContentCanBeLinked(content: SharedContentRecord | null) {
  if (!content) {
    throw new AppError(
      "공통 콘텐츠를 찾을 수 없습니다.",
      404,
      "SHARED_CONTENT_NOT_FOUND",
    );
  }
  if (content.status === "ARCHIVED") {
    throw new AppError(
      "보관된 공통 콘텐츠는 과정 레슨으로 연결할 수 없습니다.",
      409,
      "SHARED_CONTENT_ARCHIVED",
    );
  }
}

export function assertCourseLessonBelongsToCourse(input: {
  courseLesson: CourseLessonScope | null;
  courseId: string;
}) {
  if (!input.courseLesson) {
    throw new AppError(
      "과정 레슨을 찾을 수 없습니다.",
      404,
      "COURSE_LESSON_NOT_FOUND",
    );
  }
  if (input.courseLesson.courseId !== input.courseId) {
    throw new AppError(
      "과정 레슨이 요청한 과정에 속하지 않습니다.",
      403,
      "COURSE_LESSON_SCOPE_MISMATCH",
    );
  }
}

export function createCourseLessonProgressKey(input: {
  userId: string;
  courseId: string;
  courseLessonId: string;
}) {
  return `${input.userId}:${input.courseId}:${input.courseLessonId}`;
}

export function normalizeCourseLessonProgressPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeCourseLessonTimeSpentSeconds(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(31_536_000, Math.round(value)));
}

export function assertCourseLessonCompletionAllowed(input: {
  completionRule: string;
  explicitRequest: boolean;
  progressPercent: number;
}) {
  if (input.completionRule === "SCROLL_END" && input.progressPercent < 90) {
    throw new AppError(
      "본문을 충분히 학습한 뒤 완료할 수 있습니다.",
      400,
      "COURSE_LESSON_SCROLL_REQUIRED",
    );
  }
  if (!input.explicitRequest) {
    throw new AppError(
      "학습 완료 요청을 확인할 수 없습니다.",
      400,
      "COURSE_LESSON_COMPLETION_NOT_CONFIRMED",
    );
  }
}

export function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function mergeCourseLessonPresentation(input: {
  content: {
    id: string;
    title: string;
    summary: string;
    body: string;
  };
  courseLesson: {
    id: string;
    displayTitle: string;
  };
  extension?: {
    additionalBody: string | null;
    examPointsJson: string;
    practicalNotes: string;
    legalNotes: string;
    standardNotes: string;
    evidenceNotes: string;
    commonMistakes: string;
  } | null;
}): SharedContentPresentation {
  return {
    contentId: input.content.id,
    courseLessonId: input.courseLesson.id,
    title: input.courseLesson.displayTitle || input.content.title,
    summary: input.content.summary,
    body: [input.content.body, input.extension?.additionalBody]
      .filter(Boolean)
      .join("\n\n"),
    examPoints: parseJsonArray(input.extension?.examPointsJson),
    practicalNotes: input.extension?.practicalNotes ?? "",
    legalNotes: input.extension?.legalNotes ?? "",
    standardNotes: input.extension?.standardNotes ?? "",
    evidenceNotes: input.extension?.evidenceNotes ?? "",
    commonMistakes: input.extension?.commonMistakes ?? "",
  };
}
