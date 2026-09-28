import assert from "node:assert/strict";
import test from "node:test";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import type { PostgresExecutor, PostgresQueryValue, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";
import { authorizeAndPublishCppgRegistration } from "../lib/services/cppg-runtime-publication.ts";

test("actor authorization is independent and required before the CPPG publication policy", async () => {
  const statements: string[] = [];
  const executor: PostgresExecutor = {
    query: async () => { throw new Error("publication transaction must not start for an unauthorized actor"); },
    transaction: async <T>(callback: (transaction: PostgresTransactionExecutor) => Promise<T>) => callback({
      query: async <Row extends Record<string, unknown>>(statement: string, parameters: readonly PostgresQueryValue[]) => {
        void parameters;
        statements.push(statement);
        return { rows: [] as Row[], rowCount: 1 };
      },
    }),
  };
  const owner = new PostgresRuntimeAuthorityPersistence(executor);
  await assert.rejects(
    authorizeAndPublishCppgRegistration({
      registrationSemanticIdentity: "a".repeat(64),
      requestedContentRevisionIds: ["cppg:revision:one"],
      actor: { id: "actor-without-catalog-role", roles: ["CONTENT_REVIEWER"] },
    }, owner),
    (error: unknown) => error instanceof Error && "code" in error && (error as Error & { code: string }).code === "ACTOR_UNAUTHORIZED",
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0]!, /admin_audit_logs/u);
  assert.match(statements[0]!, /'DENIED'/u);
});
