# Securium Occupational Role Foundation Wave A - P1 Repair Final Rereview

Snapshot date: 2026-09-08

## Decision

- Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_FINAL_REREVIEW_PASS_WITH_P1_REPAIRS`
- Review Decision: `PASS_WITH_P1_REPAIRS`
- Completion Classification: `NOT_COMPLETE`
- Primary next gate: `REPAIR_SECURIUM_OCCUPATIONAL_ROLE_ALIAS_DB_NORMALIZATION_AND_COLLISION`
- Skill Foundation Readiness: `READY_AFTER_ADDITIONAL_ROLE_REPAIR`
- Typed Graph Readiness: `ROLE_IDENTITY_CONFLICT_SAFE_RELATION_LAYER_DEFERRED`

This was an independent review. Implementation, schema, migration, production database, deployment, commit, push, and PR were not changed. Only this review report and its machine report were created.

## Baseline

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `67686548da982cd9f3c11806ac21b95cf4be526a`
- Ahead / behind: `0 / 1`
- Main drift: `NON_CONFLICTING_DRIFT`
- Repair Markdown SHA-256 verified: `875D5BE78605894009C4760577A60903510FD2A26CE1FC51530D18658C10BB7D`
- Repair machine SHA-256 verified: `062F85F1AB4B71909E17C442CE89FD8F9A6FB2DC973C189423CC17B01C511F64`
- Previous final rereview Markdown SHA-256 verified: `69469215ACB55562323EE231B2F3E5CB5F669312E4E718613EBEDDC9261E0383`
- Previous final rereview machine SHA-256 verified: `12B57EA4DC70C8CDFC6E28771E93F413FEED74973CA96AB45CFA72C823D4785E`

The pre-existing worktree is dirty with the earlier Concept authority, Role Wave A, and P1 repair artifacts. No implementation file was mutated during this rereview.

## Independent authority result

`occupational_roles` is the only canonical Occupational Role store. `occupational_role_aliases` is subordinate alias metadata. No RBAC, CP-A, content metadata, UI constant, Skill, or graph projection was found to override it. Canonical Role Authority Count is `1`.

The resolver now collects exact ID, role_key, and alias matches, de-duplicates by Role ID, and fails closed when distinct Roles remain. No `if idMatch return idMatch` priority path exists. Repository reads use `occupational_roles` and `occupational_role_aliases`; the only Role writer is the server-only repository plus direct database migrations/tests.

## P1 closure matrix

### P1-01 - Behavioral tests

- Before: the claimed behavioral Role test file was absent.
- Independent verification: `tests/occupational-role-authority.test.ts`, `tests/occupational-role-identity-database.test.mjs`, `tests/occupational-role-postgres-disposable.test.mjs`, and `tests/occupational-role-schema.test.mjs` exist and are included in `test:occupational-role`.
- Substance: tests exercise exact ID/key/alias resolution, label-only and unknown rejection, same-Role deduplication, ID/key and ID/alias/key/alias conflicts, ambiguous aliases, RBAC/Concept/CP-A/Skill/Course/Certification boundaries, ACTIVE safety, direct DB key/alias constraints, and key immutability.
- Result: `18/18 PASS`, skipped `0`, todo `0`.
- Status: `CLOSED`.

### P1-02 - Resolver conflict handling

- Before: ID priority could hide a different role_key or alias.
- Independent verification: resolver gathers all authoritative exact namespaces before deciding; repository query uses an OR over direct ID/key matches and separately includes aliases.
- Result: ID-only, key-only, alias-only resolve; same Role ID+key resolves; distinct ID+key, ID+alias, key+alias, and multiple aliases return `AMBIGUOUS`; unknown and label-only inputs return `UNRESOLVED`; insertion order does not change the result.
- Status: `CLOSED`.

### P1-03 - Database identity contract

- Before: database constraints did not fully enforce the application identity contract or key immutability.
- Implemented: PostgreSQL `0031_occupational_role_identity_hardening.sql` and D1 `0042_occupational_role_identity_hardening.sql` enforce the bounded role_key grammar, persisted lowercase/trimmed alias shape, `normalized_alias = alias`, and role_key update triggers.
- Independent finding: DB checks do not implement the application's NFKC normalization. A direct D1 writer accepted `application\u00a0security engineer` and a fullwidth variant when both `alias` and `normalized_alias` were supplied identically. Application normalization produces a different canonical lookup form. Distinct Roles can also hold the same normalized alias because uniqueness remains `(role_id, normalized_alias)`; the resolver correctly returns `AMBIGUOUS`, but the DB does not make that state impossible.
- Status: `NOT_CLOSED`.

## Required review fields

1. Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_FINAL_REREVIEW_PASS_WITH_P1_REPAIRS`.
2. Review Decision: `PASS_WITH_P1_REPAIRS`.
3. Snapshot Date: `2026-09-08`.
4. Worktree: the specified Securium skill graph foundation worktree.
5. Branch: `architecture/role-skill-concept-graph-foundation`.
6. HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`.
7. Fresh origin/main: `67686548da982cd9f3c11806ac21b95cf4be526a`.
8. Ahead/Behind: `0 / 1`.
9. Main Drift: `NON_CONFLICTING_DRIFT`.
10. Repair Report Hash Verification: both supplied repair hashes match exactly.
11. Scope Integrity: `PASS`; no implementation scope expansion observed.
12. Canonical Runtime DB: `Supabase PostgreSQL`.
13. D1 Role: `local / compatibility / rollback`.
14. Canonical Role Authority: `occupational_roles`, with subordinate `occupational_role_aliases`.
15. Authority Count: `1`.
16. Behavioral Test Files: four Role-focused files listed above.
17. Behavioral Test Substance: executable resolver, repository-boundary, disposable D1, disposable PostgreSQL, lifecycle, and separation assertions.
18. Behavioral Test Result: `18/18 PASS`.
19. P1-01 Status: `CLOSED`.
20. Resolver Algorithm: collect exact ID/key/alias matches, normalize candidates by canonical ID, resolve zero/one/multiple as unresolved/resolved/ambiguous.
21. ID-only Resolution: `RESOLVED`.
22. Key-only Resolution: `RESOLVED`.
23. Alias-only Resolution: `RESOLVED`.
24. ID/Key Same-Role: `RESOLVED` after deduplication.
25. ID/Key Different-Role Conflict: `AMBIGUOUS`.
26. ID/Alias Conflict: `AMBIGUOUS`.
27. Key/Alias Conflict: `AMBIGUOUS`.
28. Multi-Alias Conflict: `AMBIGUOUS`.
29. Resolver Determinism: `PASS`; candidate ordering is canonical-ID sorted and query order independent.
30. Label-as-Identity: `NO`; label-only input is unresolved.
31. P1-02 Status: `CLOSED`.
32. role_key Grammar: `role:<namespace>:<identity>`, lowercase ASCII segments `[a-z0-9._-]+`, exactly two structural separators, trimmed, length 8..255.
33. PostgreSQL role_key Enforcement: `PASS` for the bounded grammar through the 0031 CHECK.
34. D1 role_key Enforcement: `PASS` for the equivalent bounded grammar through 0042 CHECKs.
35. App/PostgreSQL Grammar Parity: `PASS` for the tested ASCII bounded corpus.
36. PostgreSQL/D1 Grammar Parity: `LOGICALLY_ALIGNED` for the tested bounded role_key grammar.
37. Alias Normalization Contract: application uses NFKC, trim, lowercase, and whitespace collapse.
38. PostgreSQL Alias Enforcement: `PARTIAL`; lower/trim/control-whitespace/normalized_alias equality are enforced, but NFKC is not recomputed by PostgreSQL.
39. D1 Alias Enforcement: `PARTIAL`; lower/trim/control-whitespace/normalized_alias equality are enforced, but NFKC is not recomputed by SQLite/D1.
40. Alias Collision Handling: distinct-role duplicate normalized aliases are DB-valid and resolver-fail-closed as `AMBIGUOUS`; this remains part of P1-03 repair scope because the DB does not make the state unambiguous.
41. role_key Immutability: `PASS`; database triggers prevent normal updates.
42. Direct DB Key Mutation Test: `PASS` on D1 and disposable PostgreSQL.
43. Runtime Writer Key Mutation Test: `PASS`; no normal repository mutation path exists and DB trigger is defense in depth.
44. Unsafe role_key Writers: `0` in active runtime paths; migration DDL is excluded as governed deployment authority.
45. P1-03 Status: `NOT_CLOSED`.
46. PostgreSQL 0031 Review: forward-only, bounded, no security-definer bypass, trigger and checks are scoped to Role identity.
47. D1 0042 Review: forward-only table rebuild/check/trigger migration, clean application through 43 migrations.
48. Historical Migration Mutation: `0`.
49. Migration Namespace Safety: `MIGRATION_NAMESPACE_SAFE`; branch has PostgreSQL through 0031 and D1 through 0042, while fresh origin/main ends at PG 0029/D1 0040.
50. Existing Data Compatibility: valid pre-hardening Role rows satisfy the new grammar; no production data was modified or backfilled.
51. PostgreSQL Validation: `PASS`; `POSTGRES_MIGRATIONS_VALID files=31 tables=92 checksum=f44ed3ac0be92c81`.
52. Clean D1 Migration: `PASS`; latest clean integration applied 43 migrations and Role constraints behaved as expected.
53. PostgreSQL/D1 Overall Parity: `KNOWN_BOUNDED_COMPATIBILITY_DIFFERENCE`; role_key semantics align, but neither SQL engine independently performs application NFKC alias normalization.
54. Canonical Concept Boundary: `PASS`; `ontology_concepts / ontology_aliases` remain canonical and untouched.
55. RBAC Separation: `PASS`; `roles` and `user_roles` are not imported by the Role authority.
56. CP-A Boundary: `PASS`; CP-A remains staging/compatibility only.
57. Skill Mutation: `0`; Skill remains unimplemented.
58. Role Relation Mutation: `0`; no `ROLE_REQUIRES_SKILL` or Role relation authority.
59. Graph Projection Mutation: `0`; no SKOS, Semantica, Neo4j, GraphRAG, Search, or MCP authority.
60. Unsafe ACTIVE Writers: `0`; ACTIVE still requires review fields and no activation route was added.
61. Role Read Path Audit: canonical tables only, with exact normalized alias lookup; no label/metadata fallback.
62. Role Write Path Audit: server repository validates inputs; direct DB is constrained, but alias NFKC enforcement remains incomplete.
63. Graph Regression: `62/62 PASS`.
64. Unit: `448/448 PASS`.
65. Integration: `59/59 PASS`.
66. Typecheck: `PASS`.
67. Lint: `PASS`.
68. Build: `PASS`.
69. db:check: `PASS`.
70. Migration Guard: `10/10 PASS`.
71. Namespace Guard: `2/2 PASS`.
72. git diff --check: `PASS`.
73. New Skips/Only/TODO: `0/0/0` in repair paths.
74. Stale 0033 Assertion: `PRE_EXISTING_NON_CAUSAL`; `tests/cpa-fresh-main-contract.test.mjs` remains `4/5` only because it expects no 0033 migration while the repository contains migrations through 0042.
75. Security Critical/High: `0/0` for the repaired runtime authority; no client Role writer or RBAC path was added.
76. Data Trust Critical/High: `0/1`; P1-03 remains for DB-side NFKC/alias-collision hardening. Resolver wrong-Role selection is not present.
77. Privacy Critical/High: `0/0`.
78. P0: `NONE`.
79. P1 Before: `P1-01`, `P1-02`, `P1-03`.
80. P1 Closed: `P1-01`, `P1-02`.
81. P1 Remaining: `P1-03` database alias normalization and collision hardening.
82. P2: `NONE INTRODUCED`; activation governance, relation vocabulary, and projections remain deferred.
83. Occupational Role Foundation Completion: `NOT_COMPLETE`; canonical authority is sound but DB alias hardening remains.
84. Skill Foundation Readiness: `READY_AFTER_ADDITIONAL_ROLE_REPAIR`.
85. Typed Graph Readiness: `ROLE_IDENTITY_CONFLICT_SAFE_RELATION_LAYER_DEFERRED`.
86. Remaining Role Work: close DB-side canonical alias normalization and decide/enforce cross-role alias uniqueness or an explicit governed ambiguity policy.
87. Recommended Next Gate: `REPAIR_SECURIUM_OCCUPATIONAL_ROLE_ALIAS_DB_NORMALIZATION_AND_COLLISION`.
88. Commit: `NO`.
89. Push: `NO`.
90. PR: `NO`.
91. Deployment: `NO`.

## Findings

### P1-RR-01 - DB accepts aliases outside application NFKC canonical form

- Affected paths: `db/schema.ts`, `db/postgres/migrations/0031_occupational_role_identity_hardening.sql`, `drizzle/0042_occupational_role_identity_hardening.sql`.
- Evidence: direct in-memory D1 insertion accepted `application\u00a0security engineer` and a fullwidth variant when `alias` and `normalized_alias` were identical. The application normalizer applies NFKC and whitespace normalization before lookup.
- Violated invariant: direct canonical DB writers must not persist non-normalized alias identity data.
- Impact: malformed alias rows can persist and are not equivalent to the application lookup form; they fail closed as unresolved rather than selecting a wrong Role, but canonical data integrity is incomplete.
- Required correction: add a bounded DB-enforceable alias character/normalization contract or a canonical generated representation with equivalent PostgreSQL/D1 semantics; add direct tests for NBSP/fullwidth and the chosen policy.
- Blocks Skill Foundation: `YES`, until P1-03 is closed.
- Verification: direct PostgreSQL and D1 corpus must reject or deterministically canonicalize the same values.

### P1-RR-02 - Cross-role normalized alias collision remains DB-valid

- Affected paths: both Role alias schemas and their unique indexes.
- Evidence: D1 accepted the same `normalized_alias` for two different Role IDs; resolver returned `AMBIGUOUS` with both IDs.
- Violated invariant: the final review contract requires duplicate normalized alias state to be rejected or otherwise made unambiguous by canonical constraints.
- Impact: no wrong Role is selected, but canonical alias data can contain a persistent ambiguity.
- Required correction: choose and enforce global normalized-alias uniqueness, or define an explicit governed collision namespace that makes lookup unambiguous; preserve fail-closed behavior during transition.
- Blocks Skill Foundation: `YES` under the strict database-boundary invariant.
- Verification: direct PostgreSQL/D1 inserts for two Role IDs using one normalized alias must either reject or resolve through an explicit namespace.

## Final architecture status

The single Role authority, stable role_key identity, resolver conflict handling, RBAC/Concept/CP-A separation, PostgreSQL/D1 role_key grammar, key immutability, and all required regression gates are sound. The final approval is withheld only because database alias normalization and cross-role alias collision policy are not fully enforced at the database boundary.

No Skill, Role relation, Certification, Evidence, learner state, advanced graph layer, production DB, deployment, commit, push, or PR was introduced by this rereview.

The SHA-256 of this report and the machine report is computed after final file materialization and recorded in the final handoff.
