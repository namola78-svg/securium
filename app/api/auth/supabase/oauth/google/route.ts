import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  resolveSupabaseAuthConfig,
  SUPABASE_OAUTH_RETURN_COOKIE,
} from "@/lib/auth-provider";
import { buildSafeRedirectQuery, safeAuthReturnPath } from "@/lib/auth-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = resolveSupabaseAuthConfig();
  const url = new URL(request.url);
  const returnTo = safeAuthReturnPath(url.searchParams.get("return_to"));
  const callbackUrl = new URL("/api/auth/supabase/oauth/callback", request.url);
  callbackUrl.searchParams.set("return_to", returnTo);
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    const query = buildSafeRedirectQuery({
      error: "oauth_provider_failed",
      return_to: returnTo,
    });
    const response = NextResponse.redirect(
      new URL(`/login?${query}`, request.url),
    );
    response.cookies.delete(SUPABASE_OAUTH_RETURN_COOKIE);
    applySupabaseSsrCookies(response, cookiesToSet);
    return response;
  }

  const response = NextResponse.redirect(data.url);
  applySupabaseSsrCookies(response, cookiesToSet);
  response.cookies.set(SUPABASE_OAUTH_RETURN_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
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
