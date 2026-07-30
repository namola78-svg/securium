import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolveSupabaseAuthConfig,
  supabaseSessionCookieSpecs,
  SUPABASE_OAUTH_RETURN_COOKIE,
} from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = resolveSupabaseAuthConfig();
  const url = new URL(request.url);
  const returnTo = safeAuthReturnPath(
    url.searchParams.get("return_to") ??
      request.cookies.get(SUPABASE_OAUTH_RETURN_COOKIE)?.value,
  );
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  if (!code || providerError) {
    const params = new URLSearchParams({
      error: providerError === "access_denied" ? "oauth_cancelled" : "oauth_callback_failed",
      return_to: returnTo,
    });
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, request.url));
  }

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const supabase = createServerClient(config.supabaseUrl, config.anonKey, {
    auth: {
      flowType: "pkce",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        cookiesToSet.push(...values);
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Supabase OAuth callback failed", {
        message: error?.message ?? "Session was not returned.",
        name: error?.name,
        status: error?.status,
      });
    }
    const params = new URLSearchParams({
      error: "oauth_callback_failed",
      return_to: returnTo,
    });
    const response = NextResponse.redirect(
      new URL(`/login?${params.toString()}`, request.url),
    );
    applySupabaseSsrCookies(response, cookiesToSet);
    return response;
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  applySupabaseSsrCookies(response, cookiesToSet);
  for (const cookie of supabaseSessionCookieSpecs(
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    },
    process.env.NODE_ENV === "production",
  )) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  response.cookies.delete(SUPABASE_OAUTH_RETURN_COOKIE);
  return response;
}

function applySupabaseSsrCookies(
  response: NextResponse,
  cookiesToSet: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>,
) {
  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
}
