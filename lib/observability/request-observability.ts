const EVENT_NAME = "SECURIUM_REQUEST_OBSERVATION_V1" as const;
const MAX_EVENT_LENGTH = 2048;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const ROUTE_FAMILIES = [
  "PUBLIC_PAGE",
  "AUTH_PAGE",
  "LEARNER_PAGE",
  "ADMIN_PAGE",
  "GOVERNANCE_PAGE",
  "AUTH_API",
  "PROGRESS_API",
  "LEARNING_API",
  "AI_API",
  "ADMIN_API",
  "HEALTH_API",
  "OTHER_API",
] as const;

export type RouteFamily = (typeof ROUTE_FAMILIES)[number] | "OTHER_PAGE";
export type MethodCategory =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "OTHER";
export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx" | "UNKNOWN";
export type AuthCategory = "ANONYMOUS" | "AUTHENTICATED" | "UNKNOWN";
export type TrafficCategory =
  | "LIKELY_BROWSER"
  | "KNOWN_SEARCH_CRAWLER"
  | "KNOWN_AUTOMATION"
  | "UNKNOWN_CLIENT";
export type RuntimeCategory = "NODE" | "EDGE" | "MIDDLEWARE" | "UNKNOWN";
export type EnvironmentCategory =
  | "PRODUCTION"
  | "PREVIEW"
  | "DEVELOPMENT"
  | "TEST"
  | "UNKNOWN";
export type DurationBucket =
  | "LT_50MS"
  | "MS_50_250"
  | "MS_250_1000"
  | "S_1_5"
  | "GT_5S"
  | "UNKNOWN";
export type Outcome = "SUCCESS" | "FAILURE" | "UNKNOWN";
export type ErrorCategory =
  | "NONE"
  | "VALIDATION"
  | "AUTH"
  | "AUTHORIZATION"
  | "DATABASE"
  | "EXTERNAL_SERVICE"
  | "AI"
  | "RATE_LIMIT"
  | "CONFIGURATION"
  | "INTERNAL"
  | "UNKNOWN";
export type Severity = "INFO" | "ERROR";

export type RequestObservation = {
  event: typeof EVENT_NAME;
  severity: Severity;
  routeFamily: RouteFamily;
  routeTemplate: string;
  method: MethodCategory;
  statusClass: StatusClass;
  outcome: Outcome;
  errorCategory: ErrorCategory;
  authCategory: AuthCategory;
  trafficCategory: TrafficCategory;
  runtimeCategory: RuntimeCategory;
  environment: EnvironmentCategory;
  durationMs: number | null;
  durationBucket: DurationBucket;
  correlationId: string;
};

export type RequestObservationContext = {
  status?: number;
  durationMs?: number | null;
  outcome?: Outcome;
  error?: unknown;
  correlationId?: string;
};

type ObservationWriter = (line: string) => void;

const requestStarts = new WeakMap<Request, number>();

const PUBLIC_STATIC_ROUTES = new Set([
  "/",
  "/about",
  "/courses",
  "/guide",
  "/legal",
  "/legal/privacy",
  "/legal/terms",
  "/privacy",
  "/terms",
]);

const AUTH_ROUTES = new Set(["/login", "/signup"]);
const GOVERNANCE_PAGE_PREFIXES = ["/admin/audit-logs", "/admin/ai-explainability"];
const ADMIN_PAGE_PREFIXES = ["/admin"];
const LEARNER_PAGE_PREFIXES = [
  "/ai-tutor",
  "/analytics",
  "/bookmarks",
  "/dashboard",
  "/learn",
  "/lectures",
  "/mock-exams",
  "/my-courses",
  "/my-learning",
  "/practical",
  "/practice",
  "/profile",
  "/reviews",
  "/settings",
  "/specialized",
  "/wrong-notes",
];

const PROGRESS_API_PREFIXES = [
  "/api/audio/progress",
  "/api/course-lessons/progress",
  "/api/lectures/progress",
  "/api/lessons/progress",
];

const API_AUTH_PREFIXES = ["/api/auth"];
const API_ADMIN_PREFIXES = ["/api/admin"];
const API_AI_PREFIXES = ["/api/ai"];
const API_HEALTH_PREFIXES = ["/api/health", "/api/ops"] as const;
const API_LEARNING_PREFIXES = [
  "/api/bookmarks",
  "/api/course-lessons",
  "/api/enrollments",
  "/api/learning-settings",
  "/api/lectures",
  "/api/levels",
  "/api/mock-exams",
  "/api/practical",
  "/api/question-attempts",
  "/api/question-reports",
  "/api/specialized",
  "/api/wrong-notes",
];

function hasPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function safePathname(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    if (pathname.length > 512 || !pathname.startsWith("/")) return "/__invalid__";
    return pathname;
  } catch {
    return "/__invalid__";
  }
}

export function classifyRoute(request: Request) {
  const pathname = safePathname(request);
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (isApi) {
    if (hasPrefix(pathname, PROGRESS_API_PREFIXES)) {
      return { routeFamily: "PROGRESS_API" as const, routeTemplate: progressTemplate(pathname) };
    }
    if (hasPrefix(pathname, API_AUTH_PREFIXES)) {
      return { routeFamily: "AUTH_API" as const, routeTemplate: "/api/auth/[...]" };
    }
    if (hasPrefix(pathname, API_ADMIN_PREFIXES)) {
      return { routeFamily: "ADMIN_API" as const, routeTemplate: "/api/admin/[...]" };
    }
    if (hasPrefix(pathname, API_AI_PREFIXES)) {
      return { routeFamily: "AI_API" as const, routeTemplate: "/api/ai/[...]" };
    }
    if (hasPrefix(pathname, ["/api/practical"])) {
      return { routeFamily: "AI_API" as const, routeTemplate: "/api/practical/[...]" };
    }
    if (hasPrefix(pathname, API_HEALTH_PREFIXES)) {
      return { routeFamily: "HEALTH_API" as const, routeTemplate: "/api/health/[...]" };
    }
    if (hasPrefix(pathname, API_LEARNING_PREFIXES)) {
      return { routeFamily: "LEARNING_API" as const, routeTemplate: "/api/learning/[...]" };
    }
    return { routeFamily: "OTHER_API" as const, routeTemplate: "/api/[...]" };
  }

  if (AUTH_ROUTES.has(pathname)) {
    return { routeFamily: "AUTH_PAGE" as const, routeTemplate: pathname };
  }
  if (PUBLIC_STATIC_ROUTES.has(pathname)) {
    return { routeFamily: "PUBLIC_PAGE" as const, routeTemplate: pathname };
  }
  if (pathname === "/courses/example" || /^\/courses\/[^/]+$/.test(pathname)) {
    return { routeFamily: "PUBLIC_PAGE" as const, routeTemplate: "/courses/[courseSlug]" };
  }
  if (hasPrefix(pathname, GOVERNANCE_PAGE_PREFIXES)) {
    return { routeFamily: "GOVERNANCE_PAGE" as const, routeTemplate: "/admin/[governance]" };
  }
  if (hasPrefix(pathname, ADMIN_PAGE_PREFIXES)) {
    return { routeFamily: "ADMIN_PAGE" as const, routeTemplate: "/admin/[...]" };
  }
  if (hasPrefix(pathname, LEARNER_PAGE_PREFIXES)) {
    return { routeFamily: "LEARNER_PAGE" as const, routeTemplate: "/learner/[...]" };
  }
  return { routeFamily: "OTHER_PAGE" as const, routeTemplate: "/other" };
}

function progressTemplate(pathname: string) {
  if (pathname.startsWith("/api/audio/progress")) return "/api/audio/progress";
  if (pathname.startsWith("/api/course-lessons/progress")) return "/api/course-lessons/progress";
  if (pathname.startsWith("/api/lectures/progress")) return "/api/lectures/progress";
  return "/api/lessons/progress";
}

export function classifyMethod(method: string | null | undefined): MethodCategory {
  const value = method?.toUpperCase();
  return value === "GET" ||
    value === "POST" ||
    value === "PUT" ||
    value === "PATCH" ||
    value === "DELETE" ||
    value === "HEAD" ||
    value === "OPTIONS"
    ? value
    : "OTHER";
}

export function classifyStatus(status: number | null | undefined): StatusClass {
  const code = status ?? NaN;
  if (!Number.isInteger(code) || code < 100 || code > 599) return "UNKNOWN";
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return "UNKNOWN";
}

