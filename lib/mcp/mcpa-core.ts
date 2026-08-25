import { isPublicCourse } from "../services/catalog-service.ts";

export const MCPA_MAX_LIMIT = 50;
export const MCPA_DEFAULT_LIMIT = 10;
export const MCPA_RESOURCE_URIS = [
  "securium://courses/{courseKey}",
  "securium://courses/{courseKey}/lessons/{lessonKey}",
] as const;
export const MCPA_TOOL_NAMES = [
  "search_learning_content",
  "get_question",
] as const;

export type McpAEntityType = "Course" | "Lesson" | "Question";
export type McpADetail = "SUMMARY" | "DETAIL";
export type McpAErrorCode =
  | "NOT_FOUND"
  | "AMBIGUOUS_IDENTITY"
  | "NOT_PUBLISHED"
  | "NOT_AUTHORIZED"
  | "GOVERNANCE_BLOCKED"
  | "INVALID_CURSOR"
  | "LIMIT_EXCEEDED";

export type McpARevision = Readonly<{
  value: string;
  asOf?: string;
}>;

export type McpATraceability = Readonly<{
  stableKey: string;
  sourceAuthority: "published canonical database";
  revision: McpARevision;
  match: "EXACT_KEY" | "LEXICAL" | "FILTERED" | "RESOURCE";
}>;

export type McpAResult = Readonly<{
  entityType: McpAEntityType;
  stableKey: string;
  title: string;
  summary: string;
  publicationStatus: "PUBLISHED";
  revision: McpARevision;
  sourceAuthority: "published canonical database";
  navigationTarget: string;
  relationship?: Readonly<Record<string, string>>;
  traceability: McpATraceability;
  detail?: Readonly<Record<string, unknown>>;
}>;

export type McpASearchInput = Readonly<{
  text?: string;
  entityType?: McpAEntityType;
  courseKey?: string;
  publicationStatus?: "PUBLISHED";
  limit?: number;
  cursor?: string;
  detail?: McpADetail;
}>;

export type McpACourse = Readonly<{
  id: string;
  slug: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  active: boolean;
  published: boolean;
  deletedAt: string | null;
  updatedAt?: string;
  totalLevels?: number;
  difficulty?: string;
}>;

export type McpALesson = Readonly<{
  id: string;
  courseId: string;
  contentId: string;
  contentKey: string;
  title: string;
  summary: string;
  body?: string;
  bodyFormat?: string;
  sortOrder: number;
  estimatedMinutes?: number;
  status: "PUBLISHED";
  updatedAt?: string;
  learningObjectives?: readonly string[];
}>;

export type McpAQuestion = Readonly<{
  id: string;
  title: string;
  content: string;
  type: string;
  difficulty: string;
  courseId: string;
  questionVersionId?: string | null;
  questionVersionSemanticHash?: string | null;
  createdAt?: string;
  choices?: readonly Readonly<{ id?: string; content: string; displayOrder: number }>[];
}>;

export type McpAReadService = Readonly<{
  listPublishedCourses(): Promise<readonly McpACourse[]>;
  getPublicCourseByKey(courseKey: string): Promise<McpACourse | null>;
  listPublishedLessons(course: McpACourse): Promise<readonly McpALesson[]>;
  getPublicLesson(courseKey: string, lessonKey: string): Promise<McpALesson | null>;
  listPublishedQuestions(input: Readonly<{ courseId?: string; questionIds?: readonly string[] }>): Promise<readonly McpAQuestion[]>;
}>;

export class McpAError extends Error {
  readonly code: McpAErrorCode;

  constructor(code: McpAErrorCode, message: string = code) {
    super(message);
    this.name = "McpAError";
    this.code = code;
  }
}

function assertPublicationStatus(status: string | undefined) {
  if (status !== undefined && status !== "PUBLISHED") {
    throw new McpAError("NOT_PUBLISHED", "MCP-A only supports published content.");
  }
}

