import { redirect } from "next/navigation";
import {
  assertSameOriginRequest,
  persistSupabaseSession,
  signInWithSupabasePassword,
  validateAuthForm,
} from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";
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
  const params = new URLSearchParams({ return_to: returnTo });
  if (error instanceof AppError) {
    if (error.code === "AUTH_EMAIL_INVALID") {
      params.set("error", "email_invalid");
    } else if (error.code === "AUTH_PASSWORD_INVALID") {
      params.set("error", "password_invalid");
    } else if (error.status >= 500) {
      params.set("error", "network");
    } else {
      params.set("error", "credentials_invalid");
    }
  } else {
    params.set("error", "credentials_invalid");
  }
  return `/login?${params.toString()}`;
}
