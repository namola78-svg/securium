import { createServerClient } from "@supabase/ssr";
import { AppError } from "./errors.ts";

export type AuthProviderName = "sites" | "supabase";

export type AuthenticatedIdentity = {
  email: string;
  displayName: string;
  fullName: string | null;
};

export const SUPABASE_ACCESS_COOKIE = "sa_access_token";
export const SUPABASE_REFRESH_COOKIE = "sa_refresh_token";
export const SUPABASE_OAUTH_RETURN_COOKIE = "sa_oauth_return_to";

export type SupabaseAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

type SupabaseUserPayload = {
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
};

type SupabaseAccessTokenPayload = SupabaseUserPayload & {
  exp?: number;
};

export function resolveAuthProvider(
  environment: Record<string, string | undefined> = process.env,
): AuthProviderName {
  const provider = environment.AUTH_PROVIDER?.trim().toLowerCase();
  if (!provider) return "sites";
  if (provider === "sites" || provider === "supabase") return provider;
  throw new AppError("AUTH_PROVIDER must be sites or supabase.", 500, "AUTH_PROVIDER_INVALID");
}

export function resolveSupabaseAuthConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const supabaseUrl =
    environment.SUPABASE_URL?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey =
    environment.SUPABASE_ANON_KEY?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new AppError(
      "Supabase Auth requires SUPABASE_URL and SUPABASE_ANON_KEY.",
      500,
      "SUPABASE_AUTH_NOT_CONFIGURED",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new AppError(
      "SUPABASE_URL must be a valid HTTPS URL.",
      500,
      "SUPABASE_AUTH_NOT_CONFIGURED",
    );
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new AppError(
      "SUPABASE_URL must be a credential-free HTTPS URL.",
      500,
      "SUPABASE_AUTH_NOT_CONFIGURED",
    );
  }

  return {
    supabaseUrl: parsed.origin,
    authUrl: `${parsed.origin}/auth/v1`,
    anonKey,
  };
}

export async function getSupabaseAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const cookieStore = await getCookieStore();
  const accessToken = cookieStore.get(SUPABASE_ACCESS_COOKIE)?.value;
  if (!accessToken) return getSupabaseIdentityFromSsrCookies();

  const config = resolveSupabaseAuthConfig();
  let response: Response;
  try {
    response = await fetch(`${config.authUrl}/user`, {
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
  } catch {
    return (
      getSupabaseIdentityFromAccessToken(accessToken) ??
      (await getSupabaseIdentityFromSsrCookies())
    );
  }
  if (!response.ok) {
    return (
      getSupabaseIdentityFromAccessToken(accessToken) ??
      (await getSupabaseIdentityFromSsrCookies())
    );
  }

  const payload = (await response.json()) as SupabaseUserPayload;
  return supabasePayloadToIdentity(payload);
}

async function getSupabaseIdentityFromSsrCookies(): Promise<AuthenticatedIdentity | null> {
  const config = resolveSupabaseAuthConfig();
  const cookieStore = await getCookieStore();
  const supabase = createServerClient(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server components cannot persist refreshed cookies here. Route handlers
        // and proxy keep the custom HttpOnly session cookies refreshed.
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return supabasePayloadToIdentity({
      email: data.user.email,
      user_metadata: {
        full_name:
          typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name
            : undefined,
        name:
          typeof data.user.user_metadata?.name === "string"
            ? data.user.user_metadata.name
            : undefined,
      },
    });
  } catch {
    return null;
  }
}

export function getSupabaseIdentityFromAccessToken(
  accessToken: string,
): AuthenticatedIdentity | null {
  const [, payloadPart] = accessToken.split(".");
  if (!payloadPart) return null;

  let payload: SupabaseAccessTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as SupabaseAccessTokenPayload;
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) return null;
  return supabasePayloadToIdentity(payload);
}

function supabasePayloadToIdentity(
  payload: SupabaseUserPayload,
): AuthenticatedIdentity | null {
  const email = payload.email?.trim().toLowerCase();
  if (!email) return null;
  const fullName =
    payload.user_metadata?.full_name?.trim() ||
    payload.user_metadata?.name?.trim() ||
    null;

  return {
    email,
    displayName: fullName ?? email,
    fullName,
  };
}

