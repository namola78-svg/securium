# ISMS-P Theory Batch 1 Production Executor Validation

## Executor contract

The Production executor is a separate path from the existing generic
materializer. The generic materializer continues to allow APPLY and ROLLBACK
only for explicitly confirmed `isolated-d1` and `disposable-postgres` targets.
Its Production fail-closed guard is unchanged.

The executor has separate PLAN, approval-digest, and APPLY invocations. APPLY
requires the exact approval string, expected main SHA, preflight SHA, expected
CREATE/conflict/HOLD counts, fresh-diff hash, approval digest, and explicit
Production-target confirmation. Missing or mismatched inputs fail closed.

## Approval binding

The canonical preflight SHA binds:

- Batch identity
- main/release SHA
- hashed Production target identity
- 36 operation classifications and payload hashes
- exact operation, conflict, pending, and HOLD counts
- tracked body, summary, example, exam-point, and materialization hashes

The approval digest additionally binds the exact approval string to the main
SHA, preflight SHA, operation count, and fresh-diff hash. Approval values are
runtime inputs; no approval is hardcoded.

## TOCTOU protection

PLAN is generated in a `REPEATABLE READ READ ONLY` transaction. APPLY first
recomputes that read-only preflight, then starts a single `SERIALIZABLE`
PostgreSQL transaction. A transaction-scoped advisory lock is acquired and the
preflight is recomputed again before any INSERT. Any difference invalidates the
approval.

APPLY requires exactly:

- Content: `CREATE 12 / NOOP 0 / CONFLICT 0`
- CourseLesson: `CREATE 12 / NOOP 0 / CONFLICT 0`
- CourseLessonExtension: `CREATE 12 / NOOP 0 / CONFLICT 0`
- Total: `CREATE 36 / NOOP 0 / CONFLICT 0`
- PENDING: `0`
- HOLD operations: `0`

## Atomicity and verification

The reviewed manifest supplies parameterized INSERT statements in FK order:
Content, CourseLesson, then CourseLessonExtension. Blind upsert and conflict
ignore are not used. All 36 statements execute inside one PostgreSQL
transaction. Each must affect exactly one row.

Before commit, the executor verifies all 36 rows by the existing exact
materializer contract, confirms the published denominator increased by 12,
and confirms the aggregate progress row count did not change. A failure throws
from the transaction callback and rolls the entire transaction back.

After commit, a new read-only transaction performs exact read-back. No
automatic retry is present. A committed approval cannot be replayed because
the fresh state contains 36 NOOP operations and APPLY requires 36 CREATE and
zero NOOP.

## Rollback policy

The Production executor has no rollback command and performs no automatic
post-commit rollback. Any future Production rollback remains a separate,
explicitly approved operation.

## D1 validation

- Approval required: PASS
- Main SHA mismatch: PASS (refused)
- Preflight SHA mismatch / TOCTOU change: PASS (refused)
- Wrong conflict or HOLD expectation: PASS (refused)
- Exact 36 validation: PASS
- Isolated atomic materializer APPLY: PASS
- Reapply / replay state: PASS (refused by Production contract)
- Existing generic Production guard unchanged: PASS

## PostgreSQL 17.6 validation

Executed against a local disposable `postgres:17.6-alpine` container using
ephemeral test-only credentials:

- Correct approval tuple: PASS
- Wrong tuple: PASS (refused)
- Exact atomic 36 INSERT: PASS
- Injected transaction failure: PASS; partial Batch writes `0`
- In-transaction verification: PASS
- Post-commit read-back: PASS
- Existing progress aggregate preserved: PASS
- Replay after commit: PASS (refused)
- D1/PostgreSQL logical parity: PASS

The GitHub Actions parity workflow is extended to run the same test on the
executor feature branch using only its PostgreSQL service container. No
Production secret is referenced.

## Production safety

- Production APPLY performed: **NO**
- Production rows created: **0**
- Production migration/schema/seed changes: **0**
- Previous approval reused: **NO**
- Manual SQL/INSERT path: **NO**

A new Production preflight and new explicit approval are required only after
this executor is committed, reviewed, merged to main, validated on the main
SHA, and deployed.

## Final repository QA

- Unit: `359/359 PASS`
- Integration: `23/23 PASS` (a first concurrent Vinext startup attempt ended
  with an internal worker error; the required standalone rerun passed)
- Full E2E: `80/80 PASS`
- Typecheck: `PASS`
- Lint: `PASS` with one preserved warning in a pre-existing untracked audit
  generator outside the intended diff
- Next production build: `PASS`
- Cloudflare build: `PASS`
- PostgreSQL migration validation: `PASS`, 9 files / 78 tables
- Production PLAN from the uncommitted implementation: correctly refused
  before connection because the executor cannot bind dirty code to a release
  SHA
