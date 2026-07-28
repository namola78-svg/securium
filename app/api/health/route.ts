import { getDatabaseProvider } from "@/db";
import {
  isProductionEnvironment,
  validateRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/environment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const requestId = crypto.randomUUID();
  const environment = process.env as RuntimeEnvironment;

  try {
    const production =
      isProductionEnvironment(environment) ||
      process.env.VERCEL_ENV === "production";
    validateRuntimeEnvironment(environment, production);

    const database = await getDatabaseProvider();
    const healthy = await database.healthCheck();
    return Response.json(
      {
        status: healthy ? "ok" : "unavailable",
        database: healthy ? "ok" : "unavailable",
        requestId,
      },
      {
        status: healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        database: "unavailable",
        requestId,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
