import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasPublicLearningContent } from "../lib/services/course-availability.ts";
import { courseLessonHref } from "../lib/services/learning-route.ts";

const repositories = readFileSync("db/repositories.ts", "utf8");
const sharedRepositories = readFileSync("db/shared-content-repositories.ts", "utf8");
const curriculumRepositories = readFileSync("db/curriculum-repositories.ts", "utf8");
const overview = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
const subject = readFileSync("app/learn/[courseSlug]/subjects/[subjectId]/page.tsx", "utf8");
const courseLesson = readFileSync("app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx", "utf8");

test("course availability requires a public canonical lesson", () => {
  assert.equal(
    hasPublicLearningContent({ active: true, published: true, publishedLessonCount: 0 }),
    false,
  );
  assert.equal(
    hasPublicLearningContent({ active: true, published: true, publishedLessonCount: null }),
    false,
  );
  assert.equal(
    hasPublicLearningContent({ active: true, published: true, publishedLessonCount: 1 }),
    true,
  );
  assert.equal(
    hasPublicLearningContent({ active: false, published: true, publishedLessonCount: 1 }),
    false,
  );
  assert.equal(
    hasPublicLearningContent({ active: true, published: false, publishedLessonCount: 1 }),
    false,
  );
});

test("availability projection excludes drafts, unpublished content, and sample content", () => {
  const projection = repositories.slice(
    repositories.indexOf("publishedLessonCount:"),
    repositories.indexOf(".from(courses)", repositories.indexOf("publishedLessonCount:")),
  );
  assert.match(projection, /courseLessons\.status.*PUBLISHED/);
  assert.match(projection, /contents\.status.*PUBLISHED/);
  assert.match(projection, /contents\.canonicalKey.*NOT LIKE 'sample\.%'/);
  assert.match(sharedRepositories, /notLike\(contents\.canonicalKey, "sample\.%"\)/);
  assert.match(curriculumRepositories, /notLike\(contents\.canonicalKey, "sample\.%"\)/);
});

test("overview, subject selection, and lesson navigation use one theory destination", () => {
  const href = courseLessonHref("cppg", "lesson-1");
  assert.equal(href, "/learn/cppg/course-lessons/lesson-1");
  assert.match(overview, /courseLessonHref\(course\.slug, lesson\.id\)/);
  assert.match(subject, /listPublishedCourseLessonsForSubject/);
  assert.match(subject, /courseLessonHref\(course\.slug, lesson\.id\)/);
  assert.doesNotMatch(subject, /\/learn\/\$\{course\.slug\}\/lessons\//);
  assert.match(courseLesson, /courseLessonHref\(courseSlug, (?:previousLesson|nextLesson)\.id\)/);
  assert.doesNotMatch(overview, /getCourseTheoryProgress|legacyTheory/);
});
