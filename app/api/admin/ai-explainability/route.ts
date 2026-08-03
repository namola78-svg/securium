import { listAdminAIExplainabilityTraces } from "@/db/ai-explainability-repositories";
import { requireAuditViewer } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuditViewer();
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
    return successResponse(request, await listAdminAIExplainabilityTraces(limit));
  } catch (error) {
    return errorResponse(error);
  }
}
