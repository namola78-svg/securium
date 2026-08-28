# SECURIUM VERCEL P4 — Runtime Observability Read-Only Architecture Design

Snapshot date: 2026-08-28
Authorization: `AUTHORIZE_P4_OBSERVABILITY_DESIGN_READ_ONLY`

## Final status

`SECURIUM_VERCEL_P4_OBSERVABILITY_DESIGN_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION`

This design is bounded, privacy-safe, and can answer the operational questions that were unavailable during the historical approximately 3.02M-invocation incident. Exact historical IP recovery remains intentionally impossible. Account-plan confirmation is not required for the recommended V1 because the baseline uses Vercel Runtime Logs/Observability, which Vercel documents as available on all plans; drains and extended retention remain optional preconditions for a later implementation choice.

## Fresh-main record

| Field | Result |
|---|---|
| Worktree | `C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/securium-vercel-observability-p4` |
| Branch | `design/vercel-observability-p4` |
| HEAD | `55dc6640ee25e269d5a9ba4ed8e472b51be40c0c` |
| Fresh `origin/main` | `55dc6640ee25e269d5a9ba4ed8e472b51be40c0c` |
| Main match | `YES` |
| Initial status | clean, tracking `origin/main` |

The requested separate worktree already existed at the prescribed path and was exactly at the expected fresh `origin/main`; it was reused as the fresh-main design worktree. No P3 branch was reused.

## Historical diagnostic gap

The retained historical material establishes invocation volume and a structural dynamic-SSR amplifier, but not the source. The checked-in `vercel-runtime-logs.jsonl` has request method, concrete request path, response status, deployment, environment, branch, cache, and Vercel source fields. It does not provide a durable application-level route-family, auth category, progress classification, privacy-safe bot category, or retained client-concentration view. Therefore it cannot prove whether the spike was browser traffic, crawler traffic, automation, progress polling, or another source. The report does not reinterpret that evidence as proof of a root cause.

## Current observability inventory

### Exact repository paths and capabilities

| Path | Current capability/evidence |
|---|---|
| `vercel-runtime-logs.jsonl` | Retained sample/export of Vercel request records; includes `requestMethod`, concrete `requestPath`, `responseStatusCode`, `deploymentId`, `environment`, `branch`, and Vercel source. This is evidence, not active instrumentation. |
| `vercel.json` | Only `ignoreCommand`; no drain, analytics, OTel, or observability configuration. |
| `proxy.ts` | Existing Next.js 16 proxy/auth boundary. It reads Supabase session cookies, may refresh a session, redirects protected anonymous requests, and covers selected auth/protected page prefixes. It is not an all-request logging boundary and does not currently log. |
| `lib/http.ts` | Shared API response helpers. `errorResponse` accepts a validated caller-supplied `x-request-id` or creates a UUID for error responses; it does not log request events. It also reads no body for logging. |
| `worker/index.ts` | Sets `x-request-id` if absent in the Cloudflare worker path; this is an existing transport correlation behavior, not Vercel observability. |
| `app/admin/page.tsx` | Local `console.error` for an admin dashboard summary-load failure. |
| `app/admin/ai-explainability/page.tsx` | Existing request-ID field is governance/AI explainability UI data, not runtime traffic telemetry. |
| `app/api/auth/supabase/oauth/callback/route.ts` | Existing error/redirect behavior around OAuth; no observability event model. |
| `app/api/ops/dashboard-performance/route.ts` | Direct JSON response path; no telemetry. |
| `app/api/health/route.ts` | Direct JSON health responses; no telemetry. |
| `app/error.tsx` | Error UI boundary; no runtime request telemetry. |
| `db/schema.ts` and audit/governance services | Request IDs exist in domain/governance records in places, but those are not runtime observability and must remain separate. |

Search found no `instrumentation.ts`, `instrumentation-client.ts`, Sentry configuration, OTel application setup, Vercel Analytics package, Speed Insights package, request logger, log-drain configuration, or active application request logger. `@opentelemetry/api` appears only as transitive lockfile material and is not an active integration.

### API and route inventory

The fresh main contains exactly 59 `app/api/**/route.ts` handlers, plus `app/questions/route.ts`, for 60 route-handler files total. The 59 API count matches the requested current/fresh-main count.

Verified route families and evidence-based mapping:

