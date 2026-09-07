# Securium Vercel P4 Privacy-Safe Minimal Server Observability — Final Rereview

Snapshot: 2026-09-07  
Worktree: `securium-vercel-observability-p4`  
Branch: `design/vercel-observability-p4`  
HEAD: `313db389b8f3c1d0ccced0bb296661d163986b74`  
Fresh `origin/main`: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`  
Ahead/behind: `1 ahead / 8 behind`

## Decision

Final Status: `SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_FINAL_REREVIEW_PASS`

Review Decision: `APPROVE_PRIVACY_SAFE_MINIMAL_SERVER_LOGGING_AND_NATIVE_VERCEL_METRICS`

Readiness: `P4_MINIMAL_SERVER_OBSERVABILITY_APPROVED_CLEAN_PUBLICATION_PREPARATION_MAY_PROCEED`

Primary Next Gate: `PREPARE_SECURIUM_VERCEL_P4_OBSERVABILITY_CLEAN_PUBLICATION_WORKTREE`

The hostile runtime correlation-ID object escape is closed. The repaired boundary requires a primitive string before applying the approved regular expression, and only that validated primitive or a safe request/platform fallback reaches the event. The fixed event schema, privacy exclusions, bounded dimensions, and fail-open telemetry behavior remain intact.

## Evidence

| Artifact | SHA-256 |
| --- | --- |
| Repair Markdown | `c0dd8700597ac81900be61f815e88f87f3289239af68537f89d4c2d0996ea945` |
| Repair machine report | `421b97dcc0a41d18e779b6ea0209cdadbfe50754f95a5c8da161cf8801c43188` |
| Original failed-review Markdown | `abf5461c9697c4f34189bba3705694d073079870172912566d61c60de80872a9` |
| Original failed-review machine report | `f4dad1da5b9a5138efccc76d6ce6fe80a2d3c5699cfd94534a9c7a1b71275c20` |

The original blocker was confirmed as a type-validation/return-value mismatch: coercion-compatible validation could succeed while the original unknown object was retained. The repaired code uses `isSafeCorrelationId(value: unknown): value is string`, whose first condition is `typeof value === "string"`.

## Runtime boundary verification

Approved correlation policy remains `[A-Za-z0-9._:-]{1,128}`. No regex or string operation is applied to arbitrary unknown values before primitive validation. The emitted value is always a primitive string: an accepted primitive header/context value, a safe `crypto.randomUUID()` fallback, or the bounded `UNAVAILABLE` fallback.

Independent hostile probes passed for:

- plain object with safe-looking `toString()` and secret-bearing properties;
- nested secret-bearing object;
- boxed `String` object;
- array, number, boolean, symbol, BigInt, null, and undefined;
- overlong string;
- newline, carriage return, tab, and null-like control characters;
- newline plus forged JSON/log text;
- hostile `valueOf()` and `Symbol.toPrimitive` objects;
- throwing coercion and proxy access cases.

The probe emitted one JSON event, preserved a primitive string correlation value, omitted the fake secret markers, and produced no forged second event. The original unknown object was not retained.

## Fixed event schema

Event name: `SECURIUM_REQUEST_OBSERVATION_V1`  
Field count: 15  
Arbitrary metadata: none.

Exact fields:

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

The event has no payload, body, header, SQL, error-message, stack, prompt, response, Evidence, security-payload, or generic metadata field. `JSON.stringify` is applied only to the constructed fixed event. Event output is capped at 2,048 serialized characters.

## Privacy, security, and data-boundary findings

| Boundary | Result |
| --- | --- |
| User identifier | None collected |
| Application IP | Not collected |
| Request body | Not captured |
| Response body | Not captured |
| Query values | Not captured |
| Raw URL | Not captured; normalized route template only |
| Arbitrary headers | Not captured |
| Authorization/Cookie/API-key values | Not captured |
| Raw SQL and database error text | Not captured; category only |
| Raw AI prompt/response/private context | Not captured |
| Learning Evidence, answers, mastery, notes | Not captured |
| Security-training/request payloads | Not captured |
| Raw error message and stack | Not in structured observation |
| Audit/governance authority | Separate; unchanged |
| Canonical learning authority | Separate; unchanged |
| Product analytics | Separate; not implemented |

The route classifier produces bounded route families/templates and strips query and fragment data. The correlation ID is never an aggregation dimension. Other aggregation dimensions remain bounded: route template/family, method, status class, outcome, error category, environment/runtime, and duration bucket. Dynamic user/resource IDs, raw URLs, raw duration, messages, request IDs, and arbitrary payload values are not dimensions.

## Duration, outcome, and errors

Duration starts from monotonic `performance.now()` timing, is finite and non-negative, rounded to an integer, and capped at `86,400,000ms`. Invalid values normalize to `null); they do not fail the application. Buckets are finite: `LT_50MS`, `MS_50_250`, `MS_250_1000`, `S_1_5`, `GT_5S`, and `UNKNOWN`.

