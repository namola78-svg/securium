# SECURIUM KNOWLEDGE PHASE 1 — Remaining Trust Boundary Repair

Snapshot date: 2026-08-28  
Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-knowledge-phase1`  
Branch: `feat/knowledge-phase1`

## 1. Final Status

`SECURIUM_KNOWLEDGE_PHASE_1_REMAINING_TRUST_BOUNDARY_REPAIR_PASS_READY_FOR_FINAL_FOCUSED_HUMAN_REVIEW`

Pre-repair HEAD, fresh `origin/main`, and merge base: `1855f9818b473a2aa752d004da45a27f056b4838`. Ahead: 0. Behind: 0. Main drift: none. No files were staged, committed, pushed, merged, deployed, or connected to production.

## 2. Original Remaining High Defect / Root Cause

Before repair, `createKnowledgeQueryService(authority)` was exported from `lib/services/knowledge-query-service.ts`. Structural typing allowed an arbitrary importer to provide `resolveConcept`, `loadState`, and `searchCandidates`, fabricate `ACTIVE/PUBLISHED/PUBLIC/APPROVED/OFFICIAL/CURRENT`, and receive a `PUBLIC` projection. Runtime composition was absent.

Unsafe export: `createKnowledgeQueryService`. Unsafe parameter: exported `KnowledgeAuthority`. Fake state: all trust-bearing repository results. Trusted output: `PUBLIC` projection. Root cause: no server-owned production composition boundary.

## 3. Selected Repair Architecture

Option C plus a test-only seam: the evaluator factory is kept in `knowledge-query-service-core.ts`; `knowledge-query-service-test-only.ts` is the only test-owned export of that seam. The production contract exports only identifier/query operations and pure ID helpers. `server-knowledge-query-service.ts` constructs the authority internally and is the only production composition point.

Before:

```text
Caller → createKnowledgeQueryService(fakeAuthority) → fake repository state → PUBLIC
```

After:

```text
Caller → identifier/query → server-owned Knowledge boundary
       → canonical repositories → configured database provider
       → server-derived state → bounded projection
