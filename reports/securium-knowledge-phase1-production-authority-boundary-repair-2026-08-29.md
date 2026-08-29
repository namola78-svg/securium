# SECURIUM KNOWLEDGE PHASE 1 — Production Authority Boundary Repair

## 1. Final Status

`SECURIUM_KNOWLEDGE_PHASE_1_PRODUCTION_AUTHORITY_BOUNDARY_REPAIR_PASS_READY_FOR_FINAL_HUMAN_REVIEW`

Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-knowledge-phase1`  
Branch: `feat/knowledge-phase1`  
Pre-repair HEAD: `1855f9818b473a2aa752d004da45a27f056b4838`  
Fresh `origin/main`: same  
Merge base: same  
Ahead/behind: `0/0`  
Main drift: none  
Repair report: this file.

## 2. Prior Deep-Import Defect / Root Cause

The prior review directly imported `lib/services/knowledge-query-service-core.ts`, supplied a structurally fabricated `KnowledgeAuthority`, and obtained a `PUBLIC` projection with `ACTIVE/PUBLISHED/PUBLIC/APPROVED/OFFICIAL/CURRENT` state. The root cause was runtime availability of an authority-accepting factory below an otherwise safe facade.

## 3. Module Graph Before / After

Before:

```text
Production/runtime importer
  → lib/services/knowledge-query-service-core
  → createKnowledgeQueryService(fakeAuthority)
  → fabricated trusted state
  → PUBLIC
```

After:

```text
Production/runtime importer
  → knowledge-query-service.ts
  → resolvePublicKnowledge/searchPublicKnowledge
  → server-knowledge-query-service.ts
  → non-exported evaluator + concrete repositories
```

```text
Tests
  → tests/support/knowledge-query-test-harness.ts
  → explicit injected test authority
