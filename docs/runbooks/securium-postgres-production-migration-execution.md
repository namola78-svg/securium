# Securium production PostgreSQL migration execution runbook

**Status:** Ready as an operator plan; this document does not authorize execution.
**Frozen candidate:** `ddee4c0280064bb057103227cbca59a1261ee432`
**Scope:** Historical production lineage with numbered receipts through `0012`, six validated supplementary receipts, and no `app_schema_baseline_receipts` table.

This is a future execution procedure. No production connection or mutation was made while preparing it. The repository runner at `scripts/postgres-migrations.mjs` is authoritative. Do not apply migration SQL manually or bypass its guards.

## 1. Candidate and migration plan

Before the change window, check out the frozen candidate and confirm `git rev-parse HEAD` equals the SHA above and `git status --short` is empty. Do not substitute a later or locally modified tree. Run the local, read-only static check:

```sh
npm run db:postgres:validate
```

Expected output for this candidate:

```text
POSTGRES_MIGRATIONS_VALID files=43 tables=133 checksum=f2a06a5a4fc461df
```

The historical ledger validates the PR #268 production receipt order through `0012` exactly as `0001, 0002, 0003, 0004, 0005, 0006, 0009, 0007, 0008, 0010, 0011, 0012`. The pending numbered migrations then run in lexical filename order:

```text
0013_question_governance_foundation
0014_learning_event_version_revision_governance
0015_evidence_projection_foundation
0016_theory_revision_governance
0017_evidence_e1_core_remediation
0018_practical_revision_governance
0019_evidence_e2_a_recompute_operations
0020_concept_persistence_cp_a
0021_cs1a_governance_receipts
0022_cs1a_audit_identity
0023_content_final_review_authority
0024_content_review_judgment_infrastructure
0025_content_reviewer_separation_policy
0026_content_reviewer_separation_enforcement
0027_web-pentest-review-records
0028_generic_content_revision_registration_v1
0029_generic_review_currentness_domain
0041_legacy_concept_rls_hardening
0048_typed_relations_wave_b_current_main
0049_attempt_sequence_schema_foundation
0050_sw_foundation_identity_version_binding
0051_course_lesson_progress_revision_binding
0052_mock_exam_composition_snapshot
0053_runtime_authority_postgres_persistence
0054_cppg_canonical_registration
0055_cppg_publication_receipts
0056_secure_coding_8h_runtime_registration
0057_cppg_publication_revocations
0059_auth_identity_binding_contract
0060_isms_profile_mapping_foundation
```

`APPLICABLE_COUNT=30`. `0058_app_schema_baseline_receipts_rls_hardening` is **NOT_APPLICABLE** for this lineage: the database is classified `HISTORICAL_DATABASE`, the baseline receipt relation is absent, and no `0058` receipt exists. The runner must emit:

```text
POSTGRES_MIGRATION_NOT_APPLICABLE migration=0058_app_schema_baseline_receipts_rls_hardening lineage=HISTORICAL_DATABASE reason=BASELINE_RECEIPT_TABLE_ABSENT receipt=NONE
```

It must not execute `0058`, create `app_schema_baseline_receipts`, or record a `0058` receipt. A `0058` receipt without its table is an inconsistency and must fail closed. If the live database differs from the stated facts and has the baseline relation, stop and reclassify; that is a different applicability path.

## 2. Read-only pre-deploy gate

These checks are read-only. The SQL below is intended for the provider SQL console or another approved read-only SQL session. It contains no DDL or DML. Capture results without connection strings, credentials, or secret values.

```sql
SELECT current_database() AS database_name,
       current_user AS current_user,
       session_user AS session_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('lock_timeout') AS lock_timeout,
       current_setting('statement_timeout') AS statement_timeout,
       current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout;

SELECT rolname
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY rolname;

SELECT name, to_regclass('public.' || name) AS relation
FROM (VALUES
  ('app_schema_migrations'),
  ('app_schema_baseline_receipts'),
  ('evidence_projections'),
  ('content_review_policy_evaluations')
) AS expected(name)
ORDER BY name;

SELECT id, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY applied_at, id;

```

The relation lookup confirms the baseline receipt table is absent without querying a missing relation. The first query must show `current_user=postgres` and the previously observed identity. This role is an observed production fact; the repository runner itself does not enforce a particular role name.

Proceed to the status command only when the read-only snapshot confirms all of the following:

