# Typed Role–Skill–Concept Relations Wave B

## FK deletion-policy P1 repair

- Final status: `SECURIUM_TYPED_ROLE_SKILL_CONCEPT_RELATIONS_WAVE_B_FK_DELETION_POLICY_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
- Repair decision: `PASS_READY_FOR_FINAL_REREVIEW`
- Finding: `WAVE-B-P1-001 = CLOSED`
- Completion: `TYPED_ROLE_SKILL_CONCEPT_RELATIONS_WAVE_B_PENDING_FINAL_REREVIEW`

## Root cause and bounded repair

The Drizzle declarations in `db/schema.ts` used `onDelete: "cascade"` for `roleSkillRelations.roleId` and `roleSkillRelations.skillId`, while the approved provider authorities `PG0042` and `D10051` use restrictive foreign keys. This was an ORM/provider semantic mismatch that could permit silent governed-relation loss through ORM-generated deletion behavior.

Changed only:

- `roleSkillRelations.roleId`: `cascade` → `restrict`
- `roleSkillRelations.skillId`: `cascade` → `restrict`

The Skill→Concept Wave B FK declarations were audited and already used `restrict`. No migration SQL, migration ID, relation identity, endpoint authority, seed, learner state, or downstream feature was changed.

## Fresh baseline and scope

- Worktree: `securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- `origin/main`: `ac65766b8e406968dd66fd906249c48b91fa6b38`
- Ahead/behind: `3/0`
- Worktree was already dirty with prior Wave A/Wave B implementation and evidence files; no unrelated changes were reset.
- Repair implementation diff: the two Role→Skill Drizzle FK policies plus focused parity/deletion regression assertions.

## Migration authority and parity

- PG migration: `db/postgres/migrations/0042_typed_role_skill_concept_relations.sql`
- D1 migration: `drizzle/0051_typed_role_skill_concept_relations.sql`
- Provider pair: `PG0042 / D10051 = VALID_PAIR`
- PG0042 mutation: `0`
- D10051 mutation: `0`
- Migration renumbering: `0`
- PG checksum: unchanged; migration validation PASS
- D1 journal/ownership: unchanged and valid
- `db:generate`: not run because it writes migration artifacts; `db:check` was used and reported no schema drift.

### Complete Wave B FK-policy matrix

| Relation | Endpoint | Drizzle | PG0042 | D10051 | Match |
| --- | --- | --- | --- | --- | --- |
| Role→Skill | `role_skill_relations.role_id → occupational_roles.id` | `restrict` | `RESTRICT` | `restrict` | PASS |
| Role→Skill | `role_skill_relations.skill_id → skills.id` | `restrict` | `RESTRICT` | `restrict` | PASS |
| Role→Skill | `role_skill_relations.reviewed_by → users.id` | `restrict` | `RESTRICT` | `restrict` | PASS |
| Skill→Concept | `skill_concept_relations.skill_id → skills.id` | `restrict` | `RESTRICT` | `restrict` | PASS |
| Skill→Concept | `skill_concept_relations.concept_id → ontology_concepts.id` | `restrict` | `RESTRICT` | `restrict` | PASS |
| Skill→Concept | `skill_concept_relations.reviewed_by → users.id` | `restrict` | `RESTRICT` | `restrict` | PASS |

## Deletion behavior

- Disposable PostgreSQL Role deletion with a referenced Role→Skill row: `PASS_RESTRICTED_FK` (`23503`); relation remained.
- Disposable PostgreSQL Skill deletion with referenced Role→Skill/Skill→Concept rows: `PASS_RESTRICTED_FK` (`23503`); relations remained.
- Disposable PostgreSQL explicit authorized deletion of the relation row: `PASS_AUTHORIZED`; relation count became zero only after explicit relation deletion.
- Disposable D1 regression: Role and Skill endpoint deletion are rejected by restrictive FK behavior.
- Silent governed-relation cascade count: `0`.
- ORM/provider parity regression: `PASS`; all six Wave B FKs are checked against Drizzle, PG, and D1 declarations.

## Verification

- Focused Typed Relations regression: `8/8 PASS_EXIT_0` (previous `7/7` plus deletion-policy parity coverage)
- Unit: `448/448 PASS_EXIT_0`
- Integration: `59/59 PASS_EXIT_0`
- PostgreSQL guard: `10/10 PASS_EXIT_0`
- Typecheck: `PASS`
- Lint: `PASS` (existing warning only, 0 errors)
- Build: `PASS_EXIT_0`
- `db:check`: `PASS`
- `db:postgres:validate`: `PASS`
- Namespace guard: `PASS`, collisions `0/0`
- Provider orphan guard: `0/0`
- `git diff --check`: `PASS`
- New skip/only/TODO: `0/0/0`

## Scope preservation and review

- Relation authority count: `1`
- Relation identity, directionality, types, provenance, lifecycle, uniqueness: unchanged
- Role/Skill/Concept authorities: unchanged
- Relation seed: `0`
- Curriculum mapping: `0`
- Learner state: `ABSENT`
- Evidence/Mastery mutation: `0`
- Security Critical/High: `0/0`
- Data Trust Critical/High: `0/0`; the ORM/migration mismatch is closed and silent endpoint cascade is prevented.
- Privacy Critical/High: `0/0`
- P0/P1/P2: `0/0/0`

## Decision and next gate

`WAVE-B-P1-001` is closed. Wave B is intentionally not declared complete by this repair gate; it remains pending independent final rereview.

- Recommended next gate: `FINAL_REREVIEW_SECURIUM_TYPED_ROLE_SKILL_CONCEPT_RELATIONS_WAVE_B_AFTER_FK_POLICY_REPAIR`
- Skill State: `WAIT`
- SW Skill Mapping: `WAIT`
- Mastery→Skill: `WAIT`
- Commit: `NONE`
- Push: `NONE`
- PR: `NONE`
- Deployment: `NONE`
- Production DB: `NONE`

## Artifact hashes

The machine-readable report and companion manifests contain the detailed values. SHA-256 values are recorded in `reports/architecture/securium-typed-role-skill-concept-relations-wave-b-fk-deletion-policy-p1-repair-sha256-2026-09-08.json`.
