import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import {
  buildSwSecurityWeaknessRuntimeProjection,
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  type RuntimeCourseIdentity,
} from "@/lib/services/securium-sw-security-weakness-runtime-adapter";
import {
  assertSwFoundationAttemptCourse,
  assertSwFoundationBindingMatches,
  buildSwFoundationQuestionBindingSeeds,
  getSwFoundationQuestionBindingSeed,
  type SwFoundationQuestionBindingRecord,
} from "@/lib/services/securium-sw-security-weakness-foundation-binding";
import { getDb } from ".";
import { foundationQuestionBindings, courses } from "./schema";

function fail(code: string, message: string, status = 409): never {
  throw new AppError(message, status, code);
}

export async function getRuntimeSwCourseIdentity(
  courseId: string,
): Promise<RuntimeCourseIdentity> {
  const [course] = await getDb()
    .select({
      id: courses.id,
      code: courses.code,
      slug: courses.slug,
      name: courses.name,
      active: courses.active,
      published: courses.published,
      isSample: courses.isSample,
      deletedAt: courses.deletedAt,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) {
    fail("COURSE_NOT_FOUND", "The requested course was not found.", 404);
  }
  return {
    ...course,
    bindingKey: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey,
  };
}

function assertBindingRowsMatchExpected(
  seeds: readonly ReturnType<typeof buildSwFoundationQuestionBindingSeeds>[number][],
  rows: readonly SwFoundationQuestionBindingRecord[],
): void {
  const expectedById = new Map(seeds.map((seed) => [seed.id, seed]));
  const seenIds = new Set<string>();
  for (const row of rows) {
    if (seenIds.has(row.id)) {
      fail(
        "SW_FOUNDATION_BINDING_DUPLICATE",
        "Duplicate SW Foundation binding identity detected",
      );
    }
    seenIds.add(row.id);
    const seed = expectedById.get(row.id);
    if (seed) {
      assertSwFoundationBindingMatches(seed, row);
      continue;
    }
    if (
      row.foundationBindingKey === seeds[0]?.foundationBindingKey &&
      row.foundationVersion === seeds[0]?.foundationVersion
    ) {
      fail(
        "SW_FOUNDATION_BINDING_UNKNOWN",
        `Unknown SW Foundation binding question: ${row.foundationQuestionId}`,
      );
    }
  }
  if (seenIds.size !== rows.length) {
    fail(
      "SW_FOUNDATION_BINDING_DUPLICATE",
      "Duplicate SW Foundation binding identity detected",
    );
  }
}

/**
 * Explicit governed provisioning seam. It is never called by a request path
 * and stores only deterministic Foundation identity/version metadata.
 */
export async function registerSwFoundationQuestionBindings(
  courseId: string,
): Promise<readonly SwFoundationQuestionBindingRecord[]> {
  const runtimeCourse = await getRuntimeSwCourseIdentity(courseId);
  const seeds = buildSwFoundationQuestionBindingSeeds(runtimeCourse);
  const rows = await getDb()
    .select()
    .from(foundationQuestionBindings)
    .where(eq(foundationQuestionBindings.courseId, courseId));
  assertBindingRowsMatchExpected(seeds, rows);

  const existingByQuestionId = new Set(
    rows
      .filter(
        (row) =>
          row.foundationBindingKey === seeds[0]?.foundationBindingKey &&
          row.foundationVersion === seeds[0]?.foundationVersion,
      )
      .map((row) => row.foundationQuestionId),
  );
  const missing = seeds.filter(
    (seed) => !existingByQuestionId.has(seed.foundationQuestionId),
  );
  if (missing.length) {
    await getDb().batch(
      missing.map((seed) =>
        getDb().insert(foundationQuestionBindings).values({
          id: seed.id,
          courseId: seed.courseId,
          foundationBindingKey: seed.foundationBindingKey,
          foundationVersion: seed.foundationVersion,
          foundationQuestionId: seed.foundationQuestionId,
          semanticHash: seed.semanticHash,
          lifecycleState: seed.lifecycleState,
        }).onConflictDoNothing({ target: foundationQuestionBindings.id }),
      ) as unknown as Parameters<ReturnType<typeof getDb>["batch"]>[0],
    );
  }

  const registered = await getDb()
    .select()
    .from(foundationQuestionBindings)
    .where(eq(foundationQuestionBindings.courseId, courseId));
  assertBindingRowsMatchExpected(seeds, registered);
  const expectedIds = new Set(seeds.map((seed) => seed.id));
  const exact = registered.filter((row) => expectedIds.has(row.id));
  if (
    exact.length !== seeds.length ||
    new Set(exact.map((row) => row.id)).size !== seeds.length
  ) {
    fail(
      "SW_FOUNDATION_BINDING_CARDINALITY_INVALID",
      "SW Foundation binding registration did not produce exactly 21 bindings",
    );
  }
  return Object.freeze(exact);
}

export async function resolveSwFoundationQuestionBinding(input: Readonly<{
  courseId: string;
  foundationQuestionId: string;
  foundationQuestionBindingId?: string | null;
}>) {
  const runtimeCourse = await getRuntimeSwCourseIdentity(input.courseId);
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  const seed = getSwFoundationQuestionBindingSeed(
    runtimeCourse,
    input.foundationQuestionId,
  );
  if (!input.foundationQuestionBindingId) {
    fail(
      "SW_FOUNDATION_BINDING_REQUIRED",
      "A Foundation question requires an immutable binding identity",
    );
  }
  if (input.foundationQuestionBindingId !== seed.id) {
    fail(
      "SW_FOUNDATION_BINDING_ID_MISMATCH",
      "The Foundation question and binding identity do not match",
    );
  }
  const rows = await getDb()
    .select()
    .from(foundationQuestionBindings)
    .where(
      and(
        eq(foundationQuestionBindings.id, seed.id),
        eq(foundationQuestionBindings.courseId, input.courseId),
      ),
    );
  if (rows.length !== 1) {
    fail(
      rows.length === 0
        ? "SW_FOUNDATION_BINDING_NOT_FOUND"
        : "SW_FOUNDATION_BINDING_AMBIGUOUS",
      `Expected exactly one immutable Foundation binding for ${input.foundationQuestionId}`,
      404,
    );
  }
  const binding = rows[0];
  assertSwFoundationBindingMatches(seed, binding);
  if (binding.lifecycleState !== "ACTIVE") {
    fail(
      "SW_FOUNDATION_BINDING_RETIRED",
      "Retired Foundation bindings cannot receive new attempts",
    );
  }
  const question = projection.questions.find(
    (candidate) => candidate.id === input.foundationQuestionId,
  );
  if (!question) {
    fail(
      "SW_FOUNDATION_QUESTION_NOT_FOUND",
      `Unknown SW Foundation question: ${input.foundationQuestionId}`,
      404,
    );
  }
  return Object.freeze({ runtimeCourse, seed, binding, question });
}

export { assertSwFoundationAttemptCourse };
