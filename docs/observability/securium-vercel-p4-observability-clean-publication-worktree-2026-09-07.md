# Securium Vercel P4 Observability — Clean Publication Worktree

Snapshot: 2026-09-07  
Source worktree: `securium-vercel-observability-p4`  
Source branch: `design/vercel-observability-p4`  
Source HEAD: `313db389b8f3c1d0ccced0bb296661d163986b74`  
Source mutation: `0`  
Fresh `origin/main`: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`

## Publication status

Final Status: `SECURIUM_VERCEL_P4_OBSERVABILITY_CLEAN_PUBLICATION_WORKTREE_PASS_READY_FOR_BOUNDED_PR`

Decision: `APPROVE_CLEAN_MAIN_BASED_PRIVACY_SAFE_OBSERVABILITY_PUBLICATION_CANDIDATE`

Readiness: `P4_OBSERVABILITY_ISOLATED_ON_FRESH_MAIN_BOUNDED_PR_CREATION_MAY_PROCEED`

Primary Next Gate: `CREATE_SECURIUM_VERCEL_P4_OBSERVABILITY_BOUNDED_PR`

## Clean worktree

New worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-vercel-observability-p4-publication`  
New branch: `feat/vercel-p4-observability-publication`  
Base SHA: `92a2f0a94ad364118a3bef6ea5987e98a96223c9`  
Initial status: clean.

Fresh-main collision review found no changes to `lib/http.ts`, `lib/observability/request-observability.ts`, `package.json`, or `tests/request-observability.test.ts` between the source HEAD and current `origin/main`. The transplant therefore had no textual or semantic integration collision. Newer main files and dependencies were preserved.

## Exact publication candidate files

Runtime:

- `lib/http.ts`
- `lib/observability/request-observability.ts`

Focused test:

- `tests/request-observability.test.ts`

Package/script:

- `package.json` — only the approved `test:observability` script was added.

Publication evidence:

- `docs/observability/securium-vercel-p4-bounded-implementation-readiness-2026-09-07.md`
- `docs/observability/securium-vercel-p4-privacy-safe-minimal-server-observability-implementation-2026-09-07.md`
- `docs/observability/securium-vercel-p4-observability-runtime-field-boundary-repair-2026-09-07.md`
- `docs/observability/securium-vercel-p4-privacy-safe-minimal-server-observability-final-rereview-2026-09-07.md`
- matching machine reports under `reports/`.

The failed-review report and obsolete design report were intentionally not transplanted. No unrelated files were included.

## Parity and frozen boundaries

The four runtime/test/package files and all eight approval-evidence artifacts are byte-identical to the approved source files. Classification: `SEMANTICALLY_IDENTICAL`.

The implementation remains `SERVER_LOGGING_AND_METRICS` only:

- logs: implemented through structured server console output compatible with native Vercel Runtime Logs;
- metrics: native Vercel aggregation over bounded fields;
- traces, client telemetry, OTel, Drains, AI observability, MCP observability, dashboards, alerts, and product/learning analytics: not included.

The event remains `SECURIUM_REQUEST_OBSERVATION_V1` with exactly 15 fields:

`event`, `severity`, `routeFamily`, `routeTemplate`, `method`, `statusClass`, `outcome`, `errorCategory`, `authCategory`, `trafficCategory`, `runtimeCategory`, `environment`, `durationMs`, `durationBucket`, `correlationId`.

The repaired `isSafeCorrelationId(value: unknown): value is string` guard is present. It requires a primitive string before applying `[A-Za-z0-9._:-]{1,128}`; arbitrary objects, boxed strings, arrays, numbers, symbols, BigInts, control characters, and log-injection values cannot survive. No arbitrary metadata path exists. Request/response bodies, query values, raw URLs, arbitrary headers, secrets, raw errors, SQL, AI content, learner Evidence, and security payloads remain excluded. Correlation ID remains forbidden as a metric dimension.

## Validation

| Gate | Result |
| --- | --- |
| Focused observability tests | 16/16 PASS |
| Independent hostile-object probe | PASS; one event, 15 fields, primitive correlation, secret markers absent |
| Unit suite | 448/448 PASS |
| Integration suite | 59/59 PASS |
| PostgreSQL migration guard | 10/10 PASS |
| Typecheck | PASS |
| Lint | PASS |
| Production build | PASS |
| `git diff --check` | PASS |
| New skips/only/todo | 0 |
| New dependencies | 0 |

The first clean-worktree typecheck/lint attempt correctly exposed absent local dependencies; `npm ci --ignore-scripts` installed the existing lockfile dependencies in the publication worktree only. Package manifests and lockfile were unchanged. Subsequent typecheck and lint passed. No external telemetry network was used.

## Scope and safety

Privacy Critical/High: `0/0`  
Security Critical/High: `0/0`  
Cardinality Critical/High: `0/0`  
Cost risk: `LOW`  
Performance risk: `LOW`

Schema change: `0`  
Migration change: `0`  
Historical migration mutation: `0`  
Production DB: `NO`  
Deployment: `NO`  
UI change: `0`  
Source worktree mutation: `0`  
Commit: `NO`  
Push: `NO`  
PR: `NO`

The new worktree is ready for the separate bounded-PR gate. No PR, merge, deployment, route expansion, or observability-scope change was performed here.