| Family | Repository route evidence |
|---|---|
| `PUBLIC_PAGE` | `/`, `/about`, `/courses`, `/courses/[courseSlug]`, `/guide`, `/legal`, `/legal/privacy`, `/legal/terms`, `/privacy`, `/terms` |
| `AUTH_PAGE` | `/login`, `/signup`, and `/api/auth/**` |
| `LEARNER_PAGE` | `/dashboard`, `/learn/**`, `/lectures/**`, `/my-courses`, `/my-learning`, `/practice/**`, `/reviews`, `/bookmarks`, `/profile`, `/settings`, `/wrong-notes`, `/mock-exams/**`, `/specialized/**`, `/practical/**`, `/ai-tutor`, `/analytics/**` |
| `ADMIN_PAGE` | `/admin/**` |
| `GOVERNANCE_PAGE` | `/admin/audit-logs`, `/admin/ai-explainability`, and related admin audit/governance screens; this remains a page family only, never a telemetry payload channel |
| `AUTH_API` | `app/api/auth/**` |
| `PROGRESS_API` | `app/api/audio/progress`, `app/api/course-lessons/progress`, `app/api/lessons/progress`, `app/api/lectures/progress` |
| `LEARNING_API` | bookmarks, enrollments, learning-settings, lectures bookmark/note, levels, mock-exams, question-attempts, question-reports, wrong-notes, and other learner data handlers under `app/api` |
| `AI_API` | `app/api/ai/**` and practical analysis/assessment handlers where the route is AI-backed; payloads are never logged |
| `ADMIN_API` | `app/api/admin/**` |
| `HEALTH_API` | `app/api/health` and operational health/performance endpoints |
| `OTHER_API` | Any future or currently unmapped `app/api/**` route; unknown is a deliberate safe fallback |

This is 12 low-cardinality family labels. `GOVERNANCE_PAGE` is not a governance event stream; governance audit remains separate.

## Current Vercel-native evidence and capability assessment

Official current documentation states that Runtime Logs and Observability are available on all plans. Runtime Logs expose request method, route/template versus concrete request path, status, request ID, user agent, deployment/environment/branch, and function/middleware details. Vercel documents plan-dependent retention: Hobby 1 hour, Pro 1 day, Enterprise 3 days, with Observability Plus extending eligible plans to 30 days. The checked-in runtime log sample corroborates the presence of deployment/environment/branch/method/path/status fields.

Vercel documents the following separately:

| Facility | Assessment for this project |
|---|---|
| Runtime Logs | Available and structurally sufficient for 100% request-level route/method/status/deployment correlation, subject to plan retention. Existing sample proves the project has used this surface. |
| Observability / Functions metrics | Native invocation/error/per-route aggregation is the primary baseline for spike counts and function breakdown. No setting is enabled or changed by this report. |
| Web Analytics | Not installed in the repository. Useful for pageviews/visitor analysis but not sufficient alone for API progress writes, HTTP status classes, or auth classification. Do not enable in P4 read-only. |
| Speed Insights | Not installed in the repository. Useful for Core Web Vitals, not invocation attribution. Do not enable in P4 read-only. |
| OpenTelemetry | Next.js supports root `instrumentation.ts` and runtime-conditional registration. No app OTel is present. OTel is optional for detailed traces and should not be V1’s required dependency. |
| Log Drains | Vercel documents drains as Pro/Enterprise. Account plan and destination are not confirmed here; no drain is configured or enabled. Treat drains as an optional export/retention gate, not a prerequisite for the native V1 design. |
| Request logs | Native Vercel request logs are available through dashboard/CLI/API surfaces; they include request path and route-template views. Application logging should add only missing categorical fields. |
| Deployment metadata | Native logs carry deployment ID, environment, and branch; deployment details provide build/deployment context. Runtime code must not perform Git or Vercel API lookups. |

