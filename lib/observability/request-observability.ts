const EVENT_NAME = "SECURIUM_REQUEST_OBSERVATION_V1" as const;

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
  | "UNKNOWN";
export type DurationBucket =
  | "LT_50MS"
  | "MS_50_250"
  | "MS_250_1000"
  | "S_1_5"
  | "GT_5S"
  | "UNKNOWN";

export type RequestObservation = {
  event: typeof EVENT_NAME;
  routeFamily: RouteFamily;
  routeTemplate: string;
  method: MethodCategory;
  statusClass: StatusClass;
  authCategory: AuthCategory;
  trafficCategory: TrafficCategory;
  runtimeCategory: RuntimeCategory;
  environment: EnvironmentCategory;
  durationBucket: DurationBucket;
};

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
  if (
    statusClass === "2xx" ||
    statusClass === "3xx"
  ) {
    if (routeFamily === "PROGRESS_API" || routeFamily === "ADMIN_API") return "AUTHENTICATED";
  }
  return "UNKNOWN";
}

function classifyRuntime() {
  const runtime = process.env.NEXT_RUNTIME?.toLowerCase();
  if (runtime === "nodejs" || runtime === "node") return "NODE" as const;
  if (runtime === "edge") return "EDGE" as const;
  if (runtime === "middleware") return "MIDDLEWARE" as const;
  return "UNKNOWN" as const;
}

function classifyEnvironment() {
  const environment = process.env.VERCEL_ENV?.toLowerCase();
  if (environment === "production") return "PRODUCTION" as const;
  if (environment === "preview") return "PREVIEW" as const;
  if (process.env.NODE_ENV === "development") return "DEVELOPMENT" as const;
  return "UNKNOWN" as const;
}

export function durationBucket(durationMs: number | null | undefined): DurationBucket {
  if (!Number.isFinite(durationMs) || (durationMs as number) < 0) return "UNKNOWN";
  if ((durationMs as number) < 50) return "LT_50MS";
  if ((durationMs as number) < 250) return "MS_50_250";
  if ((durationMs as number) < 1000) return "MS_250_1000";
  if ((durationMs as number) <= 5000) return "S_1_5";
  return "GT_5S";
}

export function buildRequestObservation(
  request: Request,
  status?: number,
  durationMs?: number,
): RequestObservation {
  const route = classifyRoute(request);
  const statusClass = classifyStatus(status);
  return {
    event: EVENT_NAME,
    routeFamily: route.routeFamily,
    routeTemplate: route.routeTemplate,
    method: classifyMethod(request.method),
    statusClass,
    authCategory: classifyAuth(route.routeFamily, statusClass),
    trafficCategory: classifyTraffic(request.headers.get("user-agent")),
    runtimeCategory: classifyRuntime(),
    environment: classifyEnvironment(),
    durationBucket: durationBucket(durationMs),
  };
}

function shouldEmit() {
  return process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "test";
}

export function emitRequestObservation(
  request: Request,
  status?: number,
  durationMs?: number,
  write: (line: string) => void = (line) => console.log(line),
) {
  try {
    if (!shouldEmit()) return;
    const event = buildRequestObservation(request, status, durationMs);
    write(JSON.stringify(event));
  } catch {
    // Telemetry is deliberately fail-open. It must never affect a request.
  }
}
