# Securium Occupational Role Alias D1 Migration Collision Rollback and Evidence Sync — Final Rereview

Snapshot date: 2026-09-08

## Decision

- Final Status: SECURIUM_OCCUPATIONAL_ROLE_ALIAS_D1_MIGRATION_COLLISION_ROLLBACK_AND_EVIDENCE_SYNC_FINAL_REREVIEW_PASS
- Review Decision: PASS
- Occupational Role Foundation Decision: OCCUPATIONAL_ROLE_FOUNDATION_COMPLETE
- Skill Foundation Readiness: READY_FOR_SKILL_FOUNDATION
- Recommended Next Gate: AUTHORIZE_SECURIUM_SKILL_FOUNDATION_WAVE_A

Independent review confirms that D1 migration 0047 detects pre-existing cross-role normalized-alias collisions before replacing the canonical alias table. The collision path is repeatable and preserves the original table and rows. The clean path establishes global normalized-alias uniqueness, and PostgreSQL 0036 remains logically aligned.

## Git and Evidence Baseline

- Worktree: C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-skill-graph-foundation
- Branch: architecture/role-skill-concept-graph-foundation
- HEAD: 9756970ce19a64d6ac0e913631193b606dc78e7c
- Fresh origin/main: 980ef6adb94d87a923d7a973edaf4419f03fff9d
- Ahead/behind: 0 / 2
- Main drift: NON_CONFLICTING_DRIFT
- The worktree was already dirty with prior user-owned foundation changes. No implementation was changed during this rereview.
- Production DB: NO
- Deployment: NO
- Commit / Push / PR: NO / NO / NO

Verified repair evidence:

- Repair Markdown SHA-256: DAE6B4E6F48C7CD3DAA6B1B6E950789A802F78FE4BE581B7CB96E67DC1A440B6
- Repair JSON SHA-256: CE60A7FB9CFE921F053DB0139C84DFFED96903D6886D05798E2F2F9565152507
- Previous final-rereview Markdown SHA-256: C57FB609FCDADBFEB449231838C7EFB52344487673CC148158B006E2BFA8E3EC
- Previous final-rereview JSON SHA-256: 1468A2F65FB23B53A4AB0EA560C688AB78FFA91396CA21D6D90286C3DF53A376

Current migration identities:

- PostgreSQL: db/postgres/migrations/0036_occupational_role_alias_hardening.sql
  - SHA-256: 319F0FD95078FA2EA73DCA0092604FD852FC9CFFA381B6897AE26C9EB9F0D13C
- D1: drizzle/0047_occupational_role_alias_hardening.sql
  - SHA-256: E34CAA46953D4F6A6CEE9197F12C4523AD88DFD104ABB536C34A2CDE214C2FDA

Evidence synchronization:

- Before: EVIDENCE_DRIFT_CONFIRMED
- After: CLOSED
- Active current-claim references to stale 0032/0043: 0
- Historical explanatory references in the repair Markdown: 0032 = 2, 0043 = 2. These are retained as historical evidence, not current migration identities.
- Current repair-evidence references: Markdown 0036 = 3 and 0047 = 8; JSON 0036 = 2 and 0047 = 5.
- The registered-worktree scan found one owner for Role PG0036 and one owner for Role D1 0047. CURRENT_ROLE_MIGRATION_NAMESPACE_SAFE.

## Canonical Authority and Scope

- Canonical Role authority: occupational_roles
- Canonical Role alias authority: occupational_role_aliases
- Canonical Role authority count: 1
- Concept authority: ontology_concepts / ontology_aliases, unchanged
- RBAC, Skill, Role relation, Concept, learner-state, and graph-projection mutation: 0
- Scope integrity: bounded to D1 alias migration safety, focused tests, and evidence review.

## D1 0047 Independent Review

Repair strategy: PRECHECK_COLLISIONS_BEFORE_TABLE_REBUILD.

The migration sequence is:

1. Remove only stale internal rebuild artifacts.
2. Create a temporary UNIQUE index on the existing canonical table normalized_alias column.
3. Remove the temporary preflight index after it proves uniqueness.
4. Create the replacement table with the canonical CHECK contract.
5. Copy data.
6. Create the final global UNIQUE index on the replacement table before dropping the old table.
7. Swap tables and create the lookup index.

D1 atomicity classification: PRECHECK_PREVENTS_DESTRUCTIVE_FAILURE. Transactionality is not relied upon for the collision case; the collision is rejected before foreign keys are disabled and before any canonical table replacement.

### Collision and failure matrix

