export type AuditResult = "SUCCESS" | "FAILURE" | "DENIED";

export const AUDIT_ACTION_METADATA_ALLOWLIST: Record<string, readonly string[]> = {
  ADMIN_LOGIN_SUCCESS: ["authSource"],
  ADMIN_LOGIN_FAILURE: ["authSource", "reasonCode"],
  ROLE_CHANGED: ["roleCode", "changeType"],
  ADMIN_CREATED: ["assignedRoles"],
  ADMIN_BOOTSTRAPPED: ["assignedRoles", "bootstrapMethod"],
  COURSE_CREATED: ["courseCode"],
  COURSE_UPDATED: ["changedFields"],
  COURSE_DEACTIVATED: ["previousStatus"],
  QUESTION_CREATED: ["version"],
  QUESTION_UPDATED: ["version"],
  QUESTION_APPROVED: ["fromStatus", "toStatus"],
  QUESTION_REJECTED: ["fromStatus", "toStatus", "reasonCode"],
  QUESTION_PUBLISHED: ["fromStatus", "toStatus"],
  LEGAL_ARTICLE_UPDATED: ["version", "contentDate"],
  ISMS_STANDARD_UPDATED: ["version", "contentDate"],
  CONTENT_REVISION_DRAFT_CREATED: ["version"],
  CONTENT_REVISION_PUBLISHED: ["version", "previousVersionId"],
  CONTENT_REVISION_ARCHIVED: ["version"],
  MOCK_EXAM_PUBLISHED: ["previousStatus"],
  USER_SUSPENDED: ["reasonCode"],
  USER_REACTIVATED: ["previousStatus"],
  DATA_EXPORTED: ["format", "fromDate", "toDate", "filterCount", "rowCount"],
  AI_SETTINGS_CHANGED: ["changedFields"],
  FILE_UPLOADED: ["mimeCategory", "sizeBytes", "storageProvider"],
  CONTENT_ARCHIVED: ["previousStatus"],
  LEARNING_UNIT_CREATED: [],
  LEARNING_UNIT_UPDATED: [],
  LEARNING_UNIT_ARCHIVED: [],
  LESSON_CREATED: ["version"],
  LESSON_UPDATED: ["version"],
  LESSON_ARCHIVED: ["version"],
  ONTOLOGY_DRAFTED: ["targetType", "fromStatus", "toStatus"],
  ONTOLOGY_ACTIVATED: [
    "targetType",
    "fromStatus",
    "toStatus",
    "evidenceCount",
  ],
  ONTOLOGY_ARCHIVED: ["targetType", "fromStatus", "toStatus", "summaryLength"],
  PRACTICAL_ATTEMPT_CREATED: [
    "practicalId",
    "practicalDefinitionVersionId",
    "rubricVersionId",
  ],
  PRACTICAL_ATTEMPT_SUBMITTED: ["submissionDigest", "draftRevision"],
  PRACTICAL_ATTEMPT_EXPIRED: ["reasonCode"],
  PRACTICAL_ATTEMPT_VOIDED: ["reasonCode"],
  PRACTICAL_EVALUATION_CREATED: [
    "sequence",
    "method",
    "qualification",
    "evaluationPayloadDigest",
  ],
  PRACTICAL_EVALUATION_REVISED: [
    "sequence",
    "previousEvaluationId",
    "method",
    "qualification",
    "evaluationPayloadDigest",
  ],
  PRACTICAL_EVALUATOR_FAILED: ["reasonCode", "evaluatorJobId"],
  CS1A_GOVERNANCE_DECISION_CONFIRMED: [
    "policyVersion",
    "resourceType",
    "resourceId",
    "resourceRevisionId",
    "revisionHash",
    "decision",
    "reasonCode",
    "sourceSetHash",
    "humanDecisionHash",
    "rightsDisposition",
    "currentnessDisposition",
    "contentClass",
    "publicationAuthority",
  ],
};

const SENSITIVE_KEY =
  /password|passwd|secret|token|api.?key|session|oauth|answer|response.?body|request.?body|raw|resident|ssn|rrn|personal|privacy.?data|file.?content/i;
const SENSITIVE_VALUE =
  /(?:bearer\s+[a-z0-9._~-]{8,}|sk-[a-z0-9_-]{8,}|(?:password|passwd|token|api.?key|secret)\s*[:=]\s*\S+|\b\d{6}-?\d{7}\b)/i;

export function choosePrimaryActorRole(roles: readonly string[]) {
  const priority = [
    "SUPER_ADMIN",
    "ADMIN",
    "COURSE_MANAGER",
    "CONTENT_REVIEWER",
    "CONTENT_EDITOR",
    "USER",
  ];
  return priority.find((role) => roles.includes(role)) ?? "UNKNOWN";
}

export function auditResultForStatus(status: number): AuditResult {
  return status === 401 || status === 403 ? "DENIED" : "FAILURE";
}

export function sanitizeAuditMetadata(
  action: string,
  metadata: Record<string, unknown> | undefined,
) {
  const allowed = new Set(AUDIT_ACTION_METADATA_ALLOWLIST[action] ?? []);
  const safe: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!allowed.has(key) || SENSITIVE_KEY.test(key)) continue;
    if (
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean"
    ) {
      safe[key] =
        typeof value === "string" ? sanitizeAuditText(value, 500) : value;
      continue;
    }
    if (
      Array.isArray(value) &&
      value.length <= 30 &&
      value.every((item) => typeof item === "string")
    ) {
      safe[key] = value.map((item) => sanitizeAuditText(item, 100));
    }
  }
  return safe;
}

export function summarizeUserAgent(userAgent: string | null) {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /bot|crawler|spider/i.test(userAgent)
            ? "Bot"
            : "Other";
  const platform = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Mac OS|Macintosh/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Other";
  return `${browser}/${platform}`;
}

export async function requestAuditContext(
  request?: Request,
  configuredSalt?: string,
) {
  if (!request) {
    return {
      ipHash: null,
      userAgentSummary: null,
      requestId: crypto.randomUUID(),
    };
  }
  const forwarded =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return {
    ipHash: forwarded ? await hashIp(forwarded, configuredSalt) : null,
    userAgentSummary: summarizeUserAgent(request.headers.get("user-agent")),
    requestId: safeRequestId(request.headers.get("x-request-id")),
  };
}

async function hashIp(ip: string, configuredSalt?: string) {
  const normalized = abbreviateIp(ip);
  const salt =
    configuredSalt?.trim() ||
    process.env.AUDIT_IP_HASH_SALT?.trim() ||
    "shield-audit-network-v1";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}|${normalized}`),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

function sanitizeAuditText(value: string, maxLength: number) {
  const trimmed = value.slice(0, maxLength);
  return SENSITIVE_VALUE.test(trimmed) ? "[REDACTED]" : trimmed;
}

function abbreviateIp(ip: string) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(":")) {
    return `${ip.split(":").slice(0, 4).join(":")}::/64`;
  }
  return "invalid";
}

function safeRequestId(value: string | null) {
  return value && /^[A-Za-z0-9._:-]{1,100}$/.test(value)
    ? value
    : crypto.randomUUID();
}
