# SECURIUM VERCEL P0-P4 CLOSURE AUDIT

Snapshot date: 2026-08-28
Authorization: `AUTHORIZE_VERCEL_P0_P4_CLOSURE_AUDIT_READ_ONLY`

## Final status

`SECURIUM_VERCEL_P0_P4_CLOSURE_AUDIT_PASS_STRUCTURAL_OPTIMIZATION_COMPLETE_PRODUCTION_MEASUREMENT_BLOCKED_EXTERNAL_VERCEL`

Structural closure passes. No phase regression was found. Production measurement and any further optimization remain blocked by the external Vercel account/control-plane state.

## Repository identity and authority

| Field | Result |
|---|---|
| Worktree | `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-vercel-p0-p4-closure` |
| Branch | `audit/vercel-p0-p4-closure` |
| HEAD | `25a59bbcd5184afbc5e783fc3099c752c91cf05f` |
| Fresh origin/main | `25a59bbcd5184afbc5e783fc3099c752c91cf05f` |
| Main Match | YES |
| Git Status | CLEAN before report; report is the only change |
| P0 Authority Present | YES — `2a628ff4e8cc6a6c249218874cc72563faadf55b` is an ancestor |
| P1 Authority Present | YES — force-dynamic classification authority is retained; `f5b094cd693ba083c06797a809b0f0bda0233da0` supplies auth-page force-dynamic authority |
| P2 Authority Present | YES — `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` is an ancestor |
| P3 Authority Present | YES — `55dc6640ee25e269d5a9ba4ed8e472b51be40c0c` is an ancestor |
| P4 Authority Present | YES — `a01a0886a85632adeb8de57267b612757c9a07f6` is an ancestor |
| Governance PR #85 interference | NONE |

The current main tip is the unrelated governance PR #85 merge. No audit action modified or interfered with it.

## Phase regression result

| Phase | Result | Evidence |
|---|---|---|
| P0 | PASS | Current presentation boundary and focused tests |
| P1 | PASS | 60-route dynamic inventory retained; `/courses` is MUST_DYNAMIC |
| P2 | PASS | 15-second writer contracts and focused tests |
| P3 | PASS | Classifier, fail-safe defaults, and focused tests |
| P4 | PASS | Bounded event, privacy tests, and route-count recalculation |

## P0 — presentation identity

| Metric | Result |
|---|---:|
| Root Identity Resolver Count | 0 |
| SiteHeader Identity Resolver Count | 0 |
| Presentation Provider Count | 1 |
| Session Fetch Owner Count | 1 |
| Presentation Polling Count | 0 |
| Private Identity In Public HTML | 0 |
| Client Authorization Authority | 0 |
| Additional Anonymous Auth DB Lookup | 0 |

The public root and `SiteHeader` do not resolve application identity. The single presentation provider owns the session request, and its response is presentation-only. Protected route and API authorization remains server-side. P0 regression: PASS.

## P1 — force-dynamic

Current inventory: 60 P1-scoped routes examined; 60 `MUST_DYNAMIC`; 0 `CAN_ISR`; 0 `CAN_STATIC`. `/courses` is explicitly retained as `MUST_DYNAMIC` under the current architecture. No P2/P3/P4 change removed or weakened this boundary. P1 regression: PASS.

## P2 — progress amplification

| Contract | Result |
|---|---|
| P2 Interval | 15,000 ms |
| Dirty-State Suppression | PRESENT |
| Paused Recurring Writes | STOPPED |
| Final Checkpoints | Pause and end preserved |
| In-Flight Serialization | PRESENT |
| Hidden-tab behavior | UNCHANGED |
| API changed | NO |
| Schema changed | NO |
| Migration changed | NO |
| Auth changed | NO |

P2 preserves active checkpoints, retries after failed saves, completion semantics, resume semantics, and server ownership validation. P2 regression: PASS.

## P3 — build churn

`scripts/vercel-ignore-build.mjs`, `tests/vercel-ignore-build.test.mjs`, and `vercel.json` are present.

| Classifier contract | Result |
|---|---|
| Production | BUILD |
| Preview + explicitly proven safe-only diff | SKIP |
| Runtime | BUILD |
| Mixed | BUILD |
| Unknown | BUILD |
| Test-only | BUILD |
| Missing/invalid SHA | BUILD |
| Git/parser failure | BUILD |
| Unsafe rename/deletion | BUILD |
| Branch-name filtering | NONE |
| Exit 0 | SKIP |
| Exit 1 | BUILD |

P3 is fail-safe and was not weakened by P4. P3 regression: PASS.

## P4 — observability and privacy

| Metric | Result |
|---|---:|
| P4 Event | `SECURIUM_REQUEST_OBSERVATION_V1` |
| Total API Routes | 59 |
| Application Event Coverage | 52 |
| Native Vercel Coverage | 59 |
| Progress Coverage | 4/4 |
| High-Cardinality Fields | 0 |
| Application DB Telemetry Writes | 0 |
| D1 Telemetry Writes | 0 |
| External Telemetry Requests | 0 |

