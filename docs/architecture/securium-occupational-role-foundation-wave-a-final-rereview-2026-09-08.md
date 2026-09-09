# Securium Occupational Role Foundation Wave A - Final Rereview

Snapshot date: 2026-09-08 (Asia/Seoul)

## Decision

- Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_FINAL_REREVIEW_PASS_WITH_P1_REPAIRS`
- Review Decision: `PASS_WITH_P1_REPAIRS`
- Readiness: `ROLE_FOUNDATION_SAFE_BOUNDARY_WITH_REQUIRED_P1_REPAIRS`
- Primary Next Gate: `REPAIR_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_P1_FINDINGS`
- Critical blockers: `NONE`

Independent review confirms one canonical Occupational Role authority and preserves the approved Concept and relation authorities. The implementation is safe in its currently unreachable foundation boundary, but it is not ready for Skill Foundation approval until the three P1 findings below are repaired and rereviewed.

## Required final fields

1. Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_FINAL_REREVIEW_PASS_WITH_P1_REPAIRS`
2. Review Decision: `PASS_WITH_P1_REPAIRS`
3. Snapshot Date: `2026-09-08`
4. Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
5. Branch: `architecture/role-skill-concept-graph-foundation`
6. HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
7. Fresh origin/main: `67686548da982cd9f3c11806ac21b95cf4be526a`
8. Ahead/Behind: `0/1` (behind by one commit)
9. Main Drift: `NON_CONFLICTING_DRIFT`
10. Implementation Report Hash Verification: PASS; Markdown `CD3A8345C522EB77998DA78851FEC6BE732D165CA194E372FD5C5AB97315BF74`, machine `0E6851DDC71DCF3D17E3B7F931E0BCDD44A52A80915136664EACE7167B2AEEF9`; prior authority rereview Markdown `05AC2B9CC935D569764818CEB97557C86E3F1EFF7068374411B7E99B27479A2E`, machine `73AE9A7BF4CB38A87B3C74A3780F169B4845BBFE3E4B16B0106BABA439108DCC`.
11. Scope Integrity: `PASS_WITH_EXPECTED_PRIOR_AUTHORITY_FILES`; no Wave A mutation of Concept, Evidence, Course, Certification, Skill, or advanced projection authority.
12. Canonical Runtime DB: `Supabase PostgreSQL`
13. D1 Role: `LOCAL / COMPATIBILITY / ROLLBACK`
14. Canonical Role Authority: `occupational_roles`; subordinate alias table `occupational_role_aliases`
15. Canonical Authority Count: `1`
16. Role ID Strategy: stable internal `occupational_roles.id`; no label-derived identity.
17. role_key Strategy: unique semantic identity in `occupational_roles.role_key`.
18. role_key Validation: repository writer accepts `role:<namespace>:<identity>` using lowercase ASCII segments and `._-`; trims outer whitespace; rejects empty, uppercase, internal whitespace, Unicode, extra separators, and slash input. Database currently enforces non-empty only.
19. Label-as-Identity: `NO`; label-only lookup is unresolved and renames do not define identity.
20. Alias Authority: `occupational_role_aliases` only.
21. Alias Resolution: exact registered normalized alias only; no fuzzy or partial matching.
22. Ambiguous Alias Handling: `AMBIGUOUS` / fail closed; global collisions are allowed to preserve ambiguity, per-role duplicate normalized aliases are unique.
23. Unknown Alias Handling: `UNRESOLVED`; no Role auto-creation.
24. Resolver Determinism: PASS for individual ID, key, alias, unknown, label-only, and ambiguous inputs; P1 gap for conflicting composite ID plus key.
25. Resolver Server Boundary: repository/pure resolver boundary exists; no application route currently exposes it; callers cannot make client data authoritative through an app path.
26. Unsafe Canonical Role Writers: `0` observed.
27. Role Lifecycle: bounded `DRAFT`, `ACTIVE`, `RETIRED`; DRAFT resolves `UNKNOWN`, ACTIVE `RESOLVED`, RETIRED `DEPRECATED`.
28. Unsafe ACTIVE Writers: `0` observed.
29. Activation Governance Status: safe but absent; current ACTIVE mutation path count `0`, future activation route required before publication.
30. RBAC Separation: PASS; `roles` and `user_roles` remain authorization-only and are not imported by the Occupational Role authority.
31. Concept Separation: PASS; Occupational Role is not an `ontology_concepts` row and has no embedded Concept authority.
32. Concept Authority Preservation: PASS; `ontology_concepts / ontology_aliases` remains the single Concept authority; Concept delegation tests pass.
33. CP-A Boundary: PASS; CP-A remains DRAFT staging/compatibility only and cannot override Role or Concept truth.
34. Skill Foundation Status: `SKILL_FOUNDATION_NOT_IMPLEMENTED`; no Skill table, resolver, relation, or auto-creation path.
35. Certification Boundary: Certification entity not implemented; Role is not Certification.
36. Course Boundary: Role is not Course; no Course metadata is a Role identity authority.
37. Role Relation Status: no authoritative Role -> Skill, Role -> Concept, Role hierarchy, or arbitrary Role relation family was introduced.
38. Relation Vocabulary Decision: `BOUNDED_ROLE_SKILL_RELATION_EXTENSION_REQUIRED`; minimum future family is directed `ROLE_REQUIRES_SKILL`, after Skill identity is approved.
39. Relation Directionality Readiness: `ROLE_RELATION_HARDENING_REQUIRED`; no independent inverse copies should be added.
40. Role Graph Projection Decision: `CANONICAL_GRAPH_READS_SUFFICIENT_FOR_NEXT_WAVE`; no projection is required before Skill identity.
41. Personal Graph Separation: PASS; no user Role state, mastery, confidence, or learner graph was introduced.
42. Evidence/Role Future Compatibility: `PASS`; shared Role definitions can later be referenced by derived competency views without changing Evidence authority.
43. Learner Twin Boundary: `PASS`; future Twin may read shared Role definitions plus personal Concept/Skill state; Role rows contain no learner state.
44. Advanced Authority Status: none created; all advanced systems remain future read-only projections.
45. SKOS Authority: `NONE`
46. Semantica Authority: `NONE`
47. Neo4j Authority: `NONE`
48. GraphRAG Authority: `NONE`
49. Search Authority: `NONE`
50. MCP Authority: `NONE`
51. Provenance: source type/source ID/provenance JSON and review fields exist; deep provenance validation remains future governance work.
52. Currentness: targeted future concern only; no global currentness requirement introduced.
53. Role Read Path Audit: exact DB lookup, pure resolver, ACTIVE-only list, and canonical Concept delegation; no metadata or UI override.
54. Role Write Path Audit: `createOccupationalRoleDraft` and `addOccupationalRoleAlias`; both are repository definitions, server-side in intent, DRAFT/alias bounded, and currently unreferenced by app routes.
55. PostgreSQL Migration Review: PASS; forward-only `0030_occupational_role_foundation.sql`, FK/index/check/RLS/privilege pattern reviewed, no destructive rewrite.
56. D1 Migration Review: PASS for clean local migration/readback; forward-only `0041_occupational_role_foundation.sql` and journal entry reviewed.
57. PostgreSQL/D1 Parity: `LOGICALLY_ALIGNED` for bounded schema semantics; PostgreSQL adds server privilege/RLS hardening, not different Role semantics.
58. Migration Namespace Collision Review: no Role/Concept/Skill collision observed in `origin/main` or inspected relevant visible refs; branch-specific numbering still requires merge coordination.
59. Historical Migration Mutation: `0`
60. Stale 0033 Assertion Causality: `PRE_EXISTING_NON_CAUSAL`; current standalone CP-A result is 4/5 because its no-0033 assertion conflicts with migration history already in HEAD and origin/main.
61. Duplicate Role Tests: partial evidence; database uniqueness and static schema tests pass, but claimed behavioral file is absent.
62. Similar Role Preservation: PASS by architecture; no label-based merge or taxonomy collapse exists, and no seed volume was introduced.
63. Alias Collision Tests: direct resolver probes pass for ambiguous and unknown aliases; dedicated behavioral regression file is missing.
64. RBAC Boundary Tests: static/code boundary PASS; dedicated behavioral regression evidence is missing.
65. Concept Regression: `20/20 PASS` for canonical Concept/CP-A authority and provider parity suite.
66. Graph Canonical Authority Regression: `32/32 PASS` for ontology/domain and namespace guard suite.
67. Focused Role Tests: `3/3 PASS` static schema tests; claimed `63/63` behavioral suite is not reproducible because the file is absent.
68. Unit: `INCONCLUSIVE`; `npm run test:unit` emitted output but did not terminate with a summary in this environment.
69. Integration: `INCONCLUSIVE aggregate`; clean disposable D1 migration/readback passed, but the aggregate wrapper did not terminate with a final summary on rerun.
70. Typecheck: `PASS`
71. Lint: `PASS`
72. Build: `PASS`; 63 routes.
73. db:check: `PASS`
74. PostgreSQL Migration Validation: `PASS`; 30 files, 92 created tables.
75. Migration Guard: `10/10 PASS`
76. Namespace Guard: `2/2 PASS`
77. Clean D1 Migration: `PASS` for disposable migration/readback; aggregate wrapper completion remains inconclusive.
78. git diff --check: `PASS`
79. New Skips/Only/Todo: `0/0/0` in Wave A files.
80. Security Critical/High: `0/0` in active repaired paths.
81. Data Trust Critical/High: `0/0` in active repaired paths; P1 hardening gaps remain.
82. Privacy Critical/High: `0/0`
83. P0 Findings: `NONE`
84. P1 Findings: `ROLE-RR-P1-001` missing behavioral Role test evidence; `ROLE-RR-P1-002` conflicting composite ID/key resolves by ID instead of failing closed; `ROLE-RR-P1-003` database does not enforce full key/alias normalization/immutability contract; `ROLE-WA-P1-002` activation governance route intentionally deferred and currently safe.
85. P2 Findings: `ROLE-RR-P2-001` prior implementation report has encoding-corrupted relation strings; advanced projections remain future-only.
86. Role Foundation Completion: `BOUNDARY_ESTABLISHED; P1_REPAIRS_REQUIRED_BEFORE_UNCONDITIONAL_APPROVAL`
87. Skill Foundation Readiness: `READY_AFTER_ROLE_P1_REPAIR`
88. Typed Graph Readiness: `ROLE_RELATION_HARDENING_REQUIRED`
89. Parallel Worktree Conflict Risk: `NONE_OBSERVED` for inspected Role/Concept/Skill authority and migration refs; coordination remains required before merge.
90. Remaining Work: repair P1 resolver/test/database identity-contract gaps; then govern activation; then establish Skill identity; then add bounded Role <-> Skill relation vocabulary; later add projections.
91. Recommended Next Gate: `REPAIR_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_P1_FINDINGS`
92. Commit Status: `NO`
93. Push Status: `NO`
94. PR Status: `NO`

