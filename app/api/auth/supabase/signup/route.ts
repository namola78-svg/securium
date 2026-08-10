import { redirect } from "next/navigation";
import {
  assertSameOriginRequest,
  persistSupabaseSession,
  signUpWithSupabasePassword,
  validateAuthForm,
} from "@/lib/auth-provider";
import { AppError } from "@/lib/errors";
import {
  buildSafeRedirectQuery,
  safeAuthReturnPath,
} from "@/lib/auth-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let returnTo = "/dashboard";
  try {
    assertSameOriginRequest(request);
    const form = await request.formData();
    const requestedReturnTo = safeAuthReturnPath(form.get("returnTo"));
    returnTo = requestedReturnTo;
    const credentials = validateAuthForm({
      email: form.get("email"),
      password: form.get("password"),
      displayName: form.get("displayName"),
      requireDisplayName: true,
    });
    const session = await signUpWithSupabasePassword(credentials);
    if (session) {
      await persistSupabaseSession(session);
    } else {
      returnTo = `/login?${buildSafeRedirectQuery({
        notice: "confirm_email",
        return_to: requestedReturnTo,
      }).toString()}`;
    }
  } catch (error) {
    redirect(signupFailurePath(returnTo, error));
  }
  redirect(returnTo);
}

function signupFailurePath(returnTo: string, error: unknown) {
  const params: Record<string, string | undefined> = { return_to: returnTo };

  if (error instanceof AppError) {
    if (error.code === "AUTH_EMAIL_INVALID") {
      params.error = "email_invalid";
    } else if (error.code === "AUTH_PASSWORD_INVALID") {
      params.error = "weak_password";
    } else if (error.code === "AUTH_NAME_INVALID") {
      params.error = "display_name_invalid";
    } else if (error.code === "CSRF_REJECTED") {
      params.error = "signup_failed";
    } else if (error.code === "AUTH_PROVIDER_INVALID") {
      params.error = "signup_failed";
    } else if (error.code === "SUPABASE_SIGNUP_EMAIL_EXISTS") {
      params.error = "already_registered";
    } else if (error.code === "SUPABASE_SIGNUP_FAILED") {
      if (error.status >= 500) {
        params.error = "network";
      } else {
        params.error = "signup_failed";
      }
    } else if (error.code === "SUPABASE_AUTH_NETWORK_ERROR") {
      params.error = "network";
    } else if (error.code === "SUPABASE_AUTH_NOT_CONFIGURED") {
      params.error = "signup_disabled";
    } else if (error.status >= 500) {
      params.error = "network";
    } else {
      params.error = "signup_failed";
    }
  } else {
    params.error = "signup_failed";
  }

  return `/signup?${buildSafeRedirectQuery(params).toString()}`;
}
