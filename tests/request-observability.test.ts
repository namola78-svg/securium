import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildRequestObservation,
  classifyErrorCategory,
  classifyMethod,
  classifyStatus,
  classifyTraffic,
  durationBucket,
  emitRequestObservation,
  finishRequestObservation,
  normalizeDurationMs,
  startRequestObservation,
} from "../lib/observability/request-observability.ts";

Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  configurable: true,
  enumerable: true,
  writable: true,
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://example.test${path}`, init);
}

test("classifies approved page and API route families", () => {
  assert.equal(buildRequestObservation(request("/")).routeFamily, "PUBLIC_PAGE");
  assert.equal(buildRequestObservation(request("/courses")).routeFamily, "PUBLIC_PAGE");
  assert.equal(buildRequestObservation(request("/courses/example")).routeTemplate, "/courses/[courseSlug]");
  assert.equal(buildRequestObservation(request("/login")).routeFamily, "AUTH_PAGE");
  assert.equal(buildRequestObservation(request("/legal/privacy")).routeFamily, "PUBLIC_PAGE");
  assert.equal(buildRequestObservation(request("/dashboard")).routeFamily, "LEARNER_PAGE");
  assert.equal(buildRequestObservation(request("/admin/courses")).routeFamily, "ADMIN_PAGE");
  assert.equal(buildRequestObservation(request("/admin/audit-logs")).routeFamily, "GOVERNANCE_PAGE");
  assert.equal(buildRequestObservation(request("/api/auth/session")).routeFamily, "AUTH_API");
  assert.equal(buildRequestObservation(request("/api/lessons/progress")).routeFamily, "PROGRESS_API");
  assert.equal(buildRequestObservation(request("/api/unknown")).routeFamily, "OTHER_API");
  assert.equal(buildRequestObservation(request("/unknown-page")).routeFamily, "OTHER_PAGE");
});

test("covers every P2 progress route without dynamic values", () => {
  const routes = [
    "/api/audio/progress",
    "/api/course-lessons/progress",
    "/api/lessons/progress",
    "/api/lectures/progress",
  ];
  for (const path of routes) {
    const observation = buildRequestObservation(request(`${path}?courseId=secret&userId=42`), 200);
    assert.equal(observation.routeFamily, "PROGRESS_API");
    assert.equal(observation.statusClass, "2xx");
    assert.equal(observation.authCategory, "AUTHENTICATED");
    assert.equal(JSON.stringify(observation).includes("secret"), false);
    assert.equal(JSON.stringify(observation).includes("courseId"), false);
    assert.equal(JSON.stringify(observation).includes("userId"), false);
  }
});

test("normalizes dynamic paths and strips query and fragments", () => {
  const observation = buildRequestObservation(
    request("/courses/secret-course?email=person%40example.test#fragment"),
  );
  const serialized = JSON.stringify(observation);
  assert.equal(observation.routeTemplate, "/courses/[courseSlug]");
  assert.equal(serialized.includes("secret-course"), false);
  assert.equal(serialized.includes("person"), false);
  assert.equal(serialized.includes("fragment"), false);
  assert.equal(buildRequestObservation(request("/learn/course/123/lessons/550e8400-e29b-41d4-a716-446655440000")).routeTemplate, "/learner/[...]");
});

test("uses bounded method, status, duration, and traffic enums", () => {
  assert.equal(classifyMethod("trace"), "OTHER");
  assert.equal(classifyStatus(204), "2xx");
  assert.equal(classifyStatus(404), "4xx");
  assert.equal(classifyStatus(503), "5xx");
  assert.equal(classifyStatus(99), "UNKNOWN");
  assert.equal(durationBucket(49), "LT_50MS");
  assert.equal(durationBucket(250), "MS_250_1000");
  assert.equal(durationBucket(6000), "GT_5S");
  assert.equal(classifyTraffic("Mozilla/5.0 Chrome/123.0 Safari/537.36"), "LIKELY_BROWSER");
  assert.equal(classifyTraffic("Googlebot/2.1 (+http://www.google.com/bot.html)"), "KNOWN_SEARCH_CRAWLER");
  assert.equal(classifyTraffic("Playwright/1.0"), "KNOWN_AUTOMATION");
  assert.equal(classifyTraffic(null), "UNKNOWN_CLIENT");
  assert.equal(classifyTraffic("x".repeat(10000)), "UNKNOWN_CLIENT");
});

