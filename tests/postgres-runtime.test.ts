import assert from "node:assert/strict";
import test from "node:test";
import { like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  createPostgresJsExecutor,
  PostgresJsExecutor,
  type PostgresJsClient,
  type PostgresJsFactory,
} from "../db/postgres/postgres-js-executor.ts";
import {
  createPostgreSqlConnectionPlan,
} from "../db/postgres/connection-config.ts";
import {
  DatabaseProviderError,
} from "../db/provider/database-error.ts";
import {
  createRuntimeDatabaseProvider,
} from "../db/provider/provider-factory.ts";
import {
  DrizzleD1CompatibilityDatabase,
  translateD1SqlForProvider,
} from "../db/provider/drizzle-d1-compatibility.ts";
import type {
  DatabaseExecutionResult,
  DatabaseProvider,
  DatabaseQueryResult,
  DatabaseStatement,
} from "../db/provider/database-provider.ts";
import { courses } from "../db/schema.ts";
import { AppError } from "../lib/errors.ts";

const runtimeEnvironment = {
  APP_ENV: "development",
  DB_PROVIDER: "supabase",
  DATABASE_URL:
    "postgresql://pooler:runtime-password-value@pool.example.com:6543/app",
  POSTGRES_MAX_CONNECTIONS: "2",
  POSTGRES_IDLE_TIMEOUT_SECONDS: "15",
  POSTGRES_CONNECT_TIMEOUT_SECONDS: "7",
  POSTGRES_QUERY_TIMEOUT_MS: "1000",
  POSTGRES_SSL_MODE: "require",
};

test("runtime configuration is bounded and migration still requires DIRECT_URL", () => {
  const plan = createPostgreSqlConnectionPlan(runtimeEnvironment, "RUNTIME");
  assert.equal(plan.maxConnectionsPerInstance, 2);
  assert.equal(plan.idleTimeoutSeconds, 15);
  assert.equal(plan.connectTimeoutSeconds, 7);
  assert.equal(plan.queryTimeoutMs, 1000);
  assert.equal(plan.sslMode, "require");
  assert.throws(
    () => createPostgreSqlConnectionPlan(runtimeEnvironment, "MIGRATION"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "POSTGRES_CONFIGURATION_INVALID",
  );
  assert.throws(
    () =>
      createPostgreSqlConnectionPlan(
        {
          ...runtimeEnvironment,
          APP_ENV: "production",
          DATABASE_URL:
            "postgresql://user:runtime-password-value@localhost:5432/app",
        },
        "RUNTIME",
      ),
    AppError,
  );
});

test("runtime factory selects postgres without opening a connection on import", async () => {
  let factoryCalls = 0;
  let queryCalls = 0;
  let capturedOptions: Parameters<PostgresJsFactory>[1] | undefined;
  const client = createFakeClient({
    onQuery: () => {
      queryCalls += 1;
      return rows([{ ok: 1 }], 1);
    },
  });
  const provider = await createRuntimeDatabaseProvider(runtimeEnvironment, {
    postgresModuleLoader: async () => ({
      default: ((url, options) => {
        factoryCalls += 1;
        capturedOptions = options;
        assert.equal(url, runtimeEnvironment.DATABASE_URL);
        return client;
      }) satisfies PostgresJsFactory,
    }),
  });
  assert.equal(provider.kind, "supabase");
  assert.equal(factoryCalls, 1);
  assert.equal(queryCalls, 0);
  assert.equal(capturedOptions?.prepare, false);
  assert.equal(capturedOptions?.max, 2);
  assert.equal(await provider.healthCheck(), true);
  assert.equal(queryCalls, 1);
});

test("query, queryOne, execute and parameter binding preserve common results", async () => {
  const calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const executor = new PostgresJsExecutor(
    createFakeClient({
      onQuery: (sql, parameters) => {
        calls.push({ sql, parameters });
        return rows([{ id: "row-1" }], 3);
      },
    }),
    1000,
  );
  const queryResult = await executor.query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1",
    ["row-1"],
  );
  assert.deepEqual(queryResult, {
    rows: [{ id: "row-1" }],
    rowCount: 3,
  });
  assert.deepEqual(
    await executor.queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1",
      ["row-1"],
    ),
    { id: "row-1" },
  );
  assert.equal(
    (await executor.execute("UPDATE users SET active = $1", [true])).rowCount,
    3,
  );
  assert.deepEqual(calls[0].parameters, ["row-1"]);
  assert.equal(calls[0].sql, "SELECT id FROM users WHERE id = $1");
});

