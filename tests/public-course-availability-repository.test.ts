import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createPublicCourseAvailabilityRepository,
  listPublicCourseAvailability,
  PUBLIC_COURSE_AVAILABILITY_BATCH_SIZE,
} from "../db/public-course-availability-repository.ts";
import { RepositoryContext } from "../db/repository-adapter/repository-context.ts";
import type {
  DatabaseExecutionResult,
  DatabaseProvider,
  DatabaseQueryResult,
  DatabaseStatement,
} from "../db/provider/database-provider.ts";
import { isPublicCourseAvailable } from "../lib/services/course-availability-display.ts";

test("availability repository returns only minimal flags and deduplicates input", async () => {
  const provider = new RecordingProvider("d1", [
    { courseId: "course-2", hasPublishedQuestion: 0, hasPublishedLessonContent: 1 },
    { courseId: "course-1", hasPublishedQuestion: 1, hasPublishedLessonContent: 0 },
  ]);
  const repository = createPublicCourseAvailabilityRepository(
    new RepositoryContext(provider),
  );

  const result = await repository.listByCourseIds([
    "course-1",
    "course-1",
    "course-2",
  ]);

  assert.deepEqual(result, [
    { courseId: "course-1", hasPublishedQuestion: true, hasPublishedLessonContent: false },
    { courseId: "course-2", hasPublishedQuestion: false, hasPublishedLessonContent: true },
  ]);
  assert.equal(provider.statements.length, 1);
  assert.deepEqual(provider.statements[0]?.parameters, ["course-1", "course-2", 1, 1, 1]);
  assert.doesNotMatch(provider.statements[0]?.sql ?? "", /body|answer|title|summary/i);
  assert.match(provider.statements[0]?.sql ?? "", /questions/);
  assert.match(provider.statements[0]?.sql ?? "", /course_lessons/);
  assert.match(provider.statements[0]?.sql ?? "", /contents/);
});

test("availability repository has an empty-input fast path and bounded set batches", async () => {
  const provider = new RecordingProvider("supabase", [
    { courseId: "course-1", hasPublishedQuestion: 0, hasPublishedLessonContent: 0 },
  ]);
  const context = new RepositoryContext(provider);

  assert.deepEqual(await listPublicCourseAvailability(context, []), []);
  assert.equal(provider.statements.length, 0);

  const ids = Array.from(
    { length: PUBLIC_COURSE_AVAILABILITY_BATCH_SIZE + 1 },
    (_, index) => `course-${index}`,
  );
  await listPublicCourseAvailability(context, ids);
  assert.equal(provider.statements.length, 2);
  assert.match(provider.statements[0]?.sql ?? "", /\$103/);
  assert.match(provider.statements[1]?.sql ?? "", /\$4/);
  assert.equal(provider.statements[0]?.parameters?.length, 103);
  assert.equal(provider.statements[1]?.parameters?.length, 4);
});

test("availability repository rejects invalid input, null flags, and query errors", async () => {
  const provider = new RecordingProvider("d1", [
    { courseId: "course-1", hasPublishedQuestion: null, hasPublishedLessonContent: 0 },
  ]);
  const context = new RepositoryContext(provider);

  await assert.rejects(
    listPublicCourseAvailability(context, ["course-1", ""]),
    (error: unknown) => (error as { code?: string }).code === "PUBLIC_COURSE_AVAILABILITY_INPUT_INVALID",
  );
  await assert.rejects(
    listPublicCourseAvailability(context, ["course-1"]),
    (error: unknown) => (error as { code?: string }).code === "PUBLIC_COURSE_AVAILABILITY_RESULT_INVALID",
  );

  provider.queryError = new Error("fixture query failure");
  await assert.rejects(
    listPublicCourseAvailability(context, ["course-1"]),
    /fixture query failure/,
  );
});

test("the display helper uses availability only and preserves sample content as a valid result", () => {
  assert.equal(
    isPublicCourseAvailable({
      courseId: "course-sample",
      hasPublishedQuestion: true,
      hasPublishedLessonContent: false,
    }),
    true,
  );
  assert.equal(
    isPublicCourseAvailable({
      courseId: "course-outline",
      hasPublishedQuestion: false,
      hasPublishedLessonContent: false,
    }),
    false,
  );
  assert.equal(isPublicCourseAvailable(null), false);
});

test("target callers use the explicit availability result without changing the common course DTO", () => {
  const coursePage = readFileSync("app/courses/page.tsx", "utf8");
  const courseCard = readFileSync("components/course-card.tsx", "utf8");
  const detailPage = readFileSync("app/courses/[courseSlug]/page.tsx", "utf8");
  const repositories = readFileSync("db/repositories.ts", "utf8");

  assert.match(coursePage, /listPublicCourseAvailability/);
  assert.match(coursePage, /isPublicCourseAvailable\(availabilityByCourseId\.get\(course\.id\)\)/);
  assert.match(courseCard, /availability:/);
  assert.match(courseCard, /isPublicCourseAvailable\(availability\)/);
  assert.match(detailPage, /getPublicCourseAvailability\(course\.id\)/);
  assert.match(detailPage, /isPublicCourseAvailable\(availability\)/);
  assert.doesNotMatch(repositories, /publishedLessonCount/);
  assert.doesNotMatch(repositories, /questions\.status.*PUBLISHED/);
});

class RecordingProvider implements DatabaseProvider {
  readonly kind: "d1" | "supabase";
  readonly statements: DatabaseStatement[] = [];
  queryError: Error | undefined;
  private readonly rows: Record<string, unknown>[];

  constructor(kind: "d1" | "supabase", rows: Record<string, unknown>[]) {
    this.kind = kind;
    this.rows = rows;
  }

  async query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<DatabaseQueryResult<Row>> {
    this.statements.push(statement);
    if (this.queryError) throw this.queryError;
    return {
      rows: this.rows as Row[],
      rowCount: this.rows.length,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(): Promise<Row | null> {
    return null;
  }

  async execute(): Promise<DatabaseExecutionResult> {
    return { affectedRows: 0, returnedRows: [], metadata: { provider: this.kind } };
  }

  async transaction(): Promise<DatabaseExecutionResult[]> {
    return [];
  }

  async healthCheck() {
    return true;
  }
}