export async function signInWithSupabasePassword(input: {
  email: string;
  password: string;
}): Promise<SupabaseAuthSession> {
  const config = resolveSupabaseAuthConfig();
  const response = await fetch(`${config.authUrl}/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
    cache: "no-store",
  });

  return parseSupabaseSessionResponse(response);
}

export async function signUpWithSupabasePassword(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<SupabaseAuthSession | null> {
  const config = resolveSupabaseAuthConfig();
  const response = await fetch(`${config.authUrl}/signup`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      data: input.displayName?.trim()
        ? { full_name: input.displayName.trim() }
        : undefined,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AppError(
      "Supabase signup failed.",
      response.status >= 500 ? 502 : 400,
      "SUPABASE_SIGNUP_FAILED",
    );
  }

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

export async function persistSupabaseSession(session: SupabaseAuthSession) {
  const cookieStore = await getCookieStore();
  const secure = process.env.NODE_ENV === "production";
  for (const cookie of supabaseSessionCookieSpecs(session, secure)) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }
}

export function supabaseSessionCookieSpecs(
  session: SupabaseAuthSession,
  secure: boolean,
) {
  return [
    {
      name: SUPABASE_ACCESS_COOKIE,
      value: session.accessToken,
      options: {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
        maxAge: Math.max(60, session.expiresIn),
      },
    },
    {
      name: SUPABASE_REFRESH_COOKIE,
      value: session.refreshToken,
      options: {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      },
    },
  ];
}

export async function clearSupabaseSession() {
  const cookieStore = await getCookieStore();
  for (const cookieName of supabaseSessionCookieNamesForLogout(
    cookieStore.getAll().map((cookie) => cookie.name),
  )) {
    cookieStore.delete(cookieName);
  }
}

export function supabaseSessionCookieNamesForLogout(cookieNames: string[]) {
  return Array.from(
    new Set([
      SUPABASE_ACCESS_COOKIE,
      SUPABASE_REFRESH_COOKIE,
      SUPABASE_OAUTH_RETURN_COOKIE,
      ...cookieNames.filter(isSupabaseSsrAuthCookieName),
    ]),
  );
}

export function expiredSupabaseSessionCookieSpecs(
  cookieNames: string[],
  secure: boolean,
) {
  return supabaseSessionCookieNamesForLogout(cookieNames).map((name) => ({
    name,
    value: "",
    options: {
      httpOnly: true,
      secure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    },
  }));
}

export function isSupabaseSsrAuthCookieName(name: string) {
  return (
    name.startsWith("sb-") &&
    (name.endsWith("-auth-token") ||
      /-auth-token\.\d+$/.test(name) ||
      name.endsWith("-auth-token-code-verifier"))
  );
}

export function validateAuthForm(input: {
  email: unknown;
  password: unknown;
  displayName?: unknown;
}) {
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const displayName = String(input.displayName ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("A valid email address is required.", 400, "AUTH_EMAIL_INVALID");
  }
  if (password.length < 8 || password.length > 128) {
    throw new AppError(
      "Password length must be between 8 and 128 characters.",
      400,
      "AUTH_PASSWORD_INVALID",
    );
  }
  if (displayName.length > 80) {
    throw new AppError("Display name is too long.", 400, "AUTH_NAME_INVALID");
  }

  return { email, password, displayName };
}

export function assertSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const url = new URL(request.url);
  if (origin !== url.origin) {
    throw new AppError("Cross-site auth request rejected.", 403, "CSRF_REJECTED");
  }
}

async function parseSupabaseSessionResponse(
  response: Response,
): Promise<SupabaseAuthSession> {
  if (!response.ok) {
    throw new AppError(
      "Supabase signin failed.",
      response.status >= 500 ? 502 : 401,
      "SUPABASE_SIGNIN_FAILED",
    );
  }

  const payload = (await response.json()) as Partial<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
  if (!payload.access_token || !payload.refresh_token) {
    throw new AppError(
      "Supabase auth response did not include a session.",
      502,
      "SUPABASE_SESSION_INVALID",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number(payload.expires_in ?? 3600),
  };
}

async function getCookieStore() {
  const mod = await import("next/headers");
  return mod.cookies();
}