P4 emits bounded route-family/template, method, status, auth, traffic, runtime, environment, and duration categories. It emits no raw URL, query, raw or hashed IP, full User-Agent, email, user/application-user/session ID, cookie, Authorization, OAuth code, body, `HumanDecisionHash`, `actorAuditLogId`, or receipt UUID. P4 regression: PASS.

## Cross-phase compatibility

| Intersection | Result | Finding |
|---|---|---|
| P0/P4 Compatibility | PASS | Telemetry source contains 0 calls to `getOptionalCurrentAppUser`, `getCachedCurrentAppUser`, `resolveCurrentAppUser`, `findUserWithRoleCodesByEmail`, or `ensureUser`; no anonymous auth lookup is added |
| P2/P4 Compatibility | PASS | No progress save, timer, polling, DB write, or external telemetry request is added |
| P3/P4 Compatibility | PASS | Runtime P4 source/config changes are BUILD-class changes; classifier is unchanged/weakened: NO |

## Cost accounting

### PROVEN

- P0 removed global public application-user/role resolution from the presentation path.
- P2 deterministically suppresses redundant successful unchanged progress writes, stops paused recurring writes, and preserves necessary final checkpoints.
- P3 provides a tested fail-safe Preview skip classifier; the retained historical sample demonstrates actual Preview churn, including repeated commits on eligible branches.
- P4 adds bounded diagnostic coverage without application DB/D1 writes or external telemetry requests; local classification overhead is bounded and negligible in focused tests.

### PROSPECTIVE

- P0 should reduce anonymous public auth/database work.
- P2 should reduce progress route invocations and downstream work for unchanged/paused/boundary cases.
- P3 should reduce safe non-runtime Preview builds after the Vercel ignored-build control is enabled and verified.
- P4 should make future invocation spikes diagnosable by route family, normalized category, method, status, progress concentration, traffic category, auth category, runtime, environment, and Preview/Production dimensions.

### UNMEASURED / UNKNOWN

Exact production invocation, DB, build-count, Build CPU, dollar, and percentage savings are not measured. Hidden-tab browser behavior is unchanged. Bot and auth categories are bounded classifications, not exact identity or intent. P4 coverage is application-event coverage, not proof that every Vercel-native request is represented by the application wrapper.

## Historical evidence boundary

| Field | Result |
|---|---:|
| Historical Deployment Sample Count | 40 |
| Historical Preview Count | 26 |
| Historical Production Count | 14 |
| Historical 574 Estimate | UNVERIFIED |
| Historical 3.02M Root Cause Proven | NO |
| Historical 3.02M Eliminated | NOT PROVEN |
| Future Equivalent Spike Diagnosable | YES |

The 40-record deployment sample proves a bounded historical Preview/Production pattern only; it is not a full historical total. The 3.02M root cause remains unproven and history is not rewritten.

## P4 diagnostic matrix

| Diagnostic dimension | Result |
|---|---|
| Top Route Family | YES |
| Top Normalized Route Category | YES |
| HTTP Method Distribution | YES |
| Status Class Distribution | YES |
| Progress API Volume | YES |
| Public/API Concentration | YES |
| Traffic Category | YES |
| Safe Auth Category | PARTIAL — bounded category, not user identity |
| Deployment Environment Correlation | YES |
| Preview/Production Correlation | YES, when environment metadata is present |
| Exact User Attribution | NO |
| Exact Raw IP Attribution | NO |

## Vercel external block

| Field | Result |
|---|---|
| Vercel Status | External account/control-plane access remains unavailable for this closure’s new validation |
| Vercel Classification | `VERCEL_EXTERNAL_ACCOUNT_BLOCK` |
| Production Measurement Available | NO |
| Deployment | NOT EXECUTED |
| Production Connection | NOT EXECUTED |

Repository evidence retains the prior read-only 40-deployment sample, while the stored project context has also returned `project_not_found`/inaccessible-account state. No Vercel mutation was attempted. This block prevents Preview/Production deployment validation, production telemetry collection, actual invocation before/after measurement, and actual Build CPU before/after measurement.

## Production measurement plan — design only

After account recovery, use a bounded 7-day baseline/measurement window at minimum; 14 days is preferred. Compare Function Invocations/day, invocations by request family, Progress API requests/hour, 5xx rate, safely available anonymous/auth distribution, traffic category distribution, Preview build count, Build CPU, and Production build count. Do not set target percentages before baseline data exists.

Legitimate before evidence consists of available historical Vercel billing/deployment evidence, P0/P2/P3 audit snapshots, and existing traffic detail (which is insufficient for exact attribution). Legitimate after evidence consists of P4 structured events, Vercel Runtime Logs/Observability, deployment metadata, and Vercel usage metrics. These sources have different scopes and cannot be treated as a single continuous historical series without reconciliation.

## Security, data trust, and firewalls

| Field | Result |
|---|---|
| Security Critical | 0 |
| Security High | 0 |
| Data Trust Critical | 0 |
| Data Trust High | 0 |
| Auth Changed | NO |
| Governance Changed | NO |
| CS1A Changed | NO |
| Audit Execution Changed | NO |
| Receipt Changed | NO |
| Schema Changed | NO |
| Migration Changed | NO |
| Content Changed | NO |
| Ontology Changed | NO |
| Evidence Changed | NO |
| DB Write | 0 |

