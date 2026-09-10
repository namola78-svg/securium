import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP,
  provisionCanonicalSecurityProfessionalLearningGroup,
} from "../lib/services/securium-canonical-security-professional-learning-group-provisioner.ts";

function makeProvider({ kind = "supabase", rows = [], transactional = true } = {}) {
  const state = {
    rows: structuredClone(rows),
    metrics: { queries: 0, inserts: 0, transactions: 0, courseWrites: 0, descendantWrites: 0, learnerWrites: 0 },
  };
  let lock = Promise.resolve();

  const matches = (working, parameters) => {
    const [id, code, name] = parameters;
    return working.rows.filter((row) => row.id === id || row.code === code || row.name === name);
  };
  const read = async (working, statement) => {
    state.metrics.queries += 1;
    return { rows: matches(working, statement.parameters ?? []), rowCount: matches(working, statement.parameters ?? []).length, metadata: { provider: kind } };
  };
  const insert = (working, statement) => {
    const values = statement.parameters ?? [];
    const row = {
      id: values[0],
      code: values[1],
      name: values[2],
      description: values[3],
      display_order: values[4],
      active: values[5],
      is_sample: values[6],
      deleted_at: values[7],
    };
    if (working.rows.some((item) => item.id === row.id || item.code === row.code || item.name === row.name)) {
      throw Object.assign(new Error("unique collision"), { code: "23505" });
    }
    working.rows.push(row);
    state.metrics.inserts += 1;
    return { affectedRows: 1, returnedRows: [], metadata: { provider: kind } };
  };
  const run = async (callback) => {
    const previous = lock;
    let release;
    lock = new Promise((resolve) => { release = resolve; });
    await previous;
    const working = structuredClone(state.rows);
    try {
      const result = await callback(working);
      state.rows = working;
      return result;
    } finally {
      release();
    }
  };
  const provider = {
    kind,
    query: async (statement) => read({ rows: state.rows }, statement),
    queryOne: async (statement) => (await read({ rows: state.rows }, statement)).rows[0] ?? null,
    execute: async (statement) => run(async (working) => insert({ rows: working }, statement)),
    transaction: async (statements) => {
      state.metrics.transactions += 1;
      return run(async (working) => statements.map((statement) => {
        const parameters = statement.parameters ?? [];
        const isConditional = parameters.length === 11;
        if (isConditional && matches({ rows: working }, parameters.slice(8)).length > 0) {
          return { affectedRows: 0, returnedRows: [], metadata: { provider: kind } };
        }
        return insert({ rows: working }, { ...statement, parameters: parameters.slice(0, 8) });
      }));
    },
    healthCheck: async () => true,
    state,
  };
  if (transactional) {
    provider.transactional = async (callback) => {
      state.metrics.transactions += 1;
      return run(async (working) => callback({
        query: async (statement) => read({ rows: working }, statement),
        queryOne: async (statement) => (await read({ rows: working }, statement)).rows[0] ?? null,
        execute: async (statement) => insert({ rows: working }, statement),
      }));
    };
  }
  return provider;
}

function canonicalRow(overrides = {}) {
  return {
    id: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.id,
    code: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.code,
    name: CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.name,
    description: "",
    display_order: 0,
    active: true,
    is_sample: false,
    deleted_at: null,
    ...overrides,
  };
}

test("creates exactly one fixed canonical group in an empty disposable provider", async () => {
  const provider = makeProvider();
  const result = await provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD");
  assert.equal(result.status, "CREATED");
  assert.deepEqual(result.group, CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP);
  assert.equal(provider.state.rows.length, 1);
  assert.equal(provider.state.metrics.courseWrites, 0);
  assert.equal(provider.state.metrics.descendantWrites, 0);
  assert.equal(provider.state.metrics.learnerWrites, 0);
});

test("exact canonical row is idempotent and produces NOOP without update", async () => {
  const provider = makeProvider({ rows: [canonicalRow()] });
  const result = await provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD");
  assert.equal(result.status, "NOOP_EXISTING");
  assert.equal(provider.state.rows.length, 1);
  assert.equal(provider.state.metrics.inserts, 0);
});

test("ID, code, name, partial, and multiple-match collisions fail closed", async () => {
  const cases = [
    { rows: [canonicalRow({ code: "OTHER" })], code: "SECURITY_GROUP_ID_COLLISION" },
    { rows: [canonicalRow({ id: "other-id" })], code: "SECURITY_GROUP_CODE_COLLISION" },
    { rows: [canonicalRow({ id: "other-id", code: "OTHER" })], code: "SECURITY_GROUP_NAME_COLLISION" },
    { rows: [canonicalRow(), canonicalRow({ id: "other-id", code: "OTHER" })], code: "SECURITY_GROUP_MULTIPLE_MATCHES" },
  ];
  for (const item of cases) {
    const provider = makeProvider({ rows: item.rows });
    await assert.rejects(
      () => provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD"),
      (error) => error.code === item.code,
    );
    assert.equal(provider.state.rows.length, item.rows.length);
  }
});

test("soft-deleted exact identity requires restore review and is never duplicated", async () => {
  const provider = makeProvider({ rows: [canonicalRow({ deleted_at: "2026-01-01T00:00:00Z" })] });
  await assert.rejects(
    () => provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD"),
    (error) => error.code === "SECURITY_GROUP_RESTORE_REVIEW_REQUIRED",
  );
  assert.equal(provider.state.rows.length, 1);
  assert.equal(provider.state.metrics.inserts, 0);
});

test("existing canonical identity with wrong visibility or metadata fails closed", async () => {
  for (const overrides of [{ active: false }, { is_sample: true }, { description: "unexpected" }, { display_order: 4 }]) {
    const provider = makeProvider({ rows: [canonicalRow(overrides)] });
    await assert.rejects(
      () => provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD"),
      (error) => error.code === "SECURITY_GROUP_EXISTING_STATE_CONFLICT",
    );
    assert.equal(provider.state.rows.length, 1);
    assert.equal(provider.state.metrics.inserts, 0);
  }
});

test("fixed visibility and metadata cannot be overridden, and production is rejected", async () => {
  const provider = makeProvider();
  await assert.rejects(
    () => provisionCanonicalSecurityProfessionalLearningGroup(provider, "PRODUCTION"),
    (error) => error.code === "SECURITY_GROUP_NONPROD_REQUIRED",
  );
  assert.equal(provider.state.rows.length, 0);
  assert.equal(CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.active, true);
  assert.equal(CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.isSample, false);
  assert.equal(CANONICAL_SECURITY_PROFESSIONAL_LEARNING_GROUP.deletedAt, null);
});

test("D1-compatible atomic batch path has the same create and replay behavior", async () => {
  const provider = makeProvider({ kind: "d1", transactional: false });
  const first = await provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD");
  const second = await provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD");
  assert.equal(first.status, "CREATED");
  assert.equal(second.status, "NOOP_EXISTING");
  assert.equal(provider.state.rows.length, 1);
  assert.equal(provider.state.metrics.inserts, 1);
});

test("concurrent logical provisions serialize to one canonical row", async () => {
  const provider = makeProvider();
  const results = await Promise.all([
    provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD"),
    provisionCanonicalSecurityProfessionalLearningGroup(provider, "NONPROD"),
  ]);
  assert.deepEqual(results.map((item) => item.status).sort(), ["CREATED", "NOOP_EXISTING"]);
  assert.equal(provider.state.rows.length, 1);
});