Outcomes are restricted to `SUCCESS`, `FAILURE`, and `UNKNOWN`. Error categories are restricted to `NONE`, `VALIDATION`, `AUTH`, `AUTHORIZATION`, `DATABASE`, `EXTERNAL_SERVICE`, `AI`, `RATE_LIMIT`, `CONFIGURATION`, `INTERNAL`, and `UNKNOWN`. Raw exception messages are not serialized or used as categories/dimensions.

## Failure isolation and integration

`emitRequestObservation` encloses emission, event construction, serialization, size checking, and writer invocation in a fail-open `try/catch`. A writer failure therefore cannot replace a successful response or the original application error. The emitter does not recursively log its own failure.

The shared `lib/http.ts` helpers start and finish request timing and invoke the single high-level observation emission path for success/error responses. Focused tests prove emitter failure isolation and one structured event behavior; direct wrapper injection is not separately imported because the repository's native TypeScript ESM test path cannot import `lib/http.ts` without a global module-resolution change. Source inspection confirms the helpers do not catch or replace primary response/error semantics, and the tested emitter boundary is the only telemetry failure point. This is adequate for this bounded rereview and does not justify a package-wide ESM change.

Normal integration emits approximately one observation per instrumented request. No tracing spans, client events, drains, external vendor, custom metrics store, dashboards, alerts, or database persistence were added.

## Validation

| Gate | Result |
| --- | --- |
| Focused observability tests | 16/16 pass |
| Runtime misuse cases | Pass |
| Secret/redaction cases | Pass |
| Body/query/header exclusion fixtures | Pass |
| Unit suite | 448/448 pass |
| Integration suite | 59/59 pass |
| PostgreSQL migration guard | 10/10 pass |
| Typecheck | Pass |
| Lint | Pass |
| Production build | Pass |
| `git diff --check` | Pass |
| New skips/only/todo | 0 |
| New dependencies | 0 |

Tests do not contact Vercel or another external telemetry service. Test environment emission uses the existing bounded test path; local development does not require Vercel credentials.

## Scope and worktree controls

Implementation scope remains `SERVER_LOGGING_AND_METRICS`. Logs are emitted as structured server console events compatible with native Vercel Runtime Logs/aggregation. Metrics are provider-native aggregation over bounded fields. Traces, client telemetry, OTel, Drains, AI/MCP observability, product/learning analytics, session replay, and payment telemetry remain deferred or out of scope.

No schema, migration, historical migration, production database, UI, or deployment change occurred. No cross-worktree mutation occurred. This review added only the rereview reports; the implementation files were pre-existing dirty state from the approved implementation/repair work.

Security Critical/High: `0/0`  
Privacy Critical/High: `0/0`  
Cardinality Critical/High: `0/0`  
Cost risk: `LOW`  
Performance risk: `LOW`  
Operational value: `HIGH`

## Remaining scope

P1: sampling policy/tuning, route expansion, dashboards/alerts, and provider retention/residency review. Provider-level Vercel IP/retention policy remains separate and is not claimed as reviewed or controlled by this application implementation.

P2: distributed tracing, client telemetry, AI observability, and MCP observability.

No critical blockers remain. No commit, push, or PR was created.
