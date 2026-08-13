import assert from "node:assert/strict";
import postgres from "postgres";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import { loadLocalEnvIfPresent } from "./load-local-env.mjs";
import { planIsmsPBatch1Materialization } from "../lib/data/isms-p-theory-batch1-materializer.mjs";

loadLocalEnvIfPresent();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL_REQUIRED");
const parsedUrl = new URL(databaseUrl);
assert.equal(["postgres:", "postgresql:"].includes(parsedUrl.protocol), true);
assert.equal(isLocalHost(parsedUrl.hostname), false, "Production snapshot cannot use localhost");

const client = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
  ssl: "require",
  onnotice: () => {},
  debug: false,
  connection: { application_name: "securium-batch1-final-readonly-diff" },
});

try {
  const result = await client.begin(
    "isolation level repeatable read read only",
    async (transactionClient) => {
      const guardRows = await transactionClient.unsafe(`
        SELECT current_setting('transaction_read_only') AS transaction_read_only,
               current_setting('transaction_isolation') AS transaction_isolation,
               clock_timestamp()::text AS snapshot_timestamp`);
      assert.equal(guardRows[0]?.transaction_read_only, "on");
      assert.equal(guardRows[0]?.transaction_isolation, "repeatable read");

      let selectStatements = 1;
      const executor = {
        async query(sql, parameters) {
          assert.match(sql.trimStart(), /^(SELECT|WITH)\b/i);
          selectStatements += 1;
          const rows = await transactionClient.unsafe(sql, [...parameters]);
          return {
            rows: Array.from(rows),
            rowCount: typeof rows.count === "number" ? rows.count : rows.length,
          };
        },
        async transaction() {
          throw new Error("READ_ONLY_SNAPSHOT_TRANSACTION_NESTING_REFUSED");
        },
      };
      const provider = new PostgresDatabaseProvider(executor);
      const plan = await planIsmsPBatch1Materialization(provider);
      const course = await provider.queryOne({
        sql: "SELECT code, slug FROM courses WHERE id = ?",
        parameters: ["course-isms-p"],
      });
      assert.equal(course?.code, "ISMS_P");
      assert.equal(course?.slug, "isms-p");
      const denominator = await provider.queryOne({
        sql: "SELECT count(*) AS count FROM course_lessons cl JOIN contents c ON c.id = cl.content_id WHERE cl.course_id = ? AND cl.status = 'PUBLISHED' AND cl.deleted_at IS NULL AND c.status = 'PUBLISHED' AND c.deleted_at IS NULL",
        parameters: ["course-isms-p"],
      });
      const currentPublished = Number(denominator?.count ?? 0);
      const entityCounts = Object.fromEntries(
        ["content", "courseLesson", "extension"].map((entity) => [
          entity,
          Object.fromEntries(
            ["CREATE", "NOOP", "CONFLICT"].map((classification) => [
              classification,
              plan.operations.filter(
                (operation) =>
                  operation.entity === entity &&
                  operation.classification === classification,
              ).length,
            ]),
          ),
        ]),
      );
      assert.deepEqual(entityCounts.content, { CREATE: 12, NOOP: 0, CONFLICT: 0 });
      assert.deepEqual(entityCounts.courseLesson, { CREATE: 12, NOOP: 0, CONFLICT: 0 });
      assert.deepEqual(entityCounts.extension, { CREATE: 12, NOOP: 0, CONFLICT: 0 });
      assert.deepEqual(plan.counts, { CREATE: 36, NOOP: 0, CONFLICT: 0 });
      assert.equal(plan.holdOperationCount, 0);
      assert.equal(plan.conflictGate, "PASS");

      return {
        status: "PRODUCTION_FINAL_READ_ONLY_DIFF_PASS",
        snapshot_timestamp: guardRows[0].snapshot_timestamp,
        transaction_read_only: guardRows[0].transaction_read_only,
        transaction_isolation: guardRows[0].transaction_isolation,
        course_valid: plan.course.valid,
        counts: {
          content: entityCounts.content,
          course_lesson: entityCounts.courseLesson,
          extension: entityCounts.extension,
          total: plan.counts,
        },
        hold_operation_count: plan.holdOperationCount,
        conflict_gate: plan.conflictGate,
        pending: 0,
        denominator: {
          current_published_course_lessons: currentPublished,
          planned_create: entityCounts.courseLesson.CREATE,
          expected_post_count:
            currentPublished + entityCounts.courseLesson.CREATE,
          completion_delta: entityCounts.courseLesson.CREATE,
          analytics_delta: entityCounts.courseLesson.CREATE,
        },
        select_statements: selectStatements,
        write_statements: 0,
        mutations: 0,
      };
    },
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.end({ timeout: 5 });
}

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}
