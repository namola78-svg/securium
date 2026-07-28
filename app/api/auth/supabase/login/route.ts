import { redirect } from "next/navigation";
import {
  assertSameOriginRequest,
  persistSupabaseSession,
  signInWithSupabasePassword,
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
    });
    const session = await signInWithSupabasePassword(credentials);
    await persistSupabaseSession(session);
  } catch {
    redirect("/login?error=signin_failed");
  }
  redirect(returnTo);
}
