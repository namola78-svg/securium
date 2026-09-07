# Securium P4 Privacy-Safe Minimal Server Observability Implementation

Snapshot: 2026-09-07 (Asia/Seoul)

## Decision

- Final Status: `SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_IMPLEMENTATION_PASS_READY_FOR_REVIEW`
- Implementation Decision: `IMPLEMENT_PRIVACY_SAFE_SERVER_LOGGING_AND_NATIVE_VERCEL_METRICS`
- Readiness: `P4_MINIMAL_SERVER_OBSERVABILITY_IMPLEMENTED_INDEPENDENT_REVIEW_REQUIRED`
- Primary Next Gate: `REVIEW_SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_IMPLEMENTATION`
- Scope: `SERVER_LOGGING_AND_METRICS`
- Server-first: `YES`

The approved bounded scope is implemented. It emits one bounded structured server event at the existing shared HTTP response boundary. Vercel Runtime Logs can aggregate the fixed event fields without a custom telemetry store. Distributed tracing, client telemetry, drains, analytics, and payload capture remain deferred or out of scope.

## Files changed

Implementation files changed in this worktree:

- `lib/observability/request-observability.ts`
- `lib/http.ts`
- `tests/request-observability.test.ts`
- `package.json` (`test:observability` focused runner)

Pre-existing readiness artifacts were preserved and are not implementation changes:

- `docs/observability/securium-vercel-p4-bounded-implementation-readiness-2026-09-07.md`
- `reports/securium-vercel-p4-bounded-implementation-readiness-2026-09-07.json`

No route files, content, governance, currentness, Evidence, schema, migration, or database files were changed.

## Final event contract

The only event name is `SECURIUM_REQUEST_OBSERVATION_V1`. The exact emitted fields are:

```text
event
severity
routeFamily
routeTemplate
method
statusClass
outcome
errorCategory
authCategory
trafficCategory
runtimeCategory
environment
durationMs
durationBucket
correlationId
```

All values are fixed unions, bounded route templates, bounded classifications, finite normalized numbers, or a validated random/non-semantic correlation ID. There is no arbitrary event name or `Record<string, unknown>` provider path. Serialized events longer than 2048 characters are dropped fail-open.

Allowed fields are exactly the fields above. Request and response bodies, query values, raw URLs, arbitrary headers, user/resource identifiers, raw SQL, raw errors, stack traces, AI prompts/responses, learning Evidence, security-training payloads, and secrets are forbidden.

## Duration and outcome

`startRequestObservation()` stores a monotonic `performance.now()` start time in a `WeakMap<Request, number>`. `finishRequestObservation()` consumes it once, rounds finite non-negative elapsed time to milliseconds, caps it at 24 hours, and returns `null` for missing or invalid timing. The shared HTTP helper starts timing at `assertSameOrigin()` and `readRequestInput()`, then completes it at `successResponse()` or `errorResponse()`.

`outcome` is bounded to `SUCCESS`, `FAILURE`, or `UNKNOWN`. Explicit caller values are accepted only for `SUCCESS` or `FAILURE`; otherwise status/error classification determines the result. No caller-supplied arbitrary outcome is emitted.

`durationMs` is a numeric log field, and `durationBucket` is the bounded metric-friendly field: `LT_50MS`, `MS_50_250`, `MS_250_1000`, `S_1_5`, `GT_5S`, or `UNKNOWN`. Duration is never a metric dimension.

## Error taxonomy

The exact allowed `errorCategory` values are:

```text
NONE | VALIDATION | AUTH | AUTHORIZATION | DATABASE | EXTERNAL_SERVICE |
AI | RATE_LIMIT | CONFIGURATION | INTERNAL | UNKNOWN
```

Classification reads only a bounded `error.code` value when present and HTTP status. It never reads or serializes an error message, SQL, values, credentials, or a complete Error object. A successful event always uses `NONE`; failed/unknown events use the bounded categories above.

## Correlation-ID policy

The implementation prefers an existing safe `x-vercel-id`, then safe `x-request-id`, only when it matches `[A-Za-z0-9._:-]{1,128}`. Otherwise it generates `crypto.randomUUID()`, with `UNAVAILABLE` as a final non-throwing fallback. The ID is random/non-semantic, contains no identity or business/resource ID, is allowed in logs, and is never a metric dimension. The existing response `x-request-id` behavior is preserved; no new user identity lookup or hash is introduced.

## Sanitization and privacy boundary

- Route data is reduced to fixed route families/templates; IDs and query strings are excluded.
- Only `user-agent` is classified into a fixed traffic category; no raw header is emitted.
- `Authorization`, `Cookie`, `Set-Cookie`, API-key headers, bearer tokens, JWTs, passwords, database URLs, service-role keys, private keys, webhook/payment secrets, and all equivalent case variants are outside the allowlist.
- Request body, response body, query values, raw SQL, learner data, Evidence, security payloads, prompts, and model responses are not accepted by the event contract.
- No user ID, email, account ID, learner ID, course/lesson/question/attempt/review/registration ID, or IP address is emitted.
- The event is built from typed primitives and fixed classifications; arbitrary nested objects are not accepted as event fields.
- Telemetry serialization/emission is wrapped in a fail-open boundary. A writer failure, invalid duration, unsafe correlation input, serialization issue, or oversized event cannot fail the primary request and cannot recursively emit another telemetry event.