function assertLimit(limit: number | undefined) {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new McpAError("LIMIT_EXCEEDED", "Limit must be a positive integer.");
  }
  if (limit !== undefined && limit > MCPA_MAX_LIMIT) {
    throw new McpAError("LIMIT_EXCEEDED", `Limit cannot exceed ${MCPA_MAX_LIMIT}.`);
  }
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function encodeCursor(value: Readonly<{ fingerprint: string; offset: number }>) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeCursor(cursor: string | undefined, fingerprint: string) {
  if (!cursor) return 0;
  try {
    const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(cursor.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as {
      fingerprint?: string;
      offset?: number;
    };
    if (decoded.fingerprint !== fingerprint || !Number.isInteger(decoded.offset) || (decoded.offset ?? -1) < 0) {
      throw new Error("cursor mismatch");
    }
    return decoded.offset ?? 0;
  } catch {
    throw new McpAError("INVALID_CURSOR", "Cursor is invalid for this request.");
  }
}

function fingerprint(input: McpASearchInput) {
  return JSON.stringify({
    text: normalizeText(input.text),
    entityType: input.entityType ?? null,
    courseKey: input.courseKey ?? null,
    publicationStatus: "PUBLISHED",
    detail: input.detail ?? "SUMMARY",
  });
}

function courseKey(course: McpACourse) {
  return course.slug;
}

function lessonKey(course: McpACourse, lesson: McpALesson) {
  return `lesson:${encodeURIComponent(courseKey(course))}:${encodeURIComponent(lesson.contentKey)}`;
}

function questionKey(question: McpAQuestion) {
  return `question:${encodeURIComponent(question.id)}`;
}

function revision(value: string | number | undefined, asOf: string | undefined) {
  return { value: String(value ?? "canonical"), ...(asOf ? { asOf } : {}) };
}

function courseResult(course: McpACourse, detail: McpADetail, match: McpATraceability["match"]): McpAResult {
  const stableKey = courseKey(course);
  if (!isPublicCourse(course)) throw new McpAError("NOT_PUBLISHED", "Course is not publicly published.");
  return {
    entityType: "Course",
    stableKey,
    title: course.name,
    summary: course.description,
    publicationStatus: "PUBLISHED",
    revision: revision(course.updatedAt, course.updatedAt),
    sourceAuthority: "published canonical database",
    navigationTarget: `/courses/${encodeURIComponent(stableKey)}`,
    traceability: { stableKey, sourceAuthority: "published canonical database", revision: revision(course.updatedAt, course.updatedAt), match },
    ...(detail === "DETAIL" ? { detail: { code: course.code, shortName: course.shortName, totalLevels: course.totalLevels, difficulty: course.difficulty } } : {}),
  };
}

function lessonResult(course: McpACourse, lesson: McpALesson, detail: McpADetail, match: McpATraceability["match"]): McpAResult {
  if (!isPublicCourse(course) || lesson.status !== "PUBLISHED") throw new McpAError("NOT_PUBLISHED", "Lesson is not publicly published.");
  const stableKey = lessonKey(course, lesson);
  const currentRevision = revision(lesson.updatedAt, lesson.updatedAt);
  return {
    entityType: "Lesson",
    stableKey,
    title: lesson.title,
    summary: lesson.summary,
    publicationStatus: "PUBLISHED",
    revision: currentRevision,
    sourceAuthority: "published canonical database",
    navigationTarget: `/courses/${encodeURIComponent(courseKey(course))}/lessons/${encodeURIComponent(stableKey)}`,
    relationship: { courseKey: courseKey(course) },
    traceability: { stableKey, sourceAuthority: "published canonical database", revision: currentRevision, match },
    ...(detail === "DETAIL" ? { detail: { body: lesson.body ?? "", bodyFormat: lesson.bodyFormat ?? "PLAIN_TEXT", order: lesson.sortOrder, estimatedMinutes: lesson.estimatedMinutes, learningObjectives: lesson.learningObjectives ?? [] } } : {}),
  };
}

function questionResult(course: McpACourse, question: McpAQuestion, detail: McpADetail, match: McpATraceability["match"]): McpAResult {
  if (!isPublicCourse(course)) throw new McpAError("NOT_PUBLISHED", "Question course is not publicly published.");
  const stableKey = questionKey(question);
  const currentRevision = revision(question.questionVersionId ?? "canonical", question.createdAt);
  return {
    entityType: "Question",
    stableKey,
    title: question.title,
    summary: question.content.slice(0, 240),
    publicationStatus: "PUBLISHED",
    revision: currentRevision,
    sourceAuthority: "published canonical database",
    navigationTarget: `/questions/${encodeURIComponent(stableKey)}`,
    relationship: { courseKey: courseKey(course) },
    traceability: { stableKey, sourceAuthority: "published canonical database", revision: currentRevision, match },
    ...(detail === "DETAIL" ? { detail: { stem: question.content, type: question.type, difficulty: question.difficulty, choices: (question.choices ?? []).map(({ id, content, displayOrder }) => ({ id, content, displayOrder })) } } : {}),
  };
}

function matches(text: string, values: readonly string[]) {
  if (!text) return true;
  return values.some((value) => normalizeText(value).includes(text));
}

function sortResults(results: readonly McpAResult[]) {
  const order: Record<McpAEntityType, number> = { Course: 0, Lesson: 1, Question: 2 };
  return [...results].sort((left, right) => order[left.entityType] - order[right.entityType] || left.stableKey.localeCompare(right.stableKey));
}

export function createMcpACore(service: McpAReadService) {
  async function getCourse(courseKeyValue: string, detail: McpADetail = "DETAIL") {
    const course = await service.getPublicCourseByKey(courseKeyValue);
    if (!course) throw new McpAError("NOT_FOUND", "Published course was not found.");
    return courseResult(course, detail, "RESOURCE");
  }

  async function getLesson(courseKeyValue: string, lessonKeyValue: string, detail: McpADetail = "DETAIL") {
    const lesson = await service.getPublicLesson(courseKeyValue, lessonKeyValue);
    if (!lesson) throw new McpAError("NOT_FOUND", "Published lesson was not found.");
    const course = await service.getPublicCourseByKey(courseKeyValue);
    if (!course) throw new McpAError("NOT_FOUND", "Published course was not found.");
    return lessonResult(course, lesson, detail, "RESOURCE");
  }

  async function getQuestion(questionKeyValue: string, detail: McpADetail = "DETAIL") {
    const id = questionKeyValue.startsWith("question:") ? decodeURIComponent(questionKeyValue.slice("question:".length)) : "";
    if (!id) throw new McpAError("AMBIGUOUS_IDENTITY", "Question stable key is required.");
    const questions = await service.listPublishedQuestions({ questionIds: [id] });
    const question = questions[0];
    if (!question) throw new McpAError("NOT_FOUND", "Published question was not found.");
    const courses = await service.listPublishedCourses();
    const course = courses.find((candidate) => candidate.id === question.courseId);
    if (!course || !isPublicCourse(course)) throw new McpAError("NOT_PUBLISHED", "Question course is not publicly published.");
    return questionResult(course, question, detail, "EXACT_KEY");
  }

  async function search(input: McpASearchInput = {}) {
    assertPublicationStatus(input.publicationStatus);
    assertLimit(input.limit);
    if (input.entityType && !["Course", "Lesson", "Question"].includes(input.entityType)) throw new McpAError("NOT_FOUND", "Entity type is unsupported.");
    const limit = input.limit ?? MCPA_DEFAULT_LIMIT;
    const text = normalizeText(input.text);
    const detail = input.detail ?? "SUMMARY";
    const fingerprintValue = fingerprint(input);
    const offset = decodeCursor(input.cursor, fingerprintValue);
    const courses = (await service.listPublishedCourses()).filter(isPublicCourse).filter((course) => !input.courseKey || courseKey(course) === input.courseKey);
    const results: McpAResult[] = [];
    if (!input.entityType || input.entityType === "Course") {
      for (const course of courses) if (matches(text, [courseKey(course), course.name, course.description])) results.push(courseResult(course, detail, text === normalizeText(courseKey(course)) ? "EXACT_KEY" : "LEXICAL"));
    }
    if (!input.entityType || input.entityType === "Lesson") {
      for (const course of courses) for (const lesson of await service.listPublishedLessons(course)) if (lesson.status === "PUBLISHED" && matches(text, [lessonKey(course, lesson), lesson.title, lesson.summary])) results.push(lessonResult(course, lesson, detail, "LEXICAL"));
    }
    if (!input.entityType || input.entityType === "Question") {
      const questions = await service.listPublishedQuestions({ courseId: input.courseKey ? courses[0]?.id : undefined });
      const courseById = new Map(courses.map((course) => [course.id, course]));
      const seen = new Set<string>();
      for (const question of questions) {
        const course = courseById.get(question.courseId);
        const key = questionKey(question);
        if (!course || seen.has(key) || !matches(text, [key, question.title, question.content])) continue;
        seen.add(key);
        results.push(questionResult(course, question, detail, "LEXICAL"));
      }
    }
    const sorted = sortResults(results);
    const page = sorted.slice(offset, offset + limit);
    return {
      results: page,
      nextCursor: offset + limit < sorted.length ? encodeCursor({ fingerprint: fingerprintValue, offset: offset + limit }) : null,
      contractVersion: "MCPA_V1",
      asOf: new Date().toISOString(),
      warnings: [] as readonly string[],
    };
  }

  return Object.freeze({ getCourse, getLesson, getQuestion, search });
}

export type McpACore = ReturnType<typeof createMcpACore>;
