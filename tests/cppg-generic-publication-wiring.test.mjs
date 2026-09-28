import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all generic CPPG visibility writes call the shared service guard before persistence", async () => {
  const [revisions, catalog, lessons, shared, curriculum, questions, phase3, specialized, practical] = await Promise.all([
    read("db/content-revision-repositories.ts"),
    read("db/repositories.ts"),
    read("db/lesson-repositories.ts"),
    read("db/shared-content-repositories.ts"),
    read("db/curriculum-repositories.ts"),
    read("db/question-repositories.ts"),
    read("db/phase3-repositories.ts"),
    read("db/specialized-repositories.ts"),
    read("db/practical-specialization-repositories.ts"),
  ]);
  assert.match(revisions, /assertGenericCppgStatusPublicationAllowed[\s\S]*?export async function archiveContentRevision/u);
  assert.match(catalog, /export async function saveCourse\(input: CourseInput\)[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(catalog, /export async function saveCourseGroup\(input: CourseGroupInput\)[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.ok((catalog.match(/assertGenericCppgPublicationAllowed\(/gu) ?? []).length >= 5);
  assert.equal((lessons.match(/assertGenericCppgPublicationAllowed\(/gu) ?? []).length, 2);
  assert.match(shared, /assertGenericCppgStatusPublicationAllowed\([\s\S]*?input\.status[\s\S]*?"PUBLISHED"/u);
  assert.match(shared, /existing\.contentId !== input\.contentId[\s\S]*?assertGenericCppgStatusPublicationAllowed/u);
  assert.match(shared, /export async function saveCourseLessonExtension\([\s\S]*?assertGenericCppgStatusPublicationAllowed/u);
  assert.match(curriculum, /assertGenericCppgStatusPublicationAllowed\([\s\S]*?"ACTIVE"/u);
  assert.match(curriculum, /parseLinkedContent\(values\.metadata\)\.some\([\s\S]*?assertGenericCppgStatusPublicationAllowed/u);
  assert.match(questions, /export async function transitionQuestion\([\s\S]*?assertGenericCppgStatusPublicationAllowed/u);
  assert.match(phase3, /export async function saveLevel\([\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(phase3, /export async function saveMockExam\([\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(phase3, /export async function saveLevelContent\([\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(phase3, /export async function saveMockExamSection\([\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(phase3, /export async function saveMockExamQuestion\([\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(specialized, /case "CONTENT_LINK": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(specialized, /case "ISMS_STANDARD": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(specialized, /case "LEGAL_ARTICLE": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(practical, /case "SECURE_CODE_SAMPLE": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(practical, /case "SECURE_WEAKNESS": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
  assert.match(practical, /case "PRIVACY_SCENARIO": \{[\s\S]*?assertGenericCppgPublicationAllowed/u);
});

test("globally reusable shared-content publication remains outside the CPPG-specific guard", async () => {
  const shared = await read("db/shared-content-repositories.ts");
  const saveContent = shared.slice(shared.indexOf("export async function saveSharedContent"), shared.indexOf("export async function listCourseLessons"));
  assert.doesNotMatch(saveContent, /assertGenericCppg/u);
  assert.match(shared, /assertGenericCppgStatusPublicationAllowed\([\s\S]*?existing\?\.status[\s\S]*?input\.status[\s\S]*?"PUBLISHED"/u);
});

test("curriculum activation reaches the public curriculum path; legacy seed is not canonical authority", async () => {
  const [curriculum, seed, migration] = await Promise.all([
    read("db/curriculum-repositories.ts"),
    read("db/seed.sql"),
    read("db/postgres/migrations/0054_cppg_canonical_registration.sql"),
  ]);
  assert.match(curriculum, /getActiveCurriculumTreeForCourse\(courseId\)/u);
  assert.match(curriculum, /eq\(curriculumNodes\.status, "ACTIVE"\)/u);
  assert.match(seed, /\('course-cppg',[^\n]*, 1, 1,/u);
  assert.match(migration, /"publication_authority" text NOT NULL DEFAULT 'NOT_GRANTED'/u);
  assert.match(migration, /"state" text NOT NULL DEFAULT 'REGISTERED_UNPUBLISHED'/u);
});
