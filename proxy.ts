import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_ACCESS_COOKIE = "sa_access_token";
const SUPABASE_REFRESH_COOKIE = "sa_refresh_token";
const AUTH_PAGES = new Set(["/login", "/signup"]);
const PROTECTED_PREFIXES = [
  "/admin",
  "/ai-tutor",
  "/analytics",
  "/bookmarks",
  "/content-versions",
  "/dashboard",
  "/learn",
  "/lectures",
  "/mock-exams",
  "/my-courses",
  "/practical",
  "/practice",
  "/profile",
  "/reviews",
  "/settings",
  "/specialized",
  "/wrong-notes",
];

type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export async function proxy(request: NextRequest) {
  if (resolveProxyAuthProvider() !== "supabase") {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.has(pathname);
  const isProtectedPage = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isAuthPage && !isProtectedPage) return NextResponse.next();

  const accessToken = request.cookies.get(SUPABASE_ACCESS_COOKIE)?.value;
  if (isAccessTokenUsable(accessToken)) {
    if (!isAuthPage) return NextResponse.next();

    const returnTo = safeReturnPath(searchParams.get("return_to"));
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  const refreshed = await refreshSupabaseSession(
    request.cookies.get(SUPABASE_REFRESH_COOKIE)?.value,
  );

  if (refreshed) {
    if (isAuthPage) {
      const response = NextResponse.redirect(
        new URL(safeReturnPath(searchParams.get("return_to")), request.url),
      );
      setSessionCookies(response, refreshed);
      return response;
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("cookie", buildForwardedCookieHeader(request, refreshed));
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    setSessionCookies(response, refreshed);
    return response;
  }

  if (!isProtectedPage) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("return_to", `${pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SUPABASE_ACCESS_COOKIE);
  response.cookies.delete(SUPABASE_REFRESH_COOKIE);
  return response;
}

function resolveProxyAuthProvider() {
  return process.env.AUTH_PROVIDER?.trim().toLowerCase() === "supabase"
    ? "supabase"
    : "sites";
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/ai-tutor",
    "/admin/:path*",
    "/analytics/:path*",
    "/bookmarks/:path*",
    "/content-versions/:path*",
    "/dashboard",
    "/learn/:path*",
    "/lectures/:path*",
    "/mock-exams/:path*",
    "/my-courses",
    "/practical/:path*",
    "/practice/:path*",
    "/profile",
    "/reviews",
    "/settings",
    "/specialized/:path*",
    "/wrong-notes",
  ],
};

function safeReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";

  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/dashboard";
    if (AUTH_PAGES.has(url.pathname)) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

function isAccessTokenUsable(accessToken: string | undefined) {
  if (!accessToken) return false;

  const [, payload] = accessToken.split(".");
  if (!payload) return false;

  try {
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (!decoded.exp) return false;
    return decoded.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

async function refreshSupabaseSession(
  refreshToken: string | undefined,
): Promise<RefreshedSession | null> {
  if (!refreshToken) return null;

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) return null;

  let authUrl: string;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:") return null;
    authUrl = `${parsed.origin}/auth/v1`;
  } catch {
    return null;
  }

  const response = await fetch(`${authUrl}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as Partial<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
  if (!payload.access_token || !payload.refresh_token) return null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number(payload.expires_in ?? 3600),
  };
}

function setSessionCookies(response: NextResponse, session: RefreshedSession) {
  response.cookies.set(SUPABASE_ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, session.expiresIn),
  });
  response.cookies.set(SUPABASE_REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

function buildForwardedCookieHeader(
  request: NextRequest,
  session: RefreshedSession,
) {
  const cookies = new Map(
    request.cookies
      .getAll()
      .map((cookie) => [cookie.name, cookie.value] as const),
  );
  cookies.set(SUPABASE_ACCESS_COOKIE, session.accessToken);
  cookies.set(SUPABASE_REFRESH_COOKIE, session.refreshToken);
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}
