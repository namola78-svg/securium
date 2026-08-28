import assert from "node:assert/strict";
import test from "node:test";
import { DrizzleD1CompatibilityDatabase } from "../db/provider/drizzle-d1-compatibility.ts";
import { AppError } from "../lib/errors.ts";

const sentinels = [
  "fake.person@example.test",
  "fake-query-value",
  "fake-db-detail",
  "fake-sql-parameter",
  "fake-token-sentinel",
  "fake-cookie-sentinel",
  "fake-oauth-code-sentinel",
];

function leakingDatabaseError() {
  const error = new Error(`Failed query ${sentinels.join(" ")}`) as Error & {
    query?: string;
    params?: string[];
    detail?: string;
  };
  error.query = "SELECT * FROM users WHERE email = ?";
  error.params = sentinels;
  error.detail = sentinels.join(" ");
  return error;
}

function databaseThatFails(operation: "query" | "transaction") {
  return {
    kind: "supabase" as const,
    queryOne: async () => {
      if (operation === "query") throw leakingDatabaseError();
      return null;
    },
    query: async () => {
      throw leakingDatabaseError();
    },
    execute: async () => {
      throw leakingDatabaseError();
    },
    transaction: async () => {
      throw leakingDatabaseError();
    },
    healthCheck: async () => false,
  };
}

async function captureSafeError(
  action: () => Promise<unknown>,
  expectedCode = "DATABASE_UNKNOWN_ERROR",
) {
  try {
    await action();
    assert.fail("expected a sanitized database error");
  } catch (error) {
    const serialized = JSON.stringify(error);
    for (const sentinel of sentinels) {
      assert.equal(serialized.includes(sentinel), false);
    }
    assert.equal((error as { code?: string }).code, expectedCode);
    assert.equal((error as { status?: number }).status, 500);
  }
}

test("compatibility query boundary removes database error details", async () => {
  const database = new DrizzleD1CompatibilityDatabase(async () =>
    databaseThatFails("query"),
  );
  await captureSafeError(() => database.prepare("SELECT ?").bind(sentinels[1]).all());
});

test("compatibility execute and transaction boundaries remove parameters", async () => {
  const database = new DrizzleD1CompatibilityDatabase(async () =>
    databaseThatFails("transaction"),
  );
  await captureSafeError(() => database.prepare("SELECT ?").bind(sentinels[2]).run());
  await captureSafeError(
    () => database.batch([database.prepare("SELECT ?").bind(sentinels[3])]),
    "DATABASE_TRANSACTION_ERROR",
  );
});

test("compatibility boundary preserves application errors", async () => {
  const database = new DrizzleD1CompatibilityDatabase(async () => ({
    kind: "supabase" as const,
    queryOne: async () => {
      throw new AppError("safe application error", 409, "SAFE_APPLICATION_ERROR");
    },
    query: async () => ({
      rows: [],
      rowCount: 0,
      metadata: { provider: "supabase" as const },
    }),
    execute: async () => ({ affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" as const } }),
    transaction: async () => [],
    healthCheck: async () => false,
  }));
  await assert.rejects(
    () => database.prepare("SELECT 1").first(),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "SAFE_APPLICATION_ERROR" &&
      error.status === 409,
  );
});
