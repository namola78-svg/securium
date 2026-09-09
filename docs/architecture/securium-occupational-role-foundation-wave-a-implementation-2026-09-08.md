# Securium Occupational Role Foundation Wave A — Implementation Report

Snapshot date: 2026-09-08 (Asia/Seoul)

## Decision

**Final Status:** `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_IMPLEMENTATION_PASS_READY_FOR_REVIEW`

**Implementation Decision:** `CREATE_BOUNDED_CANONICAL_OCCUPATIONAL_ROLE_AUTHORITY`

**Readiness:** `PASS_READY_FOR_REVIEW`

**Recommended Next Gate:** `REREVIEW_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A`

Wave A establishes one dedicated canonical Occupational Role aggregate without creating Skill, Certification, learner state, Role relations, or advanced graph/search authority. The existing approved Concept authority remains unchanged: `ontology_concepts / ontology_aliases`. Role authoring can resolve Concepts only through the approved canonical Concept resolver.

## Baseline and scope integrity

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `67686548da982cd9f3c11806ac21b95cf4be526a`
- Ahead/behind: `0/1`
- Main drift: `NON_CONFLICTING_DRIFT`
- Approved final rereview Markdown SHA verified: `05AC2B9CC935D569764818CEB97557C86E3F1EFF7068374411B7E99B27479A2E`
- Approved final rereview machine SHA verified: `73AE9A7BF4CB38A87B3C74A3780F169B4845BBFE3E4B16B0106BABA439108DCC`
- Scope integrity: `PASS`; no production DB, deployment, active publication, learner-state backfill, commit, push, or PR.
- Existing graph-authority repair files were preserved; current-wave changes are limited to Role foundation, migrations, tests, the causal namespace-count update, and these reports.

## Role authority

`occupational_roles` is the single canonical Occupational Role store. `occupational_role_aliases` is subordinate alias metadata within the same Role authority, not a second Role store.

Role identity:

- Stable internal ID: `occupational_roles.id`, generated server-side when absent.
- Stable semantic key: `occupational_roles.role_key`, unique and validated as `role:<namespace>:<identity>`.
- Display label: `occupational_roles.label`; mutable display data and never primary identity.
- Lifecycle: `DRAFT | ACTIVE | RETIRED`.
- Active review guard: an ACTIVE row requires `reviewed_by`, `reviewed_at`, and non-empty review evidence JSON at the database boundary.
- Provenance: `source_type`, `source_id`, `provenance_json`, review identity, and review evidence.
- No Role taxonomy seed was added.

The write repository is server-side and currently creates DRAFT only. No client route can create or activate canonical Role rows. This keeps publication governed and avoids implying a complete occupational taxonomy in Wave A.

## Resolver and aliases

`lib/services/occupational-role-authority.ts` provides the pure deterministic contract; `db/occupational-role-repositories.ts` provides the server-side database boundary.

- Exact canonical ID → resolve.
- Exact `role_key` → resolve.
- Explicit registered exact alias → resolve.
- Ambiguous alias → `AMBIGUOUS`.
- Unknown ID/key/alias → `UNRESOLVED`.
- Display label supplied as a label is not canonical identity and is not implicitly treated as an alias.
- RETIRED roles resolve as `DEPRECATED` rather than active.
- Fuzzy matching is absent.

Similar roles remain distinct. No label-based merge is performed.

## Domain boundaries

- `roles` remains RBAC authorization-only.
- `occupational_roles` has no permission, membership, or authorization behavior.
- Occupational Role is distinct from Concept, Skill, Course, and Certification.
- Skill status: `SKILL_FOUNDATION_NOT_IMPLEMENTED`.
- Certification entity: not implemented.
- Role→Skill, Role→Concept, and Role hierarchy relations: not implemented in Wave A.
- No Role relation table or duplicate relation authority was introduced.
- No `user_role_state`, mastery, affinity, confidence, competency, or Learner Twin data was introduced.

## Relation and Concept compatibility

The approved relation authorities remain unchanged. Wave A does not add a Role relation family. The explicit contract is:

- Role→Skill: `NOT_IMPLEMENTED_SKILL_REQUIRED`.
- Role→Concept: `NOT_IMPLEMENTED_NO_DIRECT_EDGE_IN_WAVE_A`.
- Role hierarchy: `NOT_IMPLEMENTED`.
- Future role relations require a bounded `ontology_edges` vocabulary review before any writer is added.

Role authoring exposes `resolveOccupationalRoleConcept`, which delegates to `resolveCanonicalConceptFromDatabase`. No role-owned concept copy, label identity, CP-A override, or metadata pseudo-concept exists.

The future learner flow remains architecturally compatible:

