import assert from "node:assert/strict";
import test from "node:test";
import { createMcpARequestHandler } from "../lib/mcp/mcpa-adapter.ts";
import { createMcpACore, type McpAReadService } from "../lib/mcp/mcpa-core.ts";

const course = { id: "course-public", slug: "public-course", code: "PUB", name: "Public Course", shortName: "Public", description: "Canonical public course", active: true, published: true, deletedAt: null, updatedAt: "2026-08-25T00:00:00Z" };
const lesson = { id: "lesson-1", courseId: course.id, contentId: "content-1", contentKey: "content.public.lesson-1", title: "Canonical Lesson", summary: "Published lesson", body: "body", bodyFormat: "MARKDOWN", sortOrder: 1, status: "PUBLISHED" as const };
const question = { id: "q-1", title: "Published Question", content: "Which control?", type: "SINGLE_CHOICE", difficulty: "EASY", courseId: course.id, questionVersionId: "qv-1", choices: [{ id: "c-1", content: "Choice", displayOrder: 1 }] };
const service: McpAReadService = { listPublishedCourses: async () => [course], getPublicCourseByKey: async (key) => key === course.slug ? course : null, listPublishedLessons: async () => [lesson], getPublicLesson: async (_key, key) => key === `lesson:public-course:${encodeURIComponent(lesson.contentKey)}` ? lesson : null, listPublishedQuestions: async ({ questionIds } = {}) => questionIds ? (questionIds.includes(question.id) ? [question] : []) : [question] };
const handle = createMcpARequestHandler(createMcpACore(service));

test("MCPA-09 pagination and MCPA-14 malformed input normalize safely", async () => {
  const tooLarge = await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_learning_content", arguments: { limit: 51 } } });
  assert.equal((tooLarge.error as { code: string }).code, "LIMIT_EXCEEDED");
  const malformed = await handle({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search_learning_content", arguments: { cursor: "bad" } } });
  assert.equal((malformed.error as { code: string }).code, "INVALID_CURSOR");
});

test("MCPA-10/12 adapter exposes only two tools and no database escape hatch", async () => {
  const response = await handle({ jsonrpc: "2.0", id: 3, method: "tools/list" });
  const names = (response.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name);
  assert.deepEqual(names, ["search_learning_content", "get_question"]);
});

test("MCPA-13 question detail excludes answer and explanation fields", async () => {
  const response = await handle({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_question", arguments: { stableKey: "question:q-1", detail: "DETAIL" } } });
  const text = JSON.stringify(response);
  assert.match(text, /Published Question/);
  assert.doesNotMatch(text, /answerConfigJson|isCorrect|explanation|wrongAnswerExplanation/);
});

test("MCPA resources are exactly Course and Lesson", async () => {
  const response = await handle({ jsonrpc: "2.0", id: 5, method: "resources/list" });
  assert.equal((response.result as { resources: unknown[] }).resources.length, 2);
});

test("MCPA-14 unsupported method fails without internal leakage", async () => {
  const response = await handle({ jsonrpc: "2.0", id: 6, method: "db/query" });
  assert.equal((response.error as { code: string }).code, "NOT_FOUND");
  assert.doesNotMatch(JSON.stringify(response), /SQL|sqlite|table|stack/i);
});