## Dependency decisions for the next gate

| Area | Classification | Evidence and dependency |
| --- | --- | --- |
| Role activation governance route | `MAY_PROCEED_IN_PARALLEL` | No ACTIVE writer exists; DRAFT-only state is safe. A governed server-side activation route is required before publication, not before canonical Skill identity. |
| Role relation vocabulary | `DEFERRED_AFTER_SKILL` | Role <-> Skill closure needs a bounded directed `ROLE_REQUIRES_SKILL` family, but canonical Skill identity can be established first. |
| Role graph projection | `NOT_REQUIRED` | Canonical PostgreSQL reads are sufficient for the next foundation wave; search/SKOS/Semantica/Neo4j/GraphRAG/MCP remain later read-only projections. |

Current activation path count: `0`.

Unsafe ACTIVE writer count: `0`.

Minimum future relation extension: `ROLE_REQUIRES_SKILL`, with explicit direction, canonical writer, provenance, lifecycle, and no arbitrary relation-type input.

## Findings requiring a repair gate

### ROLE-RR-P1-001 - Behavioral Role test evidence is absent

- Severity: P1
- Location: missing `tests/occupational-role-authority.test.ts`; current Role-specific file is `tests/occupational-role-schema.test.mjs`.
- Evidence: only three static schema tests are present; the implementation report's claimed behavioral file and 63/63 result cannot be reproduced.
- Violated invariant: canonical identity, alias, lifecycle, RBAC, Concept, CP-A, and no-Skill boundaries require executable regression proof.
- Impact: behavior may regress without a focused test gate.
- Required correction: add a real behavioral suite for exact ID/key/alias, invalid key, duplicate key, ambiguity, unknown, label-only unresolved, lifecycle, conflicting ID/key, RBAC separation, Concept delegation, CP-A, and no Skill auto-creation.
- Verification: run the file and record its exact result.
- Blocks Skill Foundation: `YES` until repaired.