```text
Must-Know Concept
  → Role
  → Skill
  → Tool / Technology
  → Learning Content / Questions / Labs
  → Certification
  → Evidence / Competency
```

Only the Role node and its identity boundary are established here.

## Schema decision and parity

**Role Schema Decision:** `BOUNDED_ROLE_SCHEMA_EXTENSION_REQUIRED`

Reusing RBAC `roles` or `ontology_concepts` would violate the approved domain boundaries, so the smallest safe extension is two tables:

- D1: `drizzle/0041_occupational_role_foundation.sql`.
- PostgreSQL: `db/postgres/migrations/0030_occupational_role_foundation.sql`.
- Drizzle metadata: `drizzle/meta/0041_snapshot.json` and journal entry `0041_occupational_role_foundation`.
- PostgreSQL migration includes table privileges revocation, RLS, and FORCE RLS for both Role tables.
- D1 local migration applied successfully through all 42 migrations.
- PostgreSQL migration validation: 30 files / 92 created tables; no remote execution.
- Historical migrations modified: 0.
- Production DB mutation: NO.

The PostgreSQL and D1 tables carry equivalent identity, lifecycle, alias uniqueness, provenance, and active-review semantics. D1 remains a local/compatibility/rollback path, not an authority.

## Security, trust, and privacy

- Security Critical/High: `0/0`.
- Data Trust Critical/High: `0/0`.
- Privacy Critical/High: `0/0`.
- RBAC confusion: prevented by separate table, separate repository imports, and explicit contract test.
- Arbitrary client canonical Role mutation: no client endpoint introduced.
- Unbounded relation types: no Role relation writer introduced.
- Alias injection/first-match: exact aliases only; ambiguity fails closed.
- Concept authority injection: Role Concept helper delegates to the approved server resolver.
- Advanced authorities: SKOS, Semantica, Neo4j, GraphRAG, Search, MCP, and Learner Twin remain absent/non-authoritative.

## Findings

### P0

None.

### P1

1. `ROLE-WA-P1-001` — Role→Skill and Role relation vocabulary are intentionally deferred. Location: `lib/services/occupational-role-authority.ts`. Invariant: Skill must not be auto-created and relation families must be bounded. Impact: Role→Skill and Role traversal queries remain unsupported. Correction: next governed Skill/typed-relation gates. Verification: add relation-family tests and canonical Skill resolver before introducing writers.

2. `ROLE-WA-P1-002` — No admin Role review/publication route exists yet. Location: `db/occupational-role-repositories.ts`. Invariant: active Role publication must be governed. Impact: Wave A can author DRAFT records and read ACTIVE records, but activation remains a future gate. Correction: add a Role-specific review route reusing server auth, evidence, audit, and lifecycle policy. Verification: route security and active-review integration tests.

3. `ROLE-WA-P1-003` — Role relations are not yet projected into the generic ontology graph. Location: `OCCUPATIONAL_ROLE_RELATION_CONTRACT`. Invariant: no premature direct Role→Concept flattening. Impact: reverse Role/Concept queries are not yet supported. Correction: authorize a bounded ontology-edge vocabulary extension after Skill foundation. Verification: directed-edge and duplicate-authority tests.

### P2

SKOS enrichment, Semantica, Search, Neo4j projection, GraphRAG, MCP, recommendations, Learner Twin, and competency projection remain future work.

## Validation

- Role/authority/schema/concept/ontology focused tests: **63/63 PASS**.
- Full unit suite: **448/448 PASS**.
- Typecheck: **PASS**.
- Lint: **PASS**.
- Build: **PASS**; 63 routes.
- `db:check`: **PASS**.
- PostgreSQL migration validation: **PASS**; 30 files, 92 tables.
- PostgreSQL migration guard: **10/10 PASS**.
- Migration namespace guard: **2/2 PASS**.
- Local D1 migration: **PASS**; 42 migrations applied.
- `git diff --check`: **PASS**.
- New skip/only/TODO scan in Wave A files: **0/0/0**.
- Standalone stale CP-A assertion remains a pre-existing non-causal issue: `PRE_EXISTING_STALE_TEST_ASSERTION_NON_CAUSAL`; it expects no `0033_*` while both `HEAD` and `origin/main` contain that migration. It was not modified.

## Required implementation fields