- historical numbered receipts through `0012` are present in the accepted production order and checksums match the frozen migrations;
- all six supplementary receipt IDs and checksums match the repository allowlist (they do not count as numbered migration progress);
- no unknown, duplicate, malformed, out-of-order, or checksum-mismatched receipt exists;
- `app_schema_baseline_receipts`, `evidence_projections`, and `content_review_policy_evaluations` are absent;
- `anon`, `authenticated`, and `service_role` exist;
- production initial-state preconditions for `0017` and `0026` are PASS (as supplied for this runbook); and
- the target is the intended production database and a change window is active.

Now run this repository status command with the approved production migration connection selected through the secret manager or shell environment. `POSTGRES_MIGRATION_URL` is preferred; its value must never be printed or pasted into evidence. `status` is read-only.

```sh
npm run db:postgres:status
```

Expected stdout for the stated initial state, in order:

```text
POSTGRES_MIGRATION_NOT_APPLICABLE migration=0058_app_schema_baseline_receipts_rls_hardening lineage=HISTORICAL_DATABASE reason=BASELINE_RECEIPT_TABLE_ABSENT receipt=NONE
POSTGRES_MIGRATIONS_PENDING 0013_question_governance_foundation,0014_learning_event_version_revision_governance,0015_evidence_projection_foundation,0016_theory_revision_governance,0017_evidence_e1_core_remediation,0018_practical_revision_governance,0019_evidence_e2_a_recompute_operations,0020_concept_persistence_cp_a,0021_cs1a_governance_receipts,0022_cs1a_audit_identity,0023_content_final_review_authority,0024_content_review_judgment_infrastructure,0025_content_reviewer_separation_policy,0026_content_reviewer_separation_enforcement,0027_web-pentest-review-records,0028_generic_content_revision_registration_v1,0029_generic_review_currentness_domain,0041_legacy_concept_rls_hardening,0048_typed_relations_wave_b_current_main,0049_attempt_sequence_schema_foundation,0050_sw_foundation_identity_version_binding,0051_course_lesson_progress_revision_binding,0052_mock_exam_composition_snapshot,0053_runtime_authority_postgres_persistence,0054_cppg_canonical_registration,0055_cppg_publication_receipts,0056_secure_coding_8h_runtime_registration,0057_cppg_publication_revocations,0059_auth_identity_binding_contract,0060_isms_profile_mapping_foundation
```

Do not proceed if stdout differs, status exits nonzero, or any error appears. Save the read-only status output in the change record after removing any sensitive connection detail (the runner does not print the URL).

## 3. Connection and migration guard requirements

For the future deploy invocation:

- Set `POSTGRES_MIGRATION_URL` explicitly to the authorized production **direct** PostgreSQL URL, stored outside the command transcript. `DIRECT_URL` is the fallback; `DATABASE_URL` is the last fallback. A dedicated migration URL is preferred.
- For any remote production endpoint, use only a direct connection or session-mode connection on port `5432`. Transaction-pooling port `6543` and every other remote custom port are rejected by the runner. Non-5432 custom ports are reserved only for loopback disposable PostgreSQL used by tests. Do not use transaction pooling.
- The runner uses one reserved `postgres` driver connection for all guarded operations, requires SSL, and verifies the same PostgreSQL backend session identity immediately before each migration. Do not enable `POSTGRES_MIGRATION_USE_PSQL=1`; deploy rejects it with `MIGRATION_GUARD_SINGLE_SESSION_REQUIRED`.
- Per migration, the runner sets and reads back `lock_timeout=5s`, `statement_timeout=60s`, and `idle_in_transaction_session_timeout=60s`. Each must match exactly. Do not override or bypass these controls.
- For this historical lineage, runner startup must not classify it as `TRUE_EMPTY`, `BASELINE_DATABASE`, `POST_BOUNDARY_DATABASE`, `UNKNOWN`, `PARTIAL_BASELINE`, or `AMBIGUOUS_NONEMPTY`.

## 4. Approval gate and future mutating step

All steps above are read-only. **The next step is the one production-mutating step.** Immediately before it, after the owner/operator has reviewed the candidate SHA, exact status output, applicability, connection target, change window, and stop/recovery plan, obtain and record explicit production migration approval from the authorized production owner. Approval must be fresh for this execution; this planning task is not that approval.

