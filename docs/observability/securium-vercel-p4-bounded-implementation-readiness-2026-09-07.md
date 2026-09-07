# Securium Vercel P4 Bounded Implementation Readiness

Snapshot date: `2026-09-07`
Review type: read-only readiness review
Production deployment: `NO`
Production database connection: `NO`
Commit / push / PR: `NO / NO / NO`

## Decision

Final Status: `SECURIUM_VERCEL_P4_OBSERVABILITY_BOUNDED_IMPLEMENTATION_READINESS_PASS`

Decision: `AUTHORIZE_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_IMPLEMENTATION`

Readiness: `P4_MINIMAL_SERVER_OBSERVABILITY_SCOPE_APPROVED_IMPLEMENTATION_REQUIRED`

Primary Next Gate: `IMPLEMENT_SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY`

This is authorization for a separate, bounded implementation gate only. It is not authorization to deploy, configure a Vercel drain, connect a provider, add a database table, merge, or publish runtime observability. The existing branch contains an earlier P4 implementation artifact; this review does not certify that artifact as complete. The next implementation must use the current `origin/main` architecture and the correction boundary defined below.

## Evidence and repository snapshot

### Part A — repository and architecture

| # | Item | Finding |
|---:|---|---|
| 1 | Final Status | `SECURIUM_VERCEL_P4_OBSERVABILITY_BOUNDED_IMPLEMENTATION_READINESS_PASS` |
| 2 | Decision | `AUTHORIZE_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_IMPLEMENTATION` |
| 3 | Snapshot Date | `2026-09-07` |
| 4 | Worktree | `C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/securium-vercel-observability-p4` |
| 5 | Branch | `design/vercel-observability-p4` |
| 6 | HEAD | `313db389b8f3c1d0ccced0bb296661d163986b74` |
| 7 | Fresh `origin/main` | `a17d4702061250d8b4d3fce8bbbd500dcc2442b2` |
| 8 | Ahead / Behind | `1 ahead / 7 behind` versus fresh `origin/main`; `0/0` versus tracking `origin/design/vercel-observability-p4` |
| 9 | Previous P4 Status | `SECURIUM_VERCEL_P4_OBSERVABILITY_DESIGN_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION` |
| 10 | Previous Design Evidence | `reports/securium-vercel-p4-observability-design-2026-08-28.md`; implementation artifacts `lib/observability/request-observability.ts`, `lib/http.ts`, and `tests/request-observability.test.ts` are present. The prior report contains both an earlier read-only design section and a later implementation section, so its status was verified against source rather than accepted by string alone. |
| 11 | Design Drift | `MINOR_UPDATE_REQUIRED`: the shared response boundary and native Vercel strategy remain valid, but the old fresh-main snapshot is stale and the actual event path does not supply duration or safe error classification. |
| 12 | Active Collision | `LOW`: current `origin/main` changes are concentrated in migrations, governance/audit identity, knowledge authority, auth/proxy, and database-error redaction. The proposed P4 files do not require those domains. `lib/http.ts` is shared infrastructure and needs a normal integration review, but it is not changed by the latest `origin/main` diff. |
| 13 | Runtime Architecture | Next.js `16.2.6`, App Router, server components, 59 `app/api/**/route.ts` handlers, shared response helpers in 52 handlers, 7 direct-response auth/health exceptions, and a retained Cloudflare/Vinext worker path. `next.config.ts` uses standalone output for non-Cloudflare builds. |
| 14 | Existing Observability | Native Vercel Runtime Logs/Observability is the available provider surface. `vercel-runtime-logs.jsonl` is a retained historical sample/evidence file, not active application instrumentation. |
| 15 | Existing Logging | Four representative application `console` sites: admin summary logs only a label/name; OAuth callback logs a development-only provider message/name/status; the error boundary logs digest/name; enrollment client logging logs an error name. No central structured logger exists. The P4 module writes one JSON line through `console.log`. |
| 16 | Existing Metrics | No application metric library or custom metric emitter. Health and operational pages expose response/database latency fields, and learner/admin pages contain product/domain metrics that are not operational telemetry. Vercel-native function/request aggregation is the recommended metric source. |
| 17 | Existing Tracing | No active OpenTelemetry setup, `instrumentation.ts`, Sentry setup, or distributed-trace application code. AI explainability traces in domain storage are not operational traces and remain outside P4. |
| 18 | Existing Analytics | Learner/product analytics pages and admin AI explainability views exist. `@vercel/analytics` and Speed Insights are not installed. Product analytics is explicitly outside this scope. |
| 19 | Existing Instrumentation | No `instrumentation.ts`, `instrumentation-client.ts`, OTel registration, Vercel drain configuration, or monitoring dependency. `proxy.ts` is the Next.js 16 auth/proxy boundary, not a telemetry entrypoint. |
| 20 | Proposed Scope Classification | `SERVER_LOGGING_AND_METRICS`: one bounded server operational event at the existing API response boundary, with native Vercel request/function metrics for aggregate counts, status, route, duration, and deployment correlation. |

