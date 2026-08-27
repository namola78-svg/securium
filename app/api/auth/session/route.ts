import { getOptionalApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
  };

  try {
    const user = await getOptionalApiUser();
    return Response.json(
      user
        ? {
            authenticated: true,
            displayName: user.displayName,
            roles: user.roles,
          }
        : { authenticated: false, displayName: null, roles: [] },
      { headers },
    );
  } catch {
    return Response.json(
      { authenticated: false, displayName: null, roles: [] },
      { headers },
    );
  }
}