The repository requires both controls at invocation: the CLI flag `--confirm` and the exact environment value `POSTGRES_MIGRATION_APPROVED=APPLY_REVIEWED_MIGRATIONS`. Neither should be placed in a standing environment or CI configuration. They are the runner's approval controls, not a replacement for the human approval record. The repository also states that production application of at least `0013` and `0015` requires separate migration authorization; this runbook's explicit approval gate covers the entire reviewed batch.

Example for a future authorized PowerShell session (connection secret is injected out-of-band; do not enter a literal URL in shell history):

```powershell
$env:POSTGRES_MIGRATION_URL = '<injected production direct PostgreSQL URL>'
$env:POSTGRES_MIGRATION_APPROVED = 'APPLY_REVIEWED_MIGRATIONS'
npm run db:postgres:deploy -- --confirm
```

**Do not execute this command as part of this planning task.** `npm run db:postgres:deploy -- --confirm` is the sole approved repository-runner deploy command shown here. Do not run SQL files directly, invoke `psql` to apply migrations, use the fresh-baseline path, or invoke another schema/seed script.

## 5. Expected deploy output and stop conditions

For production `postgres` driver execution, expect the connection announcement to identify `mode=DIRECT_OR_SESSION_5432`, `driver=postgresjs`, and port `5432`. Any remote custom-port mode is a stop condition. Expect the exact `0058` NOT_APPLICABLE line shown above and no `0058` guard or execution line. For each of the 30 applicable migration IDs in the order above, expect these three setting readbacks followed by an execute pass:

```text
MIGRATION_GUARD_SETTING name=lock_timeout expected_ms=5000 observed_ms=5000 result=PASS
MIGRATION_GUARD_SETTING name=statement_timeout expected_ms=60000 observed_ms=60000 result=PASS
MIGRATION_GUARD_SETTING name=idle_in_transaction_session_timeout expected_ms=60000 observed_ms=60000 result=PASS
MIGRATION_GUARD_PASS migration=<current applicable migration ID> session=<numeric backend pid> action=EXECUTE
```

The same backend PID must be used for the guard readback and execution of each migration. A completed run ends with:

```text
POSTGRES_MIGRATIONS_DEPLOYED
```

Stop immediately and do not try another runner, manually apply SQL, clear receipts, alter timeouts, or bypass a guard if any of these occur:

- candidate SHA or clean-worktree check fails, static validation fails, approval is absent, or production target cannot be positively identified;
- the read-only state differs from the stated facts or the expected status output / exact pending list differs;
- runner exits nonzero or emits any `MIGRATION_GUARD_*`, `POSTGRES_BASELINE_STATE_*`, `POSTGRES_HISTORICAL_LEDGER_*`, `POSTGRES_MIGRATION_*_FAILED`, unknown receipt, duplicate, progression gap/order, or checksum error;
- any concurrent schema/ledger activity makes the approved pre-deploy status stale or changes the expected next migration;
- port is not `5432` for the remote production endpoint, connection mode is not `DIRECT_OR_SESSION_5432`, the wrong driver is used, reserved-session identity changes, or any required timeout setting fails readback;
- `0017` raises `EVIDENCE_E1_EXISTING_PROJECTIONS_REQUIRE_EXPLICIT_REVIEW` or any SQL error; or
- an unexpected `0058` execution/receipt, baseline receipt table creation, missing expected `MIGRATION_GUARD_PASS`, missing terminal success line, or any other unreviewed output appears.

On stop, preserve the full redacted output and read-only database snapshot, alert the migration approver, and wait for a new diagnosis and approval before any further mutating attempt.

## 6. Resume behavior

Each numbered migration file is a transaction and is applied separately by the repository runner. A migration whose transaction fails must not leave its DDL or receipt committed. Migrations that completed and committed before an interruption remain applied; there is no batch-wide rollback. Do not manually undo completed migrations.

After any stop or interruption:

1. Stop the current operator session and capture the runner's exit and last reported migration ID.
2. Re-run only the read-only SQL snapshot and `npm run db:postgres:status` against the same target. Do not immediately rerun deploy.
3. Confirm the completed receipt IDs/checksums form the valid historical prefix followed by a contiguous prefix of the pending order, the six supplementary receipts remain valid, the baseline receipt table and `0058` receipt remain absent, and the exact status output lists only the remaining applicable migrations with the same `0058` NOT_APPLICABLE line.
4. Diagnose the stop condition. If state and cause are understood and the authorized owner gives fresh approval for resumption, reissue the same guarded runner command with both required approval controls. The runner filters already-applied valid receipts and executes only the still-pending applicable IDs; per-migration guards run again. It will not manufacture `0058` for this historical lineage.
5. If receipts are unknown, inconsistent, duplicated, reordered, checksum-mismatched, or not a contiguous progression, keep the deployment on hold. Do not repair the ledger manually.

