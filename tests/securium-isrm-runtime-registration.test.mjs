import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ISRM_DESIRED_COURSE_STATE,
  ISRM_RUNTIME_REGISTRATION_TARGET,
  assertNoForbiddenRegistrationFlags,
  classifyLegacyDescendants,
  createIsrmRegistrationPlan,
  reconcileIsrmRuntime,
} from "../scripts/securium-isrm-runtime-registration.mjs";

function makeDescendants() {
  const generic = Array.from({ length: 130 }, (_, index) => ({
    id: `generic-${String(index + 1).padStart(3, "0")}`,
    kind: index === 0 ? "enrollment" : "subject",
    courseId: "course-isrm",
    classification: "GENERIC_SAMPLE",
    learnerData: index === 0,
    quarantined: false,
  }));
  const legacy = Array.from({ length: 181 }, (_, index) => ({
    id: `legacy-${String(index + 1).padStart(3, "0")}`,
    kind: "question",
    courseId: "course-isrm",
    classification: "LEGACY_PLACEHOLDER",
    quarantined: false,
  }));
  return [...generic, ...legacy];
}

function makeFixture(kind = "supabase", options = {}) {
  const state = {
    courses: [
      {
        id: "course-isrm",
        code: "ISRM",
        slug: "isrm",
        active: options.published === undefined ? true : options.active ?? true,
        published: options.published === undefined ? true : options.published,
        isSample: options.isSample === undefined ? true : options.isSample,
        deletedAt: null,
      },
    ],
    descendants: makeDescendants(),
  };
  if (options.courses) state.courses = options.courses;
  if (options.descendants) state.descendants = options.descendants;
  const metrics = { transactions: 0, reads: 0, courseWrites: 0, childWrites: 0, learnerWrites: 0 };
  const fixture = {
    kind,
    state,
    metrics,
    transaction: async (callback) => {
      metrics.transactions += 1;
      const working = structuredClone(state);
      const transaction = {
        readIsrmCourseRows: async () => {
          metrics.reads += 1;
          return structuredClone(working.courses);
        },
        readIsrmDescendants: async () => {
          metrics.reads += 1;
          return structuredClone(working.descendants);
        },
        updateIsrmCourseVisibility: async (desired) => {
          metrics.courseWrites += 1;
          Object.assign(working.courses[0], desired);
        },
        quarantineIsrmLegacyChild: async (action) => {
          const child = working.descendants.find((item) => item.id === action.id);
          assert.ok(child, `child ${action.id} exists`);
          assert.notEqual(child.learnerData, true);
          metrics.childWrites += 1;
          if (options.failOnChildId === action.id) throw new Error("synthetic failure");
          child.quarantined = true;
        },
      };
      const result = await callback(transaction);
      state.courses = working.courses;
      state.descendants = working.descendants;
      return result;
    },
  };
  return fixture;
}

test("legacy classification preserves the reviewed 130/181/311 inventory without hard-coded child promotion", () => {
  const result = classifyLegacyDescendants(makeDescendants());
  assert.deepEqual(result.counts, { total: 311, genericSample: 130, legacyPlaceholder: 181, canonical: 0, unknown: 0 });
  assert.equal(result.preservedLearnerRows.length, 1);
  assert.equal(result.mutableRows.length, 310);
});

test("registration plan targets only the existing identity and desired unpublished state", () => {
  const fixture = makeFixture();
  const plan = createIsrmRegistrationPlan({ providerKind: fixture.kind, courseRows: fixture.state.courses, descendants: fixture.state.descendants });
  assert.equal(plan.status, "RECONCILE");
  assert.deepEqual(plan.binding, {
    courseId: "course-isrm",
    code: "ISRM",
    slug: "isrm",
    foundationCourseId: "course-isrm",
    bindingKey: "course-isrm:ISRM:isrm",
  });
  assert.deepEqual(plan.desiredVisibility, ISRM_DESIRED_COURSE_STATE);
  assert.equal(plan.legacy.counts.total, 311);
  assert.equal(plan.legacy.counts.genericSample, 130);
  assert.equal(plan.legacy.counts.legacyPlaceholder, 181);
  assert.equal(plan.legacy.quarantine.length, 310);
  assert.deepEqual(plan.writes, { course: 1, legacyChildren: 310, learnerData: 0, foundationContent: 0, publication: 0 });
  assert.deepEqual(ISRM_RUNTIME_REGISTRATION_TARGET, { courseId: "course-isrm", code: "ISRM", slug: "isrm", foundationCourseId: "course-isrm" });
});

test("atomic disposable reconciliation quarantines legacy content and preserves learner rows", async () => {
  const fixture = makeFixture();
  const result = await reconcileIsrmRuntime(fixture);
  assert.equal(result.status, "RECONCILED");
  assert.deepEqual(fixture.state.courses[0], { id: "course-isrm", code: "ISRM", slug: "isrm", active: true, published: false, isSample: false, deletedAt: null });
  assert.equal(fixture.state.descendants.filter((item) => item.quarantined === true).length, 310);
  assert.equal(fixture.state.descendants.filter((item) => item.learnerData === true && item.quarantined === true).length, 0);
  assert.equal(fixture.metrics.courseWrites, 1);
  assert.equal(fixture.metrics.childWrites, 310);
  assert.equal(fixture.metrics.learnerWrites, 0);
});

