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
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
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
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  for (const cookie of cookiesToSet) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
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