```

## 4. Runtime Server-Owned Composition

Production query boundary: `resolvePublicKnowledge`, `searchPublicKnowledge`.  
Composition module: `lib/services/server-knowledge-query-service.ts`.  
Canonical concept repository: CP-A `concepts`, `concept_versions`, `concept_labels`.  
Canonical content repository: `contents` (publication read only).  
Search authority: bounded canonical `concept_labels`/`concepts` search, followed by canonical resolution and state eligibility.  
Provider path: `server-knowledge-query-service` → `db/index.ts:getDb` → `resolveDatabaseProviderName`/`createRuntimeDatabaseProvider` → Supabase PostgreSQL in production configuration.

Unsupported publication, rights/access, mapping, provenance, and freshness joins return unknown and fail closed. Certification has no fabricated implementation. Legacy `ontology_concepts` is not promoted to canonical Concept authority.

## 5. Export Surface Before/After

| Symbol | Before risk | After accessibility | Replace authority | Trusted output |
|---|---|---|---:|---:|
| `createKnowledgeQueryService` | Public injectable factory | Test-only/internal module | No in production API | No in production API |
| `KnowledgeAuthority` | Public structural trust seam | Test-only/internal type | No in production API | No |
| `resolvePublicKnowledge` | None | Production server boundary | No | Yes, fail closed |
| `searchPublicKnowledge` | None | Production server boundary | No | Yes, fail closed |
| `publicKnowledgeId` | Pure helper | Public | No | No |
| `canonicalIdFromPublicKnowledgeId` | Pure parser | Public | No | No |

Unsafe factory exports in the production contract: 0. Unsafe low-level trust evaluator exports: 0. Public query boundary count: 2. Future consumers can inject authority: NO.

## 6. KnowledgeAuthority Disposition

`KnowledgeAuthority` and `createKnowledgeQueryService` are no longer exported by the production contract module. They remain only in a core module reached by the explicitly test-owned adapter, so unit tests can model changing server repository state without making that seam part of the runtime consumer API.

## 7. Authority Matrix

| Authority fact | Canonical owner | Runtime concrete binding | Caller replaceable? | Fail closed? |
|---|---|---|---:|---:|
| Concept identity/lifecycle | CP-A `concepts` | `getDb()` queries | No | Yes |
| Concept version/labels | CP-A `concept_versions`, `concept_labels` | `getDb()` queries | No | Yes |
| Ontology compatibility | Legacy `ontology_concepts` only | Not promoted; unresolved legacy references remain unresolved | No | Yes |
| Publication | Existing content publication rows | `contents.status` where applicable; otherwise unknown | No | Yes |
| Mapping | Existing stored mapping authority | Not inferred when unavailable | No | Yes |
| Provenance | Existing source/revision authority | Not inferred when unavailable | No | Yes |
| Freshness | Existing revision/lifecycle/mapping facts | Unknown unless all facts are authoritative | No | Yes |
| Search canonical resolution | Canonical Concept repository | Canonical label/key candidate search then resolver | No | Yes |

## 8. Eligibility, Mapping, Provenance, Freshness, Search

Eligibility is derived only after server resolution and server state. Mapping approval, official provenance, currentness, and publication cannot be supplied in request fields or candidate metadata. Search is candidate discovery only; high score never establishes canonical identity. Unsupported server facts do not become public.

## 9. Fake-Authority Regression

The focused regression checks the exact attack shape (`resolveConcept`, `loadState`, `searchCandidates` returning active/published/public/approved/official/current) against the production contract. The public module contains no factory or `KnowledgeAuthority` export and exposes only the two server-owned operations.

Fake Authority Accepted By Public Runtime Boundary: **NO**.  
Fake Authority Regression Strength: **STRONG**.  
Old factory access through production API: **NO**.  
Caller can replace production Knowledge authority: **NO**.  
Caller-injected fake repository functions: **NO**.  
Trust-boundary bypass paths: **0**.  
Structural trust injection risk: **LOW** (test-only/internal seam; none at production boundary).

Attack matrix: fake resolver — no production injection; fake state loader — no production injection; fake candidates — no production injection; `published=true`, `approved=true`, `official`, `fresh/current` request fields — ignored; high-score candidate — requires canonical server resolution and state.

## 10. Call-Site / Bypass Review

Production Knowledge call sites: 0 existing consumers. Test call sites: the Knowledge contract test uses the test-owned adapter. Unsafe production call sites: 0. Unknown call sites: 0. A future MCP/UI/Agent consumer can provide only identifier/query/bounded filter inputs, not authority, repository, provider, or trust state.

## 11. Supabase / D1 Authority

Primary runtime database: `SUPABASE_POSTGRESQL`. Canonical Knowledge database: `SUPABASE_POSTGRESQL`. D1 canonical authority: NO; D1 remains compatibility/test-only. Caller provider selection: 0. No second database client or raw SQL bypass was added.

## 12. Content / Private Data Firewalls

No question retrieval, question-bank export, user/progress/evidence/mastery/competency/credential reads, restricted full-content export, application writes, eligibility persistence, provenance persistence, freshness persistence, mapping-trust persistence, auth, proxy, governance, PIA, audit, receipt, MCP, UI, Skill, Role, or Competency changes were introduced. Unknown rights remain fail closed. The pre-existing `PROVEN_PREEXISTING_FAILURE` fixture was not modified and is not independently commit-blocking.

## 13. Schema / Migration Firewall

Schema changed: NO. Migration changed: NO. Supabase application writes: 0. Canonical Knowledge writes: 0. Production connection: NO.

## 14. Full Validation

| Check | Result |
|---|---|
| Focused Knowledge | 10 passed, 0 failed |
| Full unit | 448 passed, 0 failed |
| Integration D1 | 58 passed, 1 failed existing disposable PostgreSQL fixture |
| Provider parity/runtime-link | 7 passed, 0 failed |
| Typecheck | PASS |
| Lint | PASS |
| DB check | PASS |
| Migration guard | 9 passed, 1 failed because Docker Desktop Linux engine unavailable |
| Build | PASS; 63 routes |
| `git diff --check` | PASS |

The two PostgreSQL-related failures are environmental Docker API failures (`dockerDesktopLinuxEngine` unavailable), not regressions from this repair. New skip/only/todo: 0. Assertion weakening: 0. New lint suppressions: 0. Unsafe type escapes: 0.

## 15. Security / Data Trust

Security Critical/High: 0/0 in changed Knowledge boundary. Data Trust Critical/High: 0/0. Caller trust elevation: 0. Fake repository injection risk: 0 at production boundary. Provider spoofing: 0. Search-as-truth risk: 0. Restricted-content false allow: 0. Fake-authority acceptance: 0.

## 16. P1 Result

P1-A: PASS — server-bound canonical resolver, ontology compatibility remains non-canonical, search resolves canonically.  
P1-B: PASS — public identity is separate from eligibility and no caller authority is accepted.  
P1-C: PASS — mapping/provenance/freshness/search trust are server-owned or fail closed.  
P1-D: PASS — no changed-path Critical/High security or data-trust finding; bypass count is 0.

## 17. Agent V1 Foundation

Knowledge Search Authority Ready: YES (boundary only). Exact Concept Retrieval Authority Ready: YES (boundary only). Certification Retrieval Authority Ready: PARTIAL/unsupported until an existing canonical certification authority is identified. Learning Content Search Authority Ready: PARTIAL/unsupported trust joins fail closed. Bounded Relationship Retrieval Authority Ready: PARTIAL. Ready for Agent V1 scope review: YES, subject to authority review. Ready for Agent V1 implementation authorization: NO.

## 18. Diff / Remaining Findings

Added runtime files: `lib/services/knowledge-query-service-core.ts`, `lib/services/knowledge-query-service-test-only.ts`, `lib/services/server-knowledge-query-service.ts`. Modified runtime file: `lib/services/knowledge-query-service.ts` (facade replacement). Modified test: `tests/knowledge-public-contract.test.ts`. Added report: this file. Deleted files: none. Unexpected runtime files: none. Prior three reports were preserved unchanged.

Remaining finding: complete server-backed publication/mapping/provenance/freshness joins for future public positive projections if and when those facts are required. The current implementation does not fabricate them and returns unavailable/unknown.

## 19. Recommended Next Gate

`REVIEW_SECURIUM_KNOWLEDGE_PHASE_1_TRUST_BOUNDARY_REPAIR_FINAL`

Commit readiness remains NO pending one focused human review. Staged files: 0. Commit/push/PR/merge/deployment: NO.

## 20. Required Result Summary

Caller publication authority: 0. Caller eligibility authority: 0. Caller mapping authority: 0. Caller provenance authority: 0. Caller freshness authority: 0. Caller search canonical authority: 0. Caller repository authority: 0. Caller provider authority: 0. D1 canonical authority: NO. Second source of truth introduced: NO. Thin composition preserved: YES. New domain model: NO. New persistence: NO. Dead code: 0. Unused abstraction: 0. Circular dependency: 0. Unbounded query risk: 0.

Ready for final focused human review: YES. Ready for commit authorization: NO. Ready for commit/push/PR: NO. Ready for Agent V1 scope review: YES (partial authority readiness). Ready for Agent V1 implementation authorization: NO.
