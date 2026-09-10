import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_ISRM_COURSE,
  provisionOrReconcileCanonicalIsrmCourse,
} from "../lib/services/securium-isrm-parent-group-runtime-name-reconciler.ts";
import { CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP } from "../lib/services/securium-canonical-security-professional-learning-group-provisioner.ts";

function groupRow(overrides = {}) {
  return {
    id: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    code: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    name: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
    active: true,
    is_sample: false,
    deleted_at: null,
    ...overrides,
  };
}

function courseRow(overrides = {}) {
  return {
    id: CANONICAL_ISRM_COURSE.id,
    course_group_id: CANONICAL_ISRM_COURSE.courseGroupId,
    code: CANONICAL_ISRM_COURSE.code,
    slug: CANONICAL_ISRM_COURSE.slug,
    name: CANONICAL_ISRM_COURSE.name,
    short_name: CANONICAL_ISRM_COURSE.shortName,
    active: true,
    published: false,
    is_sample: false,
    deleted_at: null,
    ...overrides,
  };
}

function makeProvider({ groups = [groupRow()], courses = [], kind = "supabase", transactional = true, failExecute = false } = {}) {
  const state = { groups: structuredClone(groups), courses: structuredClone(courses), metrics: { queries: 0, inserts: 0, updates: 0, transactions: 0 } };
  let lock = Promise.resolve();

  const matchGroups = (rows, parameters) => {
    const [id, code, name] = parameters;
    return rows.filter((row) => row.id === id || row.code === code || row.name === name);
  };
  const matchCourses = (rows, parameters) => {
    const [id, code, slug] = parameters;
    return rows.filter((row) => row.id === id || row.code === code || row.slug === slug);
  };
  const read = async (working, statement) => {
    state.metrics.queries += 1;
    if (statement.sql.includes("FROM course_groups")) {
      const rows = matchGroups(working.groups, statement.parameters ?? []);
      return { rows: structuredClone(rows), rowCount: rows.length, metadata: { provider: kind } };
    }
    const rows = matchCourses(working.courses, statement.parameters ?? []);
    return { rows: structuredClone(rows), rowCount: rows.length, metadata: { provider: kind } };
  };
  const addCourse = (working, values) => {
    const row = {
      id: values[0], course_group_id: values[1], code: values[2], slug: values[3], name: values[4], short_name: values[5],
      active: values[6], published: values[7], is_sample: values[8], deleted_at: values[9],
    };
    if (working.courses.some((item) => item.id === row.id || item.code === row.code || item.slug === row.slug)) {
      throw Object.assign(new Error("unique collision"), { code: "23505" });
    }
    if (!working.groups.some((item) => item.id === row.course_group_id && item.code === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code && item.name === CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name && item.active && !item.is_sample && item.deleted_at === null)) {
      throw Object.assign(new Error("foreign key/precondition collision"), { code: "23503" });
    }
    working.courses.push(row);
    state.metrics.inserts += 1;
    return { affectedRows: 1, returnedRows: [], metadata: { provider: kind } };
  };
  const updateCourse = (working, values) => {
    const row = working.courses.find((item) => item.id === values[2] && item.code === values[3] && item.slug === values[4] && item.course_group_id === values[5] && item.active && !item.published && !item.is_sample && item.deleted_at === null);
    if (!row) return { affectedRows: 0, returnedRows: [], metadata: { provider: kind } };
    row.name = values[0];
    row.short_name = values[1];
    state.metrics.updates += 1;
    return { affectedRows: 1, returnedRows: [], metadata: { provider: kind } };
  };
  const execute = async (working, statement) => {
    if (failExecute) throw new Error("injected failure");
    if (statement.sql.includes("UPDATE courses")) return updateCourse(working, statement.parameters);
    return addCourse(working, statement.parameters);
  };
  const run = async (callback) => {
    const previous = lock;
    let release;
    lock = new Promise((resolve) => { release = resolve; });
    await previous;
    const working = structuredClone(state);
    try {
      const result = await callback(working);
      state.groups = working.groups;
      state.courses = working.courses;
      return result;
    } finally {
      release();
    }
  };
  const provider = {
    kind,
    query: async (statement) => read(state, statement),
    queryOne: async (statement) => (await read(state, statement)).rows[0] ?? null,
    execute: async (statement) => run((working) => execute(working, statement)),
    transaction: async (statements) => run(async (working) => Promise.all(statements.map((statement) => execute(working, statement)))),
    healthCheck: async () => true,
    state,
  };
  if (transactional) {
    provider.transactional = async (callback) => run(async (working) => callback({
      query: async (statement) => read(working, statement),
      queryOne: async (statement) => (await read(working, statement)).rows[0] ?? null,
      execute: async (statement) => execute(working, statement),
    }));
  }
  return provider;
}

test("empty state creates exactly one canonical course under the existing parent", async () => {
  const provider = makeProvider();
  const result = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  assert.equal(result.status, "CREATED");
  assert.deepEqual(result.course, CANONICAL_ISRM_COURSE);
  assert.deepEqual(provider.state.courses, [courseRow()]);
  assert.equal(provider.state.metrics.inserts, 1);
  assert.equal(provider.state.metrics.updates, 0);
});