### ROLE-RR-P1-002 - Conflicting composite references do not fail closed

- Severity: P1
- Location: `lib/services/occupational-role-authority.ts:149-151`.
- Evidence: the resolver checks `reference.id` before `reference.roleKey`; valid Role A ID plus Role B key resolves Role A.
- Violated invariant: contradictory identity assertions must not silently select one field.
- Impact: future callers can submit semantically inconsistent identity data.
- Required correction: resolve all supplied identity fields and require one matching canonical Role; otherwise return an unresolved conflict result.
- Verification: add a conflicting ID/key fixture and assert fail-closed behavior.
- Blocks Skill Foundation: `YES`.

### ROLE-RR-P1-003 - Full identity contract is not enforced at the database boundary

- Severity: P1
- Location: `db/schema.ts:66-77`; `db/postgres/migrations/0030_occupational_role_foundation.sql:18-20`.
- Evidence: database checks require only non-empty key/label; regex, normalized alias consistency, and key immutability are writer-level or implicit.
- Violated invariant: every canonical Role writer must preserve stable identity semantics.
- Impact: a future generic server SQL writer could bypass the bounded contract.
- Required correction: add a guarded authority writer or equivalent database enforcement for key format, alias normalization, and explicit key immutability before authoring exposure.
- Verification: direct D1/PostgreSQL constraint fixtures plus repository writer tests.
- Blocks Skill Foundation: `YES`.

