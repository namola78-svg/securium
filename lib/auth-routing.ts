const RESERVED_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/callback",
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/api/auth/supabase/login",
  "/api/auth/supabase/logout",
  "/api/auth/supabase/oauth/callback",
  "/api/auth/supabase/oauth/google",
  "/api/auth/supabase/signup",
]);

type AuthApiRoute =
  | "/api/auth/supabase/oauth/google"
  | "/api/auth/supabase/logout"
  | "/signin-with-chatgpt"
  | "/signout-with-chatgpt";

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

export function buildSafeRedirectQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) continue;

    const nextValue = String(raw).trim();
    if (!nextValue) continue;

    if (key === "return_to") {
      const safe = safeAuthReturnPath(nextValue, "");
      if (safe) {
        query.set(key, safe);
      }
      continue;
    }

    query.set(key, nextValue);
  }

  return query;
}

function buildLegalReturnTo(returnTo: string) {
  return safeAuthReturnPath(returnTo, "/dashboard");
}

export function legalTermsHref(returnTo: string) {
  return `/legal/terms?return_to=${encodeURIComponent(buildLegalReturnTo(returnTo))}`;
}

export function legalPrivacyHref(returnTo: string) {
  return `/legal/privacy?return_to=${encodeURIComponent(buildLegalReturnTo(returnTo))}`;
}

export function authRedirectHref(
  route: "/login" | "/signup",
  returnTo: string,
) {
  return `${route}?return_to=${encodeURIComponent(safeAuthReturnPath(returnTo))}`;
}

export function authApiRedirectHref(
  route: AuthApiRoute,
  returnTo: string,
  fallback = "/",
) {
  return `${route}?return_to=${encodeURIComponent(safeAuthReturnPath(returnTo, fallback))}`;
}