test("transaction commits on success and rolls back on failure", async () => {
  let commits = 0;
  let rollbacks = 0;
  const client = createFakeClient({
    onQuery: () => rows([], 1),
    onCommit: () => {
      commits += 1;
    },
    onRollback: () => {
      rollbacks += 1;
    },
  });
  const executor = new PostgresJsExecutor(client, 1000);
  const result = await executor.transaction(async (transaction) => {
    await transaction.query("UPDATE one SET value = $1", [1]);
    await transaction.query("UPDATE two SET value = $1", [2]);
    return "committed";
  });
  assert.equal(result, "committed");
  assert.equal(commits, 1);
  assert.equal(rollbacks, 0);

  await assert.rejects(
    executor.transaction(async (transaction) => {
      await transaction.query("UPDATE one SET value = $1", [1]);
      throw { code: "25P02" };
    }),
    (error: unknown) =>
      error instanceof DatabaseProviderError &&
      error.category === "transaction_error",
  );
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
});

test("timeout cancels a pending query and returns a safe error", async () => {
  let cancelled = false;
  const never = new Promise<ReturnType<typeof rows>>(() => {});
  const pending = Object.assign(never, {
    cancel: () => {
      cancelled = true;
    },
  });
  const executor = new PostgresJsExecutor(
    createFakeClient({ onQuery: () => pending }),
    20,
  );
  await assert.rejects(
    executor.query("SELECT pg_sleep($1)", [10]),
    (error: unknown) =>
      error instanceof DatabaseProviderError &&
      error.category === "timeout" &&
      error.code === "DATABASE_TIMEOUT",
  );
  assert.equal(cancelled, true);
});

test("PostgreSQL errors are normalized without leaking query parameters", async () => {
  const sensitiveValue = "private-connection-value";
  const executor = new PostgresJsExecutor(
    createFakeClient({
      onQuery: () => Promise.reject({
        code: "23505",
        message: `duplicate ${sensitiveValue}`,
        query: "INSERT INTO users(email) VALUES($1)",
        parameters: [sensitiveValue],
      }),
    }),
    1000,
  );
  let captured: unknown;
  try {
    await executor.execute("INSERT INTO users(email) VALUES($1)", [
      sensitiveValue,
    ]);
  } catch (error) {
    captured = error;
  }
  assert.ok(captured instanceof DatabaseProviderError);
  assert.equal(captured.category, "unique_violation");
  assert.equal(captured.code, "DATABASE_UNIQUE_VIOLATION");
  assert.doesNotMatch(JSON.stringify(captured), new RegExp(sensitiveValue));
  assert.doesNotMatch(captured.message, /INSERT|duplicate/i);
});

