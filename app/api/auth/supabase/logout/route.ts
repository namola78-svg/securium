import { redirect } from "next/navigation";
import { assertSameOriginRequest, clearSupabaseSession } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await clearSupabaseSession();
  const url = new URL(request.url);
  redirect(safeAuthReturnPath(url.searchParams.get("return_to"), "/"));
}

export async function POST(request: Request) {
  assertSameOriginRequest(request);
  await clearSupabaseSession();
  const form = await request.formData();
  redirect(safeAuthReturnPath(form.get("returnTo"), "/"));
}