test("normalizes duration and fails closed for invalid timing", () => {
  assert.equal(normalizeDurationMs(125.6), 126);
  assert.equal(normalizeDurationMs(Number.NaN), null);
  assert.equal(normalizeDurationMs(Number.POSITIVE_INFINITY), null);
  assert.equal(normalizeDurationMs(-1), null);
});

test("propagates one monotonic duration and clears the request timer", () => {
  const currentRequest = request("/api/health");
  startRequestObservation(currentRequest, performance.now() - 125.6);
  const duration = finishRequestObservation(currentRequest);
  assert.ok(typeof duration === "number");
  assert.ok((duration as number) >= 100);
  assert.equal(finishRequestObservation(currentRequest), null);
});

test("classifies errors from bounded codes and status only", () => {
  assert.equal(
    classifyErrorCategory({ code: "DATABASE_TIMEOUT", message: "secret SQL" }, 500),
    "DATABASE",
  );
  assert.equal(classifyErrorCategory({ code: "AUTHORIZATION_DENIED" }, 403), "AUTHORIZATION");
  assert.equal(
    classifyErrorCategory({ code: "AI_PROVIDER_FAILURE", token: "secret" }, 502),
    "AI",
  );
  assert.equal(classifyErrorCategory(new Error("DATABASE_URL=secret"), 500), "INTERNAL");
});

