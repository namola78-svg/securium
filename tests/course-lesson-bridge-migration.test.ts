import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const d1Migration = readFileSync(
  "drizzle/0016_course_lesson_lesson_bridge.sql",
  "utf8",
);
const postgresMigration = readFileSync(
  "db/postgres/migrations/0005_course_lesson_lesson_progress.sql",
  "utf8",
);

test("D1 migration bridges legacy Lesson rows into CourseLesson rows", () => {
  assert.match(d1Migration, /ALTER TABLE `course_lessons` ADD `lesson_id`/);
  assert.match(d1Migration, /ALTER TABLE `course_lessons` ADD `unlock_condition`/);
  assert.match(d1Migration, /content-from-lesson-/);
  assert.match(d1Migration, /course-lesson-from-/);
  assert.match(d1Migration, /FROM lessons l/);
  assert.match(d1Migration, /FROM user_lesson_progress ulp/);
  assert.match(d1Migration, /user_course_lesson_progress/);
});

test("PostgreSQL migration keeps CourseLesson bridge and progress fields aligned", () => {
  assert.match(postgresMigration, /ADD COLUMN IF NOT EXISTS "lesson_id"/);
  assert.match(postgresMigration, /course_lessons_lesson_id_lessons_id_fk/);
  assert.match(postgresMigration, /course_lessons_course_lesson_unique/);
  assert.match(postgresMigration, /ADD COLUMN IF NOT EXISTS "last_viewed_at"/);
  assert.match(postgresMigration, /ADD COLUMN IF NOT EXISTS "time_spent_seconds"/);
  assert.match(postgresMigration, /content-from-lesson-/);
  assert.match(postgresMigration, /course-lesson-from-/);
  assert.match(postgresMigration, /0005_course_lesson_lesson_progress/);
});
