import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  lte,
  sql,
} from "drizzle-orm";
import { getDb } from ".";
import { adminAuditLogs as auditLogs, users } from "./schema";
import {
  choosePrimaryActorRole,
  auditResultForStatus,
  requestAuditContext,
  sanitizeAuditMetadata,
  type AuditResult,
} from "@/lib/services/audit-service";
import { AppError } from "@/lib/errors";
import { env } from "cloudflare:workers";

export type AuditWriteInput = {
  actorUserId: string;
  actorRoles?: string[];
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  result?: AuditResult;
  courseId?: string | null;
  requestId?: string | null;
  ipHash?: string | null;
  userAgentSummary?: string | null;
  metadata?: Record<string, unknown>;
};

export function createAuditInsert(input: AuditWriteInput) {
  const metadata = sanitizeAuditMetadata(input.action, input.metadata);
  return getDb().insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId,
    actorRole:
      input.actorRole ?? choosePrimaryActorRole(input.actorRoles ?? []),
    action: input.action.slice(0, 100),
    resourceType: input.resourceType.slice(0, 100),
    resourceId: input.resourceId.slice(0, 200),
    result: input.result ?? "SUCCESS",
    ipHash: input.ipHash ?? null,
    userAgentSummary: input.userAgentSummary?.slice(0, 120) ?? null,
    requestId: input.requestId?.slice(0, 100) ?? null,
    metadataJson: JSON.stringify(metadata),
  });
}

export async function recordAuditEvent(
  input: AuditWriteInput,
  request?: Request,
) {
  const context = request
    ? await requestAuditContext(request, env.AUDIT_IP_HASH_SALT)
    : {
        ipHash: input.ipHash ?? null,
        userAgentSummary: input.userAgentSummary ?? null,
        requestId: input.requestId ?? crypto.randomUUID(),
      };
  await createAuditInsert({
    ...input,
    ipHash: context.ipHash,
    userAgentSummary: context.userAgentSummary,
    requestId: input.requestId ?? context.requestId,
  });
}

export function recordAudit(
  input: Omit<AuditWriteInput, "resourceType" | "resourceId"> & {
    targetType: string;
    targetId: string;
  },
  request?: Request,
) {
  const { targetType, targetId, ...rest } = input;
  return recordAuditEvent(
    {
      ...rest,
      resourceType: targetType,
      resourceId: targetId,
    },
    request,
  );
}

export async function recordAuditEventSafely(
  input: AuditWriteInput,
  request?: Request,
) {
  try {
    await recordAuditEvent(input, request);
  } catch {
    // An audit storage outage must not replace the original business error,
    // and sensitive request data must never be logged as a fallback.
  }
}

export function recordAuditFailureSafely(
  input: Omit<AuditWriteInput, "result">,
  error: unknown,
  request?: Request,
) {
  const status = error instanceof AppError ? error.status : 500;
  return recordAuditEventSafely(
    {
      ...input,
      result: auditResultForStatus(status),
      metadata: {
        ...(input.metadata ?? {}),
        reasonCode:
          error instanceof AppError ? error.code : "INTERNAL_ERROR",
      },
    },
    request,
  );
}

export type AuditListFilters = {
  fromDate?: string;
  toDate?: string;
  action?: string;
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  result?: AuditResult;
  page?: number;
  pageSize?: number;
};

function auditConditions(filters: AuditListFilters) {
  return [
    filters.fromDate
      ? gte(auditLogs.createdAt, `${filters.fromDate} 00:00:00`)
      : undefined,
    filters.toDate
      ? lte(auditLogs.createdAt, `${filters.toDate} 23:59:59.999`)
      : undefined,
    filters.action ? eq(auditLogs.action, filters.action) : undefined,
    filters.actorUserId
      ? eq(auditLogs.actorUserId, filters.actorUserId)
      : undefined,
    filters.resourceType
      ? eq(auditLogs.resourceType, filters.resourceType)
      : undefined,
    filters.resourceId
      ? like(auditLogs.resourceId, `%${escapeLike(filters.resourceId)}%`)
      : undefined,
    filters.result ? eq(auditLogs.result, filters.result) : undefined,
  ];
}

export async function listAuditLogs(filters: AuditListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(10, Math.min(filters.pageSize ?? 30, 100));
  const where = and(...auditConditions(filters));
  const [rows, countRows] = await Promise.all([
    getDb()
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorEmail: users.email,
        actorRole: auditLogs.actorRole,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        result: auditLogs.result,
        requestId: auditLogs.requestId,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    getDb()
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAuditLogById(id: string) {
  const [row] = await getDb()
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorEmail: users.email,
      actorRole: auditLogs.actorRole,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      result: auditLogs.result,
      ipHash: auditLogs.ipHash,
      userAgentSummary: auditLogs.userAgentSummary,
      requestId: auditLogs.requestId,
      metadataJson: auditLogs.metadataJson,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(eq(auditLogs.id, id))
    .limit(1);
  if (!row) return null;
  return { ...row, metadata: safeJson(row.metadataJson) };
}

export async function listAuditActors() {
  return getDb()
    .selectDistinct({
      id: users.id,
      email: users.email,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(asc(users.email));
}

export async function listAuditFilterOptions() {
  const [actions, resources] = await Promise.all([
    getDb()
      .selectDistinct({ value: auditLogs.action })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action)),
    getDb()
      .selectDistinct({ value: auditLogs.resourceType })
      .from(auditLogs)
      .orderBy(asc(auditLogs.resourceType)),
  ]);
  return {
    actions: actions.map((row) => row.value).filter(Boolean),
    resources: resources.map((row) => row.value).filter(Boolean),
  };
}

export async function listAuditLogsForExport(filters: AuditListFilters) {
  return getDb()
    .select({
      createdAt: auditLogs.createdAt,
      actorUserId: auditLogs.actorUserId,
      actorRole: auditLogs.actorRole,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      result: auditLogs.result,
      requestId: auditLogs.requestId,
      metadataJson: auditLogs.metadataJson,
    })
    .from(auditLogs)
    .where(and(...auditConditions(filters)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5000);
}

function escapeLike(value: string) {
  return value
    .trim()
    .slice(0, 100)
    .replaceAll("%", "")
    .replaceAll("_", "");
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
