import assert from "node:assert/strict";
import test from "node:test";
import {
  getSupabaseIdentityFromAccessToken,
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
      supabaseUrl: "https://project.supabase.co",
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
  assert.equal(
    safeAuthReturnPath("/api/auth/supabase/oauth/google"),
    "/dashboard",
  );
});

test("supabase access token fallback extracts non-expired identity only", () => {
  const futurePayload = {
    email: "Learner@Example.COM",
    exp: Math.floor(Date.now() / 1000) + 600,
    user_metadata: { full_name: "Learner" },
  };
  const token = [
    "header",
    Buffer.from(JSON.stringify(futurePayload)).toString("base64url"),
    "signature",
  ].join(".");

  assert.deepEqual(getSupabaseIdentityFromAccessToken(token), {
    email: "learner@example.com",
    displayName: "Learner",
    fullName: "Learner",
  });

  const expiredToken = [
    "header",
    Buffer.from(
      JSON.stringify({ email: "old@example.com", exp: 1 }),
    ).toString("base64url"),
    "signature",
  ].join(".");
  assert.equal(getSupabaseIdentityFromAccessToken(expiredToken), null);
  assert.equal(getSupabaseIdentityFromAccessToken("not-a-jwt"), null);
});
