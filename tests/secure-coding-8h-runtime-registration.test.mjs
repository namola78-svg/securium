import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadSecureCoding8HRuntimeModel,
} from "../lib/services/secure-coding-8h-runtime-adapter.ts";
import {
  REGISTRATION_RECORD,
  assertExactRegistrationRow,
  buildCourseGroupLookupSql,
  buildCourseLookupSql,
  buildRegistrationInsertSql,
  classifyExistingCourseRows,
  normalizeCourseRow,
} from "../scripts/register-secure-coding-8h-runtime.mjs";

const registrationContext = {
  id: REGISTRATION_RECORD.id,
  slug: REGISTRATION_RECORD.slug,
  active: false,
  published: false,
  deletedAt: null,
};

function exactDatabaseRow() {
  return {
    id: REGISTRATION_RECORD.id,
    course_group_id: REGISTRATION_RECORD.courseGroupId,
    code: REGISTRATION_RECORD.code,
    slug: REGISTRATION_RECORD.slug,
    name: REGISTRATION_RECORD.name,
    short_name: REGISTRATION_RECORD.shortName,
    description: REGISTRATION_RECORD.description,
    thumbnail_url: null,
    total_levels: REGISTRATION_RECORD.totalLevels,
    passing_score: REGISTRATION_RECORD.passingScore,
    difficulty: REGISTRATION_RECORD.difficulty,
    active: 0,
    published: 0,
    display_order: REGISTRATION_RECORD.displayOrder,
    is_sample: 0,
    deleted_at: null,
  };
}

test("adapter loads the canonical Foundation and derives the approved counts", () => {
  const model = loadSecureCoding8HRuntimeModel({
    runtimeCourse: registrationContext,
    exposure: "registration",
  });

  assert.equal(model.runtimeIdentity.courseId, "developer-secure-coding-8h-python-vibe");
  assert.equal(model.runtimeIdentity.slug, "secure-coding-8h-python-vibe");
  assert.equal(model.foundationIdentity.candidateId, "securium-developer-secure-coding-8h-python-vibe-foundation-v1");
  assert.deepEqual(model.counts, {
    modules: 8,
    minutes: 480,
    objectives: 32,
    questions: 40,
    explanations: 40,
    codeExamples: 8,
    diagnosticTriads: 8,
    practicalSpecs: 8,
    executableLabs: 0,
  });
  assert.deepEqual(model.moduleIds, ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"]);
  assert.equal(model.objectiveIds.length, 32);
  assert.equal(model.questionIds.length, 40);
  assert.deepEqual(model.practicalIds, ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08"]);
  assert.equal(model.practicalStatus, "SPEC_ONLY");
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.foundation), true);
});

test("adapter output is deterministic and keeps the published path gated", () => {
  const first = loadSecureCoding8HRuntimeModel({ runtimeCourse: registrationContext, exposure: "registration" });
  const second = loadSecureCoding8HRuntimeModel({ runtimeCourse: registrationContext, exposure: "registration" });
  assert.deepEqual(first, second);

  assert.throws(
    () => loadSecureCoding8HRuntimeModel({ runtimeCourse: registrationContext, exposure: "server-runtime" }),
    (error) => error?.code === "UNPUBLISHED_ACCESS_DENIED",
  );

  const published = loadSecureCoding8HRuntimeModel({
    runtimeCourse: { ...registrationContext, active: true, published: true },
    exposure: "server-runtime",
  });
  assert.equal(published.exposure, "server-runtime");
});

test("adapter rejects identity, module, and question boundary violations", () => {
  assert.throws(
    () => loadSecureCoding8HRuntimeModel({ runtimeCourse: { ...registrationContext, id: "wrong-course" }, exposure: "registration" }),
    (error) => error?.code === "RUNTIME_IDENTITY_MISMATCH",
  );
  assert.throws(
    () => loadSecureCoding8HRuntimeModel({ runtimeCourse: { ...registrationContext, slug: "wrong-slug" }, exposure: "registration" }),
    (error) => error?.code === "RUNTIME_IDENTITY_MISMATCH",
  );
});

test("registration record is exact, unpublished, and idempotent", () => {
  assert.equal(classifyExistingCourseRows([]), "INSERT_REQUIRED");
  assert.equal(classifyExistingCourseRows([exactDatabaseRow()]), "IDEMPOTENT_NOOP");
  assertExactRegistrationRow(normalizeCourseRow(exactDatabaseRow()));

  const conflictingSlug = exactDatabaseRow();
  conflictingSlug.slug = "another-course";
  assert.throws(
    () => classifyExistingCourseRows([conflictingSlug]),
    (error) => error?.code === "RUNTIME_IDENTITY_MISMATCH",
  );
  assert.throws(
    () => classifyExistingCourseRows([exactDatabaseRow(), exactDatabaseRow()]),
    (error) => error?.code === "IDENTITY_COLLISION",
  );
});

test("provider SQL is fixed to courses identity and cannot publish", () => {
  const d1 = buildRegistrationInsertSql("d1");
  const postgres = buildRegistrationInsertSql("postgres");
  for (const sql of [d1, postgres]) {
    assert.match(sql, /INSERT INTO courses/);
    assert.match(sql, /secure-coding-8h-python-vibe/);
    assert.match(sql, /SECURE_CODING_8H/);
    assert.match(sql, /0|false/);
    assert.doesNotMatch(sql, /ON CONFLICT|OR IGNORE/i);
  }
  assert.match(buildCourseGroupLookupSql(), /course_groups/);
  assert.match(buildCourseLookupSql(), /WHERE id/);
  assert.doesNotMatch(buildCourseLookupSql(), /SELECT \*/);
});

test("registration script has no publication switch and no Foundation payload copy", async () => {
  const source = await readFile(new URL("../scripts/register-secure-coding-8h-runtime.mjs", import.meta.url), "utf8");
  const adapterSource = await readFile(new URL("../lib/services/secure-coding-8h-runtime-adapter.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /--publish|--active|--public|--sample/);
  assert.match(source, /loadSecureCoding8HRuntimeModel/);
  assert.match(source, /validate-secure-coding-8h-foundation\.mjs/);
  assert.doesNotMatch(source, /What should a reviewer identify first/);
  assert.doesNotMatch(source, /TRIAD-SQL|Q01.*prompt|P01.*scenario/);
  assert.doesNotMatch(adapterSource, /What should a reviewer identify first/);
  assert.doesNotMatch(adapterSource, /TRIAD-SQL|Q01.*prompt|P01.*scenario/);
});
