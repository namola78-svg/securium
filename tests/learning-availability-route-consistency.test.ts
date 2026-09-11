import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getPublicLearningAvailability,
  hasPublicLearningContent,
  hasPublicTheoryContent,
} from "../lib/services/course-availability.ts";
import { courseLessonHref } from "../lib/services/learning-route.ts";

const repositories = readFileSync("db/repositories.ts", "utf8");
const sharedRepositories = readFileSync("db/shared-content-repositories.ts", "utf8");
const curriculumRepositories = readFileSync("db/curriculum-repositories.ts", "utf8");
const overview = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
const subject = readFileSync("app/learn/[courseSlug]/subjects/[subjectId]/page.tsx", "utf8");
const courseLesson = readFileSync("app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx", "utf8");

test("theory availability requires a public canonical lesson", () => {
  assert.equal(
    hasPublicTheoryContent({ active: true, published: true, publishedLessonCount: 0 }),
    false,
  );
  assert.equal(
    hasPublicTheoryContent({ active: true, published: true, publishedLessonCount: null }),
    false,
  );
  assert.equal(
    hasPublicTheoryContent({ active: true, published: true, publishedLessonCount: 1 }),
    true,
  );
  assert.equal(
    hasPublicTheoryContent({ active: false, published: true, publishedLessonCount: 1 }),
    false,
  );
  assert.equal(
    hasPublicTheoryContent({ active: true, published: false, publishedLessonCount: 1 }),
    false,
  );
});

test("course availability keeps practice-only courses enterable", () => {
  const practiceOnly = {
    active: true,
    published: true,
    publishedLessonCount: 0,
    publishedQuestionCount: 3,
  };
  assert.equal(hasPublicTheoryContent(practiceOnly), false);
  assert.equal(getPublicLearningAvailability(practiceOnly), "PRACTICE");
  assert.equal(hasPublicLearningContent(practiceOnly), true);
  assert.equal(
    getPublicLearningAvailability({
      ...practiceOnly,
      publishedLessonCount: 1,
    }),
    "THEORY",
  );
  assert.equal(
    getPublicLearningAvailability({
      ...practiceOnly,
      publishedQuestionCount: 0,
    }),
    "UNAVAILABLE",
  );
  assert.equal(
    getPublicLearningAvailability({
      ...practiceOnly,
      published: false,
    }),
    "UNAVAILABLE",
  );
});

test("availability projection excludes drafts, unpublished content, and sample content", () => {
  const projection = repositories.slice(
    repositories.indexOf("publishedQuestionCount:"),
    repositories.indexOf(".from(courses)", repositories.indexOf("publishedQuestionCount:")),
  );
  assert.match(projection, /courseLessons\.status.*PUBLISHED/);
  assert.match(projection, /contents\.status.*PUBLISHED/);
  assert.match(projection, /contents\.canonicalKey.*NOT LIKE 'sample\.%'/);
  assert.match(projection, /publishedQuestionCount:/);
  assert.match(projection, /questions\.status.*PUBLISHED/);
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
