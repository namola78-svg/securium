import { getChatGPTUserForDisplay } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
  };

  try {
    const identity = await getChatGPTUserForDisplay();
    return Response.json({ authenticated: Boolean(identity) }, { headers });
  } catch {
    return Response.json({ authenticated: false }, { headers });
  }
}
