import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createPostgreSqlConnectionPlan,
  validatePostgreSqlEnvironment,
} from "../db/postgres/connection-config.ts";
import {
  createDatabaseProvider,
  resolveDatabaseProviderName,
} from "../db/provider/provider-factory.ts";
import type { DatabaseValue } from "../db/provider/database-provider.ts";
import { buildSearchPredicate } from "../db/provider/search-dialect.ts";
import {
  PostgresDatabaseProvider,
  normalizePostgresStatement,
  type PostgresExecutor,
} from "../db/provider/postgres-database-provider.ts";
import { validateRuntimeEnvironment } from "../lib/environment.ts";
import { AppError } from "../lib/errors.ts";
import {
  validateEmbeddingVector,
  type VectorRetrievalProvider,
} from "../lib/ai/retrieval-provider.ts";
import {
  ServerStorageAuthorizationPolicy,
  validateStorageUpload,
} from "../lib/storage/storage-policy.ts";
import {
  LocalStorageProvider,
  SupabaseStorageProvider,
  createStorageProvider,
} from "../lib/storage/storage-provider.ts";

const manager = {
  actor: { userId: "admin-1", roles: ["ADMIN"] },
};

test("PostgreSQL runtime and migration URLs have separate plans", () => {
  const environment = {
    DATABASE_URL:
      "postgresql://pooler:runtime-password-value@pool.example.com:6543/app",
    DIRECT_URL:
      "postgresql://owner:migration-password-value@db.example.com:5432/app",
  };
  const runtime = createPostgreSqlConnectionPlan(environment, "RUNTIME");
  const migration = createPostgreSqlConnectionPlan(environment, "MIGRATION");
  assert.equal(runtime.url, environment.DATABASE_URL);
  assert.equal(runtime.pooled, true);
  assert.equal(runtime.preparedStatements, false);
  assert.equal(migration.url, environment.DIRECT_URL);
  assert.equal(migration.pooled, false);
});

test("PostgreSQL runtime URL is independent from the migration URL", () => {
  assert.doesNotThrow(() =>
    validatePostgreSqlEnvironment({
      DATABASE_URL:
        "postgresql://user:runtime-password-value@pool.example.com/app",
    }),
  );
  assert.throws(
    () =>
      validatePostgreSqlEnvironment({
        DATABASE_URL: "https://example.com/app",
        DIRECT_URL:
          "postgresql://user:migration-password-value@db.example.com/app",
      }),
    AppError,
  );
});

