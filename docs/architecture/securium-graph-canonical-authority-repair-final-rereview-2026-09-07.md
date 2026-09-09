# Securium Graph Canonical Authority Repair — Final Independent Rereview

Snapshot date: 2026-09-08 (Asia/Seoul)

## Final decision

**Final Status:** `SECURIUM_GRAPH_CANONICAL_AUTHORITY_REPAIR_FINAL_REREVIEW_PASS`

**Review Decision:** `APPROVE_SINGLE_CANONICAL_CONCEPT_AND_RELATION_AUTHORITY`

**Readiness:** `GRAPH_CANONICAL_AUTHORITY_APPROVED_OCCUPATIONAL_ROLE_FOUNDATION_MAY_PROCEED`

**Primary Next Gate:** `AUTHORIZE_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A`

The independent rereview confirms one active canonical Concept authority: `ontology_concepts`, with `ontology_aliases` as its alias relation. `ontology_concepts.id` remains the stable canonical identifier and `ontology_concepts.concept_key` remains the semantic identity. CP-A is constrained to DRAFT staging/compatibility and exact stable-key bridging; it cannot establish or override canonical Concept truth.

The relation model is canonical by relation family: `ontology_edges` for generic ontology edges, `question_concepts` for Question→Concept mappings, `content_revision_concepts` for Lesson/Content→Concept mappings, `fact_concept_bindings` for fact mappings, and `evidence_projections` for personal evidence projections. `coreConcepts` metadata and hardcoded content constants are not canonical relation authority. No changed active path provides unsafe duplicate writes.

## Independent evidence

| Item | Result |
|---|---|
| Audit Markdown SHA-256 | `CFC8DD5AB9E0D13AC2308E057BF9695402576E3442D8B50B3C579B876361395C` verified |
| Audit machine SHA-256 | `9F5A905D71B98D80EAEFF35B83EFA5423102879803A6F2BB785A76CE5B38C0CE` verified |
| Repair Markdown SHA-256 | `9B9C5F169DEC56F04F4A420D6838BA3229C6A064E68E67DF66620E3875708D48` verified |
| Repair machine SHA-256 | `F1440FE9D56C64CED707427F21F159DFF463019CC953AE3E214F0F864162CC35` verified |
| HEAD | `9756970ce19a64d6ac0e913631193b606dc78e7c` |
| Fresh `origin/main` | `67686548da982cd9f3c11806ac21b95cf4be526a` |
| Ahead/behind | `0/1` |
| Fresh-main drift | `NON_CONFLICTING_DRIFT`; the one main commit adds ISE governance/runtime/provider transaction capability and does not alter Concept/relation authority files or migrations |
| Review implementation mutation | `0`; only the two requested report artifacts were created during this review |

## Authority trace

The trace was performed against implementation, schema declarations, migrations, repositories, services, admin routes, tests, and compatibility paths.

### Concept writers and readers

- `db/ontology-repositories.ts:74` `upsertOntologyConcept` writes the legacy `ontology_concepts` table and `ontology_aliases`; it preserves stable `concept_key` identity and is the active canonical ontology writer.
- `db/ontology-repositories.ts:335` review status mutation is role/evidence/audit governed and operates on `ontology_concepts` or `ontology_edges`.
- `lib/data/security-content-upgrade-v3.mjs:568` emits the existing PostgreSQL/D1 canonical ontology seed/upsert representation.
- `db/concept-persistence-repositories.ts:36`–`53` writes CP-A `concepts`, `concept_versions`, and `concept_labels`, but `stagingStatus` rejects every non-DRAFT lifecycle with `CP_CANONICAL_AUTHORITY_BOUNDARY`.
- `db/canonical-concept-repositories.ts:20` reads legacy canonical rows first and CP-A rows second, then resolves only through the bounded resolver.
- `lib/services/server-knowledge-query-service.ts:187`–`203` routes server Concept resolution/search/state through the canonical repository; callers cannot submit authority or trust fields.
- Question, content revision, fact, and evidence tables reference `ontology_concepts.id` through foreign keys. Their specialized mapping repositories therefore retain canonical IDs without a second Concept identity store.

### Resolver behavior

`lib/services/canonical-concept-authority.ts:118`–`196` was independently traced and its tests were rerun:

- canonical ID or exact `concept_key` → canonical Concept;
- CP-A ID/key/alias → canonical Concept only through an exact CP-A `stableKey` → canonical `concept_key` bridge;
- exact canonical alias → canonical candidate;
- unknown ID/key/alias → unresolved/fail closed;
- multiple exact alias or bridge candidates → `AMBIGUOUS`;
- labels are lookup data, never identity and never a merge instruction;
- fuzzy scores/search candidates never become canonical output;
- canonical lifecycle is preserved as resolved/deprecated/unknown rather than silently rewritten.

The server boundary is enforced by the public knowledge-query contract and dynamic server-side repository composition. A caller cannot declare a canonical ID, semantic identity, authority source, or alias result as trusted truth.

### CP-A attack cases

- A conflicting CP-A record with the same stable-looking key cannot override the legacy canonical label, ID, lifecycle, or semantic record; the legacy row wins on canonical lookup.
- An unmapped CP-A record has no exact stable-key bridge and resolves as `UNRESOLVED_LEGACY_REFERENCE`; no canonical row is auto-created.
- CP-A relations are not accepted as canonical (`RELATION_AUTHORITY_CONTRACT.cpaRelations = NONE`).

## Relation authority decision

The repair does not create a third relation store. The independent authority map is:

| Relation family | Canonical authority | Non-canonical inputs |
|---|---|---|
| Generic ontology relation | `ontology_edges` | none identified in the repaired path |
| Question→Concept | `question_concepts` | generic edges cannot override the specialized mapping |
| Lesson/Content→Concept | `content_revision_concepts` | `coreConcepts` JSON is authoring/read hint only |
| Fact→Concept | `fact_concept_bindings` | no CP-A relation authority |
| Evidence→Concept projection | `evidence_projections` | personal projection, not knowledge-graph authority |
| Existing practical/content ontology relations | `ontology_edges` within its generic family | content/question linkage metadata is not a competing Concept mapping |

Relations are stored as directed records. Legacy inverse materialization (`PARENT_OF`/`CHILD_OF` and paired cross-course compatibility edges) remains in the same `ontology_edges` authority and is not a second store. Exact edge keys and the bounded relation vocabulary prevent duplicate canonical rows within the generic family. The remaining polymorphic generic edge shape and legacy text relation fields are P1 hardening opportunities, but they are not active dual authorities in the repaired paths.

## Candidate duplicate review

No equivalence was fabricated:

- Command Injection / OS Command Injection / Shell Injection: `RELATED`/`NARROWER` candidates; not collapsed automatically.
- Authentication / MFA / JWT: `BROADER`/`NARROWER`/`RELATED`; distinct concepts preserved.
- Authorization / IDOR / BOLA: `BROADER`/`NARROWER`/`RELATED`; distinct concepts preserved.
- Cryptography / Encryption: `BROADER`/`NARROWER` candidate; not automatically merged.
- XSS variants: `RELATED`/`NARROWER` candidates; exact alias only when explicitly governed.

Exact aliases are candidates, not independent Concepts. Ambiguous aliases return `AMBIGUOUS`; unknown aliases remain unresolved.

## Boundary decisions

- Course remains a learning-delivery/content container. Certification remains a separate qualification-domain concept and is not implemented as a canonical entity in this gate. `Course != Certification`.
- Existing `roles` are authorization/RBAC roles only. Occupational Role is absent and must be a new domain entity. `AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE`.
- Skill remains absent by design. No premature canonical Skill authority was created.
- Supabase PostgreSQL remains the canonical runtime knowledge-domain authority. D1 remains local/compatibility/rollback only.
- SKOS, Semantica, Neo4j, GraphRAG, Search, and MCP graph output have no authority and must later be read-only projections/adapters.
- No personal graph was introduced. Evidence, mastery, Skill State, and Learner Twin remain separate downstream concerns referencing shared canonical Concepts.

## Compatibility and governance

Question/content/evidence IDs remain bound to `ontology_concepts.id`; legacy evidence IDs therefore remain deterministically resolvable. Unknown evidence IDs fail closed. Mapping version, provenance, lifecycle, review, and currentness fields are preserved in their existing specialized families. The invalidation contract remains projection-oriented: a changed canonical mapping changes/stales downstream mapping-version state; mastery and Skill recomputation are intentionally not implemented here.

