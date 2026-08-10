import { redirect } from "next/navigation";
import {
  assertSameOriginRequest,
  persistSupabaseSession,
  signInWithSupabasePassword,
  validateAuthForm,
} from "@/lib/auth-provider";
import {
  buildSafeRedirectQuery,
  safeAuthReturnPath,
} from "@/lib/auth-routing";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let returnTo = "/dashboard";
  try {
    assertSameOriginRequest(request);
    const form = await request.formData();
    returnTo = safeAuthReturnPath(form.get("returnTo"));
    const credentials = validateAuthForm({
      email: form.get("email"),
      password: form.get("password"),
    });
    const session = await signInWithSupabasePassword(credentials);
    await persistSupabaseSession(session);
  } catch (error) {
    redirect(loginFailurePath(returnTo, error));
  }
  redirect(returnTo);
}

function loginFailurePath(returnTo: string, error: unknown) {
  const params: Record<string, string | undefined> = { return_to: returnTo };
  if (error instanceof AppError) {
    if (error.code === "AUTH_EMAIL_INVALID") {
      params.error = "email_invalid";
    } else if (error.code === "AUTH_PASSWORD_INVALID") {
      params.error = "password_invalid";
    } else if (error.code === "CSRF_REJECTED") {
      params.error = "credentials_invalid";
    } else if (error.code === "AUTH_PROVIDER_INVALID") {
      params.error = "credentials_invalid";
    } else if (error.code === "SUPABASE_AUTH_NOT_CONFIGURED") {
      params.error = "network";
    } else if (error.code === "SUPABASE_AUTH_NETWORK_ERROR") {
      params.error = "network";
    } else if (error.code === "SUPABASE_SIGNIN_FAILED") {
      if (error.status >= 500) {
        params.error = "network";
      } else {
        params.error = "credentials_invalid";
      }
    } else if (error.code === "SUPABASE_SESSION_INVALID") {
      params.error = "credentials_invalid";
    } else if (error.status >= 500) {
      params.error = "network";
    } else {
      params.error = "credentials_invalid";
    }
  } else {
    params.error = "credentials_invalid";
  }
  return `/login?${buildSafeRedirectQuery(params).toString()}`;
}
