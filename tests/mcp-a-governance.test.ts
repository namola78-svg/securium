import assert from "node:assert/strict";
import test from "node:test";
import { createMcpACore, type McpAReadService } from "../lib/mcp/mcpa-core.ts";

const publicCourse = { id: "course-public", slug: "public-course", code: "PUB", name: "Public Course", shortName: "Public", description: "Published canonical", active: true, published: true, deletedAt: null, updatedAt: "2026-08-25T00:00:00Z" };
const draftCourse = { id: "course-draft", slug: "developer-secure-coding-8h", code: "SC8H", name: "Secure Coding 8H", shortName: "SC8H", description: "Git-only candidate", active: true, published: false, deletedAt: null };
const service: McpAReadService = { listPublishedCourses: async () => [publicCourse, draftCourse], getPublicCourseByKey: async (key) => key === publicCourse.slug ? publicCourse : null, listPublishedLessons: async () => [], getPublicLesson: async () => null, listPublishedQuestions: async () => [] };
const core = createMcpACore(service);

test("MCPA-11 MUST_EXCLUDE/draft content cannot be emitted", async () => {
  const result = await core.search({ text: "secure coding" });
  assert.equal(result.results.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /developer-secure-coding-8h|Git-only/);
});

test("MCPA-10 no learner-private data is accepted by the public search contract", async () => {
  const result = await core.search({ text: "progress", entityType: "Course" });
  assert.equal(result.results.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /attempt|wrong|analytics|evidence|settings|user_skill_state/i);
});

test("MCPA-12 core has no write or generic SQL operation", () => {
  const names = Object.keys(core).sort();
  assert.deepEqual(names, ["getCourse", "getLesson", "getQuestion", "search"]);
  assert.equal(names.some((name) => /write|insert|update|delete|sql|query/i.test(name)), false);
});

test("MCPA-13 summary/detail context efficiency excludes full bodies from search", async () => {
  const result = await core.search({ entityType: "Course", detail: "SUMMARY" });
  assert.equal(result.results[0]?.detail, undefined);
  assert.equal(result.results[0]?.summary, "Published canonical");
});

test("MCPA-15 traceability identifies canonical source and revision", async () => {
  const result = await core.getCourse("public-course");
  assert.equal(result.sourceAuthority, "published canonical database");
  assert.equal(result.traceability.stableKey, "public-course");
  assert.equal(result.publicationStatus, "PUBLISHED");
});
