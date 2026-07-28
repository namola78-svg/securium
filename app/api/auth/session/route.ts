import { getOptionalCurrentAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
  };

  try {
    const user = await getOptionalCurrentAppUser();
    return Response.json({ authenticated: Boolean(user) }, { headers });
  } catch {
    return Response.json({ authenticated: false }, { headers });
  }
}