test("exact canonical replay is a NOOP", async () => {
  const provider = makeProvider({ courses: [courseRow()] });
  const result = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  assert.equal(result.status, "NOOP_EXISTING");
  assert.deepEqual(result.reconciledFields, []);
  assert.equal(provider.state.metrics.inserts, 0);
  assert.equal(provider.state.metrics.updates, 0);
});

test("safe name and short-name drift uses governed metadata reconciliation only", async () => {
  const provider = makeProvider({ courses: [courseRow({ name: "Legacy ISRM", short_name: "Legacy" })] });
  const result = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  assert.equal(result.status, "GOVERNED_METADATA_RECONCILIATION");
  assert.deepEqual(result.reconciledFields, ["name", "shortName"]);
  assert.deepEqual(provider.state.courses, [courseRow()]);
  assert.equal(provider.state.metrics.updates, 1);
  assert.equal(provider.state.metrics.inserts, 0);
});

test("missing, wrong, soft-deleted, and duplicate parents fail closed", async () => {
  const cases = [
    { groups: [], code: "ISRM_PARENT_GROUP_NOT_FOUND" },
    { groups: [groupRow({ code: "WRONG" })], code: "ISRM_PARENT_GROUP_IDENTITY_CONFLICT" },
    { groups: [groupRow({ deleted_at: "2026-01-01T00:00:00Z" })], code: "ISRM_PARENT_GROUP_RESTORE_REVIEW_REQUIRED" },
    { groups: [groupRow(), groupRow({ id: "other-group", code: "OTHER" })], code: "ISRM_PARENT_GROUP_MULTIPLE_MATCHES" },
  ];
  for (const item of cases) {
    const provider = makeProvider({ groups: item.groups });
    await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"), (error) => error.code === item.code);
    assert.equal(provider.state.courses.length, 0);
  }
});

test("wrong course identity dimensions fail closed", async () => {
  const cases = [
    { id: "course-isrm", code: "OTHER", slug: "isrm", codeExpected: "ISRM_COURSE_ID_COLLISION" },
    { id: "other", code: "ISRM", slug: "other", codeExpected: "ISRM_COURSE_CODE_COLLISION" },
    { id: "other", code: "OTHER", slug: "isrm", codeExpected: "ISRM_COURSE_SLUG_COLLISION" },
  ];
  for (const item of cases) {
    const provider = makeProvider({ courses: [courseRow({ id: item.id, code: item.code, slug: item.slug })] });
    await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"), (error) => error.code === item.codeExpected);
    assert.equal(provider.state.metrics.inserts, 0);
  }
});

test("wrong parent, soft-delete, visibility, and duplicate course states fail closed", async () => {
  const cases = [
    { row: courseRow({ course_group_id: "other-group" }), code: "ISRM_COURSE_WRONG_PARENT" },
    { row: courseRow({ deleted_at: "2026-01-01T00:00:00Z" }), code: "ISRM_COURSE_RESTORE_REVIEW_REQUIRED" },
    { row: courseRow({ published: true }), code: "ISRM_COURSE_VISIBILITY_CONFLICT" },
  ];
  for (const item of cases) {
    const provider = makeProvider({ courses: [item.row] });
    await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"), (error) => error.code === item.code);
    assert.equal(provider.state.metrics.inserts, 0);
    assert.equal(provider.state.metrics.updates, 0);
  }
  const duplicate = makeProvider({ courses: [courseRow(), courseRow({ id: "course-isrm-duplicate" })] });
  await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(duplicate, "NONPROD"), (error) => error.code === "ISRM_COURSE_MULTIPLE_MATCHES");
});

test("name-only rows do not become canonical identity", async () => {
  const provider = makeProvider({ courses: [courseRow({ id: "legacy-name-only", code: "LEGACY", slug: "legacy-name-only" })] });
  const result = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  assert.equal(result.status, "CREATED");
  assert.equal(provider.state.courses.length, 2);
  assert.equal(provider.state.courses.filter((row) => row.id === CANONICAL_ISRM_COURSE.id).length, 1);
});

test("production and arbitrary metadata override attempts are rejected", async () => {
  const provider = makeProvider();
  await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(provider, "PRODUCTION"), (error) => error.code === "ISRM_NONPROD_REQUIRED");
  assert.equal(provider.state.courses.length, 0);
  assert.equal(CANONICAL_ISRM_COURSE.active, true);
  assert.equal(CANONICAL_ISRM_COURSE.published, false);
  assert.equal(CANONICAL_ISRM_COURSE.isSample, false);
});

test("D1-compatible conditional path preserves create and replay semantics", async () => {
  const provider = makeProvider({ kind: "d1", transactional: false });
  const first = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  const second = await provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD");
  assert.equal(first.status, "CREATED");
  assert.equal(second.status, "NOOP_EXISTING");
  assert.equal(provider.state.courses.length, 1);
  assert.equal(provider.state.metrics.inserts, 1);
});

test("concurrent empty-state provisions produce one course", async () => {
  const provider = makeProvider();
  const results = await Promise.all([
    provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"),
    provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"),
  ]);
  assert.deepEqual(results.map((item) => item.status).sort(), ["CREATED", "NOOP_EXISTING"]);
  assert.equal(provider.state.courses.length, 1);
});

test("transaction failure leaves no course row", async () => {
  const provider = makeProvider({ failExecute: true });
  await assert.rejects(() => provisionOrReconcileCanonicalIsrmCourse(provider, "NONPROD"), /transaction failed|failed/i);
  assert.equal(provider.state.courses.length, 0);
});