## 7. Read-only post-deploy verification

After the runner reports terminal success, use a separate read-only verification session. These queries do not mutate production:

```sql
SELECT id, checksum, applied_at
FROM public.app_schema_migrations
ORDER BY applied_at, id;

SELECT id, checksum
FROM public.app_schema_migrations
WHERE id IN (
  '0013_question_governance_foundation',
  '0014_learning_event_version_revision_governance',
  '0015_evidence_projection_foundation',
  '0016_theory_revision_governance',
  '0017_evidence_e1_core_remediation',
  '0018_practical_revision_governance',
  '0019_evidence_e2_a_recompute_operations',
  '0020_concept_persistence_cp_a',
  '0021_cs1a_governance_receipts',
  '0022_cs1a_audit_identity',
  '0023_content_final_review_authority',
  '0024_content_review_judgment_infrastructure',
  '0025_content_reviewer_separation_policy',
  '0026_content_reviewer_separation_enforcement',
  '0027_web-pentest-review-records',
  '0028_generic_content_revision_registration_v1',
  '0029_generic_review_currentness_domain',
  '0041_legacy_concept_rls_hardening',
  '0048_typed_relations_wave_b_current_main',
  '0049_attempt_sequence_schema_foundation',
  '0050_sw_foundation_identity_version_binding',
  '0051_course_lesson_progress_revision_binding',
  '0052_mock_exam_composition_snapshot',
  '0053_runtime_authority_postgres_persistence',
  '0054_cppg_canonical_registration',
  '0055_cppg_publication_receipts',
  '0056_secure_coding_8h_runtime_registration',
  '0057_cppg_publication_revocations',
  '0059_auth_identity_binding_contract',
  '0060_isms_profile_mapping_foundation'
)
ORDER BY id;

SELECT name, to_regclass('public.' || name) AS relation
FROM (VALUES
  ('app_schema_baseline_receipts'),
  ('evidence_projections'),
  ('content_review_policy_evaluations'),
  ('user_auth_identity_bindings'),
  ('isms_profiles'),
  ('isms_profile_requirement_mappings')
) AS expected(name)
ORDER BY name;

SELECT count(*) AS unexpected_0058_receipts
FROM public.app_schema_migrations
WHERE id = '0058_app_schema_baseline_receipts_rls_hardening';

SELECT c.relname,
       c.relrowsecurity,
       c.relforcerowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_has_table_privileges,
       has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS authenticated_has_table_privileges
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
```

Verify that all 30 listed IDs appear once with their exact candidate-registered checksums; all original numbered and supplementary receipts remain intact and in their pre-deploy order; `0058` count is zero; `app_schema_baseline_receipts` remains absent; and the runner's fresh read-only status now prints `POSTGRES_MIGRATION_NOT_APPLICABLE ... receipt=NONE` followed by `POSTGRES_MIGRATIONS_APPLIED`. The evidence and content-review tables created by applicable migrations should now exist. Confirm RLS and role grants against the migration SQL/repository security contract; use a focused read-only security review rather than treating the catalog listing alone as a complete proof.

If any post-deploy verification fails, stop further changes and escalate. Do not attempt ad hoc repair or reverse SQL.

## 8. Rollback limitations and mutation record

The repository provides no down-migration or whole-batch rollback command. Transaction boundaries protect each individual migration only: a failing current migration rolls back its own transaction, while earlier committed migrations remain. Recovery is diagnosis followed by a separately approved guarded resume, or a separately designed and authorized remediation. Do not promise rollback to the pre-deploy schema.

- Read-only actions in this runbook: local SHA/worktree/static validation, all SQL `SELECT` statements, migration `status`, and post-deploy verification.
- Future production mutation: the single repository runner command in section 4; it can apply the 30 numbered migrations.
- Required approval point: immediately before that future command, after the read-only gate and plan review.
- Production DB mutation in this preparation: **NONE**.
- Vercel environment mutation: **NONE**.
- Git mutation: **NONE**.
