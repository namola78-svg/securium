# Securium Occupational Role Alias D1 Migration Collision/Rollback and Evidence Sync Repair

Snapshot date: 2026-09-08
Review/implementation mode: bounded repair; no production, deployment, commit, push, or PR.

## Final status

- Final Status: `SECURIUM_OCCUPATIONAL_ROLE_ALIAS_D1_MIGRATION_COLLISION_ROLLBACK_AND_EVIDENCE_SYNC_REPAIR_PASS_READY_FOR_FINAL_REREVIEW`
- Repair Decision: `REPAIR_D1_MIGRATION_FAILS_BEFORE_CANONICAL_TABLE_REPLACEMENT_AND_SYNCHRONIZE_CURRENT_MIGRATION_EVIDENCE`
- Primary next gate: `FINAL_REREVIEW_SECURIUM_OCCUPATIONAL_ROLE_ALIAS_D1_MIGRATION_COLLISION_ROLLBACK_AND_EVIDENCE_SYNC_REPAIR`
- P1-01: `CLOSED` and unchanged.
- P1-02: `CLOSED` and unchanged.
- P1-03: `CLOSED_PENDING_FINAL_REREVIEW`.

## Git and evidence baseline

- Worktree: `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation`
- Branch: `architecture/role-skill-concept-graph-foundation`
- HEAD: `9756970ce19a64d6ac0e913631193b606dc78e7c`
- Fresh `origin/main`: `980ef6adb94d87a923d7a973edaf4419f03fff9d`
- Ahead/behind: `0 / 2`
- Main drift: `NON_CONFLICTING_DRIFT`.
- Worktree was already dirty with prior foundation files. This repair changed only the current unreleased D1 alias migration, its focused database test, and these two reports.
- Prior final rereview Markdown SHA-256: `C57FB609FCDADBFEB449231838C7EFB52344487673CC148158B006E2BFA8E3EC` (verified).
- Prior final rereview JSON SHA-256: `1468A2F65FB23B53A4AB0EA560C688AB78FFA91396CA21D6D90286C3DF53A376` (verified).
- Prior repair Markdown SHA-256: `2CCB9A786546F11F13712D5495200DBA70C4703AEBC03044CE34BB10123AF055` (verified).
- Prior repair JSON SHA-256: `5B22B98F6167B4036CFACA38FA5DCD1F229FDD917AEBA2695568428B455ED1A4` (verified).

## Evidence drift and current migrations

Evidence drift was confirmed: historical repair evidence named PostgreSQL `0032` and D1 `0043`, while the current worktree contains the same Role migration family at PostgreSQL `0034`–`0036` and D1 `0045`–`0047`.

Current files used by this repair:

- PostgreSQL: `db/postgres/migrations/0036_occupational_role_alias_hardening.sql`
- PostgreSQL SHA-256: `319F0FD95078FA2EA73DCA0092604FD852FC9CFFA381B6897AE26C9EB9F0D13C`
- D1: `drizzle/0047_occupational_role_alias_hardening.sql`
- D1 SHA-256 after repair: `E34CAA46953D4F6A6CEE9197F12C4523AD88DFD104ABB536C34A2CDE214C2FDA`
- PostgreSQL validation: `POSTGRES_MIGRATIONS_VALID files=32 tables=92 checksum=550ddb7f8ef1d3c5`.
- Migration namespace guard: `2/2 PASS`.
- Explicit registered-worktree scan found no second worktree containing the current Role `0036`/`0047` files. Current numbers are `CURRENT_NUMBERS_SAFE`.
- The current Role migration files are untracked worktree artifacts, so an authoritative Git rename chain from `0032→0036` and `0043→0047` is not recoverable from Git history. The stale historical reports were not rewritten. `EVIDENCE_DRIFT = CLOSED` for this report because every current claim names the actual files.

## Original defect and repair

The old D1 `0047` copied duplicate aliases into `__new_occupational_role_aliases`, dropped the canonical table, renamed the replacement, and only then attempted the global unique index. A pre-existing cross-Role collision therefore failed after replacement and left duplicate canonical rows without the intended unique index.

Repair strategy: `PRECHECK_COLLISIONS_BEFORE_TABLE_REBUILD`.

The current migration now:

1. removes only stale internal rebuild artifacts from a prior failed attempt;
2. creates a temporary unique preflight index on the existing canonical table;
3. aborts at that preflight if any normalized alias is duplicated, without dropping or replacing the canonical table;
4. copies data only after the preflight passes;
5. creates the final global unique index on the new table before the old table is dropped;
6. creates the replacement lookup index after the table swap.

No arbitrary winner selection, `INSERT OR IGNORE`, row-order choice, or silent cross-Role merge exists. D1 transactionality is not relied on for the collision case; the collision failure occurs before destructive replacement. The PostgreSQL migration remains transaction-wrapped and unchanged.

## Independent failure and recovery evidence

