import { redirect } from "next/navigation";
import {
  assertSameOriginRequest,
  persistSupabaseSession,
  signUpWithSupabasePassword,
  validateAuthForm,
} from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

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
      displayName: form.get("displayName"),
    });
    const session = await signUpWithSupabasePassword(credentials);
    if (session) {
      await persistSupabaseSession(session);
    } else {
      returnTo = "/login?notice=confirm_email";
    }
  } catch {
    redirect("/signup?error=signup_failed");
  }
  redirect(returnTo);
}