test("emits bounded failure context without raw error data", () => {
  const observation = buildRequestObservation(
    request("/api/lessons/progress?email=person%40example.test"),
    {
      status: 503,
      durationMs: 120.4,
      error: { code: "DATABASE_TIMEOUT", message: "DATABASE_URL=secret" },
      correlationId: "req-safe-1",
    },
  );
  const serialized = JSON.stringify(observation);
  assert.equal(observation.outcome, "FAILURE");
  assert.equal(observation.errorCategory, "DATABASE");
  assert.equal(observation.durationMs, 120);
  assert.equal(observation.durationBucket, "MS_50_250");
  assert.equal(observation.correlationId, "req-safe-1");
  assert.equal(serialized.includes("DATABASE_URL"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("person"), false);
});

test("rejects unsafe inbound correlation IDs and generates a safe fallback", () => {
  const observation = buildRequestObservation(
    request("/api/health", { headers: { "x-request-id": "user@example.test" } }),
  );
  assert.match(observation.correlationId, /^[A-Za-z0-9._:-]{1,128}$/);
  assert.equal(observation.correlationId.includes("@"), false);
  assert.equal(observation.correlationId.includes("secret"), false);
});

test("accepts only primitive bounded correlation IDs at the runtime boundary", () => {
  const hostileObject = {
    secret: "SHOULD_NEVER_APPEAR",
    nested: { token: "NESTED_SECRET_MARKER" },
    toString() {
      throw new Error("coercion must not run");
    },
    valueOf() {
      throw new Error("coercion must not run");
    },
  };
  const proxy = new Proxy({}, {
    get() {
      throw new Error("proxy coercion must not run");
    },
  });
  const values: unknown[] = [
    hostileObject,
    proxy,
    new String("safe-id"),
    ["safe-id"],
    12345,
    true,
    Symbol("safe-id"),
    BigInt(12345),
    null,
    undefined,
    "x".repeat(129),
    "line\nwith\rcontrol\tcharacters\u0000",
  ];

  for (const value of values) {
    assert.doesNotThrow(() => {
      const observation = buildRequestObservation(request("/api/health"), {
        status: 200,
        correlationId: value as string,
      });
      const serialized = JSON.stringify(observation);
      assert.equal(typeof observation.correlationId, "string");
      assert.match(observation.correlationId, /^[A-Za-z0-9._:-]{1,128}$/);
      assert.equal(serialized.includes("SHOULD_NEVER_APPEAR"), false);
      assert.equal(serialized.includes("NESTED_SECRET_MARKER"), false);
      assert.equal(serialized.includes("coercion must not run"), false);
    });
  }
});

test("rejects correlation log injection and keeps the event schema fixed", () => {
  const lines: string[] = [];
  emitRequestObservation(
    request("/api/health"),
    {
      status: 200,
      correlationId: "safe-id\n{\"event\":\"FORGED\"}",
    },
    (line: string) => lines.push(line),
  );
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(typeof parsed.correlationId, "string");
  assert.match(parsed.correlationId, /^[A-Za-z0-9._:-]{1,128}$/);
  assert.equal(parsed.event, "SECURIUM_REQUEST_OBSERVATION_V1");
  assert.deepEqual(Object.keys(parsed).sort(), [
    "authCategory",
    "correlationId",
    "durationBucket",
    "durationMs",
    "environment",
    "errorCategory",
    "event",
    "method",
    "outcome",
    "routeFamily",
    "routeTemplate",
    "runtimeCategory",
    "severity",
    "statusClass",
    "trafficCategory",
  ].sort());
  assert.equal(lines[0].includes("FORGED"), false);
});

test("does not serialize request bodies, query values, or security markers", () => {
  const observation = buildRequestObservation(
    request("/api/health?token=query-secret&email=person%40example.test", {
      method: "POST",
      body: "SQL_INJECTION_MARKER <script>XSS_MARKER</script> SSRF_MARKER",
      headers: { "content-type": "text/plain" },
    }),
    { status: 200, correlationId: "safe-id" },
  );
  const serialized = JSON.stringify(observation);
  for (const forbidden of [
    "query-secret",
    "person",
    "SQL_INJECTION_MARKER",
    "XSS_MARKER",
    "SSRF_MARKER",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("malformed, oversized, and adversarial inputs use bounded fallbacks", () => {
  const malformed = buildRequestObservation({
    url: "not-a-url",
    method: "TRACE",
    headers: new Headers({ "user-agent": "unknown" }),
  } as Request);
  assert.equal(malformed.routeFamily, "OTHER_PAGE");
  assert.equal(malformed.routeTemplate, "/other");
  assert.equal(malformed.method, "OTHER");
  const oversized = buildRequestObservation({
    url: `https://example.test/${"x".repeat(1000)}`,
    method: "GET",
    headers: new Headers(),
  } as Request);
  assert.equal(oversized.routeFamily, "OTHER_PAGE");
  assert.equal(oversized.routeTemplate, "/other");
});

test("never serializes PII, secrets, raw path values, or headers", () => {
  const observation = buildRequestObservation(
    request("/learn/private-course/lesson-99?token=secret&email=person%40example.test", {
      method: "POST",
      headers: {
        authorization: "Bearer secret-token",
        cookie: "sa_access_token=secret-session",
        "user-agent": "Mozilla/5.0 secret-header",
      },
    }),
  );
  const serialized = JSON.stringify(observation);
  for (const forbidden of [
    "private-course",
    "lesson-99",
    "token",
    "person",
    "Bearer",
    "secret-session",
    "secret-header",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("emitter is fail-open and writes only one structured event", () => {
  const lines: string[] = [];
  const failingRequest = request("/api/lessons/progress");
  emitRequestObservation(failingRequest, 200, 100, (line: string) => lines.push(line));
  assert.equal(lines.length, 1);
  assert.doesNotThrow(() =>
    emitRequestObservation(failingRequest, 200, 100, () => {
      throw new Error("synthetic logger failure");
    }),
  );
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, "SECURIUM_REQUEST_OBSERVATION_V1");
  assert.equal(parsed.routeFamily, "PROGRESS_API");
  assert.equal(parsed.outcome, "SUCCESS");
  assert.equal(parsed.errorCategory, "NONE");
  assert.equal(parsed.durationMs, 100);
  assert.equal(parsed.durationBucket, "MS_50_250");
});

test("P0 anonymous classification has no application-user lookup dependency", () => {
  const source = readFileSync("lib/observability/request-observability.ts", "utf8");
  for (const forbidden of [
    "getOptionalCurrentAppUser",
    "getCachedCurrentAppUser",
    "resolveCurrentAppUser",
    "getCurrentAppUser",
    "requireCurrentAppUser",
    "findUserWithRoleCodesByEmail",
    "ensureUser",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  const observation = buildRequestObservation(request("/"));
  assert.equal(observation.authCategory, "ANONYMOUS");
});