- Original unsafe reproduction before repair: `UNSAFE_PARTIAL_STATE_REMAINS`; replacement table survived with duplicate rows and no global unique index.
- Repaired exact cross-Role collision: `COLLISION_PRECHECK_FAILS_BEFORE_MUTATION`.
- Collision fixture: Role A and Role B both owned normalized alias `shared alias` under the pre-0047 per-Role uniqueness schema.
- Repaired failure: `UNIQUE constraint failed: occupational_role_aliases.normalized_alias` during preflight.
- After failure: original `occupational_role_aliases` remained, both original rows remained, the old per-Role unique index remained, no replacement table remained, and no new global index was present.
- Repeated failed migration: same bounded failure and unchanged original rows; no accumulating rebuild table or partial canonical replacement.
- Governed disposable cleanup: one colliding alias was removed; rerunning the same current `0047` succeeded.
- Clean success: D1 full migration runner applied all 44 migrations including `0047`; exit status was zero.
- Post-success direct duplicate insert: rejected by `occupational_role_aliases_normalized_unique`.
- Post-success update collision: rejected.
- Failed migration marker: the migration fails before completion and contains no application-side success marker. Clean Wrangler application reports `0047` successful only on the success path; the collision fixture never reaches that completion point.
- Existing repository/local Role alias scan: no seeded Role alias rows; no existing production or persistent local database was queried.
- Existing collision count in the disposable failing fixture: `1` before and `1` after the failed migration; no new ambiguity was introduced.
- Retry after collision repair: `PASS`.

## Normalization and provider parity

Application normalization remains `NFKC → trim → lowercase → collapse whitespace runs to one ASCII space`. Persisted `alias` and `normalized_alias` remain the same bounded printable-ASCII canonical form. Korean/localized preferred Role labels remain supported; Korean aliases remain intentionally rejected by the existing bounded alias-key policy and were not changed by this repair.

- PostgreSQL: unchanged global normalized-alias uniqueness and canonical-form check; disposable Role regression passed.
- D1: preflight plus pre-swap unique index; clean and collision fixtures passed.
- PostgreSQL/D1 parity: `LOGICALLY_ALIGNED` for successful canonical storage and collision rejection. D1 additionally requires a preflight because its table rebuild is provider-specific; this does not widen accepted canonical state.
- NFKC/case/trim/repeated-whitespace corpus: PASS in existing Role database tests; noncanonical compatibility input is rejected before a successful canonical rebuild. A pre-existing fullwidth alias fixture fails safely before replacement.
- Resolver defense: unchanged; legacy ambiguity still returns `AMBIGUOUS`, and clean DB-valid alias state has no alias-induced ambiguity.

## Regression gates

- Focused D1 database file: `tests/occupational-role-identity-database.test.mjs`; `7/7` tests PASS, including collision precheck, repeated failure, preserved old table, remediation/retry, post-migration duplicate rejection, and non-ASCII legacy failure safety.
- Occupational Role suite: `21/21 PASS`.
- Graph/Concept/Role authority regression: `49/49 PASS` for the current canonical-authority, ontology, certification-ontology, Role resolver, and Role schema set.
- Unit: `448/448 PASS`.
- Integration: `59/59 PASS`.
- Typecheck: `PASS`.
- Lint: `PASS`.
- Build: `PASS` with `63/63` generated routes.
- `db:check`: `PASS`.
- PostgreSQL migration validation: `PASS`.
- PostgreSQL migration guard: `10/10 PASS`.
- Namespace guard: `2/2 PASS`.
- Clean D1 migration: `PASS`.
- `git diff --check`: `PASS`.
- Repair-file skip/only/TODO scan: `0/0/0`.
- Known stale CP-A assertion remains `PRE_EXISTING_NON_CAUSAL`; it was not changed by this repair.

## Scope and risk

- Canonical Role authority: `occupational_roles`; alias authority remains subordinate `occupational_role_aliases`; authority count `1`.
- P1-01: `CLOSED`.
- P1-02: `CLOSED`.
- P1-03: `CLOSED_PENDING_FINAL_REREVIEW`.
- P1 remaining: `NONE` pending final independent rereview.
- P0: `NONE`.
- P2: no new finding.
- Skill mutation: `0`.
- Role relation mutation: `0`.
- Concept mutation: `0`.
- RBAC mutation: `0`.
- Graph projection mutation: `0`.
- Security Critical/High: `0/0`.
- Data Trust Critical/High: `0/0` for the repaired path.
- Privacy Critical/High: `0/0`.
- Production DB: `NO`.
- Deployment: `NO`.
- Commit/Push/PR: `NO / NO / NO`.

## Readiness

The D1 collision/partial-migration defect is repaired, but this is not the final rereview. Skill Foundation remains `BLOCKED_PENDING_FINAL_REREVIEW`. After the required final rereview passes, the next gate is `AUTHORIZE_SECURIUM_SKILL_FOUNDATION_WAVE_A`; no Role→Skill relation or graph projection is included here.

Report SHA-256 values are calculated after final materialization and returned in the handoff.
