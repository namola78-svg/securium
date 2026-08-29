# SECURIUM KNOWLEDGE PHASE 1 — Final Focused Review

Review date: 2026-08-29  
Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-knowledge-phase1`  
Branch: `feat/knowledge-phase1`

## 1. Final Review Decision

`BLOCK_COMMIT_TRUST_DEFECT`

The production facade is improved, but the injectable factory remains directly importable from a normal runtime `lib/` module. The exact fake-authority attack still produces a `PUBLIC` projection through that module.

## 2. Original Defect History

Original defect: `CALLER_SUPPLIED_TRUST_AUTHORITY`. First repair remaining defect: `CALLER_REPLACEABLE_KNOWLEDGE_AUTHORITY`. The latest facade removed the factory from `knowledge-query-service.ts`, but `knowledge-query-service-core.ts` still exports `createKnowledgeQueryService(authority)` and `KnowledgeAuthority`, while `knowledge-query-service-test-only.ts` re-exports them from `lib/`.

Fresh-main result: `HEAD`, `origin/main`, and merge base are all `1855f9818b473a2aa752d004da45a27f056b4838`; ahead 0, behind 0. Main drift: none. `git diff --check`: PASS. All Knowledge files and reports are untracked pre-commit artifacts; prior reports were not modified.

## 3. Production Export Surface

| Symbol | Module | Purpose | Caller inputs | Repository supplied by caller? | Authority supplied by caller? | Provider supplied by caller? | Trusted public output? |
|---|---|---|---|---:|---:|---:|---:|
| `resolvePublicKnowledge` | `knowledge-query-service.ts` → server module | Public lookup | entity type/public ID | No | No | No | Yes, fail-closed |
| `searchPublicKnowledge` | `knowledge-query-service.ts` → server module | Public bounded search | query/limit | No | No | No | Yes, fail-closed |
| `publicKnowledgeId` | public contract/core | Pure ID helper | namespace/ID | No | No | No | No |
| `canonicalIdFromPublicKnowledgeId` | public contract/core | Pure parser | ID/entity | No | No | No | No |
| `createKnowledgeQueryService` | `knowledge-query-service-core.ts` | Injectable evaluator factory | `KnowledgeAuthority` | Yes | Yes | Indirectly | Yes |

Production facade injectable factory count: 0. Runtime-importable injectable factory count across the Knowledge implementation: 1. This distinction is why the final review blocks.

## 4. Server-Owned Composition

Composition module: `lib/services/server-knowledge-query-service.ts`. Composition symbol: internal `serverAuthority()` and `productionService`. Canonical Concept source: CP-A `concepts`, `concept_versions`, `concept_labels`. State source: `contents` for content publication and CP-A identity/lifecycle; unsupported trust facts become unknown. Search source: canonical concept labels/keys followed by canonical resolution and state checks. Provider authority: `db/index.ts` and `createRuntimeDatabaseProvider`; the caller cannot select it through the public operations.

The composition is genuinely server-bound for the facade, but it imports the still-exported core factory. A direct importer can bypass the facade and obtain trusted output.

## 5. Fake-Authority Regression

The new test checks that the facade source does not expose the factory and that the server module owns composition. It passes 10/10 focused tests, but it does not test direct import of the runtime core module. I independently executed the old attack against that module with fabricated resolver/state/candidate functions returning `ACTIVE`, `PUBLISHED`, `PUBLIC`, `APPROVED`, `OFFICIAL`, and `CURRENT`.

Observed result: `{"kind":"PUBLIC", ... "freshness":"CURRENT_PUBLISHED"}`.

Fake Authority Accepted By Production Boundary: **YES via direct runtime core import**.  
Fake Authority Accepted By Public Facade: NO.  
Regression strength: **WEAK for the actual runtime module graph**. It would catch restoring the facade export, but not the currently reachable core bypass.

## 6. Structural Injection Review

`KnowledgeAuthority` is not exported by the facade, but is exported by `knowledge-query-service-core.ts` and re-exported by `knowledge-query-service-test-only.ts`, both under `lib/`. No package export map or runtime-only enforcement prevents an importer from loading the core module. Structural Trust Injection Risk: **HIGH**. The previous HIGH finding therefore remains open.

Production code does not import the test-only module, but production server code imports the core factory directly, so the seam is not confined to tests/internal-only code.

## 7. Caller Authority Counts

Through the facade: repository 0, provider 0, publication 0, eligibility 0, mapping 0, provenance 0, freshness 0, search canonical 0. Across the complete runtime-importable implementation: repository authority 1, eligibility/trust authority 1, because the core factory accepts arbitrary `KnowledgeAuthority` and can produce trusted output. Bypass path count: **1**.

## 8. Eligibility / Mapping / Provenance / Freshness

The evaluator derives eligibility from authority state and correctly ignores malicious request fields. Unknown facts fail closed. Mapping cannot be established through the facade; provenance and freshness cannot be established through request data. These properties are sound inside the server composition, but are bypassable through the directly importable factory.

## 9. Search Canonicalization

The server search path bounds candidates, resolves each through canonical Concept data, loads server state, and does not treat score as authority. The direct factory still allows a caller to provide both candidate and resolver authority, so search canonical authority is bypassable through the core module.

## 10. Remaining Fail-Closed Authority Gaps

| Gap | Current behavior | False public allow? | Blocking Phase 1? | Future work |
|---|---|---:|---:|---:|
| Certification authority | Unsupported/unknown | No through facade | Nonblocking capability gap | Identify existing canonical certification repository |
| Complete publication joins | Unknown where unavailable | No | Nonblocking if fail-closed | Bind existing publication authority |
| Mapping joins | Unknown/null where unavailable | No | Nonblocking if fail-closed | Bind stored approved mapping authority |
| Provenance joins | Unknown where unavailable | No | Nonblocking if fail-closed | Bind source/revision authority |
| Freshness joins | Unknown where unavailable | No | Nonblocking if fail-closed | Bind revision/lifecycle/mapping authority |
| Injectable core factory | Fabricated state can be PUBLIC | **Yes** | **Blocking** | Move seam outside runtime-importable production module or eliminate exported factory |

## 11. Supabase / D1 Authority

Primary runtime database: `SUPABASE_POSTGRESQL`. Canonical Knowledge database: `SUPABASE_POSTGRESQL`. D1 canonical authority: NO. Miniflare canonical authority: NO. The public caller cannot choose D1, Miniflare, mock repository, or fake provider; the core bypass remains provider-agnostic and does not itself select a database.

## 12. Integration Failure Classification

Exact failing test: `FR-1A I11 disposable PostgreSQL applies 0011 with RLS, privileges, and history-safe FKs` in `tests/fact-persistence-integration.test.mjs`. Exact suite command: `npm.cmd run test:integration`. Failure point: the test's first `docker run ... postgres:17.6`, before PostgreSQL starts and before any Knowledge code is exercised. Docker dependency: Docker Desktop Linux engine. `docker info` independently reported client context `desktop-linux` but server failure on `dockerDesktopLinuxEngine`.

The test did not execute its PostgreSQL assertions. The test is unrelated to Knowledge Phase 1 files. The test source and command are present on fresh `origin/main`; no Knowledge implementation exists there, so the same pre-test Docker failure is independent of this worktree. Classification: **ENVIRONMENT_ONLY**.

## 13. Migration Guard Failure Classification

Exact failing test: `disposable PostgreSQL 17.6 executes fixture only after guard pass` at `tests/postgres-migration-guard.test.mjs:149`. Command: `npm.cmd run test:postgres-migration-guard`. Failure point: first `docker run ... postgres:17.6`, before the disposable database, migration fixture, or guard execution. Docker dependency and daemon error are identical. Migration files were not changed by this Knowledge work. Fresh `origin/main` contains the same Docker-dependent test. Classification: **ENVIRONMENT_ONLY**.

No Docker tests were skipped or weakened.

## 14. Full Validation

Focused Knowledge: 10/10. Full unit: 448/448. Provider parity/runtime-link: 7/7. Typecheck: PASS. Lint: PASS. DB check: PASS. Build: PASS / 63 routes. `git diff --check`: PASS. Integration D1 portion: 58 passed; PostgreSQL fixture blocked by Docker. Migration guard: 9 passed; PostgreSQL fixture blocked by Docker.

New Skip: 0. New Only: 0. New Todo: 0. Assertion weakening: 0. Unsafe type escape: 0. Fake-authority test weakening: **1 gap** — no direct-core import regression.

## 15. Security / Data Trust

Security Critical/High: 0/1. Data Trust Critical/High: 0/1. Caller trust elevation count: 1 through direct core factory. Fake repository injection risk: HIGH through core. Provider spoofing risk: LOW through facade, HIGH for the injectable core seam. Search-as-truth risk: LOW through facade, HIGH through fake authority. Restricted content risk: fail-closed in evaluator but not sufficient to close the injection defect.

## 16. P1-A/B/C/D

P1-A: **FAIL** — canonical facade composition exists, but a runtime-importable factory bypass remains.  
P1-B: **FAIL** — public facade is safe, complete implementation graph is not.  
P1-C: **FAIL** — trust facts are server-owned only on the facade path.  
P1-D: **FAIL** — Data Trust High and bypass count remain 1.

## 17. Agent Foundation

Knowledge Search: PARTIAL. Exact Concept Retrieval: PARTIAL. Certification Retrieval: NOT READY. Learning Content Search: PARTIAL. Bounded Relationships: NOT READY. Agent V1 scope review: NO while the trust boundary is open. Agent V1 implementation authorization: NO.

## 18. Exact Diff / Scope

Because the worktree is pre-commit and files are untracked, `git diff --stat` is empty; `git status --short` lists the four Knowledge runtime files, Knowledge test, prior three reports, and the 2026-08-28 repair report. This review adds exactly this report. No code/test/prior-report/schema/migration files were modified during this review. Staged files: 0.

## 19. Commit / PR Recommendation

Do not authorize commit, push, PR, merge, or deployment. The Docker failures are independently classified `ENVIRONMENT_ONLY` and are not the commit blocker. The trust defect is the blocker.

## 20. Next Gate

`REPAIR_SECURIUM_KNOWLEDGE_PHASE_1_PRODUCTION_AUTHORITY_BOUNDARY`

Required correction: make the authority factory genuinely non-runtime-importable by moving it to a test-owned location outside the production runtime module graph, or eliminate the factory from the runtime implementation and construct the evaluator only inside the server-owned composition. Add a regression that directly verifies every runtime-importable Knowledge module cannot accept fabricated authority.

--------------------------------------------------
REVIEW DECISION
--------------------------------------------------

`BLOCK_COMMIT_TRUST_DEFECT`

--------------------------------------------------
ORIGINAL TRUST DEFECT
--------------------------------------------------

`CALLER_SUPPLIED_TRUST_AUTHORITY` evolved into `CALLER_REPLACEABLE_KNOWLEDGE_AUTHORITY`; it remains reachable through the core runtime module.

--------------------------------------------------
SERVER-OWNED COMPOSITION
--------------------------------------------------

Facade composition is server-owned in `server-knowledge-query-service.ts`, but the runtime-importable core factory provides one bypass.

--------------------------------------------------
PRODUCTION EXPORT SURFACE
--------------------------------------------------

Facade exports are safe; core runtime exports are not.

--------------------------------------------------
FAKE AUTHORITY ATTACK
--------------------------------------------------

Direct core attack reproduced and returned `PUBLIC`. Required result is therefore NO, but observed result is YES.

--------------------------------------------------
FAIL-CLOSED AUTHORITY GAPS
--------------------------------------------------

Certification and incomplete trust joins fail closed and are nonblocking; the injectable runtime core is not fail-closed and is blocking.

--------------------------------------------------
SUPABASE / D1
--------------------------------------------------

Supabase PostgreSQL is canonical; D1 and Miniflare are not canonical.

--------------------------------------------------
INTEGRATION CLASSIFICATION
--------------------------------------------------

`ENVIRONMENT_ONLY` — Docker daemon unavailable before unrelated PostgreSQL test execution.

--------------------------------------------------
MIGRATION GUARD CLASSIFICATION
--------------------------------------------------

`ENVIRONMENT_ONLY` — Docker daemon unavailable before fixture/guard execution.

--------------------------------------------------
SECURITY / DATA TRUST
--------------------------------------------------

Security/Data Trust Critical/High: `0/1/0/1`; trust bypass paths: 1.

--------------------------------------------------
P1-A/B/C/D
--------------------------------------------------

FAIL / FAIL / FAIL / FAIL.

--------------------------------------------------
VALIDATION
--------------------------------------------------

Focused 10/10, unit 448/448, parity 7/7, typecheck/lint/DB/build/diff-check PASS; Docker-dependent PostgreSQL checks environment-blocked.

--------------------------------------------------
COMMIT / PR
--------------------------------------------------

NO. Do not authorize commit, push, or PR.

--------------------------------------------------
NEXT GATE
--------------------------------------------------

`REPAIR_SECURIUM_KNOWLEDGE_PHASE_1_PRODUCTION_AUTHORITY_BOUNDARY`