### ROLE-WA-P1-002 - Activation governance route deferred

- Severity: P1 (deferred, currently safe)
- Location: no application ACTIVE mutation route; lifecycle checks in `db/schema.ts` and role authority service.
- Evidence: current writer forces DRAFT and no app route imports Role writers.
- Violated invariant for future publication: ACTIVE must be governed server-side.
- Impact: Role publication is unavailable, but there is no unsafe activation path.
- Required correction: a later governed activation route with review/provenance checks.
- Verification: route/auth tests and ACTIVE transition tests.
- Blocks Skill Foundation: `NO` for identity foundation; required before Role publication.

## Boundary conclusions

- `occupational_roles` is the only canonical Occupational Role authority.
- `occupational_role_aliases` is subordinate alias metadata, not a second Role authority.
- `ontology_concepts / ontology_aliases` remains the only canonical Concept authority.
- RBAC `roles` and `user_roles` remain authorization-only.
- Course, Certification, Skill, Evidence, learner state, and advanced graph/search systems were not promoted to Role authority.
- No Role relation family was introduced; no free-form Role edge writer exists.
- Future Role -> Skill -> Concept closure must use bounded typed relations and canonical Concept IDs.

## Architecture invariant

Occupational Role is a shared canonical security-career domain entity, not an authorization role, Concept, Skill, Course, Certification, or learner state. Its identity comes only from the bounded Role authority in Supabase PostgreSQL. Future Role -> Skill -> Concept relationships must build on that authority without introducing duplicate graph sources of truth.

## Review artifacts

- Implementation report: `docs/architecture/securium-occupational-role-foundation-wave-a-implementation-2026-09-08.md`
- Implementation machine report: `reports/architecture/securium-occupational-role-foundation-wave-a-implementation-2026-09-08.json`
- This rereview report: `docs/architecture/securium-occupational-role-foundation-wave-a-final-rereview-2026-09-08.md`
- This machine report: `reports/architecture/securium-occupational-role-foundation-wave-a-final-rereview-2026-09-08.json`
- Final report SHA-256 values are recorded in the final handoff because embedding a file's own digest would change that digest.