```

The old core path and old test-only `lib/` path are absent. Production source does not import the test harness.

## 4. Production Export Surface

Production Knowledge module: `lib/services/knowledge-query-service.ts`. Runtime exports are `resolvePublicKnowledge`, `searchPublicKnowledge`, `publicKnowledgeId`, and `canonicalIdFromPublicKnowledgeId`. Request inputs are identifier/query/bounded limit only. Caller repository authority: no. Caller authority: no. Caller provider: no. Trusted output: only through server-owned composition.

Injectable factory export count: `0`. Authority type export count: `0` from production modules. Provider injection count: `0`. Repository injection count: `0`. Trusted projection boundary count: `2`.

## 5. Test-Only Injection Design

The deterministic injected evaluator is now located at `tests/support/knowledge-query-test-harness.ts`. It is imported only by `tests/knowledge-public-contract.test.ts`. No `lib/` or `app/` file imports it, and the build does not depend on it. The server evaluator and `KnowledgeAuthority` type are local/non-exported inside `server-knowledge-query-service.ts`.

## 6. Deep-Import Attack Regression

The focused regression verifies the production facade has no injected factory, the server module has no exported authority seam, production source does not reference the test harness, and the former core/test-only runtime files do not exist. Direct imports of both former runtime paths fail with `ERR_MODULE_NOT_FOUND`.

Original deep-import attack reproduced before fix: YES. Same attack possible after fix: NO. Fake authority accepted: NO. Trusted `PUBLIC` from fake state: NO. Regression present: YES. Regression strength: **STRONG**.

Raw trust value injection: CLOSED. Public factory injection: CLOSED. Deep-import core injection: CLOSED.

## 7. Server-Owned Composition

Composition module: `lib/services/server-knowledge-query-service.ts`. Composition symbol: internal `serverAuthority()` and `productionService`. Canonical Concept bindings: CP-A `concepts`, `concept_versions`, `concept_labels`. Canonical state bindings: existing `contents` publication read plus server-derived lifecycle; unsupported publication/access/mapping/provenance/freshness facts remain unknown. Search candidates: canonical labels/keys, then canonical server resolver and state eligibility. Provider selection owner: `db/index.ts` → configured runtime provider factory.

Caller replaceable: NO. D1 selectable by caller: NO. Production injected factory call sites: `0`. Test injection call sites: `10` evaluator constructions in the test file, all through the test harness.

## 8. Provider Authority

Primary runtime DB: `SUPABASE_POSTGRESQL`. Canonical Knowledge DB: `SUPABASE_POSTGRESQL`. D1 canonical authority: NO. Miniflare canonical authority: NO. The consumer-facing API accepts no provider, repository, authority, mock, D1, or legacy-provider argument.

## 9. Fail-Closed Authority Gaps

Certification authority, complete publication joins, mapping joins, provenance joins, and freshness joins remain unsupported where no existing canonical fact can be safely joined. Each returns unknown/denied and cannot produce a false public allow. These are nonblocking capability gaps for this boundary repair. No fabricated positive state was added.

## 10. Security / Data Trust

Trust Boundary Bypass Paths: `0`. Structural Trust Injection Risk: `LOW`, confined to the test harness and non-authoritative test path. Security Critical/High: `0/0`. Data Trust Critical/High: `0/0`. Provider spoofing risk: `0` at production boundary. Search-as-truth risk: `0`. Restricted false-allow risk: `0`. Caller repository/provider/mapping/publication/provenance/freshness/canonical-search authority: all `0`.

Question public retrieval: `0`. Private learner data paths: `0`. DB writes: `0`. Canonical Knowledge writes: `0`. Schema change: NO. Migration change: NO. Auth/proxy/session: NO. Governance/PIA/audit/receipt/evidence: NO. MCP: NO. Agent runtime: NO. UI: NO. Production connection: NO.

## 11. Validation

| Check | Result |
|---|---|
| Focused Knowledge | 10/10 |
| Full unit | 448/448 |
| Provider parity/runtime-link | 7/7 |
| Typecheck | PASS |
| Lint | PASS |
| DB check | PASS |
| Build | PASS / 63 routes |
| Integration | 59/59 |
| Integration environmental classification | Prior Docker failure superseded by successful rerun |
| Migration guard | 10/10 |
| Migration environmental classification | Prior Docker failure superseded by successful rerun |
| `git diff --check` | PASS |

New Skip/Only/Todo: `0/0/0`. Assertion weakening: `0`. Unsafe type escape: `0`. Security test disabled: `0`.

## 12. P1-A/B/C/D

P1-A: PASS — runtime canonical resolution, search canonicalization, and provider selection are server-owned.  
P1-B: PASS — public identity is separate from eligibility; caller cannot replace authority.  
P1-C: PASS — mapping, provenance, freshness, and search trust are server-owned or fail closed.  
P1-D: PASS — Critical/High security and data-trust findings are 0/0; bypass count is 0.

## 13. Exact Diff

Modified runtime: `lib/services/knowledge-query-service.ts`, `lib/services/server-knowledge-query-service.ts`. Deleted runtime files: `lib/services/knowledge-query-service-core.ts`, `lib/services/knowledge-query-service-test-only.ts`. Added test-only file: `tests/support/knowledge-query-test-harness.ts`. Modified focused test: `tests/knowledge-public-contract.test.ts`. Added report: this file. Prior reports preserved. No schema/migration/firewall-scope files changed. Nothing staged.

## 14. Remaining Findings

No remaining trust-boundary finding. Future repository work may bind currently unsupported certification/publication/mapping/provenance/freshness facts, retaining fail-closed behavior until authoritative joins exist.

## 15. Readiness / Next Gate

Ready for final human review: YES. Ready for commit authorization: NO. Ready for Agent V1 scope review: YES/PARTIAL. Ready for Agent V1 implementation authorization: NO. Commit/push/PR/merge/deployment: NO.

Next gate: `REVIEW_SECURIUM_KNOWLEDGE_PHASE_1_PRODUCTION_AUTHORITY_BOUNDARY_FINAL`

--------------------------------------------------
FINAL STATUS
--------------------------------------------------

`SECURIUM_KNOWLEDGE_PHASE_1_PRODUCTION_AUTHORITY_BOUNDARY_REPAIR_PASS_READY_FOR_FINAL_HUMAN_REVIEW`

--------------------------------------------------
ORIGINAL DEEP-IMPORT DEFECT
--------------------------------------------------

Runtime-importable `createKnowledgeQueryService(fakeAuthority)` could fabricate trusted state and return `PUBLIC`.

--------------------------------------------------
REPAIR
--------------------------------------------------

Removed the runtime core/factory path; kept injection only in `tests/support`; made production evaluator and authority composition non-exported inside the server module.

--------------------------------------------------
FAKE AUTHORITY ATTACK
--------------------------------------------------

Before: reproduced. After: blocked; old paths return `ERR_MODULE_NOT_FOUND`.

--------------------------------------------------
VALIDATION
--------------------------------------------------

Focused 10/10, unit 448/448, parity 7/7, integration 59/59, migration guard 10/10, typecheck/lint/DB/build/diff-check PASS.

--------------------------------------------------
COMMIT / PR
--------------------------------------------------

No commit or PR authorization; one final human review remains required.
