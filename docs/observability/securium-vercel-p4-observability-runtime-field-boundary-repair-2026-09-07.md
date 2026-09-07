# Securium P4 Observability Runtime Field-Boundary Repair

Snapshot: 2026-09-07 (Asia/Seoul)

## Decision

- Final Status: `SECURIUM_VERCEL_P4_OBSERVABILITY_RUNTIME_FIELD_BOUNDARY_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
- Repair Decision: `ENFORCE_PRIMITIVE_BOUNDED_CORRELATION_ID_RUNTIME_BOUNDARY`
- Readiness: `P4_OBSERVABILITY_RUNTIME_SCHEMA_BOUNDARY_REPAIRED_FINAL_REREVIEW_REQUIRED`
- Primary Next Gate: `REREVIEW_SECURIUM_VERCEL_P4_PRIVACY_SAFE_MINIMAL_SERVER_OBSERVABILITY_AFTER_RUNTIME_BOUNDARY_REPAIR`

The single blocking runtime field-boundary defect was repaired. The fix requires a primitive string before correlation-ID validation, preserves only that trusted primitive, and falls back to the existing generated safe ID for every other runtime value. No recursive sanitizer, event-schema redesign, route expansion, tracing, client telemetry, drains, OTel, deployment, or database change was introduced.

## Evidence and reproduction

The failed-review evidence matched before repair:

- Failed-review Markdown SHA-256: `abf5461c9697c4f34189bba3705694d073079870172912566d61c60de80872a9`
- Failed-review machine SHA-256: `f4dad1da5b9a5138efccc76d6ce6fe80a2d3c5699cfd94534a9c7a1b71275c20`

The original hostile runtime case reproduced before editing. An object with `toString() => "safe-correlation-id"`, a top-level secret, and a nested secret was accepted, retained by identity, and emitted with both secret markers. The observed result was:

```text
accepted: true
originalObjectRetained: true
buildLeaksSecret: true
emittedLines: 1
emittedLeaksSecret: true
emittedLeaksNestedSecret: true
```

Root cause: `TYPE_VALIDATION_AND_RETURN_VALUE_MISMATCH`. `RegExp.test()` implicitly coerced an unknown runtime value, while the successful branch returned the original unknown value.

## Repair

`isSafeCorrelationId(value: unknown): value is string` now first requires `typeof value === "string"`, then applies the existing exact format `/^[A-Za-z0-9._:-]{1,128}$/`. Header values are already framework-resolved strings and use the same helper. No arbitrary object coercion, `toString()`, `valueOf()`, proxy getter, boxed string, array, number, boolean, symbol, BigInt, or function can reach the trusted branch.

The correlation output invariant is now:

```text
typeof emittedCorrelationId === "string"
```

The event remains exactly 15 fields with no metadata bag. Correlation ID remains forbidden as a metric dimension. User identifier remains `NONE`; IP remains `NOT_COLLECTED`; request/response bodies, query values, raw URLs/headers, SQL, AI content, Learning Evidence, and security payloads remain excluded.

## Runtime misuse coverage

The focused suite now includes explicit runtime cases for:

- plain object with safe-looking or throwing `toString()`;
- top-level and nested secret-bearing objects;
- object with throwing `valueOf()`;
- proxy with throwing property access;
- boxed `String`;
- array, number, boolean, symbol, BigInt, `null`, and `undefined`;
- strings longer than 128 characters;
- newline, carriage return, tab, and null-like control characters;
- newline plus forged JSON/log text;
- body, query, and harmless security-payload markers.

Every case either receives a generated safe primitive string or uses a safe valid primitive string. Secret markers are asserted absent from complete serialized output. The log-injection case emits exactly one JSON line and contains no forged event marker.

## Existing observability boundaries preserved

- Event: `SECURIUM_REQUEST_OBSERVATION_V1`.
- Fields: `event`, `severity`, `routeFamily`, `routeTemplate`, `method`, `statusClass`, `outcome`, `errorCategory`, `authCategory`, `trafficCategory`, `runtimeCategory`, `environment`, `durationMs`, `durationBucket`, `correlationId`.
- Duration: monotonic `performance.now()`, finite/non-negative, rounded, capped at `86,400,000ms`.
- Outcomes and error categories remain the existing bounded unions.
- Route templates and all metric dimensions remain bounded.
- Native Vercel Runtime Logs remain the provider boundary; no custom metric database exists.
- Telemetry remains fail-open and non-recursive.

Direct `lib/http.ts` writer injection is not separately exercised because its existing extensionless production imports cannot be loaded by the focused native Node ESM runner without changing global module resolution. The fail-open boundary is the invoked `emitRequestObservation()` call used by both `successResponse()` and `errorResponse()`, and its writer-failure test passes. No unrelated module-resolution change was made.

## Verification

- Focused telemetry suite: `16/16 PASS`.
- Full unit suite: `448/448 PASS`.
- Full local integration suite: `59/59 PASS`.
- PostgreSQL migration guard: passed as part of integration gate.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS`.
- `git diff --check`: `PASS`.
- New `skip`/`only`/`todo` bypasses: `0`.
- External telemetry network: not used.
- New dependencies: `0`.

## Review classification

- Runtime misuse boundary: `PASS`.
- Secret boundary: `PASS`.
- Nested object boundary: `PASS`.
- Event schema: `BOUNDED`.
- Privacy Critical/High: `0/0`.
- Security Critical/High: `0/0`.
- Cardinality Critical/High: `0/0`.
- Cost risk: `LOW`.
- Performance risk: `LOW`.
- Operational value: `HIGH`.
- Schema change: `0`.
- Migration change: `0`.
- Historical migration mutation: `0`.
- Production DB: `NO`.
- Deployment: `NO`.
- UI change: `0`.
- Cross-worktree mutation: `0`.

## Remaining scope

P1: sampling, route expansion, dashboards/alerts, and retention/data-residency review.

P2: distributed tracing, client telemetry, AI observability, and MCP observability.

No runtime coercion fix or runtime-misuse test gap remains in P1. Provider-level IP, retention, and residency policy remain separate platform review items; this application event does not claim to control them.