test("DB Provider는 D1을 기본으로 선택하고 잘못된 값은 차단한다", () => {
  assert.equal(resolveDatabaseProviderName({}), "d1");
  assert.equal(
    resolveDatabaseProviderName({ DB_PROVIDER: "supabase" }),
    "supabase",
  );
  assert.throws(
    () => resolveDatabaseProviderName({ DB_PROVIDER: "unknown" }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "DATABASE_PROVIDER_CONFIGURATION_INVALID",
  );
  assert.equal(
    createDatabaseProvider({}, { d1: {} as D1Database }).kind,
    "d1",
  );
});

test("Production에서도 Supabase 설정 누락 시 D1로 자동 fallback하지 않는다", () => {
  assert.throws(
    () =>
      createDatabaseProvider(
        { DB_PROVIDER: "supabase" },
        { d1: {} as D1Database },
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "DATABASE_PROVIDER_CONFIGURATION_INVALID",
  );
});

test("PostgreSQL Provider는 placeholder와 transaction을 dialect에 맞게 처리한다", async () => {
  const calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const executor: PostgresExecutor = {
    async query<Row extends Record<string, unknown>>(
      sql: string,
      parameters: readonly DatabaseValue[],
    ) {
      calls.push({ sql, parameters });
      return {
        rows: [{ id: "row-1" }] as unknown as Row[],
        rowCount: 1,
      };
    },
    async transaction(callback) {
      return callback(this);
    },
  };
  const provider = new PostgresDatabaseProvider(executor);
  assert.equal(
    createDatabaseProvider(
      {
        DB_PROVIDER: "supabase",
        DATABASE_URL:
          "postgresql://pooler:runtime-password-value@pool.example.com/app",
      },
      { postgres: executor },
    ).kind,
    "supabase",
  );
  const row = await provider.queryOne<{ id: string }>({
    sql: "SELECT id FROM users WHERE email = ? AND status = ?",
    parameters: ["user@example.invalid", "ACTIVE"],
  });
  assert.equal(row?.id, "row-1");
  assert.match(calls[0].sql, /email = \$1 AND status = \$2/);
  const results = await provider.transaction([
    { sql: "UPDATE users SET updated_at = CURRENT_TIMESTAMP::text WHERE id = ?", parameters: ["row-1"] },
    { sql: "DELETE FROM bookmarks WHERE user_id = ?", parameters: ["row-1"] },
  ]);
  assert.deepEqual(results, [
    {
      affectedRows: 1,
      returnedRows: [{ id: "row-1" }],
      metadata: { provider: "supabase" },
    },
    {
      affectedRows: 1,
      returnedRows: [{ id: "row-1" }],
      metadata: { provider: "supabase" },
    },
  ]);
  assert.match(calls[1].sql, /CURRENT_TIMESTAMP::text/);
});

test("PostgreSQL placeholder 수가 다르면 안전하게 차단한다", () => {
  assert.throws(
    () =>
      normalizePostgresStatement({
        sql: "SELECT * FROM users WHERE id = ?",
        parameters: [],
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "DATABASE_PARAMETER_MISMATCH",
  );
});

test("PostgreSQL native placeholder도 Repository Adapter에서 안전하게 허용한다", () => {
  assert.deepEqual(
    normalizePostgresStatement({
      sql: "SELECT * FROM users WHERE id = $1 AND status = $2",
      parameters: ["user-1", "ACTIVE"],
    }),
    {
      sql: "SELECT * FROM users WHERE id = $1 AND status = $2",
      parameters: ["user-1", "ACTIVE"],
    },
  );
  assert.throws(
    () =>
      normalizePostgresStatement({
        sql: "SELECT * FROM users WHERE id = $2",
        parameters: ["user-1"],
      }),
    AppError,
  );
});

test("D1 LIKE와 PostgreSQL ILIKE·full-text 검색을 분리한다", () => {
  assert.match(
    buildSearchPredicate("d1", ["title"]).sql,
    /lower\("title"\) LIKE lower\(\?\)/,
  );
  assert.match(
    buildSearchPredicate("supabase", ["title", "content"]).sql,
    /ILIKE \?/,
  );
  assert.match(
    buildSearchPredicate(
      "supabase",
      ["title", "content"],
      "full-text",
    ).sql,
    /plainto_tsquery/,
  );
});

test("PostgreSQL 호환 schema는 68개 테이블과 SQLite 문법 차단을 검증한다", async () => {
  const [sql, manifestText] = await Promise.all([
    readFile(
      new URL(
        "../db/postgres/migrations/0001_d1_compatibility_schema.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../db/postgres/schema-manifest.json", import.meta.url),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(manifestText) as { tableCount: number };
  assert.equal(manifest.tableCount, 68);
  assert.doesNotMatch(
    sql,
    /\bPRAGMA\b|\bAUTOINCREMENT\b|\bINSERT\s+OR\s+|last_insert_rowid|`/,
  );
  assert.match(sql, /\bBEGIN;/);
  assert.match(sql, /\bCOMMIT;/);
  assert.ok(
    sql.indexOf(
      'CREATE UNIQUE INDEX "privacy_flow_nodes_scenario_id_unique"',
    ) < sql.indexOf('CREATE TABLE "privacy_flow_edges"'),
    "referenced composite unique indexes must exist before dependent foreign keys",
  );
});

test("server-only RLS migration closes every application table to direct clients", async () => {
  const sql = await readFile(
    new URL(
      "../db/postgres/migrations/0002_server_only_rls_lockdown.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    [...sql.matchAll(/\bENABLE ROW LEVEL SECURITY\b/g)].length,
    69,
  );
  assert.equal(
    [...sql.matchAll(/\bREVOKE ALL PRIVILEGES ON TABLE\b/g)].length,
    69,
  );
  assert.doesNotMatch(sql, /\bCREATE POLICY\b/i);
  assert.doesNotMatch(
    sql,
    /\bGRANT\b[\s\S]*\b(?:anon|authenticated)\b/i,
  );
  assert.match(sql, /\bBEGIN;/);
  assert.match(sql, /\bCOMMIT;/);
});

test("Supabase environment validation keeps the service role server-only", () => {
  assert.throws(
    () =>
      validateRuntimeEnvironment(
        {
          STORAGE_PROVIDER: "supabase",
          SUPABASE_URL: "https://project.supabase.co",
        },
        false,
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "SECURITY_CONFIGURATION_INVALID",
  );
  assert.throws(
    () =>
      validateRuntimeEnvironment(
        {
          STORAGE_PROVIDER: "supabase",
          SUPABASE_URL: "https://project.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40),
          NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "leak",
        } as never,
        false,
      ),
    AppError,
  );
});

test("bucket policy generates keys and validates bucket MIME rules", () => {
  const thumbnail = validateStorageUpload("public-thumbnails", {
    originalName: "thumbnail.webp",
    mimeType: "image/webp",
    sizeBytes: 500,
  });
  assert.match(
    thumbnail.storageKey,
    /^public\/image\/[0-9a-f-]{36}\.webp$/,
  );
  assert.throws(
    () =>
      validateStorageUpload("private-audio", {
        originalName: "payload.html",
        mimeType: "text/html",
        sizeBytes: 500,
      }),
    AppError,
  );
});

test("private objects require server authorization and ownership", async () => {
  const policy = new ServerStorageAuthorizationPolicy();
  await assert.rejects(
    policy.assertAllowed("READ", "private-audio", "private/audio/a.mp3", {
      actor: { userId: "user-1", roles: ["USER"] },
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === "STORAGE_ACCESS_FORBIDDEN",
  );
  await assert.doesNotReject(
    policy.assertAllowed("READ", "private-audio", "private/audio/a.mp3", {
      actor: { userId: "user-1", roles: ["USER"] },
      ownsPrivateObject: async (_bucket, _key, userId) => userId === "user-1",
    }),
  );
});

test("local provider is development-only and prevents duplicate trust paths", async () => {
  const provider = createStorageProvider({
    APP_ENV: "development",
    STORAGE_PROVIDER: "local",
  });
  assert.ok(provider instanceof LocalStorageProvider);
  await assert.rejects(
    provider.put(
      {
        bucket: "public-thumbnails",
        originalName: "thumb.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1, 2, 3]),
      },
      { actor: { userId: "user-1", roles: ["USER"] } },
    ),
    AppError,
  );
  assert.throws(
    () =>
      createStorageProvider({
        APP_ENV: "production",
        STORAGE_PROVIDER: "local",
      }),
    AppError,
  );
});

test("Supabase private read creates a short signed URL without leaking key", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const serviceRoleKey = "server-only-service-role-key-value";
  const provider = new SupabaseStorageProvider({
    supabaseUrl: "https://project.supabase.co",
    serviceRoleKey,
    bucketNames: { "private-audio": "preview-private-audio" },
    fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: input.toString(), init });
      return new Response(
        JSON.stringify({
          signedURL:
            "/storage/v1/object/sign/private-audio/private/audio/test.mp3?token=signed",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch,
  });
  const result = await provider.createReadUrl(
    "private-audio",
    "private/audio/test.mp3",
    manager,
    300,
  );
  assert.match(result.url, /^https:\/\/project\.supabase\.co\//);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /preview-private-audio/);
  assert.equal(
    (calls[0].init?.headers as Record<string, string>).authorization,
    `Bearer ${serviceRoleKey}`,
  );
});

test("vector retrieval remains an optional validated extension", () => {
  assert.deepEqual(validateEmbeddingVector([0.1, 0.2], 2), [0.1, 0.2]);
  assert.throws(() => validateEmbeddingVector([Number.NaN]));
  const compileOnly: VectorRetrievalProvider | null = null;
  assert.equal(compileOnly, null);
});
