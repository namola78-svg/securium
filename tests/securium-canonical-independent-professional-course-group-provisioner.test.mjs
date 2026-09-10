import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP,
  provisionCanonicalIndependentProfessionalCourseGroup,
} from "../lib/services/securium-canonical-independent-professional-course-group-provisioner.ts";

function makeProvider({ kind = "supabase", rows = [], transactional = true } = {}) {
  const state = {
    rows: structuredClone(rows),
    metrics: {
      queries: 0,
      inserts: 0,
      updates: 0,
      deletes: 0,
      transactions: 0,
    },
  };
  let lock = Promise.resolve();

  const matches = (working, parameters) => {
    const [id, code, name] = parameters;
    return working.rows.filter(
      (row) => row.id === id || row.code === code || row.name === name,
    );
  };

  const read = async (working, statement) => {
    const rowsForStatement = matches(working, statement.parameters ?? []);
    state.metrics.queries += 1;
    return {
      rows: structuredClone(rowsForStatement),
      rowCount: rowsForStatement.length,
      metadata: { provider: kind },
    };
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
    if (
      working.rows.some(
        (item) =>
          item.id === row.id || item.code === row.code || item.name === row.name,
      )
    ) {
      throw Object.assign(new Error("unique collision"), { code: "23505" });
    }
    working.rows.push(row);
    state.metrics.inserts += 1;
    return {
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: kind },
    };
  };

  const run = async (callback) => {
    const previous = lock;
    let release;
    lock = new Promise((resolve) => {
      release = resolve;
    });
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
    queryOne: async (statement) =>
      (await read({ rows: state.rows }, statement)).rows[0] ?? null,
    execute: async (statement) =>
      run(async (working) => insert({ rows: working }, statement)),
    transaction: async (statements) => {
      state.metrics.transactions += 1;
      return run(async (working) =>
        statements.map((statement) => {
          const parameters = statement.parameters ?? [];
          const conditional = parameters.length === 11;
          if (conditional && matches({ rows: working }, parameters.slice(8)).length > 0) {
            return {
              affectedRows: 0,
              returnedRows: [],
              metadata: { provider: kind },
            };
          }
          return insert({ rows: working }, {
            ...statement,
            parameters: parameters.slice(0, 8),
          });
        }),
      );
    },
    healthCheck: async () => true,
    state,
  };

  if (transactional) {
    provider.transactional = async (callback) => {
      state.metrics.transactions += 1;
      return run(async (working) =>
        callback({
          query: async (statement) => read({ rows: working }, statement),
          queryOne: async (statement) =>
            (await read({ rows: working }, statement)).rows[0] ?? null,
          execute: async (statement) => insert({ rows: working }, statement),
        }),
      );
    };
  }

  return provider;
}

function canonicalRow(overrides = {}) {
  return {
    id: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.id,
    code: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.code,
    name: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.name,
    description: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.description,
    display_order: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.displayOrder,
    active: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.active,
    is_sample: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.isSample,
    deleted_at: CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP.deletedAt,
    ...overrides,
  };
}

function assertNoMutation(provider) {
  assert.equal(provider.state.metrics.inserts, 0);
  assert.equal(provider.state.metrics.updates, 0);
  assert.equal(provider.state.metrics.deletes, 0);
}

test("exports one fixed frozen canonical authority without override metadata", async () => {
  assert.equal(Object.isFrozen(CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP), true);
  assert.deepEqual(CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP, {
    id: "group-independent",
    code: "INDEPENDENT_PROFESSIONAL",
    name: "독립 전문과정",
    description: "",
    displayOrder: 2,
    active: true,
    isSample: false,
    deletedAt: null,
  });
  assert.equal(provisionCanonicalIndependentProfessionalCourseGroup.length, 2);

  const provider = makeProvider();
  const result = await provisionCanonicalIndependentProfessionalCourseGroup(
    provider,
    "NONPROD",
    { id: "caller-controlled", active: false },
  );
  assert.equal(result.status, "CREATED");
  assert.deepEqual(result.group, CANONICAL_INDEPENDENT_PROFESSIONAL_COURSE_GROUP);
  assert.deepEqual(provider.state.rows, [canonicalRow()]);
});

test("empty Supabase and D1-compatible providers create the same exact row", async () => {
  for (const provider of [makeProvider(), makeProvider({ kind: "d1", transactional: false })]) {
    const result = await provisionCanonicalIndependentProfessionalCourseGroup(
      provider,
      "NONPROD",
    );
    assert.equal(result.status, "CREATED");
    assert.deepEqual(provider.state.rows, [canonicalRow()]);
    assert.equal(provider.state.metrics.inserts, 1);
    assert.equal(provider.state.rows.length, 1);
  }
});