Review found no auth bypass, private identity exposure, cache leakage introduced by P0-P4, telemetry PII leakage, log-injection path, uncontrolled cardinality, client authorization authority, progress correctness regression, or unsafe build skip. Historical claims, savings claims, bot limitations, auth-category limitations, coverage limits, and sample limits remain explicitly qualified.

## Validation and integrity

| Gate | Result |
|---|---|
| P0 Tests | PASS — focused boundary tests included in 27/27 |
| P2 Tests | PASS — focused progress tests included in 27/27 |
| P3 Tests | PASS — classifier tests included in 27/27 |
| P4 Tests | PASS — observability tests included in 27/27 |
| Typecheck | PASS |
| Lint | PASS |
| Unit | PASS — 448/448 |
| Integration | PASS — 59/59 |
| Migration Guard | PASS — 10/10 |
| DB Check | PASS |
| Build | PASS |
| New skip | 0 |
| New only | 0 |
| New todo | 0 |
| Assertion weakening | 0 |

`npm ci` was run because dependencies were absent; it changed ignored dependency state only. No runtime code, configuration, schema, content, evidence, workflow, or Vercel state was changed. No test was weakened.

## Version-control and scope boundary

| Action | Result |
|---|---|
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Deployment | NO |
| Production Connection | NO |

| File scope | Result |
|---|---|
| Exact Changed Files | `reports/securium-vercel-p0-p4-closure-audit-2026-08-28.md` |
| Unexpected Changed Files | NONE |
| Reports Written | 1 — this report |

No new optimization was implemented. Rate limiting, bot/crawler blocking, cache changes, ISR/static conversion, polling changes, build rules, telemetry backends, drains, and analytics integrations remain separate future work requiring production evidence.

## Required result

| Field | Result |
|---|---|
| Structural Optimization Complete | YES |
| Ready For Production Measurement | YES, conditional on Vercel account recovery |
| Ready For Further Optimization | NO — wait for bounded production measurement |
| Remaining Preconditions | Recover Vercel account/control-plane access; verify project/environment settings; collect bounded baseline; then collect measurement window |
| Recommended Next Step | `WAIT_FOR_VERCEL_ACCOUNT_RECOVERY_THEN_AUTHORIZE_P0_P4_PRODUCTION_MEASUREMENT` |

## Final summary

P0

Presentation identity is isolated: root and `SiteHeader` identity resolver count is 0, one provider owns one session fetch, no presentation polling exists, public HTML contains no private identity, and authorization remains server-side.

P1

The current P1-scoped inventory has 60 `MUST_DYNAMIC` routes, including `/courses`; `CAN_ISR` and `CAN_STATIC` are both 0.

P2

Progress amplification controls are preserved: 15-second checkpoints, dirty-state suppression, stopped paused cadence, final pause/end checkpoints, and in-flight serialization.

P3

Build churn control is present and fail-safe: production, runtime, mixed, unknown, test-only, invalid-input, parser-failure, and unsafe path cases BUILD; only proven safe Preview diffs SKIP.

P4

Bounded observability is present for 59 API routes with 52 application-wrapped routes, 59 native Vercel baseline routes, 4/4 progress routes, zero high-cardinality fields, and no telemetry DB or external request.

CROSS-PHASE COMPATIBILITY

P0/P4, P2/P4, and P3/P4 all PASS. P4 does not reintroduce identity cost, progress activity, or classifier weakening.

PROVEN BENEFITS

Only structurally/deterministically proven improvements are claimed: public identity-resolution removal, redundant progress-write suppression, tested safe Preview classification, historical bounded Preview churn demonstration, and zero-backend bounded telemetry overhead.

UNMEASURED BENEFITS

Production invocation, progress-volume, deployment-count, Build CPU, cost, and percentage reductions remain unmeasured.

HISTORICAL 3.02M

The historical 3.02M root cause remains unproven, and its elimination is not proven.

OBSERVABILITY

A future equivalent spike is prospectively diagnosable by bounded route, request, status, traffic, auth-category, runtime, environment, and deployment-environment dimensions, but not by exact user or raw IP.

VERCEL EXTERNAL BLOCK

`VERCEL_EXTERNAL_ACCOUNT_BLOCK` remains applicable. Preview/Production deployment validation, production telemetry collection, actual invocation before/after measurement, and actual Build CPU before/after measurement remain blocked.

PRODUCTION MEASUREMENT

After account recovery, run a 7-day minimum, preferably 14-day, bounded baseline/measurement comparison across invocations, Progress API volume, errors, traffic/auth categories, Preview/Production builds, and Build CPU.

SECURITY / DATA TRUST

Combined result: Security Critical 0, Security High 0, Data Trust Critical 0, Data Trust High 0. Claims remain bounded and qualified.

NEXT GATE

`WAIT_FOR_VERCEL_ACCOUNT_RECOVERY_THEN_AUTHORIZE_P0_P4_PRODUCTION_MEASUREMENT`
