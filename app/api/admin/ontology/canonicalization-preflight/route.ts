import { getDatabaseProvider } from "@/db";
import { requireOntologyAdministrator } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { runSwSecurityWeaknessCanonicalDatabasePreflight } from "@/lib/services/securium-sw-security-weakness-canonical-db-preflight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireOntologyAdministrator();
    await assertRateLimit(`admin-ontology-preflight:${user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });

    const database = await getDatabaseProvider();
    const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(database);
    return Response.json(
      {
        ...result,
        generatedAt: new Date().toISOString(),
      },
      {
        status: result.status === "PASS" ? 200 : result.status === "BLOCK" ? 409 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}