The admin ontology page reads canonical ontology rows and the review-status route is protected by ontology administrator checks, same-origin validation, transition governance, evidence, and audit recording. No admin route was found that lets clients directly create an authoritative CP-A Concept or arbitrary authority result.

## Validation

- Focused authority/content/ontology suite: **60/60 passed**.
- Unit suite: **448/448 passed**.
- Typecheck: **PASS**.
- Lint: **PASS**.
- Build: **PASS**; 63 routes generated.
- `db:check`: **PASS**.
- PostgreSQL migration guard: **10/10 PASS**.
- Migration namespace guard: **2/2 PASS**.
- `git diff --check`: **PASS**.
- New skip/only/TODO in repaired authority files: **0/0/0**.
- Standalone `tests/cpa-fresh-main-contract.test.mjs`: 4/5 passed; one assertion fails because it expects no `0033_*` migration. `0033_cs1a_governance_receipts` is present in `HEAD`, fresh `origin/main`, and the current journal. Classification: `PRE_EXISTING_STALE_TEST_ASSERTION_NON_CAUSAL`. It is not a migration guard failure and was not changed during rereview.
- Production database: **NO**.
- Deployment: **NO**.
- Commit/push/PR: **NONE**.

## Required review fields

1. Final Status: `SECURIUM_GRAPH_CANONICAL_AUTHORITY_REPAIR_FINAL_REREVIEW_PASS`
2. Review Decision: `APPROVE_SINGLE_CANONICAL_CONCEPT_AND_RELATION_AUTHORITY`
3. Snapshot Date: `2026-09-08`
4. Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
5. Branch: `architecture/role-skill-concept-graph-foundation`
6. HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
7. Fresh origin/main: `67686548da982cd9f3c11806ac21b95cf4be526a`
8. Main Drift Classification: `NON_CONFLICTING_DRIFT`
9. Audit Markdown SHA: `CFC8DD5AB9E0D13AC2308E057BF9695402576E3442D8B50B3C579B876361395C`
10. Audit Machine SHA: `9F5A905D71B98D80EAEFF35B83EFA5423102879803A6F2BB785A76CE5B38C0CE`
11. Repair Markdown SHA: `9B9C5F169DEC56F04F4A420D6838BA3229C6A064E68E67DF66620E3875708D48`
12. Repair Machine SHA: `F1440FE9D56C64CED707427F21F159DFF463019CC953AE3E214F0F864162CC35`
13. Canonical Runtime DB: `Supabase PostgreSQL`
14. D1 Role: `Local / compatibility / rollback`
15. Concept Authorities Before: `legacy ontology_concepts plus CP-A concepts, content metadata, specialized mappings, and hardcoded authoring inputs`
16. Concept Authorities After: `one canonical legacy authority plus CP-A staging/compatibility`
17. Canonical Concept Authority: `ontology_concepts with ontology_aliases`
18. Canonical Concept ID Strategy: `ontology_concepts.id; stable and referenced by mapping/evidence FKs`
19. Semantic Identity Strategy: `ontology_concepts.concept_key; unique semantic identity`
20. Legacy Concept Role: `Active canonical Concept store`
21. CP-A Role: `DRAFT staging / compatibility / exact bridge and alias candidate source`
22. CP-A Canonical Override: `NO`
23. Third Authority: `NONE`
24. Legacy→Canonical Resolution: `Direct canonical ID/key; exact and lifecycle-preserving`
25. CP-A→Canonical Resolution: `Exact stableKey bridge only`
26. Unmapped CP-A Handling: `UNRESOLVED_LEGACY_REFERENCE / fail closed`
27. Alias Strategy: `Explicit exact aliases in ontology_aliases; candidate resolution only`
28. Label-as-Identity: `NO; labels are not primary identity`
29. Ambiguous Alias Handling: `AMBIGUOUS; no first-match or fuzzy selection`
30. Resolver Determinism: `PASS; exact identity/alias/bridge, otherwise unresolved`
31. Resolver Server Boundary: `PASS; server-owned DB resolution, caller trust fields excluded`
32. Duplicate Concept Candidates Reviewed: `Command Injection, Authentication, Authorization, Cryptography, XSS families`
33. Exact Equivalent Mappings: `Only explicitly exact stable-key/alias bridges; none fabricated`
34. Alias Mappings: `Explicit ontology_aliases and exact resolver candidates`
35. Broader/Narrower Mappings: `Preserved as distinct candidates; not auto-merged`
36. Related/Distinct Concepts Preserved: `PASS`
37. Command Injection Variant Review: `RELATED/NARROWER/UNKNOWN candidates; preserved`
38. Authentication/MFA/JWT Review: `BROADER/NARROWER/RELATED; preserved`
39. Authorization/IDOR/BOLA Review: `BROADER/NARROWER/RELATED; preserved`
40. Cryptography/Encryption Review: `BROADER/NARROWER candidate; preserved`
41. XSS Variant Review: `RELATED/NARROWER candidates; preserved`
42. Relation Authorities Before: `ontology_edges, specialized mappings, metadata, and CP-A staging paths`
43. Relation Authority After: `One canonical family per semantic relation`
44. ontology_edges Role: `Canonical generic ontology relation family`
45. question_concepts Role: `Canonical Question→Concept mapping family`
46. content_revision_concepts Role: `Canonical Lesson/Content→Concept mapping family`
47. Practical/Lab Mapping Role: `Existing practical/content ontology relations use ontology_edges; no CP-A duplicate`
48. coreConcepts Metadata Role: `Authoring/read hint only`
49. Hardcoded Constants Role: `Seed/bootstrap/test/UI input only; non-canonical`
50. Duplicate Relation Authority: `NONE in repaired active paths`
51. Relation Directionality: `Stored directed edges`
52. Inverse Strategy: `Existing inverse compatibility rows remain in the same ontology_edges authority`
53. Relation Vocabulary: `Bounded existing ontology relation enum and specialized MAPS_TO families`
54. Free-Form Relation Risk: `P1 residual polymorphic generic edge/text-field hardening; not an active dual authority`
55. Unsafe Canonical Relation Writers: `0 in changed active authority paths`
56. Question→Concept Test: `PASS`
57. Content→Concept Test: `PASS`
58. Practical/Lab→Concept Test: `PASS for existing ontology family; no separate lab authority introduced`
59. Evidence→Concept Compatibility: `PASS`
60. Evidence Legacy-ID Test: `PASS; deterministic ontology_concepts.id resolution`
61. Evidence Unknown-ID Test: `PASS; unresolved/fail closed`
62. Mapping Version Contract: `Preserved; specialized mapping_version/lifecycle/provenance fields remain authoritative`
63. Invalidation Contract: `Changed mapping/version stales downstream projections; recompute not implemented`
64. Course/Certification Boundary: `Course delivery container; Certification qualification domain`
65. Course=Certification: `NO`
66. Certification Entity: `NOT IMPLEMENTED; boundary defined`
67. RBAC Role Boundary: `roles table remains authorization-only`
68. Occupational Role Status: `ABSENT`
69. Skill Status: `ABSENT by design`
70. Knowledge Graph Authority: `Supabase PostgreSQL domain model`
71. Personal Graph Separation: `PASS; Evidence/mastery/Skill State remain downstream and user-specific`
72. SKOS Authority: `NONE`
73. Semantica Authority: `NONE`
74. Neo4j Authority: `NONE`
75. GraphRAG Authority: `NONE`
76. Search Index Authority: `NONE`
77. MCP Graph Authority: `NONE`
78. Write Path Count: `8 audited writer families; classified by authority family`
79. Unsafe Duplicate Write Paths: `0 in changed active paths`
80. Read Path Canonicalization: `PASS; runtime Concept reads resolve through ontology_concepts`
81. Provenance: `Preserved in ontology metadata, edge evidence, mapping provenance, and review/audit fields`
82. Governance: `PASS; review roles/evidence/audit path preserved`
83. CURRENTNESS: `Targeted only; no global requirement introduced`
84. PostgreSQL/D1 Parity: `Logical authority semantics aligned; D1 compatibility only`
85. Schema Change: `0`
86. Migration Change: `0`
87. Historical Migration Mutation: `0`
88. Stale CP-A Assertion: `One standalone test assertion fails on 0033_* expectation`
89. Stale CP-A Assertion Causality: `PRE_EXISTING_STALE_TEST_ASSERTION_NON_CAUSAL; present in HEAD and origin/main`
90. Production DB: `NO`
91. Deployment: `NO`
92. Duplicate Concept Test: `PASS`
93. Legacy/CP-A Same-Concept Test: `PASS`
94. CP-A Conflict Test: `PASS; canonical legacy row wins and CP-A cannot override`
95. Distinct Concept Test: `PASS`
96. Ambiguous Alias Test: `PASS; AMBIGUOUS`
97. Unknown Alias Test: `PASS; unresolved`
98. Relation Duplicate Test: `PASS; one family per semantic edge contract`
99. Relation Conflict Test: `PASS; specialized family remains authoritative over generic interpretation`
100. Inverse Test: `PASS; same ontology_edges authority, no independent inverse store`
101. Question Concept Test: `PASS`
102. Content Concept Test: `PASS`
103. Evidence Compatibility Test: `PASS`
104. Course/Certification Test: `PASS`
105. RBAC Role Test: `PASS`
106. No Occupational Role Creation Test: `PASS`
107. No Skill Creation Test: `PASS`
108. No Advanced Authority Test: `PASS`
109. Security Tests: `PASS; no changed-path authority injection or client trust bypass`
110. Data Trust Tests: `PASS; repaired active path Critical/High = 0/0`
111. Typecheck: `PASS`
112. Lint: `PASS`
113. Build: `PASS`
114. db:check: `PASS`
115. Migration Guard: `10/10 PASS`
116. Namespace Guard: `2/2 PASS`
117. git diff --check: `PASS`
118. New Skips/Only/Todo: `0/0/0`
119. Security Critical/High: `0/0`
120. Data Trust Critical/High: `0/0 in repaired active path`
121. Privacy Critical/High: `0/0`
122. P0 Before: `Duplicate legacy/CP-A Concept authority`
123. P0 Resolved: `YES; one canonical Concept authority and deterministic bridge`
124. P0 Remaining: `NONE`
125. P1 Remaining: `Occupational Role, Skill, typed graph closure, stronger polymorphic-edge constraints, full Certification entity, mapping invalidation implementation`
126. P2 Remaining: `SKOS, Semantica, Search, Neo4j projection, GraphRAG, MCP, Learner Twin, advanced recommendations`
127. Concept Hub Readiness: `Canonical authority ready; cross-Role/Skill closure not yet implemented`
128. Occupational Role Readiness: `NEXT GATE ONLY; may proceed as new domain entity`
129. Skill Foundation Readiness: `Blocked until Occupational Role wave and separately governed Skill wave`
130. Review Side Effects: `Two requested report files only`
131. Implementation Mutation During Review: `0`
132. Commit: `NONE`
133. Push: `NONE`
134. PR: `NONE`
135. Critical Blockers: `NONE`
136. Readiness Classification: `GRAPH_CANONICAL_AUTHORITY_APPROVED_OCCUPATIONAL_ROLE_FOUNDATION_MAY_PROCEED`
137. Final Architecture Classification: `Supabase PostgreSQL Canonical Knowledge Domain; ontology_concepts/ontology_aliases canonical; specialized mapping families canonical by scope; CP-A DRAFT staging/compatibility`
138. Review Report: `docs/architecture/securium-graph-canonical-authority-repair-final-rereview-2026-09-07.md`
139. Machine Report: `reports/architecture/securium-graph-canonical-authority-repair-final-rereview-2026-09-07.json`
140. Markdown SHA-256: `computed after report creation and recorded in final handoff`
141. Machine SHA-256: `computed after report creation and recorded in final handoff`
142. Primary Next Gate: `AUTHORIZE_SECURIUM_OCCUPATIONAL_ROLE_FOUNDATION_WAVE_A`

## Final architecture classification

```text
Supabase PostgreSQL Canonical Knowledge Domain
  Concept: ontology_concepts / ontology_aliases
  Question→Concept: question_concepts
  Content/Lesson→Concept: content_revision_concepts
  Generic Concept Relations: ontology_edges
  CP-A: DRAFT staging / compatibility bridge
  RBAC Role: authorization-only
  Occupational Role: NOT YET IMPLEMENTED
  Skill: NOT YET IMPLEMENTED
  Certification: boundary defined / canonical entity not yet implemented
  Evidence: references canonical Concepts through deterministic compatibility resolution
  Future projections: SKOS / Semantica / Search / Neo4j / GraphRAG / MCP
                    = NON-CANONICAL READ-ONLY PROJECTIONS
```

P0 duplicate Concept authority is independently closed. The next authorized change is Occupational Role foundation only; it must not reuse RBAC roles or jump directly to the full Skill Graph.