test("health check reports false and missing driver fails safely", async () => {
  const executor = new PostgresJsExecutor(
    createFakeClient({
      onQuery: () => Promise.reject({ code: "ECONNREFUSED" }),
    }),
    1000,
  );
  assert.equal(await executor.healthCheck(), false);
  await assert.rejects(
    createPostgresJsExecutor(runtimeEnvironment, async () => {
      throw new Error("module not found at a sensitive path");
    }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "POSTGRES_DRIVER_UNAVAILABLE" &&
      !error.message.includes("sensitive"),
  );
});

test("installed postgres.js driver loads lazily without opening a connection", async () => {
  const executor = await createPostgresJsExecutor(runtimeEnvironment);
  await assert.doesNotReject(executor.close());
});

test("D1 Drizzle compatibility adapter preserves repository reads and parameter binding", async () => {
  const provider = new CompatibilityRecordingProvider([
    { id: "course-1", name: "Course" },
  ]);
  const compatibility = new DrizzleD1CompatibilityDatabase(() => provider);
  const database = drizzle(compatibility, { schema: { courses } });
  const result = await database
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .where(
      like(courses.name, "%course%"),
    )
    .limit(1);

  assert.deepEqual(result, [{ id: "course-1", name: "Course" }]);
  assert.equal(provider.queries.length, 1);
  assert.match(provider.queries[0].sql, /ILIKE/);
  assert.deepEqual(provider.queries[0].parameters, ["%course%", 1]);
});

test("D1 Drizzle batch uses one provider transaction and returns statement results", async () => {
  const provider = new CompatibilityRecordingProvider([]);
  const compatibility = new DrizzleD1CompatibilityDatabase(() => provider);
  const statements = [
    compatibility
      .prepare("UPDATE questions SET title = ? WHERE id = ?")
      .bind("Updated", "question-1"),
    compatibility
      .prepare("DELETE FROM question_choices WHERE question_id = ?")
      .bind("question-1"),
  ];
  const results = await compatibility.batch(statements);

  assert.equal(provider.transactionCount, 1);
  assert.equal(provider.transactionStatements.length, 2);
  assert.deepEqual(provider.transactionStatements[0].parameters, [
    "Updated",
    "question-1",
  ]);
  assert.equal(results[0].meta.changes, 1);
});

test("D1 SQL translation keeps aggregate max and normalizes scalar max and LIKE", () => {
  const translated = translateD1SqlForProvider(
    `SELECT max("score") AS best, max("progress", ?) AS next, 'LIKE' AS label FROM "progress" WHERE "title" LIKE ?`,
  );
  assert.match(translated, /max\("score"\)/);
  assert.match(translated, /greatest\("progress", \?\)/);
  assert.match(translated, /'LIKE' AS label/);
  assert.match(translated, /"title" ILIKE \?/);
});

function rows<Row extends Record<string, unknown>>(
  values: Row[],
  count = values.length,
) {
  return Object.assign(values, { count });
}

function createFakeClient(options: {
  onQuery: (
    sql: string,
    parameters: readonly unknown[],
  ) =>
    | ReturnType<typeof rows>
    | PromiseLike<ReturnType<typeof rows>>;
  onCommit?: () => void;
  onRollback?: () => void;
}): PostgresJsClient {
  return {
    unsafe(sql, parameters) {
      return Promise.resolve(
        options.onQuery(sql, parameters),
      ) as never;
    },
    async begin(callback) {
      try {
        const result = await callback(this);
        options.onCommit?.();
        return result;
      } catch (error) {
        options.onRollback?.();
        throw error;
      }
    },
    async end() {},
  };
}

class CompatibilityRecordingProvider implements DatabaseProvider {
  readonly kind = "supabase" as const;
  readonly queries: DatabaseStatement[] = [];
  readonly transactionStatements: DatabaseStatement[] = [];
  transactionCount = 0;
  private readonly rows: Record<string, unknown>[];

  constructor(rows: Record<string, unknown>[]) {
    this.rows = rows;
  }

  async query<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<DatabaseQueryResult<Row>> {
    this.queries.push(statement);
    return {
      rows: this.rows as Row[],
      rowCount: this.rows.length,
      metadata: { provider: this.kind },
    };
  }

  async queryOne<Row extends Record<string, unknown>>(
    statement: DatabaseStatement,
  ): Promise<Row | null> {
    const result = await this.query<Row>(statement);
    return result.rows[0] ?? null;
  }

  async execute(
    statement: DatabaseStatement,
  ): Promise<DatabaseExecutionResult> {
    this.queries.push(statement);
    return {
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements: readonly DatabaseStatement[]) {
    this.transactionCount += 1;
    this.transactionStatements.push(...statements);
    return statements.map(() => ({
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    }));
  }

  async healthCheck() {
    return true;
  }
}
