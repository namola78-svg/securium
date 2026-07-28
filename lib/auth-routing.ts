const RESERVED_AUTH_PATHS = new Set([
  "/callback",
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/api/auth/supabase/login",
  "/api/auth/supabase/logout",
  "/api/auth/supabase/signup",
]);

export function safeAuthReturnPath(value: unknown, fallback = "/dashboard") {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;

  let url: URL;
  try {
    url = new URL(raw, "https://app.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://app.local") return fallback;
  if (RESERVED_AUTH_PATHS.has(url.pathname)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
