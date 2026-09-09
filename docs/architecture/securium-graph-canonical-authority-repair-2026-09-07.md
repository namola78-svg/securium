# Securium Graph Canonical Authority Repair

- Snapshot date: `2026-09-07`
- Worktree: `securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `67686548da982cd9f3c11806ac21b95cf4be526a`
- Ahead/behind: `0/1`
- Canonical runtime database: Supabase PostgreSQL
- D1 role: local / compatibility / rollback
- Prior audit evidence verified exactly:
  - Markdown SHA-256: `CFC8DD5AB9E0D13AC2308E057BF9695402576E3442D8B50B3C579B876361395C`
  - Machine SHA-256: `9F5A905D71B98D80EAEFF35B83EFA5423102879803A6F2BB785A76CE5B38C0CE`

## Final status

`SECURIUM_GRAPH_CANONICAL_AUTHORITY_REPAIR_PASS_READY_FOR_REREVIEW`

Repair decision: `ESTABLISH_SINGLE_CANONICAL_CONCEPT_AND_RELATION_AUTHORITY`

Primary next gate: `REREVIEW_SECURIUM_GRAPH_CANONICAL_AUTHORITY_REPAIR`

The repair selects legacy `ontology_concepts` as the single canonical Concept authority. This is the minimum-disruption choice supported by repository reality: question, content-revision, fact, evidence, ontology, and AI retrieval paths already reference its IDs. CP-A `concepts` / `concept_versions` / `concept_labels` is now explicitly staging/compatibility-only. It may bridge to the canonical store only through an exact stable-key match; it cannot create an active canonical lifecycle.

No third Concept authority was created. No schema, migration, production database, deployment, commit, push, or PR change was made.

## Authority before repair

| Candidate | Before role | Evidence |
|---|---|---|
| `ontology_concepts` / `ontology_aliases` | Operational runtime authority | `ontology_edges`, `question_concepts`, `content_revision_concepts`, `fact_concept_bindings`, evidence projections, AI ontology reads, and admin ontology reads reference it. |
| CP-A `concepts` / `concept_versions` / `concept_labels` | Separate additive persistence foundation, but server Knowledge code read it as canonical | CP-A migration says additive/no backfill; `server-knowledge-query-service.ts` directly queried CP-A. |
| `contents.core_concepts_json` | Content authoring metadata | JSON field; no canonical relation authority. |
| `question_concepts` | Question mapping authority | Foreign-keyed to legacy `ontology_concepts`; exact question mapping family. |
| content revision mappings | Content mapping authority | Foreign-keyed to legacy `ontology_concepts`; exact content mapping family. |
| evidence concept references | Personal projection references | Foreign-keyed to legacy `ontology_concepts`; no alternate user Concept authority. |
| hard-coded ontology constants | Domain vocabulary and fixtures | TypeScript constructors/fixtures; not persisted authority. |

## Authority after repair

### Canonical Concept contract

- Canonical store: `ontology_concepts`.
- Canonical Concept ID: `ontology_concepts.id`; existing IDs are preserved.
- Canonical semantic identity: `ontology_concepts.concept_key`.
- Canonical preferred label: `ontology_concepts.label` / normalized label.
- Canonical lifecycle: `ontology_concepts.status` (`DRAFT`, `ACTIVE`, `ARCHIVED` as currently governed).
- Canonical aliases: `ontology_aliases`.
- Canonical relations: relation-family contract below, all in PostgreSQL/D1 domain semantics.
- Canonical provenance/governance: existing ontology and mapping review/provenance fields; no bypass added.
- Stable identity does not depend on a mutable label.

### CP-A compatibility contract

- CP-A role: `STAGING_COMPATIBILITY_ONLY`.
- CP-A writes are restricted to `DRAFT` by `db/concept-persistence-repositories.ts`.
- CP-A cannot activate or retire an independent canonical Concept through the repository.
- CP-A ID → canonical Concept uses exact CP-A `stable_key` → exact legacy `concept_key`.
- CP-A alias/label → canonical Concept is allowed only when it bridges to one exact legacy `concept_key`.
- Missing bridge returns `UNRESOLVED_LEGACY_REFERENCE`.
- Multiple candidates return `AMBIGUOUS`; the resolver never guesses.
- Labels are never silently merged and no data was backfilled or populated.

The new resolver is implemented in `lib/services/canonical-concept-authority.ts` and the database adapter in `db/canonical-concept-repositories.ts`. The server Knowledge facade now dynamically binds to that adapter and no longer treats CP-A as the canonical read path.

## Duplicate and alias classification

No production Concept IDs were fabricated and no concepts were merged. The following review candidates remain unresolved until governed authoring evidence exists:

| Candidate | Classification | Action |
|---|---|---|
| Command Injection / OS Command Injection / Shell Injection | RELATED or NARROWER/UNKNOWN depending on scope | Preserve distinct identities; require review. |
| Authentication / MFA / JWT | BROADER/NARROWER/RELATED | Preserve distinct identities. |
| Authorization / IDOR / BOLA | BROADER/NARROWER/RELATED | Preserve distinct identities. |
| Cryptography / Encryption | BROADER/NARROWER/RELATED | Preserve distinct identities. |
| XSS variants | RELATED/NARROWER | Preserve distinct identities. |

Exact alias resolution is bounded. An alias matching multiple canonical Concepts returns `AMBIGUOUS`. Fuzzy similarity never creates identity.

## Relation authority contract

| Relation family | Canonical authority | Other representations |
|---|---|---|
| Generic ontology relations | `ontology_edges` | Graph/read retrieval structure in PostgreSQL/D1 |
| Question → Concept | `question_concepts` | No independent generic edge may override the mapping |
| Content revision → Concept | `content_revision_concepts` | `coreConcepts` is authoring metadata only |
| Fact → Concept | `fact_concept_bindings` | No independent generic edge may override the binding |
| Evidence → Concept | evidence projection tables | Personal projection, not Knowledge Graph identity |
| CP-A relations | None | CP-A has no relation authority |

The contract is one canonical family per edge semantic. Existing directed ontology edges and their legacy inverse materializations remain in the same legacy authority for compatibility; they are not a second source of truth. No new relation type, generic edge endpoint, or graph API was introduced.

Existing free-form content link relation text remains outside the canonical Concept relation contract and is a follow-up hardening item. The repair does not claim to have implemented the future Role/Skill relation vocabulary.

## Compatibility boundaries

- Evidence architecture was not changed. Existing Evidence Concept IDs remain legacy canonical IDs and resolve directly.
- Question/content mappings remain compatible because their Concept foreign keys remain legacy IDs.
- `coreConcepts` metadata is an authoring/read hint, not a canonical relation.
- Course remains a learning delivery/runtime container.
- Certification remains a separate future qualification domain; Course is not Certification.
- The existing `roles` table remains RBAC only. `AUTHORIZATION_ROLE != OCCUPATIONAL_ROLE`.
- Skill remains intentionally absent; no Skill entities were created.
- Search, ontology projections, SKOS, Semantica, Neo4j, GraphRAG, and MCP remain non-canonical or unimplemented.
- Personal Evidence/Competency state remains separate from the shared Knowledge Graph.

## Write-path audit and repair

| Writer family | After classification |
|---|---|
| Legacy ontology concept/alias repository and governed package SQL | `CANONICAL_WRITE` |
| `ontology_edges` repository and governed package SQL | `CANONICAL_WRITE` for generic ontology relation families |
| `question_concepts` | `CANONICAL_WRITE` for question mapping |
| `content_revision_concepts` | `CANONICAL_WRITE` for content mapping |
| `fact_concept_bindings` | `CANONICAL_WRITE` for fact mapping |
| evidence projections | `CANONICAL_WRITE` for personal projection state |
| CP-A concepts/versions/labels | `AUTHORING_STAGE_WRITE`; DRAFT-only, never canonical lifecycle |

Unsafe duplicate canonical writes introduced by this repair: `0`.

The server Knowledge read path is explicit and server-owned. It accepts lookup input only, resolves through legacy canonical rows, and fails closed for unknown, ambiguous, deprecated, or unbridged staging references.

## Tests and validation

| Check | Result |
|---|---|
| Authority resolver tests | 6/6 pass |
| Knowledge public contract tests | 10/10 pass |
| Ontology/relation tests | pass |
| Combined focused authority/ontology/CP-A suite | 60/60 pass |
| Full unit suite | 448/448 pass |
| Typecheck | PASS |
| Lint | PASS |
| `db:check` | PASS |
| PostgreSQL migration guard | 10/10 pass |
| Migration namespace guard | 2/2 pass |
| Build | PASS; 63 routes |
| `git diff --check` | PASS |

The standalone `tests/cpa-fresh-main-contract.test.mjs` contains a pre-existing stale assertion requiring no `0033_*` migration, while the repository and fresh `origin/main` already contain `0033` through `0040`. It was not changed because this gate forbids historical migration mutation. This is repository test-contract drift, not a repair regression and not an authority bypass.

## Security, trust, privacy, and migration gates

- Security Critical/High: `0/0` in changed paths.
- Data Trust Critical/High: `0/0` in active authority paths; unresolved/ambiguous bridges fail closed.
- Privacy Critical/High: `0/0`; no user-personal graph was introduced.
- Schema change: `0`.
- Migration change: `0`.
- Historical migration mutation: `NO`.
- Production DB: `NO`.
- Deployment: `NO`.
- Commit/push/PR: `NO`.
- New skip/only/todo: `0/0/0`.

## Current and target boundary

```text
CURRENT AFTER REPAIR
Supabase PostgreSQL / D1-compatible domain
  ontology_concepts + ontology_aliases  [SINGLE CANONICAL CONCEPT AUTHORITY]
       ├─ ontology_edges                 [generic relation authority]
       ├─ question_concepts              [question mapping authority]
       ├─ content_revision_concepts      [content mapping authority]
       ├─ fact_concept_bindings          [fact mapping authority]
       └─ evidence projections           [personal projection references]

CP-A concepts / versions / labels
  [DRAFT STAGING + EXACT COMPATIBILITY BRIDGE ONLY]

TARGET LATER
Role → Skill → Concept → Tool/Technology → Learning Content → Certification
                                      └→ Evidence → Concept Mastery → Skill State
Search / SKOS / Semantica / Neo4j / GraphRAG / MCP = downstream projections
```

## Next implementation order

1. Rereview this authority repair and approve the single-authority contract.
2. Wave A: occupational Role foundation, explicitly separate from RBAC.
3. Wave B: canonical Skill foundation.
4. Wave C: Role → Skill.
5. Wave D: Skill → Concept.
6. Wave E: Concept → Tool/Technology.
7. Wave F: Certification boundary/entity and mappings.
8. Wave G: typed relation/version/provenance closure.
9. Wave H: Must-Know Concepts read model.
10. Later: SKOS, search projection, Semantica, Neo4j projection, GraphRAG, MCP, Learner Twin.