Operational telemetry remains separate from security/governance audit logs, Learning Evidence, product analytics, authentication state, content authority, and payment authority. It cannot create or modify a canonical learning or governance fact.

## Metrics and provider boundary

Logs: `IMPLEMENT` through native server `console.log`/`console.error` structured JSON consumed by Vercel Runtime Logs.

Metrics: `IMPLEMENT via native Vercel aggregation` over bounded event fields, especially `routeTemplate`, `routeFamily`, `method`, `statusClass`, `outcome`, `errorCategory`, `environment`, and `durationBucket`. Correlation IDs and all identifiers remain excluded from dimensions. No custom metric store, database table, drain, vendor, OpenTelemetry dependency, or provider-specific application dependency was added.

Traces: `DEFER`. Client telemetry, session replay, product analytics, learner analytics, AI observability, MCP observability, payment telemetry, dashboards, alerts, SLOs, and error budgets remain deferred/out of scope.

## Integration boundary

The focused integration point is the existing shared `lib/http.ts` helper. It was extended only to start/finish the bounded timer and pass safe context into the existing observation emitter. The entire application was not mass-instrumented. Direct route exceptions that do not use the shared helper remain outside this pilot and are not falsely reported as fully instrumented.

## Test-runner repair

Root cause: the focused Node test used an extensionless TypeScript ESM import while the repository's native Node test convention requires explicit `.ts` imports. The test now imports `../lib/observability/request-observability.ts`, and `package.json` adds the existing-convention script `npm run test:observability`. No package-wide ESM/CJS setting, loader, dependency, or second test stack was introduced.

## Verification

- Focused telemetry suite: 13 passed, 0 failed.
- Full repository unit suite: 448 passed, 0 failed.
- Local integration suite: 59 passed, 0 failed.
- PostgreSQL migration guard: 10 passed, 0 failed.
- Typecheck: passed.
- Lint: passed.
- Production build: passed with Next.js 16.2.6/Turbopack.
- `git diff --check`: passed.
- New `skip`/`only`/`todo` bypasses: 0.
- Focused tests use no external network/provider telemetry.

Focused tests explicitly cover email/path/query exclusion, Authorization/Cookie/secret fixtures, nested secret-like error input, raw Error handling, long input behavior, route normalization, bounded metric dimensions, correlation-ID validation, positive/invalid duration, bounded outcomes/categories, and telemetry-writer failure isolation.

## Review classification

- Security Critical/High: `0/0`
- Privacy Critical/High: `0/0`
- Cardinality Critical/High: `0/0`
- Cost risk: `LOW` (one bounded event per selected high-level response; no per-query or payload fan-out)
- Performance risk: `LOW` (fixed-field construction, monotonic timer, no deep cloning)
- Operability value: `HIGH` for server availability/error/latency/regression visibility within the selected boundary
- Active collision: `NONE` for changed files; no active migration/content/governance files touched
- New dependencies: `0`
- Schema change: `0`
- Migration change: `0`
- Historical migration mutation: `0`
- Production DB: `NO`
- Production deployment: `NO`
- UI change: `0`
- Cross-worktree mutation: `0`

## Deferred work

P1: benchmark-based sampling/rate tuning, selected route expansion, provider retention/data-residency review, dashboard/alert design, and later SLO definition.

P2: distributed tracing, client/browser telemetry, AI/search metadata, MCP telemetry, and richer provider integrations. No raw payload capture is authorized by these future items.

Retention is `PROVIDER_MANAGED`/provider-policy dependent and was not changed in application code. Data residency is `UNKNOWN / REQUIRES PLATFORM POLICY REVIEW`. Privacy/data-processing documentation review remains `REVIEW_REQUIRED` if provider processing or retention policy changes; no legal-policy file was changed here.

## Explicit acceptance checklist

- [x] Server-only boundary.
- [x] Exact allowlisted event fields and event name.
- [x] Forbidden fields and sensitive headers excluded.
- [x] Error/category and input sanitization boundary.
- [x] Route normalization with no query values.
- [x] Low-cardinality metric fields only.
- [x] Safe non-semantic correlation ID; never a metric dimension.
- [x] Monotonic bounded duration and duration bucket.
- [x] Bounded outcome and error taxonomy.
- [x] Telemetry failure isolation and no recursive logging.
- [x] Test/local no-provider boundary.
- [x] No request/response body capture.
- [x] No raw AI content, SQL, learning Evidence, security payloads, or secrets.
- [x] No database table, schema, migration, production DB, or deployment change.
- [x] Operational telemetry remains separate from audit, governance, analytics, and Learning Evidence.
- [x] Focused ESM TypeScript test runner executes successfully.
