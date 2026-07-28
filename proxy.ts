import { NextResponse, type NextRequest } from "next/server";

const SUPABASE_ACCESS_COOKIE = "sa_access_token";
const AUTH_PAGES = new Set(["/login", "/signup"]);

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (!AUTH_PAGES.has(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get(SUPABASE_ACCESS_COOKIE)?.value;
  if (!accessToken) return NextResponse.next();

  const returnTo = safeReturnPath(searchParams.get("return_to"));
  return NextResponse.redirect(new URL(returnTo, request.url));
}

export const config = {
  matcher: ["/login", "/signup"],
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