test("exact replay is a NOOP without rewriting the canonical row", async () => {
  const provider = makeProvider({ rows: [canonicalRow()] });
  const result = await provisionCanonicalIndependentProfessionalCourseGroup(
    provider,
    "NONPROD",
  );
  assert.equal(result.status, "NOOP_EXISTING");
  assert.deepEqual(provider.state.rows, [canonicalRow()]);
  assertNoMutation(provider);
});

test("ID collisions fail closed without mutation", async () => {
  for (const row of [canonicalRow({ code: "OTHER" }), canonicalRow({ name: "Other" })]) {
    const provider = makeProvider({ rows: [row] });
    await assert.rejects(
      () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
      (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_ID_COLLISION",
    );
    assert.deepEqual(provider.state.rows, [row]);
    assertNoMutation(provider);
  }
});

test("code and name collisions on other IDs fail closed", async () => {
  const cases = [
    {
      row: canonicalRow({ id: "other-id" }),
      code: "INDEPENDENT_PROFESSIONAL_GROUP_CODE_COLLISION",
    },
    {
      row: canonicalRow({ id: "other-id", code: "OTHER" }),
      code: "INDEPENDENT_PROFESSIONAL_GROUP_NAME_COLLISION",
    },
  ];
  for (const item of cases) {
    const provider = makeProvider({ rows: [item.row] });
    await assert.rejects(
      () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
      (error) => error.code === item.code,
    );
    assertNoMutation(provider);
  }
});

test("multiple and partial identity collisions fail closed", async () => {
  const provider = makeProvider({
    rows: [
      canonicalRow(),
      canonicalRow({ id: "other-id", code: "OTHER" }),
    ],
  });
  await assert.rejects(
    () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
    (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_MULTIPLE_MATCHES",
  );
  assertNoMutation(provider);

  const partialProvider = makeProvider({
    rows: [canonicalRow({ id: "other-id", code: "OTHER" })],
  });
  await assert.rejects(
    () => provisionCanonicalIndependentProfessionalCourseGroup(partialProvider, "NONPROD"),
    (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_NAME_COLLISION",
  );
  assertNoMutation(partialProvider);
});

test("soft-deleted canonical identity requires restore review", async () => {
  const row = canonicalRow({ deleted_at: "2026-01-01T00:00:00Z" });
  const provider = makeProvider({ rows: [row] });
  await assert.rejects(
    () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
    (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_RESTORE_REVIEW_REQUIRED",
  );
  assert.deepEqual(provider.state.rows, [row]);
  assertNoMutation(provider);
});

test("canonical metadata drift fails closed", async () => {
  for (const overrides of [
    { description: "unexpected" },
    { display_order: 3 },
    { active: false },
    { is_sample: true },
  ]) {
    const row = canonicalRow(overrides);
    const provider = makeProvider({ rows: [row] });
    await assert.rejects(
      () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
      (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_METADATA_MISMATCH",
    );
    assert.deepEqual(provider.state.rows, [row]);
    assertNoMutation(provider);
  }
});

test("production and non-NONPROD environments are rejected before persistence", async () => {
  for (const environment of ["PRODUCTION", "DEVELOPMENT"]) {
    const provider = makeProvider();
    await assert.rejects(
      () => provisionCanonicalIndependentProfessionalCourseGroup(provider, environment),
      (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_NONPROD_REQUIRED",
    );
    assert.deepEqual(provider.state.rows, []);
    assertNoMutation(provider);
  }
});

test("concurrent Supabase provisions produce one CREATED and one NOOP", async () => {
  const provider = makeProvider();
  const results = await Promise.all([
    provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
    provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
  ]);
  assert.deepEqual(
    results.map((item) => item.status).sort(),
    ["CREATED", "NOOP_EXISTING"],
  );
  assert.deepEqual(provider.state.rows, [canonicalRow()]);
  assert.equal(provider.state.rows.length, 1);
  assert.equal(provider.state.metrics.inserts, 1);
});

test("provider transactions roll back a failed canonical insert", async () => {
  const provider = makeProvider();
  const originalTransactional = provider.transactional;
  provider.transactional = async (callback) =>
    originalTransactional(async (transaction) =>
      callback({
        ...transaction,
        execute: async (statement) => {
          await transaction.execute(statement);
          throw new Error("forced transaction failure");
        },
      }),
    );
  await assert.rejects(
    () => provisionCanonicalIndependentProfessionalCourseGroup(provider, "NONPROD"),
    (error) => error.code === "INDEPENDENT_PROFESSIONAL_GROUP_PROVISIONING_FAILED",
  );
  assert.deepEqual(provider.state.rows, []);
});