export function classifyTraffic(userAgent: string | null | undefined): TrafficCategory {
  const value = userAgent?.slice(0, 512).toLowerCase() ?? "";
  if (!value) return "UNKNOWN_CLIENT";
  if (/(googlebot|bingbot|duckduckbot|yandexbot|baiduspider|facebookexternalhit)/.test(value)) {
    return "KNOWN_SEARCH_CRAWLER";
  }
  if (/(playwright|puppeteer|selenium|headlesschrome|cypress|k6|curl|wget|httpclient)/.test(value)) {
    return "KNOWN_AUTOMATION";
  }
  if (/(mozilla\/|chrome\/|safari\/|firefox\/|edg\/|applewebkit\/)/.test(value)) {
    return "LIKELY_BROWSER";
  }
  return "UNKNOWN_CLIENT";
}

function classifyAuth(routeFamily: RouteFamily, statusClass: StatusClass): AuthCategory {
  if (routeFamily === "PUBLIC_PAGE" || routeFamily === "AUTH_PAGE") return "ANONYMOUS";
  if ((statusClass === "2xx" || statusClass === "3xx") &&
      (routeFamily === "PROGRESS_API" || routeFamily === "ADMIN_API")) {
    return "AUTHENTICATED";
  }
  return "UNKNOWN";
}

function classifyRuntime(): RuntimeCategory {
  const runtime = process.env.NEXT_RUNTIME?.toLowerCase();
  if (runtime === "nodejs" || runtime === "node") return "NODE";
  if (runtime === "edge") return "EDGE";
  if (runtime === "middleware") return "MIDDLEWARE";
  return "UNKNOWN";
}

function classifyEnvironment(): EnvironmentCategory {
  const vercelEnvironment = process.env.VERCEL_ENV?.toLowerCase();
  if (vercelEnvironment === "production") return "PRODUCTION";
  if (vercelEnvironment === "preview") return "PREVIEW";
  if (process.env.NODE_ENV === "test") return "TEST";
  if (process.env.NODE_ENV === "development") return "DEVELOPMENT";
  return "UNKNOWN";
}

export function normalizeDurationMs(durationMs: number | null | undefined) {
  if (!Number.isFinite(durationMs) || (durationMs as number) < 0) return null;
  return Math.min(Math.round(durationMs as number), MAX_DURATION_MS);
}

export function durationBucket(durationMs: number | null | undefined): DurationBucket {
  const normalized = normalizeDurationMs(durationMs);
  if (normalized === null) return "UNKNOWN";
  if (normalized < 50) return "LT_50MS";
  if (normalized < 250) return "MS_50_250";
  if (normalized < 1000) return "MS_250_1000";
  if (normalized <= 5000) return "S_1_5";
  return "GT_5S";
}

export function startRequestObservation(request: Request, startedAt = performance.now()) {
  try {
    if (Number.isFinite(startedAt)) requestStarts.set(request, startedAt);
  } catch {
    // Timing is diagnostic only.
  }
}

export function finishRequestObservation(request: Request) {
  try {
    const startedAt = requestStarts.get(request);
    requestStarts.delete(request);
    if (startedAt === undefined) return null;
    return normalizeDurationMs(performance.now() - startedAt);
  } catch {
    return null;
  }
}

function safeHeader(request: Request, name: string) {
  try {
    return request.headers.get(name);
  } catch {
    return null;
  }
}

function correlationIdFromRequest(request: Request) {
  for (const header of ["x-vercel-id", "x-request-id"]) {
    const value = safeHeader(request, header);
    if (isSafeCorrelationId(value)) return value;
  }
  try {
    return crypto.randomUUID();
  } catch {
    return "UNAVAILABLE";
  }
}

function isSafeCorrelationId(value: unknown): value is string {
  return typeof value === "string" && SAFE_CORRELATION_ID.test(value);
}

function safeErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code.slice(0, 128).toUpperCase() : "";
}

export function classifyErrorCategory(error: unknown, status?: number): ErrorCategory {
  const code = safeErrorCode(error);
  if (code.startsWith("DATABASE_") || code.startsWith("DB_")) return "DATABASE";
  if (code === "AUTHORIZATION_DENIED" || code === "CSRF_REJECTED") return "AUTHORIZATION";
  if (code === "AUTH_REQUIRED" || code === "SESSION_INVALID" || code.startsWith("AUTH_") || code.startsWith("SUPABASE_AUTH_")) {
    return "AUTH";
  }
  if (code.includes("RATE_LIMIT")) return "RATE_LIMIT";
  if (code.startsWith("AI_")) return "AI";
  if (code.includes("CONFIG") || code.includes("PROVIDER_INVALID")) return "CONFIGURATION";
  if (code.includes("NETWORK") || code.includes("EXTERNAL") || code.includes("UNAVAILABLE")) {
    return "EXTERNAL_SERVICE";
  }
  if (code.includes("INVALID") || code === "BAD_REQUEST") return "VALIDATION";

  if (status === 401) return "AUTH";
  if (status === 403) return "AUTHORIZATION";
  if (status === 429) return "RATE_LIMIT";
  if (status === 400 || status === 422) return "VALIDATION";
  if (status !== undefined && status >= 500) return "INTERNAL";
  return "UNKNOWN";
}

