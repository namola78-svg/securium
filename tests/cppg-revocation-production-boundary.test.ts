import assert from "node:assert/strict";
import { test } from "node:test";
import * as production from "../lib/services/cppg-runtime-publication-revocation.ts";

test("production revocation remains closed under environment spoofing", async () => {
  const env = process.env as Record<string, string | undefined>;
  const priorNodeEnv = env.NODE_ENV;
  const priorTestContext = env.NODE_TEST_CONTEXT;
  env.NODE_ENV = "test";
  env.NODE_TEST_CONTEXT = "child-v8";
  try {
    await assert.rejects(
      production.revokeCppgPublication({} as never, {} as never),
      (error: unknown) => error instanceof production.CppgPublicationRevocationError && error.code === "REVOCATION_POLICY_DENIED",
    );
    assert.equal("revokeCppgPublicationForTesting" in production, false);
  } finally {
    if (priorNodeEnv === undefined) delete env.NODE_ENV; else env.NODE_ENV = priorNodeEnv;
    if (priorTestContext === undefined) delete env.NODE_TEST_CONTEXT; else env.NODE_TEST_CONTEXT = priorTestContext;
  }
});
