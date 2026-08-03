import { listAdminAIExplainabilityTraces } from "@/db/ai-explainability-repositories";
import { requireAuditViewer } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAuditViewer();
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 50);
    return successResponse(
      request,
      await listAdminAIExplainabilityTraces(limit, {
        source: parseSource(params.get("source")),
        courseId: stringParam(params.get("courseId")),
        provider: stringParam(params.get("provider")),
        status: stringParam(params.get("status")),
        requestId: stringParam(params.get("requestId")),
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function stringParam(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}

function parseSource(value: string | null) {
  return value === "QUESTION_EXPLANATION" || value === "SPECIALIZED_REVIEW"
    ? value
    : undefined;
}