1. Final Status: `SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A_IMPLEMENTATION_PASS_READY_FOR_REVIEW`
2. Implementation Decision: `CREATE_BOUNDED_CANONICAL_OCCUPATIONAL_ROLE_AUTHORITY`
3. Snapshot Date: `2026-09-08`
4. Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
5. Branch: `architecture/role-skill-concept-graph-foundation`
6. HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
7. Fresh origin/main: `67686548da982cd9f3c11806ac21b95cf4be526a`
8. Main Drift: `NON_CONFLICTING_DRIFT`
9. Scope Integrity: `PASS`
10. Canonical Runtime DB: `Supabase PostgreSQL`
11. D1 Role: `Local / compatibility / rollback`
12. Role Schema Decision: `BOUNDED_ROLE_SCHEMA_EXTENSION_REQUIRED`
13. Canonical Role Authority: `occupational_roles + occupational_role_aliases aggregate`
14. Role ID Strategy: `occupational_roles.id; server-generated stable internal ID`
15. Semantic Role Key: `occupational_roles.role_key; role:<namespace>:<identity>`
16. Role Lifecycle: `DRAFT | ACTIVE | RETIRED`
17. Role Resolver: `Server-bound exact ID/key/alias resolver`
18. Alias Strategy: `Explicit exact aliases in occupational_role_aliases`
19. Ambiguous Alias Handling: `AMBIGUOUS / fail closed`
20. RBAC Separation: `roles authorization-only; occupational_roles separate`
21. Course/Role Separation: `OCCUPATIONAL_ROLE != COURSE`
22. Certification/Role Separation: `OCCUPATIONAL_ROLE != CERTIFICATION`
23. Concept/Role Separation: `Role has no embedded Concept authority`
24. Skill Boundary: `SKILL_FOUNDATION_NOT_IMPLEMENTED`
25. Concept Resolution: `Delegates to ontology_concepts / ontology_aliases resolver`
26. CP-A Boundary: `No CP-A Role authority or override`
27. Relation Authority: `No new Role relation family; existing authorities preserved`
28. Relation Vocabulary: `Role relations deferred pending bounded vocabulary review`
29. Directionality: `No Role edges stored in Wave A`
30. Duplicate Relation Handling: `No Role relation writer; no duplicate authority`
31. Role Duplicate Handling: `Unique role_key; duplicate resolver candidates are AMBIGUOUS`
32. Similar Role Preservation: `Similar labels remain distinct`
33. Provenance: `source_type/source_id/provenance_json/review fields`
34. Currentness: `Targeted future concern; no global requirement`
35. Write Path Audit: `Draft Role creation and explicit alias insertion; server-only`
36. Unsafe Canonical Role Writers: `0`
37. Read Path Canonicalization: `Canonical repository and deterministic resolver`
38. Personal Graph Separation: `PASS; no user-specific Role state`
39. Advanced Authority Status: `NONE; all future-only/non-canonical`
40. PostgreSQL/D1 Parity: `PASS; equivalent bounded semantics`
41. Schema Change: `YES; two dedicated Role tables`
42. Migration Change: `YES; D1 0041 and PostgreSQL 0030`
43. Historical Migration Mutation: `0`
44. Seed/Foundation Data: `No production taxonomy seed; synthetic test fixtures only`
45. Canonical Role Tests: `PASS`
46. Alias Tests: `PASS`
47. RBAC Boundary Tests: `PASS`
48. Concept Compatibility Tests: `PASS`
49. Relation Tests: `PASS for deferred/no-writer contract`
50. Graph Regression: `PASS; canonical graph focused suite`
51. Unit: `448/448 PASS`
52. Integration: `Local D1 migration PASS; PostgreSQL disposable guard PASS`
53. Typecheck: `PASS`
54. Lint: `PASS`
55. Build: `PASS`
56. db:check: `PASS`
57. Migration Validation: `PASS`
58. Migration Guard: `10/10 PASS`
59. Namespace Guard: `2/2 PASS`
60. git diff --check: `PASS`
61. New Skips/Only/Todo: `0/0/0`
62. Security Critical/High: `0/0`
63. Data Trust Critical/High: `0/0`
64. Privacy Critical/High: `0/0`
65. P0: `NONE`
66. P1: `Role→Skill, Role relation vocabulary, governed Role activation route`
67. P2: `SKOS, Semantica, Search, Neo4j, GraphRAG, MCP, Learner Twin`
68. Remaining Work: `Skill foundation, bounded Role relations, governed activation, then later graph projections`
69. Skill Foundation Readiness: `NOT IMPLEMENTED; next separately governed foundation`
70. Recommended Next Gate: `REREVIEW_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A`
71. Commit/Push/PR Status: `NONE / NONE / NONE`

## Next-gate boundary

Wave A is ready for independent rereview. It does not declare the Skill Graph complete. The next implementation may add governed Role activation or proceed to the separately authorized Skill Foundation, but must retain:

```text
RBAC Role != Occupational Role
Occupational Role != Course != Certification
Role → Skill → canonical Concept
Supabase PostgreSQL = canonical authority
D1 = compatibility / rollback
```