test("desired state is idempotent and performs no second writes", async () => {
  const fixture = makeFixture("d1");
  await reconcileIsrmRuntime(fixture);
  const before = { courseWrites: fixture.metrics.courseWrites, childWrites: fixture.metrics.childWrites };
  const result = await reconcileIsrmRuntime(fixture);
  assert.equal(result.status, "NOOP");
  assert.deepEqual({ courseWrites: fixture.metrics.courseWrites, childWrites: fixture.metrics.childWrites }, before);
});

test("unknown descendants fail closed before any mutation and roll back", async () => {
  const fixture = makeFixture("supabase", { descendants: [...makeDescendants(), { id: "mystery", kind: "unknown", courseId: "course-isrm" }] });
  const before = structuredClone(fixture.state);
  await assert.rejects(() => reconcileIsrmRuntime(fixture), (error) => error.code === "UNKNOWN_LEGACY_CHILD");
  assert.deepEqual(fixture.state, before);
  assert.equal(fixture.metrics.courseWrites, 0);
  assert.equal(fixture.metrics.childWrites, 0);
});

test("duplicate, mismatched, and canonical child identities fail closed", async () => {
  const duplicate = makeFixture("supabase", { courses: [{ id: "course-isrm", code: "ISRM", slug: "isrm", active: true, published: true, isSample: true, deletedAt: null }, { id: "course-isrm", code: "ISRM", slug: "isrm", active: true, published: true, isSample: true, deletedAt: null }] });
  await assert.rejects(() => reconcileIsrmRuntime(duplicate), (error) => error.code === "RUNTIME_IDENTITY_CONFLICT");
  const mismatch = makeFixture("supabase", { courses: [{ id: "course-isrm", code: "ISRM", slug: "wrong", active: true, published: true, isSample: true, deletedAt: null }] });
  await assert.rejects(() => reconcileIsrmRuntime(mismatch), (error) => error.code === "COURSE_SLUG_MISMATCH");
  const canonical = makeFixture("supabase", { descendants: [{ id: "canonical", kind: "subject", courseId: "course-isrm", classification: "CANONICAL_FOUNDATION" }] });
  await assert.rejects(() => reconcileIsrmRuntime(canonical), (error) => error.code === "LEGACY_CHILD_CONFLICT");
});

test("transaction failure restores the original disposable fixture", async () => {
  const fixture = makeFixture("supabase", { failOnChildId: "legacy-010" });
  const before = structuredClone(fixture.state);
  await assert.rejects(() => reconcileIsrmRuntime(fixture), (error) => error.code === "TRANSACTION_FAILED");
  assert.deepEqual(fixture.state, before);
});

test("provider parity produces the same identity and visibility plan for Supabase and D1", () => {
  const supabase = makeFixture("supabase");
  const d1 = makeFixture("d1");
  const supabasePlan = createIsrmRegistrationPlan({ providerKind: supabase.kind, courseRows: supabase.state.courses, descendants: supabase.state.descendants });
  const d1Plan = createIsrmRegistrationPlan({ providerKind: d1.kind, courseRows: d1.state.courses, descendants: d1.state.descendants });
  assert.deepEqual({ binding: supabasePlan.binding, desiredVisibility: supabasePlan.desiredVisibility, counts: supabasePlan.legacy.counts }, { binding: d1Plan.binding, desiredVisibility: d1Plan.desiredVisibility, counts: d1Plan.legacy.counts });
});

test("public catalog and guessed slug remain excluded after disposable reconciliation", async () => {
  const fixture = makeFixture();
  await reconcileIsrmRuntime(fixture);
  const published = fixture.state.courses.filter((course) => course.active && course.published && course.deletedAt === null);
  assert.equal(published.some((course) => course.slug === "isrm"), false);
  assert.equal(fixture.state.courses.find((course) => course.slug === "isrm" && course.published)?.id ?? null, null);
});

test("registration has no publication flags and no database wiring", async () => {
  assert.doesNotThrow(() => assertNoForbiddenRegistrationFlags([]));
  for (const flag of ["--publish", "--public", "--activate-public", "--sample", "--force-public"]) {
    assert.throws(() => assertNoForbiddenRegistrationFlags([flag]), (error) => error.code === "PUBLICATION_STATE_CONFLICT");
  }
  const source = await readFile(new URL("../scripts/securium-isrm-runtime-registration.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /provider-factory|db\/repositories|db\/schema|INSERT|DELETE FROM/);
  assert.match(source, /transaction/);
  assert.match(source, /readIsrmCourseRows/);
});

test("registration does not copy Foundation content or create executable practical behavior", async () => {
  const source = await readFile(new URL("../scripts/securium-isrm-runtime-registration.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /isrm-q-v2-|isrm-practical-v2-|shell|sandbox|executor|grading runner/i);
});