Sources: [Next.js instrumentation](https://nextjs.org/docs/app/guides/instrumentation), [Vercel Runtime Logs](https://vercel.com/docs/logs/runtime), [Vercel Observability](https://vercel.com/docs/observability), [Vercel Observability Insights](https://vercel.com/docs/observability/insights), [Vercel Drains](https://vercel.com/docs/drains/using-drains), and [Vercel CLI logs](https://vercel.com/docs/cli/logs).

## Recommended P4 V1 architecture

`Incoming request → native Vercel request/runtime record → one centralized low-cardinality classifier → response-boundary structured event for missing app categories → native Runtime Logs/Observability query → incident aggregation by time, route family, method, status class, category, and deployment metadata`

The implementation gate should use the existing shared API response boundary (`lib/http.ts`) for API completion events and a narrowly scoped server instrumentation/request context for request start, duration, route normalization, traffic category, and deployment metadata. It should not wrap or rewrite 59 handlers individually unless an audit finds a handler bypasses the shared response boundary. Public SSR attribution should rely on Vercel’s native route-template/request record plus deterministic route-family mapping; no identity lookup is permitted for SSR observability.

The application event is intentionally one compact JSON line per completed instrumented request, emitted to stdout for Vercel collection. There is no external request per application request, no database write, and no synchronous telemetry dependency. On the Vercel platform, native request records remain the authoritative invocation count; app events are diagnostic dimensions and must not be summed as invocations without deduplication.

### Minimum event model

Required fields only:

```text
event = {
  eventName: "request_observed",
  timestamp,
  requestId,
  routeTemplate,
  routeFamily,
  method,
  statusClass,
  authCategory,
  trafficCategory,
  runtimeCategory,
  environment,
  deploymentId?,
  durationBucket
}
```

`responseSizeBucket` is deferred: it is not needed to answer the historical questions and can add runtime/response instrumentation complexity. Exact status is retained only in native Vercel logs for drill-down; the app event uses `2xx`, `3xx`, `4xx`, `5xx`, or `unknown`.

### Auth category and P0 firewall

Allowed categories are `ANONYMOUS`, `AUTHENTICATED`, and `UNKNOWN`.

The classifier must never call `getOptionalCurrentAppUser`, `getCachedCurrentAppUser`, `resolveCurrentAppUser`, `findUserWithRoleCodesByEmail`, or `ensureUser` merely to log a request. For public SSR, absence of a trusted authenticated execution context is `ANONYMOUS`; a cookie/header marker alone is not proof and must be `UNKNOWN` or a route-derived public signal. For API requests, `AUTHENTICATED` may be set only by the existing handler’s already-required auth success (`requireApiUser`) through an in-memory request context, without a second lookup. Auth classification is therefore diagnostic and may be `UNKNOWN`; it never changes authorization, session, or role semantics.

### Traffic category

Allowed categories are `LIKELY_BROWSER`, `KNOWN_SEARCH_CRAWLER`, `KNOWN_AUTOMATION`, and `UNKNOWN_CLIENT`.

Classification uses a bounded parser over the User-Agent value and known crawler/automation signatures. It stores only the category and optionally a short classifier version, never the raw User-Agent. This is a heuristic signal: User-Agent spoofing is expected and the category is not a security decision. No blocking, rate limiting, fingerprinting, or client identity is included in P4.

### Route normalization

Never log the concrete path or query string in application telemetry. Prefer Next/Vercel route templates where available. For fallback normalization, use the static route manifest and segment-aware matching in this order:

1. Exact static path.
2. Known route templates, replacing dynamic segments with `[courseSlug]`, `[lessonId]`, `[courseLessonId]`, `[lectureId]`, `[attemptId]`, `[sampleId]`, `[scenarioId]`, `[contentId]`, `[revisionId]`, `[questionId]`, `[mockExamId]`, `[subjectId]`, `[topicId]`, `[levelId]`.
3. API catch-all families such as `/api/progress/[...]` only for an actually unmatched progress route.
4. `OTHER_API` or `OTHER_PAGE` fallback.

Query strings are discarded. Route templates remain bounded because names are from a fixed manifest, not user input. Unbounded course/lesson/session IDs never become labels.

### Request ID

Use a server-generated UUID where the runtime does not already supply a request ID. If an incoming ID is accepted for correlation, treat it as an untrusted opaque value: validate length/character set, prevent CR/LF, never use it for auth, governance, routing, or authorization, and prefer the Vercel/native request ID in the event. The existing `x-request-id` behavior in `lib/http.ts` and `worker/index.ts` is correlation only and should not be expanded into authority.

### Duration and runtime

Use the fixed buckets `<50ms`, `50–250ms`, `250ms–1s`, `1–5s`, `>5s`, and `unknown`. `runtimeCategory` is a bounded value such as `node`, `edge`, `middleware`, `static`, or `unknown`; it is not inferred from arbitrary headers. No raw duration label or high-cardinality metric label is emitted.

## Progress and public SSR coverage

Exact progress endpoints are:

- `app/api/audio/progress/route.ts`: `GET` and `POST`.
- `app/api/course-lessons/progress/route.ts`: `POST`.
- `app/api/lessons/progress/route.ts`: `POST`.
- `app/api/lectures/progress/route.ts`: `GET` and `POST`.

The V1 aggregate can answer progress writes per hour by filtering `routeFamily=PROGRESS_API` and `method=POST`, then grouping by status class and auth category. It can distinguish successful versus failed writes with `2xx` versus `4xx/5xx`; it never includes learner, course, lesson, audio, lecture, session, or request-body identifiers. Existing P2 behavior, limits, validation, and database operations are unchanged.

Public SSR routes relevant to the historical question are `/`, `/courses`, `/courses/[courseSlug]`, `/about`, `/guide`, `/legal`, `/legal/privacy`, `/legal/terms`, `/privacy`, `/terms`, `/login`, and `/signup`. Native route-template logs plus `PUBLIC_PAGE`/`AUTH_PAGE` mapping and traffic category are sufficient to distinguish landing, catalog, legal/auth, and crawler-like request groups without application-user DB work.

All 59 API handlers are covered by native Vercel request/function records. Application enrichment should be centralized through the shared HTTP response boundary, with an explicit audit for direct-response exceptions (`health`, `auth`, OAuth, and operational handlers). This avoids a 59-file instrumentation edit and preserves a safe unknown fallback.

## Options considered

| Option | Size/cost | Privacy/queryability | Decision |
|---|---|---|---|
| A. Vercel-native only | Smallest, zero app overhead; plan retention applies | Strong native method/status/route/deployment data; lacks trusted app auth/progress category and custom crawler category | Useful baseline, insufficient alone for every P4 question |
| B. Structured application stdout events | Small shared boundary; one log line/request; no DB/external request | Low-cardinality, queryable in Runtime Logs; requires careful redaction and response-boundary coverage | Recommended V1 |
| C. OpenTelemetry traces | Larger dependency/export design; sampling and drain/collector plan needed | Excellent detailed traces but greater privacy/cardinality/cost risk; not needed for counts | Defer to V1.1 only if traces are justified |
| D. Hybrid native + app events | Small bounded app enrichment with native counts and deployment metadata | Best fit: native invocation truth plus categorical app dimensions; no forced drain | Recommended architecture |

Do not use Web Analytics or Speed Insights as the primary invocation diagnosis. Do not store telemetry in Supabase application tables or D1. Database-backed telemetry would add DB writes, possible invocation/latency amplification, privacy/retention burden, and coupling to the application data plane.

## Privacy, security, and cardinality model

Never collect raw email, user ID, name, IP, cookie, Authorization header, OAuth code, session token, Supabase token, request body, user-content query values, full User-Agent, governance decision payloads, `HumanDecisionHash`, `actorAuditLogId`, receipt UUIDs, PIA subject IDs, Evidence Projection data, or MCP-exposed raw telemetry.

Raw IP storage is `NO`. A short-lived non-reversible coarse hash is deferred: it would improve concentration analysis but creates salt/key, re-identification, retention, and spoofing complexity. V1 answers concentration only through native aggregate diagnostics that Vercel makes available; it does not promise exact source identity.

High-cardinality firewall: zero unbounded user-controlled labels. The event schema rejects/suppresses raw URL, query string, user ID, course ID, lesson ID, session ID, request body, full User-Agent, IP, and arbitrary header values. Fixed enums are used for route family, traffic category, auth category, runtime category, status class, and duration bucket. The intended high-cardinality field count is `0`.

Security review:

- **Critical:** telemetry must not invoke auth/application-user lookup; must not affect authorization/session/role semantics; must not log secrets or governance/evidence payloads; must fail open.
- **High:** sanitize CR/LF and control characters; never trust caller request IDs as authority; classify User-Agent as spoofable; cap emitted event size and keys; rate-limit or sample diagnostic logs only through explicit platform controls; prevent one request from producing unbounded telemetry.
- Log injection is prevented by JSON encoding and value allowlists, not string concatenation.
- Telemetry failure is caught or delegated to platform-native behavior; the application response continues.

## Retention, sampling, alerting, and baseline

Recommendation: retain detailed request events for 7 days where the selected Vercel plan/platform supports it, with 24 hours as the safe minimum and 30 days only as an incident-approved extended-retention option. Do not retain detailed telemetry indefinitely. Native plan limits must be documented at implementation time; no assumption of Observability Plus is made.

Recommendation: 100% low-cardinality request events/counters for spike attribution, because sampling would make invocation and progress counts ambiguous. Detailed traces are not part of V1; if added later, sample them explicitly and carry a sampling-rate/scaling field. Never add sampled trace counts to native invocation totals.

Future alert designs, without implementation or arbitrary thresholds:

- invocations/hour above a baseline-derived threshold;
- progress POST rate anomaly;
- 5xx rate anomaly;
- one route-family concentration anomaly;
- crawler-category surge;
- deployment-window correlation.

The first 7–14 days after bounded implementation should establish requests/hour, route-family distribution, progress-write rate, 5xx rate, and anonymous/authenticated ratio separately for environment and deployment. Baselines must be segmented by weekday/time-of-day and marked diagnostic, not canonical facts.

## Correlation boundaries

Runtime events should use native deployment ID, environment, branch, and Vercel-provided request metadata. Git SHA can be taken from deployment metadata/environment if already present; runtime must not perform Git lookups. P3 build/deployment evidence remains a separate timestamped dataset. Queries may join on a time window and deployment ID for investigation, but must not merge build identity and request identity semantically. No MCP raw observability exposure is designed in P4.

## Expected questions

| Question | P4 V1 answer |
|---|---|
| Top route family? | YES, from fixed route-family aggregation. |
| Top method? | YES. |
| Top status class? | YES; exact status remains native drill-down only. |
| Anonymous/authenticated? | YES as diagnostic categories where existing auth context is available; `UNKNOWN` is retained for ambiguous/public cases. No extra DB lookup. |
| Progress write volume? | YES, by hour, method, route family, status class, and auth category. |
| Likely crawler category? | YES, heuristically by category; not perfect bot detection. |
| Single-source concentration? | PARTIAL: native/platform aggregate concentration diagnostics may indicate it; V1 deliberately does not persist raw IP or a client fingerprint. |
| Deployment correlation? | YES, through native deployment/environment/branch metadata and timestamp correlation. |
| Exact historical IP? | NO, intentionally and permanently unavailable from this design. |
| Historical 3.02M source diagnosable with P4? | YES, prospectively: route/method/status/progress/auth/traffic/deployment dimensions would narrow the source rapidly. It would not prove an exact person/IP or repair missing historical retention. |

## Exact future candidate implementation files

No implementation is made in P4. The smallest likely future scope is:

- `instrumentation.ts` — Next.js-supported server registration/runtime boundary, only if needed for request context/OTel-neutral initialization.
- `lib/observability/request-observability.ts` — allowlisted event type, route normalization, family mapping, User-Agent categorization, status/duration bucketing, redaction, fail-open emitter.
- `lib/observability/request-context.ts` — request-scoped in-memory context for native request ID and existing auth result; no persistence.
- `lib/http.ts` — narrow response-boundary hook to emit API completion events, preserving existing response/auth/error semantics.
- `proxy.ts` — only if implementation proves a trusted, non-semantic request-start signal is needed; do not add logging of cookies/tokens or alter matching/auth behavior otherwise.
- `tests/request-observability.test.ts` — deterministic classifier/normalization/privacy/cardinality tests.
- `tests/request-observability-p0-regression.test.ts` — anonymous landing zero-DB-lookup regression test.
- `tests/request-observability-failure.test.ts` — telemetry failure cannot fail the application request.
- `docs/securium-vercel-p4-observability.md` — operational query, retention, baseline, and trust limitations.

No route-by-route instrumentation should be the default. Direct-response exceptions must either use the same shared boundary or emit an explicit safe `UNKNOWN` event after an implementation audit.

## Test strategy

Tests must prove:

1. Dynamic path normalization and query removal for every listed dynamic segment.
2. No PII fields, request body, cookie, token, raw IP, full User-Agent, governance payload, or evidence payload.
3. User-Agent categorization into fixed categories and spoofing/unknown behavior.
4. Anonymous classification without any DB/auth application-user lookup.
5. Progress route/method classification for all four exact P2 endpoint files.
6. Unknown route fallback to `OTHER_API`/`OTHER_PAGE`.
7. Telemetry emitter failure returns/does not alter the application response.
8. Low-cardinality output: all values are allowlisted and event size is bounded.
9. Request-ID validation rejects CR/LF and oversized/untrusted values and never grants authority.
10. Status and duration bucket boundaries are deterministic.

The critical P0 test should instrument or mock the prohibited functions and exercise anonymous `/` plus a public catalog/legal route. The assertion is zero calls to `getOptionalCurrentAppUser`, `getCachedCurrentAppUser`, `resolveCurrentAppUser`, `findUserWithRoleCodesByEmail`, and `ensureUser`. An authenticated API test should prove the event can reuse the already-established `requireApiUser` result without a second lookup.

Performance target: `NEGLIGIBLE` qualitative overhead for classification and one bounded stdout write; no external request and no database write per application request. This is a target, not a production percentage claim. A deterministic local benchmark should compare a no-op request handler with the classifier/emitter path over a large fixed sample, record CPU/time and serialized byte size, and gate on no unexpected network/DB calls.

## Validation performed

| Gate | Result |
|---|---|
| `npm run typecheck` | NOT RUN TO COMPLETION: `tsc` not recognized; checkout has no usable `node_modules` binary. |
| `npm run lint` | NOT RUN TO COMPLETION: `eslint` not recognized; checkout has no usable `node_modules` binary. |
| `npm run build` | NOT RUN TO COMPLETION: `next` not recognized; checkout has no usable `node_modules` binary. |
| Existing relevant observability tests | None found as an active observability test suite. |

No dependency installation was performed because this is a read-only architecture design and the requested validation could not start without the local dependency installation. No production connection was made.

## Required firewalls and handoff state

| Field | Result |
|---|---|
| P0 changed | `NO` |
| P1 changed | `NO` |
| P2 changed | `NO` |
| P3 changed | `NO` |
| Auth changed | `NO` |
| Session semantics changed | `NO` |
| Role semantics changed | `NO` |
| Schema changed | `NO` |
| Migration changed | `NO` |
| Application DB telemetry writes | `0` |
| D1 telemetry writes | `0` |
| External request per application request | `0` |
| Vercel settings changed | `NO` |
| Commit | `NO` |
| Push | `NO` |
| PR | `NO` |
| Merge | `NO` |
| Deployment | `NO` |
| Production connection | `NO` |
| Exact IP recoverable | `NO` |
| Auth DB lookup added | `NO` |
| Raw User-Agent stored | `NO` |
| Raw IP stored | `NO` |
| High-cardinality field count | `0` |
| Runtime overhead classification | `NEGLIGIBLE` target; measure locally before implementation approval |

## Final summary

### HISTORICAL GAP

The approximately 3.02M invocations lacked retained route-family, method/status aggregation, safe auth/traffic categories, progress-specific counters, and deployment-window correlation. Retained concrete paths and platform fields could not prove the traffic source.

### P4 V1

Use Vercel-native request/runtime logs and Observability for 100% request/invocation truth, enriched by one centralized, low-cardinality, fail-open application event boundary for route family, auth category where an existing auth result already exists, traffic category, progress classification, and coarse duration.

### PRIVACY

Deliberately collect no raw IP, email, user ID, name, cookie, token, body, user-content query, full User-Agent, governance payload, Evidence Projection, or raw MCP telemetry.

### CARDINALITY

Fixed route templates, 12 evidence-based route families, four status classes, four traffic categories, three auth categories, bounded runtime categories, and five duration buckets. No unbounded user-controlled labels.

### P0 FIREWALL

Anonymous/public observability performs zero application-user or role DB lookups and cannot call the prohibited auth helpers merely to classify traffic.

### COST

Expected overhead is negligible qualitatively: bounded local classification, one bounded stdout event where needed, zero application DB telemetry writes, zero D1 writes, and zero external requests per application request. Production overhead must be measured before implementation authorization.

### DIAGNOSTIC VALUE

Future spikes can be attributed by route family, method, status class, progress volume, diagnostic auth category, heuristic crawler/browser category, deployment/environment, and time window. Concentration can be assessed only in privacy-safe aggregate form; exact IP is not recoverable.

### LIMITATIONS

User-Agent bot categories are spoofable heuristics. Auth is `UNKNOWN` where no trusted existing auth result is present. Native/platform retention is plan-dependent. Sampling is not used for V1 counts. Historical missing dimensions cannot be reconstructed.

### NEXT GATE

`AUTHORIZE_P4_OBSERVABILITY_BOUNDED_IMPLEMENTATION`

Recommended next step: obtain bounded implementation authorization, then install dependencies only as needed for validation, implement the listed shared-boundary files, run the P0 regression/performance tests plus typecheck/lint/build, and separately confirm the selected Vercel plan/retention or optional drain destination before any platform operation.

## P4 BOUNDED IMPLEMENTATION

Implementation completed on the approved fresh-main worktree. The implementation uses a small pure classifier and the existing shared API response helpers; it does not add `instrumentation.ts` or alter `proxy.ts` because neither can safely provide final response lifecycle coverage without a broader framework change.

### Actual implementation

- `lib/observability/request-observability.ts` — one stable event, allowlisted route/method/status/auth/traffic/runtime/environment/duration categories, path normalization, bounded fallbacks, and fail-open stdout emission.
- `lib/http.ts` — emits one observation through the existing success/error response boundary; error events use the already computed final public status. Existing response, error, request-ID, auth, and domain behavior is preserved.
- `tests/request-observability.test.ts` — focused route, progress, normalization, PII, cardinality, traffic, fail-open, and P0 dependency tests.

No new dependency was required. No `instrumentation.ts` was added. Native Vercel request/runtime records remain the source for invocation truth and native deployment/request correlation; application events supply only bounded diagnostic dimensions.

### Event contract

Stable event name: `SECURIUM_REQUEST_OBSERVATION_V1`.

```json
{
  "event": "SECURIUM_REQUEST_OBSERVATION_V1",
  "routeFamily": "PROGRESS_API",
  "routeTemplate": "/api/lessons/progress",
  "method": "POST",
  "statusClass": "2xx",
  "authCategory": "AUTHENTICATED",
  "trafficCategory": "LIKELY_BROWSER",
  "runtimeCategory": "UNKNOWN",
  "environment": "UNKNOWN",
  "durationBucket": "UNKNOWN"
}
```

The example is synthetic and contains no request ID, raw path value, query, user, IP, cookie, token, or governance identity. Request ID is intentionally omitted from the application event to keep aggregate cardinality at zero; Vercel native records retain their own request correlation.

The 12 approved core route families are implemented: `PUBLIC_PAGE`, `AUTH_PAGE`, `LEARNER_PAGE`, `ADMIN_PAGE`, `GOVERNANCE_PAGE`, `AUTH_API`, `PROGRESS_API`, `LEARNING_API`, `AI_API`, `ADMIN_API`, `HEALTH_API`, and `OTHER_API`. `OTHER_PAGE` is a bounded page fallback and is not a new business family.

Allowed method categories: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `OTHER`.
Allowed status categories: `2xx`, `3xx`, `4xx`, `5xx`, `UNKNOWN`.
Allowed auth categories: `ANONYMOUS`, `AUTHENTICATED`, `UNKNOWN`.
Allowed traffic categories: `LIKELY_BROWSER`, `KNOWN_SEARCH_CRAWLER`, `KNOWN_AUTOMATION`, `UNKNOWN_CLIENT`.
Allowed runtime categories: `NODE`, `EDGE`, `MIDDLEWARE`, `UNKNOWN`.
Allowed duration categories: `LT_50MS`, `MS_50_250`, `MS_250_1000`, `S_1_5`, `GT_5S`, `UNKNOWN`.

Auth classification deliberately uses only route/public-success signals available at the shared boundary. It does not resolve a user. Protected successful progress/admin events can be marked `AUTHENTICATED`; ambiguous routes remain `UNKNOWN`. This is diagnostic, not an authentication or authorization fact.

### Coverage and privacy guarantees

Route normalization uses URL parsing, query/fragment removal, fixed known templates, and bounded `/api/[...]` or `/other` fallbacks. Dynamic slugs, IDs, UUID-like values, and arbitrary paths never enter emitted fields. The four P2 progress route files are covered by `PROGRESS_API` classification:

- `app/api/audio/progress/route.ts`
- `app/api/course-lessons/progress/route.ts`
- `app/api/lessons/progress/route.ts`
- `app/api/lectures/progress/route.ts`

All 59 API handlers retain native Vercel coverage. API handlers using `successResponse`/`errorResponse` receive shared application observations; direct-response exceptions remain observable through native Vercel records and safely fall back in future integration work rather than receiving invasive route edits.

Privacy matrix: raw URL `NO`; raw query `NO`; raw IP `NO`; hashed IP `NO`; full User-Agent `NO`; email `NO`; user ID `NO`; application user ID `NO`; session ID `NO`; cookie `NO`; Authorization `NO`; OAuth code `NO`; request body `NO`; `HumanDecisionHash` `NO`; `actorAuditLogId` `NO`; receipt UUID `NO`.

Event fields are fixed enums/templates only. High-cardinality field count is `0`. Observability Event is not Security Audit, Governance Audit, Learning Evidence, Canonical Learning Fact, Billing Authority, Authentication Authority, or Authorization Authority.

### P0, P2, and failure proof

The P0 test verifies that the observability module contains no dependency on `getOptionalCurrentAppUser`, `getCachedCurrentAppUser`, `resolveCurrentAppUser`, `getCurrentAppUser`, `requireCurrentAppUser`, `findUserWithRoleCodesByEmail`, or `ensureUser`, and that anonymous `/` classification remains `ANONYMOUS`. Telemetry-specific call counts are all zero: `0 / 0 / 0 / 0 / 0` for the five required application-user lookup functions.

The P2 progress suite passed unchanged. It continues to prove the 15-second cadence, dirty-state suppression, pause behavior, final checkpoints, in-flight serialization, and hidden-tab behavior. No P2 route or client file changed; no new polling, checkpoint, timer, or database write was introduced.

Emitter and classifier failures are caught and fail open. There is no retry loop, fallback persistence, external transport, request body serialization, or response mutation.

### Performance measurement

Deterministic local measurement used 20,000 synthetic progress requests and compared classifier execution to a local no-op baseline. Measured incremental classifier cost was median `0.0018 ms`, p95 `0.0030 ms`; classification is `NEGLIGIBLE`. This is local evidence only, not a production overhead claim. Serialization/stdout volume must still be observed during a future non-production deployment review.

### Validation record

| Validation | Result |
|---|---:|
| Focused P4 tests | PASS 8/8 |
| P0 regression tests | PASS 1/1 within focused suite; all prohibited lookup references/calls 0 |
| P2 progress regression tests | PASS 6/6 |
| Full unit suite | PASS 448/448 |
| Integration suite | PASS 59/59 |
| Migration guard | PASS 10/10 |
| `db:check` | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| New skips | 0 |
| New only | 0 |
| New todo | 0 |
| Assertion weakening | 0 |
| New lint suppression | 0 |
| Unsafe type escape | 0 |
| Security Critical | 0 |
| Security High | 0 |
| Data Trust Critical | 0 |
| Data Trust High | 0 |

### Implementation state and firewalls

Dependencies were absent before implementation; locked `npm ci` was performed; dependencies are present afterward. `package.json` and `package-lock.json` are unchanged. No Vercel Dashboard change, integration, drain, deployment, or production connection occurred.

P0 changed `NO`; P1 changed `NO`; P2 changed `NO`; P3 changed `NO`. Auth semantics, session semantics, role semantics, schema, migration, content, ontology, evidence, MCP, and governance runtime are unchanged. Application DB telemetry writes `0`; D1 telemetry writes `0`; external telemetry request per application request `0`; telemetry polling `0`; additional timer `0`; additional auth lookup `0`.

P3 classifier changed `NO`. Expected P3 decision for a future P4 PR is `BUILD`; this implementation is runtime code and must not be treated as evidence-only build-skippable content.

The historical approximately 3.02M source remains unproven. A future equivalent spike is prospectively diagnosable by route family/template, method, status class, progress endpoint, heuristic traffic category, bounded auth category, and deployment/environment correlation. Exact raw-IP attribution and exact user attribution remain intentionally `NO`.

## P4 OBSERVABILITY

Implemented a centralized low-cardinality classifier and fail-open structured event emitter at the existing shared API response boundary. Vercel-native request/runtime logs remain the native invocation and deployment correlation boundary.

## EVENT CONTRACT

Event name is `SECURIUM_REQUEST_OBSERVATION_V1`. Fields are `event`, `routeFamily`, `routeTemplate`, `method`, `statusClass`, `authCategory`, `trafficCategory`, `runtimeCategory`, `environment`, and `durationBucket`, all bounded or normalized.

## ROUTE COVERAGE

The 12 approved core route families are implemented. Public landing/catalog/auth/legal routes, all 59 API routes through native Vercel coverage, shared-boundary API observations, and all four P2 progress route files are covered. Unknown API/page inputs use bounded fallbacks.

## PRIVACY

Raw URL/query/IP/full User-Agent/user/session identifiers, email, cookies, Authorization, OAuth code, request body, secrets, governance identifiers, Evidence Projection data, and MCP raw telemetry are not emitted.

## CARDINALITY

Fixed enums and route templates are used; arbitrary dynamic path, query, User-Agent, and identity values are discarded. High-cardinality field count is `0`.

## P0 FIREWALL

Observability introduces zero auth/application-user DB lookup. The five required telemetry-specific lookup counts are all zero.

## P2 FIREWALL

P2 progress semantics remain unchanged: 15-second cadence, dirty-state suppression, pause/end checkpoints, in-flight serialization, and hidden-tab behavior are preserved.

## P3 FIREWALL

The P3 classifier remains unchanged. A future P4 runtime PR must `BUILD`; it must not be treated as evidence-only build-skippable content.

## COST

Application DB writes, D1 writes, external telemetry requests, polling, timers, and additional auth lookups are all `0`. Local deterministic measurement used 20,000 samples: median `0.0018 ms`, p95 `0.0030 ms`, classified `NEGLIGIBLE`.

## FAILURE BEHAVIOR

Classifier and emitter failures are caught; telemetry failure cannot fail application behavior, authentication, learning, or governance requests.

## DIAGNOSTIC VALUE

A future equivalent of the 3.02M invocation spike becomes attributable by route family/template, method, status class, progress volume, heuristic traffic category, bounded auth category, and deployment/environment correlation. Exact raw IP and exact user attribution remain outside V1.

## HISTORICAL CLAIM

The actual historical 3.02M source remains unproven. P4 closes the evidence gap prospectively and does not retroactively manufacture historical facts.

## VALIDATION

Focused P4: 8/8; P2 regression: 6/6; full unit: 448/448; integration: 59/59; migration guard: 10/10; typecheck, lint, `db:check`, and build: PASS. New skip/only/todo/assertion-weakening/lint-suppression/unsafe-type-escape counts are all `0`.

## NEXT GATE

`REVIEW_AND_COMMIT_P4_OBSERVABILITY_BOUNDED_IMPLEMENTATION`

## P4 FINAL REVIEW

Fresh-main revalidation after implementation: `HEAD` and `origin/main` both remain `55dc6640ee25e269d5a9ba4ed8e472b51be40c0c`; merge base is identical; ahead/behind is `0/0`.

Exact API boundary review found 59 API route files total, 52 using the shared `lib/http.ts` response helpers, and 7 not using them: `app/api/auth/session/route.ts`, `app/api/auth/supabase/login/route.ts`, `app/api/auth/supabase/logout/route.ts`, `app/api/auth/supabase/oauth/callback/route.ts`, `app/api/auth/supabase/oauth/google/route.ts`, `app/api/auth/supabase/signup/route.ts`, and `app/api/health/route.ts`. The seven retain baseline request visibility through native Vercel Runtime Logs/Observability. This report does not claim 59/59 application-event coverage.

Final deterministic benchmark: 20,000 samples; median `0.0018 ms`; p95 `0.0033 ms`; `NEGLIGIBLE`. Final focused P4 tests are `8/8`, P2 regression tests `6/6`, full unit `448/448`, integration `59/59`, migration guard `10/10`, typecheck/lint/`db:check`/build all pass. No P0/P1/P2/P3 reversion was detected. P3 classification for this runtime change is `BUILD`.
