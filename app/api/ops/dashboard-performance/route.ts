import { requireAuditViewer } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getDashboardPerformanceSnapshot } from "@/lib/ops-dashboard-performance";

export async function GET(request: Request) {
  try {
    const user = await requireAuditViewer();
    const snapshot = await getDashboardPerformanceSnapshot(user.id);

    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": snapshot.requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, request);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