The latest `origin/main` still has the same P4 module content as this branch, but this branch is not a current-main checkout. No merge or rebase was performed.

### Current Vercel capability check

Current official documentation was checked only for claims material to this review. Vercel states that Runtime Logs and Observability are available on all plans; Runtime Logs expose provider-managed request metadata and route/template views, and provider limits include plan-dependent retention and per-request log limits. Vercel states that Drains are available on Pro and Enterprise and are an external export/cost boundary. See [Runtime Logs](https://vercel.com/docs/logs/runtime), [Observability](https://vercel.com/docs/observability), and [Working with Drains](https://vercel.com/docs/drains).

The P4 implementation requires only the native runtime log sink and native provider aggregation. It does not require a Vercel API token, drain secret, external endpoint, Marketplace integration, Web Analytics, Speed Insights, or OpenTelemetry dependency. Provider-native request metadata may include request path/search parameters and user-agent information; that provider behavior is not application-controlled and requires platform/privacy policy review before production enablement. The P4 application event itself must exclude those values.

## Part B — signal and privacy boundary

| # | Item | Finding |
|---:|---|---|
| 21 | Logs Recommendation | `IMPLEMENT`: a single structured, allowlisted server event through native Vercel Runtime Logs. Do not mass-refactor existing `console` calls. |
| 22 | Metrics Recommendation | `IMPLEMENT`: use native Vercel request/function aggregation plus aggregation of bounded event fields. Do not add a custom metrics vendor or database-backed metrics. |
| 23 | Traces Recommendation | `DEFER`: no immediate need for distributed traces; OTel/drain/sampling/retention would add privacy and cost surface. |
| 24 | Client Telemetry Recommendation | `DEFER`: no browser telemetry, Web Analytics, Speed Insights, session replay, or client event capture in P4. |
| 25 | Server-First | `YES`: server/API operational behavior is the useful low-risk boundary. |
| 26 | Correlation ID | Use a random, non-semantic server correlation ID in the structured log event only when the provider request ID is unavailable. It is never a metric dimension, user identifier, authorization input, or audit identity. Prefer an existing provider/runtime correlation value if it is safely available; do not log cookies or tokens to obtain one. |
| 27 | Request Body Capture | `NOT_CAPTURED`. |
| 28 | Response Body Capture | `NOT_CAPTURED`. |
| 29 | Raw Prompt Capture | `NOT_CAPTURED`; dedicated AI telemetry is deferred. |
| 30 | Raw AI Response Capture | `NOT_CAPTURED`; dedicated AI telemetry is deferred. |
| 31 | Raw SQL Capture | `NOT_CAPTURED`; query text and parameters are excluded. |
| 32 | Raw Error Capture | `NOT_CAPTURED` in metrics or structured events. Normalize to bounded categories/codes only. |
| 33 | Stack Trace Policy | No application stack serialization in P4. If the provider captures server-side stacks natively, keep them server-side, do not expose them in responses, and require provider redaction/policy review. Never use stack/message text as a metric label. |
| 34 | Full URL Capture | `NO`; only fixed route templates are allowed in the application event. |
| 35 | Query Values | `NO`; discard query values and fragments. Query keys are also excluded by default. |
| 36 | User Identifier | `NONE`; do not hash emails or use raw user/resource identifiers. |
| 37 | IP Address | Application event: `NO`. Provider-native handling, if any, is existing platform behavior and requires a separately reviewed bounded policy. |
| 38 | Session Replay | `OUT_OF_SCOPE`. |
| 39 | Product Analytics | `OUT_OF_SCOPE`. |
| 40 | Learning Analytics | `OUT_OF_SCOPE`; operational telemetry must not become learner behavior analytics. |

### Operational boundaries

Operational Observability answers how the system behaves: availability, failures, latency, route/operation concentration, and deployment regression. Security/Governance Audit remains durable, identity-bearing authority where its existing contract requires it. Learning Evidence remains the source for learning facts and competency; no learning fact may originate from observability. Product analytics answers what users do and is not authorized by P4. Observability is read-only and secondary for all domain authorities.

## Part C — fields, error taxonomy, cardinality, cost

### Allowed telemetry field classification

| Field | Allowed? | Cardinality | Sensitivity | Reason |
|---|---|---|---|---|
| `event` | Yes | Fixed enum | Low | Bounded event-name allowlist. |
| `routeFamily` | Yes | Fixed enum | Low | Stable operational grouping; no IDs. |
| `routeTemplate` | Yes | Fixed allowlisted template | Low/medium | Route template supports diagnosis without concrete path/query values. |
| `method` | Yes | Fixed enum | Low | Low-cardinality HTTP method. |
| `statusClass` | Yes | Fixed enum | Low | `2xx`, `3xx`, `4xx`, `5xx`, `UNKNOWN`. |
| `outcome` | Yes | Fixed enum | Low | `SUCCESS`, `CLIENT_ERROR`, `SERVER_ERROR`, `UNKNOWN`. |
| `errorCategory` | Yes | Fixed enum | Low/medium | Stable safe category; no raw message or code interpolation. |
| `durationBucket` | Yes | Fixed enum | Low | Histogram-like fixed bucket, not a label containing raw milliseconds. |
| `runtimeCategory` | Yes | Fixed enum | Low | `NODE`, `EDGE`, `MIDDLEWARE`, `UNKNOWN`. |
| `environment` | Yes | Fixed enum | Low | `PRODUCTION`, `PREVIEW`, `DEVELOPMENT`, `TEST`, `UNKNOWN`. |
| `correlationId` | Yes, logs only | High in logs; forbidden in metrics | Low, opaque | Random/non-semantic request correlation; not identity and not used for grouping metrics. |
| provider timestamp | Provider-managed | Provider-managed | Low | Use the log provider timestamp; no user-derived time field. |

Anything not explicitly listed above is rejected or omitted by default. The application event must not accept arbitrary `Record<string, unknown>` fields.

### Part C required fields

| # | Item | Finding |
|---:|---|---|
| 41 | Allowed Event Fields | `event`, `routeFamily`, `routeTemplate`, `method`, `statusClass`, `outcome`, `errorCategory`, `durationBucket`, `runtimeCategory`, `environment`, and optional server/provider `correlationId` for logs only. |
| 42 | Forbidden Event Fields | Raw URL/path/query/fragment, query values/keys, email/name/phone/address, user/resource/question/lesson/course/attempt IDs, IP, raw/full User-Agent, all cookies, Authorization/API-key/JWT/OAuth/session values, request/response bodies, learner Evidence, notes, answers, code, security payloads, SQL/parameters, raw error messages, stack traces, prompts/responses, tool arguments/results, payment/wallet data, arbitrary headers, arbitrary caller event names/fields. |
| 43 | Error Taxonomy | `NONE`, `VALIDATION`, `AUTH_REQUIRED`, `AUTHORIZATION_DENIED`, `SESSION_INVALID`, `DB_CONNECTION_ERROR`, `DB_TIMEOUT`, `DB_CONSTRAINT_ERROR`, `DB_TRANSACTION_ERROR`, `DB_QUERY_ERROR`, `DB_UNKNOWN_ERROR`, `EXTERNAL_SERVICE`, `AI`, `RATE_LIMIT`, `CONFIGURATION`, `INTERNAL`, `UNKNOWN`. |
| 44 | Route Normalization | Parse the URL only to obtain the pathname, discard query/fragment, match fixed route family/template maps, replace dynamic paths with bounded templates, and fall back to `/api/[...]` or `/other`. Never retain a concrete ID or slug. |
| 45 | Sensitive Key Policy | Allowlist-only serialization. Case-insensitive deny tests must reject `authorization`, `cookie`, `set-cookie`, `password`, `token`, `secret`, `api-key`, `apikey`, `jwt`, `database-url`, `direct-url`, `service-role`, `private-key`, `webhook-secret`, and equivalent nested keys if an object boundary is ever introduced. |
| 46 | String Limits | No free strings are allowed. Fixed route templates are bounded; enum values are fixed; `correlationId` must be a generated UUID or provider opaque ID with a bounded maximum of 128 characters and CR/LF rejection. |
| 47 | Event Size Policy | Application policy: one JSON event, fixed keys only, no payload objects, and serialized size <= 2 KB. This is not a Vercel provider limit. Oversize or serialization failure is dropped fail-open. |
| 48 | Metric Dimensions | `routeTemplate`/`routeFamily`, `method`, `statusClass`, `outcome`, `errorCategory`, `runtimeCategory`, and `environment`, retaining only dimensions needed for the operational questions. |
| 49 | Forbidden Dimensions | User/resource/question/lesson/course/attempt IDs, raw URL/query, raw error/message/stack, request/correlation IDs, full User-Agent, IP, prompt/tool/SQL values, branch/commit labels outside stable provider deployment metadata, and arbitrary strings. |
| 50 | Cardinality Risk | `LOW` and controlled. Metric high-cardinality Critical/High: `0/0`. The random correlation ID is log-only and explicitly excluded from metrics. |
| 51 | Privacy Critical/High | `0/0` for the authorized application event design. Provider-native query/path/user-agent handling remains a separate platform policy review item. |
| 52 | Security Critical/High | `0/0` for the authorized application event design. Existing non-P4 console sites are not mass-refactored; the development-only OAuth message remains a separate P1 review item. |
| 53 | Cost Risk | `LOW` for the bounded implementation; one compact event at the shared boundary, no external request, no DB write, no drain, and native aggregation. Reassess provider log volume before production enablement. |
| 54 | Performance Risk | `LOW` expected: fixed classification, bounded serialization, and no synchronous network/database work. The prior local benchmark is not treated as current-main production evidence. |
| 55 | Operability Value | `HIGH` for outage/error/latency/deployment-regression visibility; `MEDIUM` for source concentration because IP/user attribution is intentionally unavailable; `LOW` for product/learner behavior questions, which are out of scope. |

### URL, ID, error, and latency contracts

URL contract: route template/path only; no query keys or values. ID policy: correlation ID only; business, user, content, session, attempt, receipt, audit, and evidence IDs are excluded. Error messages are excluded from metrics and structured P4 events; provider-native stack/error details are not an application contract. Latency is a fixed duration bucket in events and a native distribution/histogram in provider metrics, never a raw metric label.

## Part D — domain separation and failure behavior

| # | Item | Finding |
|---:|---|---|
| 56 | Auth Logging | Record only bounded outcome/error categories such as `AUTH_REQUIRED` or `SESSION_INVALID`; no email, identity, token, cookie, OAuth code, or login behavior analytics. |
| 57 | Authorization Logging | A bounded `AUTHORIZATION_DENIED` category by stable route/operation is allowed; no user/resource IDs, role payloads, or policy/judgment content. Existing security/governance audit remains separate. |
| 58 | DB Observability | P4 should classify normalized high-level database failures surfaced at the response boundary. Do not instrument every SQL query, SQL text, parameter, table value, or credential. Dedicated repository/service timing is deferred unless a later benchmark proves it necessary. |
| 59 | AI Observability | `DEFER` as a dedicated event. Existing AI routes may appear only through bounded route/status/latency fields; no prompt, response, learner query, retrieved context, token payload, or cost detail. |
| 60 | MCP Observability | `DEFER`; if later required, allowlisted tool name, success/failure, duration, and safe error category only; no arguments/results. |
| 61 | Payment Observability | `OUT_OF_SCOPE`; future-compatible only by preserving the same no-secret/no-payload rule. Never log wallet private keys, payment secrets, or sensitive payment bodies. |
| 62 | Governance Observability | Operational route/category/duration/outcome only. No reviewed input, reviewer/owner identity, judgment, audit identity, receipt, or governance payload. |
| 63 | Learning Evidence Separation | No Evidence, CompetencyEvidence, mastery, answers, notes, submissions, or canonical learning fact may originate from or be stored in observability. |
| 64 | Audit Log Separation | Security/Governance Audit is a distinct authority/durability contract. P4 emits no audit record and must not reuse audit identity semantics. |
| 65 | Canonical Authority | Observability is secondary operational data and is not authority for learning, competency, content, governance, payments, authentication state, or authorization state. |
| 66 | Telemetry Failure Isolation | `observability failure != application failure`: catch classifier/serialization/emitter failure, drop the event, and return the original application response. No retries, queues, or fallback DB writes. |
| 67 | Test No-Op | Required for test, unsupported environments, and local development unless an explicit local capture test injects a fake writer. No real provider emission by default. |
| 68 | External Telemetry in Tests | `OFF`; use a fake writer/no-op adapter. Never send to Vercel drains or third-party providers from tests. |
| 69 | Local Dev Secret Requirement | `NONE`; local development must work without observability credentials, drain secrets, API tokens, or provider configuration. |
| 70 | Preview Privacy Boundary | Same strict redaction and no-body boundary as production. Preview may be enabled for validation, but must not use relaxed payload logging. |

## Part E — implementation boundary and compatibility

| # | Item | Finding |
|---:|---|---|
| 71 | Proposed Implementation Files | Reuse/complete `lib/observability/request-observability.ts`; use the existing shared boundary in `lib/http.ts`; extend `tests/request-observability.test.ts` or an equivalent existing test boundary. Do not create `instrumentation.ts`, `proxy` logging, route-by-route wrappers, AI/DB/MCP adapters, or an admin UI in P4. |
| 72 | New Dependencies | `0`. |
| 73 | Dependency Review | No dependency purpose, maturity, transitive-risk, or bundle review is needed because no new package is authorized. OTel, Sentry, analytics, speed-insights, drain SDKs, and other vendors are not authorized. |
| 74 | Client Bundle Impact | `0` intended. The telemetry module remains server-only and is not imported into client components. |
| 75 | Node Compatibility | Compatible with current Node route handlers using `Request`, `URL`, `Headers`, `console`, `crypto.randomUUID`, and bounded `process.env` reads. Explicit Node routes include auth, health, and operational handlers. |
| 76 | Edge Compatibility | The pure classifier shape is compatible with Edge-like request handling, but P4 does not add an Edge/proxy integration. Do not use Node-only APIs in any future Edge boundary. |
| 77 | Serverless Compatibility | Compatible if emission is synchronous/bounded and fail-open. Do not assume a persistent process, buffered flush, background worker, or durable in-memory queue. |
| 78 | Instrumentation Entrypoint | No existing entrypoint; `instrumentation.ts` is `DEFER/NOT_REQUIRED_NOW`. Do not create one for this scope. |
| 79 | Pilot Route/Operation | Existing shared API response boundary, with validation focused on low-risk health/progress-shaped requests in tests. Do not select ISE, SW Security Weakness, Web Pentest, CURRENTNESS, governance publication, or active content routes as a special pilot. Runtime deployment pilot remains a separate gate. |
| 80 | Active File Collision | `LOW`: no cross-worktree writes; no current origin/main diff in `lib/http.ts` or the P4 module. Recheck the fresh-main worktree at implementation time. |
| 81 | Schema Change | `0`. |
| 82 | Migration Change | `0`. |
| 83 | Historical Migration Mutation | `0`. |
| 84 | Production DB | `NO`; no connection, table, write, read, or provisioning for telemetry. |
| 85 | Production Deployment | `NO`; no deploy, Vercel setting, drain, alert, dashboard, or provider operation. |
| 86 | UI Change | `0`; no learner or admin observability UI. |

### Environment variable inventory

| Variable | Classification | P4 use |
|---|---|---|
| `VERCEL_ENV` | `PUBLIC_SAFE` as bounded provider environment category | Read only as `PRODUCTION`, `PREVIEW`, or `UNKNOWN`; never emit arbitrary value. |
| `NODE_ENV` | `SERVER_ONLY` runtime metadata | Map to bounded development/test category; never emit arbitrary value. |
| `NEXT_RUNTIME` | `SERVER_ONLY` runtime metadata | Map to `NODE`, `EDGE`, `MIDDLEWARE`, or `UNKNOWN`; no new secret. |
| `VERCEL_URL` | `SERVER_ONLY` existing deployment metadata | Not needed; never log. |
| `DATABASE_URL`, `DIRECT_URL` | `SECRET` | Never read for telemetry. |
| Supabase service-role/anon/API/OAuth/payment/webhook secrets | `SECRET` | Never read or emit. |
| Proposed `OBSERVABILITY_*` variables | `NOT_REQUIRED` | No new observability secret/config is authorized. |

## Part F — validation and side effects

| # | Item | Finding |
|---:|---|---|
| 87 | Unit Test Plan | Fixed route/method/status/outcome/error/duration/runtime/environment enums; path/query normalization; correlation ID rules; event-name/field allowlists; bounded serialization; no arbitrary fields. |
| 88 | Redaction Test Plan | Explicit negative assertions for email, name, Authorization, Cookie, Set-Cookie, DATABASE_URL-like values, JWT, nested secret-like keys, raw Error objects, query values, long free text, request/response bodies, SQL, prompts, and security payloads. Assert each sensitive value is absent from serialized telemetry. |
| 89 | Cardinality Test Plan | Fixtures for user ID, question ID, lesson/course ID, attempt ID, arbitrary URL/query, raw error message, stack, request ID, and User-Agent must never appear as metric dimensions. Assert all metric fields are allowlisted fixed values; correlation ID is log-only. |
| 90 | Failure Isolation Test | Inject a writer that throws, a serializer failure/oversize case, and malformed request inputs; assert the application result is unchanged and no exception escapes the telemetry boundary. |
| 91 | Integration Test Plan | Selected response-boundary integration tests for success/error status and duration; direct auth/health exceptions remain native-provider-only unless a separate safe boundary is explicitly approved. No external telemetry calls. |
| 92 | Current Typecheck | `PASS`: `npm run typecheck` completed successfully on this worktree. |
| 93 | Current Lint | `PASS`: `npm run lint` completed successfully on this worktree. |
| 94 | Current Build | `NOT_RUN` for this read-only review. The prior report's build PASS was on an older snapshot and is not current-main evidence. |
| 95 | Local Dependency Blocker | No general blocker for typecheck/lint; `node_modules` is present. The focused telemetry test command fails before test execution because the repository's plain Node ESM runner cannot resolve its extensionless TypeScript import (`ERR_MODULE_NOT_FOUND`). Fix the test runner/import contract in the implementation gate; this is not a production blocker. |
| 96 | `git diff --check` | `PASS`. |
| 97 | Review Side Effects | Only the two readiness reports created by this review; no runtime, schema, migration, content, governance, learning, or database code was edited by this review. |
| 98 | Cross-Worktree Mutation | `0`; no writes outside this worktree. |
| 99 | Commit | `NO`. |
| 100 | Push | `NO`. |
| 101 | PR | `NO`. |

The branch was clean before report creation and remained clean apart from the two intended readiness artifacts. The pre-existing branch diff versus `origin/main` contains the earlier P4 implementation/design files; this review did not add to that runtime diff.

## Part G — blockers, checklist, and exact authorized contract

| # | Item | Finding |
|---:|---|---|
| 102 | P0 Blockers | `NONE` for the bounded application-event design. No raw payload, secret, schema/migration, DB dependency, provider credential, or active collision is required. |
| 103 | P1 Items | Supply duration at the response boundary; add outcome/error classification; decide provider/native versus generated correlation ID; repair focused test execution; audit direct-response exceptions; benchmark event volume; confirm Vercel plan/retention/privacy policy before production enablement; separately review existing development-only OAuth error logging. |
| 104 | P2 Items | Dedicated AI metadata, MCP tool metadata, client/Web Vitals telemetry, OTel traces, dashboards, alerts, SLO/error-budget design, payment telemetry, session replay, heatmaps, and product funnels. |
| 105 | Implementation Checklist | See the explicit checklist below. |
| 106 | Proposed Event Schema | See the exact schema below. |
| 107 | Proposed Error Categories | See the bounded union below. |
| 108 | Proposed Metric Set | Native request count by stable route/template and status class; error count by stable route/template and bounded error category; latency distribution by stable route/template/operation and environment; deployment/environment correlation from provider metadata. No custom DB metrics. |
| 109 | Proposed Sampling Policy | Do not invent a trace rate. Retain all error events needed for incident diagnosis; successful bounded events may be full-rate only for the selected implementation/preview validation boundary, with production success-volume tuning deferred to implementation benchmark/provider limits. Never sample away critical failures solely for cost. No arbitrary percentage is authorized in this review. |
| 110 | Privacy Documentation Review | `REVIEW_REQUIRED`: confirm provider/runtime log processing, query-parameter handling, retention, access, and data-processing terms before production enablement. No legal/privacy policy edit is made here. |
| 111 | Data Residency Status | `UNKNOWN / REQUIRES PLATFORM POLICY REVIEW`. No unsupported residency claim is made. |
| 112 | Retention Status | `PROVIDER_MANAGED`; no application retention duration or storage is invented. Current provider documentation is plan-dependent. |
| 113 | Critical Blockers | None for the bounded design. Production provider/privacy/retention confirmation and implementation-gate test repair remain prerequisites to any production rollout, not reasons to add scope. |
| 114 | Readiness Classification | `AUTHORIZE_BOUNDED_IMPLEMENTATION`; design drift is `MINOR_UPDATE_REQUIRED` and is incorporated into the next implementation gate. |
| 115 | Review Report | `docs/observability/securium-vercel-p4-bounded-implementation-readiness-2026-09-07.md` |
| 116 | Machine Report | `reports/securium-vercel-p4-bounded-implementation-readiness-2026-09-07.json` |
| 117 | Markdown SHA-256 | Computed after final write and reported externally; not embedded self-referentially. |
| 118 | Machine SHA-256 | Computed after final write and reported externally; not embedded self-referentially. |
| 119 | Primary Next Gate | `IMPLEMENT_SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY` |

### Explicit implementation checklist

- [ ] Server-only boundary; no client import or browser event path.
- [ ] Allowlisted event names and fields only; reject/omit all other fields.
- [ ] Allowed fields limited to bounded route/operation, method, status class, outcome, error category, duration bucket, runtime, environment, and optional opaque correlation ID.
- [ ] Forbidden fields include all raw personal, learning, security, payment, request, response, header, SQL, prompt, response, tool, secret, and arbitrary error content.
- [ ] Central normalization/allowlist boundary; no caller-supplied arbitrary objects.
- [ ] Route normalization uses fixed templates and discards query values/keys and fragments.
- [ ] No user, question, lesson, course, attempt, session, content, audit, evidence, or payment IDs.
- [ ] Correlation ID is random/non-semantic, log-only, bounded, CR/LF-safe, and never a metric dimension.
- [ ] No request or response body capture.
- [ ] No raw AI prompt/response or retrieved private learning context.
- [ ] No raw SQL, SQL values, credentials, database metadata, or raw database exception text.
- [ ] Safe error taxonomy is fixed; DB/auth categories are normalized without dynamic messages.
- [ ] No raw stack trace in the application event; provider-native stack handling remains separately reviewed.
- [ ] One bounded event per selected response boundary at most; no recursive logging, retry loop, or unbounded buffering.
- [ ] Telemetry failure is fail-open and cannot alter the primary response.
- [ ] Test adapter/no-op is default in test and local development; external telemetry in tests is off.
- [ ] No new dependency, provider secret, drain, vendor, dashboard, alert, or application telemetry storage.
- [ ] No DB/schema/migration/historical migration change.
- [ ] No Learning Evidence, CompetencyEvidence, CURRENTNESS, Generic Review, ISE, Secure Coding, SW Security Weakness, Web Pentest, canonical content, governance authority, or authentication-state mutation.
- [ ] No learner UI or admin observability UI.
- [ ] Test negative assertions prove secrets/PII/payloads are absent from serialized output.
- [ ] Test cardinality assertions prove dynamic IDs, raw errors, URLs, request IDs, and arbitrary strings cannot become metric dimensions.
- [ ] Focused test command is repaired and passes; typecheck/lint/build are run at implementation gate.
- [ ] Provider plan, retention, privacy/data-processing, access, and data-residency policy are reviewed before production enablement.

### Exact proposed minimal event schema

The existing `SECURIUM_REQUEST_OBSERVATION_V1` shape is a safe allowlist foundation but is incomplete in practice because the current response helper does not pass duration and the event has no outcome/error classification or application correlation. The next implementation may preserve the event name or version it deliberately; the contract below is the required shape:

```json
{
  "event": "SECURIUM_REQUEST_OBSERVATION_V1",
  "routeFamily": "PROGRESS_API",
  "routeTemplate": "/api/lessons/progress",
  "method": "POST",
  "statusClass": "2xx",
  "outcome": "SUCCESS",
  "errorCategory": "NONE",
  "durationBucket": "MS_50_250",
  "runtimeCategory": "NODE",
  "environment": "PREVIEW",
  "correlationId": "server-generated-random-uuid"
}
```

`correlationId` is an illustrative shape, not a literal fixed value. It is present only in the server log event, is not a metric dimension, and must not encode identity. Provider timestamp is preferred over a new user-derived timestamp. Route template values come from a fixed manifest. Event name, route family, method, status, outcome, error category, duration, runtime, and environment are all bounded enums/templates.

### Event matrix

| Event | Purpose | Allowed Fields | Forbidden Fields | Sampling | Status |
|---|---|---|---|---|---|
| `request_observed` | Answer availability, route failure, latency, progress/API concentration, and deployment regression questions. | Exact proposed schema above. | All forbidden event fields above. | Error events retained for diagnosis; success rate deferred to benchmark/provider review, with no arbitrary percentage set here. | `IMPLEMENT` at existing shared API response boundary. |
| `health_check` | Existing health endpoint already reports health; avoid double-counting it as normal learner traffic. | Provider-native route/status/duration only. | Body, DB details, credentials, raw exception. | Provider/native only for P4. | `DEFER_APPLICATION_EVENT`; do not create a duplicate health system. |
| `ai_operation` | Future AI latency/failure/cost visibility. | Later allowlisted operation/provider class, latency, outcome, bounded cost bucket if policy-approved. | Prompt, response, learner query, retrieved context, identifiers, token payload. | Later design. | `DEFER`. |
| `db_operation` | Future high-level repository/service DB failure/latency visibility. | Later operation class, duration, outcome, normalized DB category. | SQL, parameters, values, table internals, credentials. | Later design. | `DEFER`; request-level DB classification is sufficient for P4. |
| `mcp_operation` | Future MCP operational visibility. | Later allowlisted tool name, duration, outcome, safe error category. | Arguments/results/private context. | Later design. | `DEFER`. |

### Proposed metric set

1. Native server request/function count by provider route template, environment, and deployment metadata.
2. Native error count/rate by stable route template and status class.
3. Bounded application-event count by route family/template, method, status class, outcome, and environment, with no request/correlation ID.
4. Latency distribution by stable route template/operation and environment using provider distributions or fixed duration buckets.
5. Bounded error-category count by stable route family/template and category; no raw message/code.

The application event is diagnostic enrichment, not a second invocation authority. Do not sum it with native invocation totals without deduplication.

### Proposed sampling, rate, retention, and cost policy

P4 does not choose an arbitrary trace percentage or retention duration. Errors remain diagnostically available subject to provider limits; successful request-event volume is benchmarked in implementation and tuned through provider controls if necessary. One event maximum is allowed per instrumented response boundary, with no retries or telemetry-induced loops. Vercel/provider retention is `PROVIDER_MANAGED`; data residency is `UNKNOWN` pending platform policy review. No drain is configured by this gate.

### Risk conclusion

There are no P0 blockers to a minimal privacy-safe server implementation. The safe boundary is narrow because application events are fixed and payload-free, native Vercel metrics remain the provider authority for invocation/latency, and telemetry failures are fail-open. The current partial branch artifact must not be treated as a completed implementation: duration, outcome/error normalization, correlation policy, and executable focused-test plumbing must be completed and reverified in the separate implementation gate.

## Prior artifact integrity

Full SHA-256 values calculated during this review:

| Artifact | SHA-256 |
|---|---|
| `reports/securium-vercel-p4-observability-design-2026-08-28.md` | `15cb1fa5bddfe2c8dfe634b63d4030865fe6e0cb1c821b8240af2c205232792f` |
| `lib/observability/request-observability.ts` | `7fd7d911698722bb71dfe58083aace20d493f0ec3f63af1fa0a62b9c14f37c91` |
| `tests/request-observability.test.ts` | `72359c20afd49367cc746ebcbc9efb8c4ad9ab87a6a3a28022a00ac38fe72cd2` |
| `lib/http.ts` | `e4b4458cd6192f6a75b24c5e97bd90e53afaf3cf90bd8c26e60e53088dd3939e` |

No commit, push, merge, rebase, deployment, Vercel setting change, production DB operation, or cross-worktree write was performed. Stop after this readiness review.
