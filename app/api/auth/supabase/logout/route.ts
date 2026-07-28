import { NextResponse } from "next/server";
import {
  assertSameOriginRequest,
  clearSupabaseSession,
  expiredSupabaseSessionCookieSpecs,
} from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await clearSupabaseSession();
  const url = new URL(request.url);
  return createLogoutResponse(request, url.searchParams.get("return_to"));
}

export async function POST(request: Request) {
  assertSameOriginRequest(request);
  const form = await request.formData();
  await clearSupabaseSession();
  return createLogoutResponse(request, form.get("returnTo"));
}

function createLogoutResponse(request: Request, returnTo: FormDataEntryValue | string | null) {
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(
    new URL(safeAuthReturnPath(returnTo, "/"), requestUrl),
  );
  const secure = process.env.NODE_ENV === "production" || requestUrl.protocol === "https:";
  for (const cookie of expiredSupabaseSessionCookieSpecs(
    parseCookieNames(request.headers.get("cookie")),
    secure,
  )) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function parseCookieNames(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name));
}
