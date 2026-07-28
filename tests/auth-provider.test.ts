import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthProvider,
  resolveSupabaseAuthConfig,
  validateAuthForm,
} from "../lib/auth-provider.ts";
import { safeAuthReturnPath } from "../lib/auth-routing.ts";

test("auth provider defaults to Sites and accepts Supabase explicitly", () => {
  assert.equal(resolveAuthProvider({}), "sites");
  assert.equal(resolveAuthProvider({ AUTH_PROVIDER: "supabase" }), "supabase");
  assert.throws(() => resolveAuthProvider({ AUTH_PROVIDER: "passwordless" }));
});

test("supabase auth config uses credential-free HTTPS project URL", () => {
  assert.deepEqual(
    resolveSupabaseAuthConfig({
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_ANON_KEY: "a".repeat(32),
    }),
    {
      authUrl: "https://project.supabase.co/auth/v1",
      anonKey: "a".repeat(32),
    },
  );
  assert.throws(() =>
    resolveSupabaseAuthConfig({
      SUPABASE_URL: "postgresql://user:pass@example.test/db",
      SUPABASE_ANON_KEY: "a".repeat(32),
    }),
  );
});

test("auth form validation normalizes email and limits password inputs", () => {
  assert.deepEqual(
    validateAuthForm({
      email: " Learner@Example.COM ",
      password: "correct-horse",
      displayName: " Learner ",
    }),
    {
      email: "learner@example.com",
      password: "correct-horse",
      displayName: "Learner",
    },
  );
  assert.throws(() =>
    validateAuthForm({ email: "bad", password: "correct-horse" }),
  );
  assert.throws(() =>
    validateAuthForm({ email: "user@example.com", password: "short" }),
  );
});

test("auth return paths reject external and reserved targets", () => {
  assert.equal(safeAuthReturnPath("/dashboard?tab=mine"), "/dashboard?tab=mine");
  assert.equal(safeAuthReturnPath("https://evil.example"), "/dashboard");
  assert.equal(safeAuthReturnPath("//evil.example"), "/dashboard");
  assert.equal(safeAuthReturnPath("/api/auth/supabase/logout"), "/dashboard");
});