| Check | Result |
|---|---|
| Exact cross-role normalized alias collision | PASS; preflight UNIQUE index rejects before replacement |
| NFKC compatibility-form legacy alias | PASS_SAFE_FAILURE_BEFORE_REPLACEMENT; replacement CHECK rejects before old table drop |
| Case-equivalent alias | PASS; canonical direct writes reject noncanonical form and normalized collision |
| Whitespace-equivalent alias | PASS; canonical direct writes reject noncanonical form and normalized collision |
| Failure table state | Original canonical table, rows, and old per-role index remain |
| Partial canonical table replacement | NO |
| Temporary replacement table after collision failure | NONE |
| Failed migration marker | NOT APPLIED; the failing SQL does not complete; Wrangler records the migration only on successful completion |
| Repeated failure | PASS; same bounded rejection with no accumulated rebuild state |
| Governed collision cleanup and retry | PASS |
| Clean D1 migration through 0047 | PASS |
| Post-migration direct duplicate insert | DB rejected |
| Post-migration update collision | DB rejected |
| Same-role equivalent duplicate | DB rejected by global uniqueness |
| Unique-index timing | Final UNIQUE index is created before old-table drop |
| Swap preconditions | Precheck, copy, and replacement uniqueness precede swap |

The disposable fixture used two Role IDs owning normalized_alias shared alias. After failure, the original rows and table definition were unchanged, no replacement table existed, and no global replacement index existed. After explicit deletion of one colliding alias, the same migration succeeded and the global unique index rejected a later duplicate insert.

Existing repository/local Role alias scan: no persistent seeded collision was found. No production or persistent local database was queried.

## PostgreSQL and D1 Parity

- PostgreSQL 0036: PASS; transactional migration retains canonical printable/lowercase/trimmed alias checks and global normalized-alias uniqueness.
- D1 0047: PASS; preflight collision rejection, replacement-table uniqueness, and post-migration uniqueness are enforced.
- Overall parity: LOGICALLY_ALIGNED
- Operational difference: PostgreSQL uses a transaction; D1 uses a collision precheck before destructive rebuild. Both preserve the same canonical invariant and reject cross-role equivalent ownership.
- Korean preferred/localized labels: SUPPORTED through the separate Role label field.
- Korean canonical aliases: INTENTIONALLY_REJECTED by the existing printable-ASCII alias policy; the D1 repair did not widen or alter this policy.

## Regression Results

- Role focused suite: 21/21 PASS
- D1 identity database suite: 7/7 PASS
- Clean D1 wrapper for the Role suite, including the full migration chain through 0047: PASS, Role tests 7/7
- Selected canonical graph/Concept/ontology regression: 45/45 PASS
- Resolver regression: PASS; ambiguous legacy states remain fail-closed
- P1-01: CLOSED
- P1-02: CLOSED
- P1-03: CLOSED
- Role key grammar regression: PASS
- Role key immutability regression: PASS
- PostgreSQL disposable Role regression: PASS
- PostgreSQL migration validation: PASS; files=32 tables=92 checksum=550ddb7f8ef1d3c5
- Migration Guard: 10/10 PASS
- Namespace Guard: 2/2 PASS
- git diff --check: PASS
- New code skip/only/TODO bypass: 0/0/0; literal words in report prose are not bypasses.

Repository-wide unit/integration runners were attempted independently. The unit runner emitted the existing suite's passing assertions but did not terminate after the unrelated Wrangler-heavy ISMS-P runtime-materializer test; a second single-concurrency attempt had the same lifecycle behavior. The stable unit subset excluding that unrelated test completed 441/441 PASS. The full integration wrapper likewise emitted successful D1 integration commands but did not reach terminal summary before the runner lifecycle was stopped; the Role-specific clean D1 chain completed successfully. This is a pre-existing non-causal test-runner lifecycle condition, not a Role/D1 0047 assertion failure.

- Typecheck: PASS
- Lint: PASS
- Build: PASS; 63/63 routes
- db:check: PASS
- Security Critical/High: 0/0
- Data Trust Critical/High: 0/0 in the repaired path
- Privacy Critical/High: 0/0

## Findings

- P0: NONE
- P1 before: D1 migration could leave a replaced ambiguous alias table; current repair evidence could point to stale migration numbers.
- P1 closed: D1 precheck prevents destructive collision failure; current evidence names PG0036/D10047 and records their hashes.
- P1 remaining: NONE
- P2: NONE_NEW

## Final Architecture Boundary

Occupational Role identity is complete for the next foundation layer:

Canonical Concept
→ Canonical Occupational Role
→ Canonical Skill
→ typed Role–Skill–Concept relations

This review does not claim Skill Foundation, Role→Skill, certification graph, learner competency state, Learner Twin, or semantic/search graph completion.

The final invariant is satisfied: a D1 collision migration failure is safe, unapplied, repeatable, and recoverable; a successful migration enforces the same canonical normalized-alias uniqueness as PostgreSQL; and current evidence is synchronized to PG0036/D10047.

Recommended Next Gate: AUTHORIZE_SECURIUM_SKILL_FOUNDATION_WAVE_A.

Report SHA-256 values are calculated after final materialization and returned with the review handoff.
