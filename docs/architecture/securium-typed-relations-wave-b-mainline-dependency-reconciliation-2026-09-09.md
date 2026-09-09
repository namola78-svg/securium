# Typed Relations Wave B — Mainline Dependency Reconciliation

- Gate: `WAIT_FOR_MAINLINE_DEPENDENCY_RECONCILIATION_BEFORE_COMMIT_REVIEW`
- Wave B technical state: `TYPED_ROLE_SKILL_CONCEPT_RELATIONS_WAVE_B_COMPLETE`
- Reconciliation status: `SECURIUM_TYPED_RELATIONS_WAVE_B_MAINLINE_DEPENDENCY_RECONCILIATION_PASS`
- Final reconciliation decision: `ARCHIVAL_COMMIT_REQUIRED_FIRST`
- Commit readiness: `WAIT`
- No implementation, migration, relation, seed, or Git destructive operation was performed.

## Fresh baseline

- Worktree: `securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `4106b5be3dcbc699e816ad661abc3cb4e82a80f5`
- Merge-base: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Ahead/behind: `0/4`
- Staged files: `0`
- Tracked modifications: `7`
- Untracked files: `105`
- Current status paths: `112`
- Stashes: `3`; none was applied or used.

The current branch is a clean ancestor of the previous Wave B worktree state but is four commits behind fresh main. Wave A/Wave B implementation and evidence remain dirty/untracked, so no rebase, merge, stash, reset, or clean is safe in this gate.

## Mainline commit classification

| SHA | Title | Classification | Domain | Wave B effect |
| --- | --- | --- | --- | --- |
| `4106b5b` | `fix(security): update Next.js to 16.3.4` | `COMPATIBLE_FOUNDATION_CHANGE` | dependency/security runtime | No relation effect; package path overlap only |
| `ac65766` | `chore(ontology): preserve historical Dataset A archival evidence` | `COMPATIBLE_FOUNDATION_CHANGE` | ontology archival governance | Dataset A remains archival; Dataset B remains canonical; no Wave B endpoint change |
| `980ef6a` | `fix(media): harden progress checkpoint identity and no-op semantics` | `UNRELATED` | media progress | No Wave B effect |
| `6768654` | `feat(governance): add fail-closed ISE review runtime (#95)` | `SECURITY_FIX` | ISE governance/runtime | No Wave B relation or migration effect |

### Mainline path overlap

- Current status paths: `112`
- Mainline changed paths: `93`
- Exact path overlap: `1`
- Overlapping path: `package.json`
- Semantic overlap in that path: none; main adds the canonical ontology closure script and Next version, while the dirty Wave Foundation adds Role/Typed Relations test scripts. A later bounded merge must preserve all three additions.
- Wave B core implementation/migration paths overlapping main: `0`
- PG/D1 migration path overlap: `0`
- Relation/RLS/resolver path overlap: `0`

## Semantic-overlap analysis

- Role authority: unchanged by mainline.
- Skill authority: unchanged by mainline.
- Concept authority: mainline adds historical Dataset A archival evidence/guard only; `ontology_concepts / ontology_aliases` remains the canonical Dataset B authority.
- Relation architecture: unchanged.
- Drizzle relation schema: unchanged.
- PG0042/D10051: no mainline path or semantic change.
- Migration registry/checksum ledger: no mainline migration change.
- Namespace guard: no mainline change.
- RLS: no mainline relation RLS change.
- Resolver behavior: no mainline Role/Skill/Concept resolver change.

## Migration reconciliation

- PG0042 global claim count: `1`
- D10051 global claim count: `1`
- PG0042/D10051 pair: `VALID_PAIR`
- New migration IDs introduced by mainline: `0`
- Collision with PG0042/D10051: `0`
- Migration semantic collisions: `0`
- Provider orphans: `0`
- PG0042 checksum: unchanged
- D10051 checksum: unchanged

The four mainline commits introduce no migration IDs and do not alter migration ownership. Reconciliation must retain the current Wave B ownership manifest and D1 journal entry exactly.

## Dependency review

- Learning Evidence authorities/migrations: `PRESENT` on mainline, but `NOT_REQUIRED_FOR_WAVE_B_COMMIT`; Wave B deliberately does not create learner state, evidence, mastery, or credentials.
- Concept Mastery: not a prerequisite for defining or committing the typed relation foundation; Wave B remains independent of mastery projection.
- Legacy Concept hardening: compatible archival-only change; canonical ontology-only resolution remains valid.
- Next.js 16.3.4: compatible dependency/runtime change; rerun build and full gates after reconciliation.
- Role authority: `1`
- Skill authority: `1`
- Concept authority: `1`
- Relation authority: `1`

## Dirty-state preservation

The current foundation contains unique untracked implementation, migrations, tests, and review evidence absent from mainline. Unique Wave B evidence lost target is `0` only if the complete preservation manifest is captured before any Git reconciliation.

Preserve at minimum:

- shared foundation: `db/schema.ts`, `drizzle/meta/_journal.json`, `package.json`, migration guard and namespace guard files;
- Role/Skill/Concept canonical authorities and their migrations;
- Wave B `db/typed-relation-repositories.ts`, `lib/services/typed-relation-authority.ts`, PG0042, D10051, typed-relation tests;
- all Wave A/Wave B docs, reports, ownership manifests, parity manifests, and SHA manifests.

The exact path inventory is in the preservation manifest. No current artifact may be discarded or regenerated from intuition.

## Strategy evaluation

| Strategy | Result | Reason |
| --- | --- | --- |
| `REBASE_IN_PLACE` | Reject | dirty/untracked state and package overlap make blind rebase unsafe |
| `COMMIT_FIRST_THEN_REBASE` | Conditional | technically viable only after bounded, explicitly authorized preservation commit |
| `BOUNDED_LOCAL_ARCHIVAL_COMMIT_FIRST` | Preferred | preserves exact reviewed state and gives a recoverable source for later fresh-main reconciliation |
| `REAUTHOR_ON_FRESH_MAIN_WORKTREE` | Reject | would risk duplicate authorities/migrations and semantic drift |
| `CHERRY_PICK_BOUNDED_COMMIT_TO_FRESH_MAIN` | Preferred follow-up | safest after preservation commit and manual package.json reconciliation |
| `WAIT_FOR_DEPENDENCY` | Current operational state | no commit/rebase was authorized in this gate |

## Recommended reconciliation

1. In a separately authorized preservation gate, create a bounded archival commit or equivalent immutable local archive containing only the Wave Foundation scope captured by the manifest.
2. Verify the archive includes PG0042/D10051, `_journal.json`, Drizzle schema, authority/relation code, tests, and evidence reports; verify hashes before and after.
3. Start from fresh `origin/main` in a clean reconciliation worktree.
4. Apply the bounded Wave Foundation commit as a cherry-pick or equivalent reviewed patch.
5. Manually reconcile `package.json`: retain Next.js `16.3.4`, the canonical ontology closure script, and Wave Foundation test scripts. Preserve `package-lock.json` from main unless a dependency install proves a bounded lockfile update is necessary.
6. Re-run Focused, Unit, Integration, PostgreSQL guard, typecheck, lint, build, `db:check`, PostgreSQL validation, namespace, migration ownership, and diff-check.
7. Only then open `COMMIT_REVIEW_SECURIUM_TYPED_ROLE_SKILL_CONCEPT_RELATIONS_WAVE_B`.

No step above is executed by this gate.

## Readiness and decision

- Wave B itself remains technically complete and is not downgraded by being behind main.
- Skill State architecture readiness: `READY_FOR_SKILL_STATE_FOUNDATION`.
- SW Skill Mapping architecture readiness: `READY_FOR_SW_SECURITY_WEAKNESS_SKILL_MAPPING`.
- Mastery→Skill current state: `READY_FOR_MASTERY_TO_SKILL_PROJECTION_DESIGN`, subject to its own evidence/mastery repository gate.
- Security Critical/High: `0/0`.
- Data Trust Critical/High: `0/0`; reconciliation risk is separate and procedural.
- Wave B P0/P1/P2: `0/0/0`.

Final reconciliation decision: `ARCHIVAL_COMMIT_REQUIRED_FIRST`.

Next gate: `PRESERVE_SECURIUM_TYPED_RELATIONS_WAVE_B_BOUNDED_ARCHIVAL_STATE`.

Commit/Push/PR/Deployment/Production DB: `NONE`.
