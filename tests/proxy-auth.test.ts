import assert from "node:assert/strict";
import test from "node:test";
import { createChunks, stringToBase64URL } from "@supabase/ssr";
import { getSupabaseRequestAuthState } from "../lib/auth-provider.ts";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_ANON_KEY;

process.env.SUPABASE_URL = "https://synthetic-project.supabase.co";
process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";

function ssrCookieHeader(overrides: Record<string, unknown> = {}) {
  const syntheticJwt = [
    stringToBase64URL(JSON.stringify({ alg: "none", typ: "JWT" })),
    stringToBase64URL(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }),
    ),
    "synthetic-signature",
  ].join(".");
  const session = {
    access_token: syntheticJwt,
    refresh_token: "synthetic-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 600,
    ...overrides,
  };
  const encoded = `base64-${stringToBase64URL(JSON.stringify(session))}`;
  return createChunks("sb-synthetic-project-auth-token", encoded)
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

function cookies(cookie?: string) {
  return cookie
    ? cookie.split("; ").map((part) => {
        const separator = part.indexOf("=");
        return { name: part.slice(0, separator), value: part.slice(separator + 1) };
      })
    : [];
}

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalKey;
});

test("valid Supabase SSR session is accepted by proxy", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ user: { email: "synthetic@example.test" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const state = await getSupabaseRequestAuthState(cookies(ssrCookieHeader()));
  assert.equal(state.authenticated, true);
});

test("missing, malformed, and expired SSR sessions redirect protected routes", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "invalid" }), { status: 401 });

  for (const cookie of [
    undefined,
    "sb-synthetic-project-auth-token.0=malformed",
    ssrCookieHeader({ expires_at: Math.floor(Date.now() / 1000) - 60 }),
  ]) {
    const state = await getSupabaseRequestAuthState(cookies(cookie));
    assert.equal(state.authenticated, false);
  }
});

test("legacy custom access cookie remains accepted when valid", async () => {
  globalThis.fetch = async () =>
    new Response(null, { status: 200 });
  const payload = stringToBase64URL(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }),
  );
  const state = await getSupabaseRequestAuthState(
    cookies(`sa_access_token=header.${payload}.signature`),
  );
  assert.equal(state.authenticated, false);
});

test("login remains public without authentication", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
  const state = await getSupabaseRequestAuthState([]);
  assert.equal(state.authenticated, false);
});
