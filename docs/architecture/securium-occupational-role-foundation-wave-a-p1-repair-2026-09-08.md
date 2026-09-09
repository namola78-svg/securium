# Securium Occupational Role Foundation Wave A - P1 Repair

Snapshot date: 2026-09-08

## Decision

- Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_P1_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
- Repair Decision: `PASS_READY_FOR_FINAL_REREVIEW`
- Primary next gate: `FINAL_REREVIEW_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_AFTER_P1_REPAIR`
- Scope: P1-01 behavioral tests, P1-02 fail-closed resolver conflicts, and P1-03 database identity hardening only.
- Production DB: `NO`
- Deployment: `NO`
- Commit / push / PR: `NO / NO / NO`

This repair does not create Skill, Role relations, Certification, graph projections, activation governance, learner state, or a new Concept authority.

## Evidence baseline

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `67686548da982cd9f3c11806ac21b95cf4be526a`
- Ahead / behind: `0 / 1`
- Main drift: `NON_CONFLICTING_DRIFT`
- Previous final rereview Markdown SHA-256: `69469215ACB55562323EE231B2F3E5CB5F669312E4E718613EBEDDC9261E0383`
- Previous final rereview machine SHA-256: `12B57EA4DC70C8CDFC6E28771E93F413FEED74973CA96AB45CFA72C823D4785E`
- Previous implementation Markdown SHA-256: `CD3A8345C522EB77998DA78851FEC6BE732D165CA194E372FD5C5AB97315BF74`
- Previous implementation machine SHA-256: `0E6851DDC71DCF3D17E3B7F931E0BCDD44A52A80915136664EACE7167B2AEEF9`

The worktree contains prior user-owned canonical graph and Wave A changes. This repair did not reset or rewrite them.

## Scope integrity

The repair-specific mutations are limited to:

- `lib/services/occupational-role-authority.ts`
- `db/occupational-role-repositories.ts`
- `db/schema.ts`
- `db/postgres/migrations/0031_occupational_role_identity_hardening.sql`
- `drizzle/0042_occupational_role_identity_hardening.sql`
- `drizzle/meta/0042_snapshot.json`
- `drizzle/meta/_journal.json`
- `tests/occupational-role-authority.test.ts`
- `tests/occupational-role-identity-database.test.mjs`
- `tests/occupational-role-postgres-disposable.test.mjs`
- `tests/occupational-role-schema.test.mjs`
- `tests/migration-namespace-guard.test.mjs`
- `package.json`
- this repair report and its machine report

No Concept, CP-A, RBAC, Skill, Certification, Evidence, learner-state, relation-vocabulary, graph-projection, or advanced semantic authority was added or changed by this repair.

## P1 closure matrix

### P1-01 - behavioral Role test file absent

- Root cause: the previous Wave A evidence named behavioral coverage, but the claimed dedicated behavioral file was absent; only schema-oriented coverage existed.
- Repair: added `tests/occupational-role-authority.test.ts` with executable resolver and boundary behavior, plus disposable D1 and PostgreSQL behavioral tests.
- Behavioral test files: `tests/occupational-role-authority.test.ts`, `tests/occupational-role-identity-database.test.mjs`, `tests/occupational-role-postgres-disposable.test.mjs`, `tests/occupational-role-schema.test.mjs`.
- Test evidence: `18/18 PASS` in `npm run test:occupational-role`; no skip or only directives.
- Status: `CLOSED`.

### P1-02 - ID versus role_key conflict used ID priority

- Root cause: resolution queried/selected identity namespaces in priority order, allowing one canonical ID to mask a different role_key or alias candidate.
- Repair: the resolver now collects exact ID, exact role_key, and exact normalized alias matches; it de-duplicates by canonical Role ID, returns `UNRESOLVED` for missing authoritative matches, returns one result only for one Role, and returns `AMBIGUOUS` for distinct Roles.
- Status: `CLOSED`.

Conflict matrix:

| Input | Result |
|---|---|
| ID only | `RESOLVED` |
| role_key only | `RESOLVED` |
| alias only | `RESOLVED` |
| ID and role_key for same Role | `RESOLVED` |
| ID and role_key for different Roles | `AMBIGUOUS` |
| ID and alias for different Roles | `AMBIGUOUS` |
| role_key and alias for different Roles | `AMBIGUOUS` |
| multiple alias candidates | `AMBIGUOUS` |
| unknown identity or label only | `UNRESOLVED` |

### P1-03 - database identity contract was incomplete

