import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCourseLessonCompletionAllowed,
  normalizeCourseLessonProgressPercent,
  normalizeCourseLessonTimeSpentSeconds,
} from "../lib/services/shared-content-service.ts";

test("CourseLesson progress percent is clamped and rounded on the server", () => {
  assert.equal(normalizeCourseLessonProgressPercent(-10), 0);
  assert.equal(normalizeCourseLessonProgressPercent(42.4), 42);
  assert.equal(normalizeCourseLessonProgressPercent(42.6), 43);
  assert.equal(normalizeCourseLessonProgressPercent(150), 100);
  assert.equal(normalizeCourseLessonProgressPercent(Number.NaN), 0);
});

test("CourseLesson time spent is sanitized on the server", () => {
  assert.equal(normalizeCourseLessonTimeSpentSeconds(-10), 0);
  assert.equal(normalizeCourseLessonTimeSpentSeconds(10.4), 10);
  assert.equal(normalizeCourseLessonTimeSpentSeconds(10.6), 11);
  assert.equal(normalizeCourseLessonTimeSpentSeconds(Number.NaN), 0);
  assert.equal(normalizeCourseLessonTimeSpentSeconds(40_000_000), 31_536_000);
});

test("CourseLesson scroll-end completion requires enough reading progress", () => {
  assert.throws(
    () =>
      assertCourseLessonCompletionAllowed({
        completionRule: "SCROLL_END",
        explicitRequest: true,
        progressPercent: 50,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "COURSE_LESSON_SCROLL_REQUIRED",
  );
  assert.doesNotThrow(() =>
    assertCourseLessonCompletionAllowed({
      completionRule: "SCROLL_END",
      explicitRequest: true,
      progressPercent: 90,
    }),
  );
  assert.doesNotThrow(() =>
    assertCourseLessonCompletionAllowed({
      completionRule: "MANUAL",
      explicitRequest: true,
      progressPercent: 0,
    }),
  );
});
