import assert from "node:assert/strict";
import test from "node:test";
import { createMcpACore, McpAError, type McpAReadService } from "../lib/mcp/mcpa-core.ts";

const courses = [
  { id: "course-public", slug: "public-course", code: "PUB", name: "Public Course", shortName: "Public", description: "Canonical public course", active: true, published: true, deletedAt: null, updatedAt: "2026-08-25T00:00:00Z", totalLevels: 1, difficulty: "BEGINNER" },
  { id: "course-draft", slug: "draft-course", code: "DRAFT", name: "Draft Course", shortName: "Draft", description: "Should not escape", active: true, published: false, deletedAt: null, updatedAt: "2026-08-25T00:00:00Z" },
] as const;
const lessons = [{ id: "lesson-1", courseId: "course-public", contentId: "content-1", contentKey: "content.public.lesson-1", title: "Canonical Lesson", summary: "A published lesson", body: "Lesson body", bodyFormat: "MARKDOWN", sortOrder: 1, estimatedMinutes: 10, status: "PUBLISHED" as const, updatedAt: "2026-08-25T00:00:00Z", learningObjectives: ["Understand"] }];
const questions = [{ id: "q-1", title: "Published Question", content: "Which control is public?", type: "SINGLE_CHOICE", difficulty: "EASY", courseId: "course-public", questionVersionId: "qv-1", createdAt: "2026-08-25T00:00:00Z", choices: [{ id: "choice-1", content: "A choice", displayOrder: 1 }] }];
const service: McpAReadService = { listPublishedCourses: async () => courses, getPublicCourseByKey: async (key) => courses.find((course) => course.slug === key && course.published) ?? null, listPublishedLessons: async () => lessons, getPublicLesson: async (_course, key) => lessons.find((lesson) => `lesson:public-course:${encodeURIComponent(lesson.contentKey)}` === key) ?? null, listPublishedQuestions: async ({ questionIds } = {}) => questionIds ? questions.filter((question) => questionIds.includes(question.id)) : questions };
const core = createMcpACore(service);

test("MCPA-01/02 published Course read passes and unpublished Course is excluded", async () => {
  assert.equal((await core.getCourse("public-course")).stableKey, "public-course");
  await assert.rejects(() => core.getCourse("draft-course"), (error: unknown) => error instanceof McpAError && error.code === "NOT_FOUND");
});

test("MCPA-03/04 published Lesson read passes and unpublished lesson cannot escape", async () => {
  const key = `lesson:public-course:${encodeURIComponent(lessons[0].contentKey)}`;
  assert.equal((await core.getLesson("public-course", key)).entityType, "Lesson");
  await assert.rejects(() => core.getLesson("public-course", "lesson:public-course:draft"), (error: unknown) => error instanceof McpAError && error.code === "NOT_FOUND");
});

test("MCPA-05/06 published Question search passes and draft course content is excluded", async () => {
  assert.equal((await core.search({ entityType: "Question", text: "public" })).results.length, 1);
  assert.equal((await core.search({ entityType: "Course", text: "draft" })).results.length, 0);
});

test("MCPA-07 exact stable-key lookup and MCPA-08 ambiguity-safe lexical candidates", async () => {
  assert.equal((await core.getQuestion("question:q-1")).stableKey, "question:q-1");
  const result = await core.search({ text: "public" });
  assert.deepEqual(result.results.map((item) => item.stableKey), [
    "public-course",
    "lesson:public-course:content.public.lesson-1",
    "question:q-1",
  ]);
  const bounded = await core.search({ text: "public", limit: 2 });
  assert.equal(bounded.results.length, 2);
  assert.ok(bounded.nextCursor);
});

test("MCPA-15 result ordering is deterministic and transport-independent", async () => {
  const first = await core.search({ text: "", limit: 50 });
  const second = await core.search({ text: "", limit: 50 });
  assert.deepEqual(first.results.map((item) => item.stableKey), second.results.map((item) => item.stableKey));
});