- Root cause: application validation existed, but direct PostgreSQL/D1 writers could bypass the full bounded key shape, persisted alias form, or canonical key immutability.
- Repair: added one forward PostgreSQL migration and one forward D1 migration. They enforce role key grammar, bounded alias storage form, normalized alias equality, uniqueness already defined by the Role schema, and a database trigger preventing normal `role_key` updates.
- Schema decision: `BOUNDED_FORWARD_MIGRATION_REQUIRED`.
- Status: `CLOSED`.

## Required report fields

1. Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_P1_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
2. Repair Decision: `PASS_READY_FOR_FINAL_REREVIEW`
3. Snapshot Date: `2026-09-08`
4. Git Baseline: branch `architecture/role-skill-concept-graph-foundation`, HEAD `9756970ce19a64d6ac0e913631193b606dc78e7c`, origin/main `67686548da982cd9f3c11806ac21b95cf4be526a`
5. Scope Integrity: `PASS`; only the three authorized P1 areas and their tests/reports were changed in this repair.
6. P1-01 Before: claimed behavioral Role test file absent.
7. P1-01 Repair: added substantive resolver, boundary, D1, and disposable PostgreSQL tests.
8. Behavioral Test Files: `tests/occupational-role-authority.test.ts`; `tests/occupational-role-identity-database.test.mjs`; `tests/occupational-role-postgres-disposable.test.mjs`; `tests/occupational-role-schema.test.mjs`.
9. Behavioral Test Results: `18/18 PASS`.
10. P1-01 Status: `CLOSED`.
11. P1-02 Before: ID priority could hide a conflicting role_key or alias.
12. Resolver Root Cause: namespace-specific priority selection.
13. Resolver Algorithm Before: ID first, then role_key, then alias.
14. Resolver Algorithm After: collect all exact authoritative matches, de-duplicate by Role ID, zero means unresolved, one means resolve, more than one means ambiguous.
15. ID-only Test: `PASS - RESOLVED`.
16. role_key-only Test: `PASS - RESOLVED`.
17. Alias-only Test: `PASS - RESOLVED`.
18. ID/key Same-Role Test: `PASS - RESOLVED`.
19. ID/key Different-Role Conflict: `PASS - AMBIGUOUS`.
20. ID/Alias Conflict: `PASS - AMBIGUOUS`.
21. Key/Alias Conflict: `PASS - AMBIGUOUS`.
22. Multi-Alias Conflict: `PASS - AMBIGUOUS`.
23. Resolver Determinism: `PASS`; candidates are de-duplicated and sorted by canonical ID; no first-row behavior.
24. P1-02 Status: `CLOSED`.
25. P1-03 Before: DB did not fully enforce key grammar, persisted alias normalization, or semantic-key immutability.
26. role_key Grammar: `role:<namespace>:<identity>`, lowercase ASCII segments `[a-z0-9._-]+`, exactly two structural colons, trimmed, length 8..255.
27. Application/DB Grammar Parity: `LOGICALLY_ALIGNED_BOUNDED`; application and both DB migrations accept/reject the same role_key grammar.
28. Alias Normalization Contract: server normalizes with NFKC, trim, lowercase, and whitespace collapse before persistence; persisted alias and normalized_alias are identical.
29. Alias DB Enforcement: PostgreSQL and D1 enforce nonempty, bounded, trimmed, lowercase, no repeated/control whitespace, and `normalized_alias = alias`.
30. role_key Immutability Contract: the canonical semantic key is immutable after creation; labels and descriptions remain mutable metadata.
31. role_key DB Enforcement: PostgreSQL trigger and D1 trigger reject normal updates that change `role_key`.
32. Key Mutation Tests: `PASS` on D1 and disposable PostgreSQL; label/description update remains allowed.
33. Schema Decision: `BOUNDED_FORWARD_MIGRATION_REQUIRED`.
34. New Migration: PostgreSQL `0031_occupational_role_identity_hardening.sql`; D1 `0042_occupational_role_identity_hardening.sql`.
35. Historical Migration Mutation: `0`.
36. Migration Namespace Safety: `NO_COLLISION_OBSERVED`; PostgreSQL files = 31 and D1 files/journal entries = 43 with namespace guard passing.
37. PostgreSQL Constraint Tests: `PASS`; disposable PostgreSQL directly rejected malformed keys, bad aliases, duplicate alias, key mutation, and unsafe ACTIVE insert.
38. D1 Constraint Tests: `PASS`; in-memory D1-compatible SQLite directly rejected malformed keys, bad aliases, duplicate alias, key mutation, and unsafe ACTIVE insert.
39. D1 Constraint Test Runner: `PASS`; clean local D1 migration through 0042 and schema suite `3/3 PASS`.
40. PostgreSQL/D1 Parity: `LOGICALLY_ALIGNED` for the bounded Role identity contract; D1 remains compatibility/local/rollback only.
41. P1-03 Status: `CLOSED`.
42. Canonical Role Authority Count: `1 - occupational_roles`.
43. RBAC Separation: `PASS`; occupational_roles is not an authorization table and no auth path imports it.
44. Concept Authority Preservation: `PASS`; `ontology_concepts / ontology_aliases` remain the canonical Concept authority.
45. CP-A Boundary: `PASS`; CP-A remains draft staging/compatibility and cannot create or override canonical Role identity.
46. Skill Foundation Status: `SKILL_FOUNDATION_NOT_IMPLEMENTED`; no Skill table, resolver, Role-to-Skill relation, or user_skill_state was added.
47. Unsafe ACTIVE Writers: `0`; the existing ACTIVE review check remains enforced, and activation governance remains out of scope.
48. Role Relation Status: `NONE_IN_WAVE_A`; no `ROLE_REQUIRES_SKILL` or other canonical Role relation was introduced.
49. Graph Projection Status: `NONE`; no SKOS, Semantica, Neo4j, GraphRAG, Search, or MCP authority was introduced.
50. Focused Role Tests: `18/18 PASS`.
51. Graph Regression: `62/62 PASS` for canonical Concept, ontology, and Role authority suites.
52. Unit: `448/448 PASS`.
53. Integration: `59/59 PASS` for the D1 integration suite.
54. Typecheck: `PASS`.
55. Lint: `PASS`.
56. Build: `PASS`.
57. db:check: `PASS`.
58. PostgreSQL Validation: `PASS`; `POSTGRES_MIGRATIONS_VALID files=31 tables=92 checksum=f44ed3ac0be92c81`.
59. Migration Guard: `10/10 PASS`.
60. Namespace Guard: `2/2 PASS`.
61. Clean D1 Migration: `PASS`; all 43 migrations applied.
62. git diff --check: `PASS`.
63. New Skips/Only/TODO: `0/0/0` in the repair-specific code and test paths.
64. Stale 0033 Assertion Causality: `PRE_EXISTING_NON_CAUSAL`; standalone CP-A fresh-main contract remains `4/5` because it expects no 0033 migration while the repository already contains migrations through 0042; the assertion predates this repair and is unrelated to Role identity.
65. Security Critical/High: `0/0`.
66. Data Trust Critical/High: `0/0` in the repaired Role authority path.
67. Privacy Critical/High: `0/0`.
68. P0: `NONE`.
69. P1 Before: `P1-01`, `P1-02`, `P1-03`.
70. P1 Closed: `3/3`; all authorized findings closed.
71. P1 Remaining: `NONE` for this repair; activation governance and typed relations remain separately deferred architecture work.
72. P2: `NONE INTRODUCED`; advanced graph/search/semantic layers remain future non-authorities.
73. Skill Foundation Readiness: `READY_FOR_SKILL_FOUNDATION` after final rereview.
74. Typed Graph Readiness: `ROLE_IDENTITY_READY_RELATION_LAYER_DEFERRED`; Role-to-Skill vocabulary is intentionally not implemented.
75. Recommended Final Rereview Gate: `FINAL_REREVIEW_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_AFTER_P1_REPAIR`.

