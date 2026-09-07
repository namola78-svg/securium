# SW Preflight Repair Clean Publication Worktree

Snapshot: 2026-09-07

## Outcome

Final Status: `SECURIUM_SW_PREFLIGHT_REPAIR_CLEAN_PUBLICATION_WORKTREE_PASS_READY_FOR_BOUNDED_PR`

Decision: `APPROVE_CLEAN_MAIN_BASED_SW_PREFLIGHT_REPAIR_PUBLICATION_CANDIDATE`

Readiness: `SW_PREFLIGHT_REPAIR_ISOLATED_ON_FRESH_MAIN_BASED_BRANCH_PR_CREATION_MAY_PROCEED`

Primary Next Gate: `CREATE_SECURIUM_SW_SERVER_RUNTIME_PREFLIGHT_REPAIR_BOUNDED_PR`

## Worktree and source protection

- Source worktree: `securium-content-sw-security-weakness`
- Source branch: `content/sw-security-weakness-authoring`
- Source HEAD: `7a61095e6b5234db8406cb2b3569aab721ae5490`
- Source mutation: none
- New worktree: `C:/Users/user/Documents/Codex/2026-07-24/1-2-3-4-5-6/securium-sw-preflight-repair-publication`
- New branch: `fix/sw-canonical-db-preflight-publication`
- New worktree base: `a17d4702061250d8b4d3fce8bbbd500dcc2442b2`
- Initial new-worktree status: clean
- Final expected changed files: five reviewed runtime/test files plus these two reports
- Unrelated source files were not copied.

## Evidence

- Publication review Markdown SHA: `5d875064e40f0f61f7a4e760063a64ae75ffafe5331c3e421ab0632d6c883600`
- Publication review machine SHA: `f82eaaceafa02be9a71b757f2c8555c72af082aebd61c1d973da07fae740d559`
- Final rereview Markdown SHA: `f02a4989f3ca1f046a82352b08ef47247cdda0a8703d89e45edc582388344e78`
- Final rereview machine SHA: `5cdcd12fa3be3513cda43f7e11e4e8b1e886bb454c479636562b13812e1fd8de`

## Publication manifest

Runtime files:

1. `app/api/admin/ontology/canonicalization-preflight/route.ts` — reviewed GET admin route.
2. `lib/services/securium-sw-security-weakness-canonical-db-preflight.ts` — read-only canonical identity and package-state preflight.
3. `lib/services/securium-sw-security-weakness-concept-canonicalization.ts` — server-owned 3-Concept/4-Edge package builder and shared semantic helpers.
4. `lib/data/securium-sw-security-weakness-concept-relation-refinement.mjs` — exact package relation data dependency.

Test file:

5. `tests/securium-sw-security-weakness-canonical-db-preflight.test.mjs` — focused fail-closed preflight regression suite.

The reviewed files are semantically text-identical to the source after line-ending normalization. `lib/http.ts` was not copied or overwritten; the current-main implementation, including its observability change, remains intact. Collision classification is `TEXTUAL_COLLISION_ONLY`; semantic collision is `NO`.

The PostgreSQL mutation adapter and unrelated migration/content artifacts are excluded.

## Safety invariants

- Route: `GET /api/admin/ontology/canonicalization-preflight`
- Duplicate route: 0
- Authentication: `requireOntologyAdministrator`
- Same-origin: PASS
- Rate limit: 10 requests / 60 seconds
- Cache: `no-store`
- Canonical identity: provider, migration/baseline, schema, ontology tables, RLS, FORCE RLS contract, and privileges must all pass.
- `Ready => CanonicalVerified`: PASS
- Wrong database with matching tables or exact package: DENY
- Migration failure/unknown/error: DENY
- RLS drift: DENY
- Valid historical and fresh-baseline fixtures: PASS
- Read-only reachable writes: INSERT/UPDATE/DELETE/DDL/migration/audit/evidence/mastery/skill-graph = 0
- DRAFT registration executor: unreachable
- Secret and raw database-error exposure: NONE
- Package: 3 Concepts, 4 Edges, DRAFT
- SW-W-01: `ontology:securium:code-injection`
- SW-W-06: `ontology:securium:os-command-injection`
- Learning coverage: 24/24
- DRAFT runtime visibility: Concepts 0, Edges 0

## Validation

- Focused preflight tests: 19/19 PASS.
- Disposable PostgreSQL 17.6 integration coverage: migration guard 10/10 PASS, including its disposable PostgreSQL execution case. The separate 12-case mutation-adapter suite is intentionally outside this read-only publication scope.
- Typecheck: PASS via installed TypeScript entry point.
- Lint: PASS via installed ESLint entry point.
- Build: PASS on the clean worktree; route appears in the compiled app route list.
- Migration guard: 10/10 PASS.
- `git diff --check`: PASS.
- New skips/only/TODO bypasses: 0.
- Security Critical/High: 0/0.
- Data Trust Critical/High: 0/0.
- Schema/migration/historical migration/content mutation: 0.
- Production DB, deployment, invocation, commit, push, PR, and main merge: NO.

## Next action

The candidate is isolated on a fresh main-based branch and is ready for a bounded PR creation gate. No commit was created in this task.
