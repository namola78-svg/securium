import {
  getAuditLogById,
  listAuditLogs,
} from "@/db/audit-repositories";
import { requireAuditViewer } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/http";
import { auditLogFilterSchema, parseInput } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireAuditViewer();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const detail = await getAuditLogById(id);
      if (!detail) {
        return Response.json(
          { error: "감사로그를 찾을 수 없습니다.", code: "AUDIT_NOT_FOUND" },
          { status: 404 },
        );
      }
      return successResponse(request, { detail });
    }
    const filters = parseInput(
      auditLogFilterSchema,
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listAuditLogs(filters);
    return successResponse(request, { result });
  } catch (error) {
    return errorResponse(error);
  }
}