## Identity and boundary findings

Canonical Role identity remains `occupational_roles.id` plus immutable semantic `role_key`. Role IDs in the current repository are text identifiers and are not structurally guaranteed to be UUIDs; therefore cross-namespace conflict detection is mandatory and is now explicit. Labels are display metadata and are never lookup authority.

The server-side repository validates Role keys and aliases before writes. The database independently rejects malformed persisted keys and noncanonical persisted alias forms. Role resolution never uses display labels, fuzzy matching, metadata fallback, CP-A data, or a first-row result.

`occupational_roles` remains distinct from RBAC roles, Concepts, Skills, Courses, Certifications, and learner state. No personal graph data was introduced. PostgreSQL remains the canonical runtime authority; D1 is a logically aligned local/compatibility/rollback path.

## Remaining boundaries

- No activation governance route was added. Existing review checks keep unsafe ACTIVE writes at zero.
- No Role relation vocabulary was added. `ROLE_REQUIRES_SKILL` remains a later gate.
- No graph projection was added. Canonical database reads are sufficient for the next identity-dependent gate.
- No Skill or Certification entity was added.

## Release restrictions

- Production DB mutation: `NO`
- Deployment: `NO`
- Active publication: `NO`
- Learner-state backfill: `NO`
- Commit: `NO`
- Push: `NO`
- PR: `NO`

The SHA-256 for this report and the machine report is computed after final file materialization and recorded in the final handoff.