function classifyOutcome(status: number | undefined, error: unknown, requested?: Outcome): Outcome {
  if (requested === "SUCCESS" || requested === "FAILURE") return requested;
  if (error !== undefined) return "FAILURE";
  const statusClass = classifyStatus(status);
  if (statusClass === "2xx" || statusClass === "3xx") return "SUCCESS";
  if (statusClass === "4xx" || statusClass === "5xx") return "FAILURE";
  return "UNKNOWN";
}

function observationContext(
  contextOrStatus: RequestObservationContext | number | undefined,
  durationMs?: number | null,
): RequestObservationContext {
  if (typeof contextOrStatus === "number") {
    return { status: contextOrStatus, durationMs };
  }
  return contextOrStatus ?? {};
}

export function buildRequestObservation(
  request: Request,
  contextOrStatus: RequestObservationContext | number = {},
  legacyDurationMs?: number | null,
): RequestObservation {
  const context = observationContext(contextOrStatus, legacyDurationMs);
  const route = classifyRoute(request);
  const statusClass = classifyStatus(context.status);
  const outcome = classifyOutcome(context.status, context.error, context.outcome);
  const errorCategory = outcome === "SUCCESS"
    ? "NONE"
    : classifyErrorCategory(context.error, context.status);
  const durationMs = normalizeDurationMs(context.durationMs);
  const suppliedCorrelationId = context.correlationId;
  const correlationId = isSafeCorrelationId(suppliedCorrelationId)
    ? suppliedCorrelationId
    : correlationIdFromRequest(request);

  return {
    event: EVENT_NAME,
    severity: outcome === "FAILURE" ? "ERROR" : "INFO",
    routeFamily: route.routeFamily,
    routeTemplate: route.routeTemplate,
    method: classifyMethod(request.method),
    statusClass,
    outcome,
    errorCategory,
    authCategory: classifyAuth(route.routeFamily, statusClass),
    trafficCategory: classifyTraffic(safeHeader(request, "user-agent")),
    runtimeCategory: classifyRuntime(),
    environment: classifyEnvironment(),
    durationMs,
    durationBucket: durationBucket(durationMs),
    correlationId,
  };
}

function shouldEmit() {
  return process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "test";
}

function defaultWriter(event: RequestObservation, line: string) {
  if (event.severity === "ERROR") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function emitRequestObservation(
  request: Request,
  contextOrStatus: RequestObservationContext | number = {},
  durationOrWrite?: number | null | ObservationWriter,
  errorOrWrite?: unknown | ObservationWriter,
  legacyWrite?: ObservationWriter,
) {
  try {
    if (!shouldEmit()) return;

    let context: RequestObservationContext;
    let write: ObservationWriter | undefined;
    if (typeof contextOrStatus === "number") {
      context = observationContext(
        contextOrStatus,
        typeof durationOrWrite === "number" ? durationOrWrite : undefined,
      );
      if (typeof errorOrWrite === "function") write = errorOrWrite as ObservationWriter;
      else if (errorOrWrite !== undefined) context.error = errorOrWrite;
      if (legacyWrite) write = legacyWrite;
    } else {
      context = contextOrStatus ?? {};
      if (typeof durationOrWrite === "function") write = durationOrWrite as ObservationWriter;
      else if (typeof errorOrWrite === "function") write = errorOrWrite as ObservationWriter;
      if (legacyWrite) write = legacyWrite;
    }

    const event = buildRequestObservation(request, context);
    const line = JSON.stringify(event);
    if (line.length > MAX_EVENT_LENGTH) return;
    if (write) write(line);
    else defaultWriter(event, line);
  } catch {
    // Telemetry is deliberately fail-open. It must never affect a request.
  }
}
