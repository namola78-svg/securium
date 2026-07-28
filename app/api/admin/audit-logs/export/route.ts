import {
  listAuditLogsForExport,
  recordAuditEvent,
} from "@/db/audit-repositories";
import { requireAuditExporter } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { auditLogFilterSchema, parseInput } from "@/lib/validation";
import { assertDataExportRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireAuditExporter();
    await assertDataExportRateLimit(user.id);
    const url = new URL(request.url);
    const filters = parseInput(
      auditLogFilterSchema,
      Object.fromEntries(url.searchParams.entries()),
    );
    const rows = await listAuditLogsForExport(filters);
    await recordAuditEvent(
      {
        actorUserId: user.id,
        actorRoles: user.roles,
        action: "DATA_EXPORTED",
        resourceType: "AUDIT_LOG",
        resourceId: `audit-export-${Date.now()}`,
        metadata: {
          format: "CSV",
          fromDate: filters.fromDate ?? "",
          toDate: filters.toDate ?? "",
          filterCount: countFilters(filters),
          rowCount: rows.length,
        },
      },
      request,
    );
    const header = [
      "createdAt",
      "actorUserId",
      "actorRole",
      "action",
      "resourceType",
      "resourceId",
      "result",
      "requestId",
      "metadata",
    ];
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.createdAt,
          row.actorUserId,
          row.actorRole,
          row.action,
          row.resourceType,
          row.resourceId,
          row.result,
          row.requestId ?? "",
          row.metadataJson,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="audit-logs-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function countFilters(filters: Record<string, unknown>) {
  return Object.entries(filters).filter(
    ([key, value]) =>
      !["page", "pageSize"].includes(key) &&
      value !== undefined &&
      value !== "",
  ).length;
}
