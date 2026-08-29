# SECURIUM PIA V1 PostgreSQL Concurrency Bounded Fix

## 1. Final Status

`SECURIUM_PIA_V1_AUDIT_IDENTITY_POSTGRES_CONCURRENCY_BOUNDED_FIX_PASS_READY_FOR_FINAL_FOCUSED_HUMAN_REVIEW`

The proven disposable-test fixture defect was corrected. Canonical PostgreSQL runtime proof now passes. No production/runtime, schema, migration, provider, executor, hash, policy, route, receipt, content, publication, remote, or live-audit change was made.

## 2. Proven Root Cause

The synthetic subject constructor in the PostgreSQL disposable test omitted the required per-subject `publicationAuthority`. The repaired repository therefore received `undefined` during `SUBJECT_PERSIST`, causing both overlapping transactions to return `DATABASE_TRANSACTION_ERROR` before the intended decision-identity race.

The verified PIA V1 fixture semantics use `publicationAuthority: "NOT_GRANTED"`. The fixture now supplies that value for all eight synthetic subjects.

## 3. Exact Fixture Correction

Modified file: `tests/cs1a-audit-identity-postgres-disposable.test.mjs`.

Change: added `publicationAuthority: "NOT_GRANTED"` to the existing synthetic subject constructor. No unrelated fixture or test behavior was refactored.

Before: one missing required fixture field.

After: zero missing required fixture fields.

## 4. Different-Actor PostgreSQL Proof

The exact disposable PostgreSQL G1 test passed with PostgreSQL 17.6. Its deterministic overlap barrier released two independent transactions attempting the same exact decision with different synthetic actors.

Result: one success, one `DUPLICATE_EXACT_GOVERNANCE_DECISION`, zero `DATABASE_TRANSACTION_ERROR`, zero double success. Final state: one decision, eight subject rows, one canonical audit, and one decision/audit binding.

## 5. Same-Actor PostgreSQL Proof

The same test's true-overlap same-actor case passed: one success, one bounded duplicate, one canonical audit, and zero double success.

## 6. Distinct-Decision Proof

The distinct-decision concurrent case passed. Distinct exact decision identities are not incorrectly blocked by the global uniqueness rule.

## 7. PostgreSQL Persisted Counts

For the primary same-decision fixture: decision `1`, subjects `8`, canonical audit `1`, binding `1`. The test performs exact subject identity read-back and publication-authority equality checks, not count-only verification.

## 8. Four-State Rollback Proof

The strengthened late-failure case passed. After failure following decision, subject, and audit attempts, the test independently verified: decision `0`, subjects `0`, audit `0`, binding `0`, and no partial subject state.

## 9. publicationAuthority Losslessness

The expected `NOT_GRANTED` value is now supplied, persisted, read back, and compared for every synthetic subject. Publication policy did not change; publication remains `NOT_GRANTED`.

## 10. Unique / Integrity Classification

The existing repaired narrow classification remained unchanged and passed its focused coverage: exact complete-decision conflicts produce the bounded duplicate result; subject, audit/binding, and unrelated integrity conflicts do not become normal exact-decision duplicates. No catch-all `23505` mapping or retry was added.

## 11. Error Redaction

Focused governance and database-redaction coverage passed. No SQLSTATE, constraint name, SQL, parameters, or driver internals are exposed in domain results.

## 12. Full Validation

| Validation | Result |
|---|---:|
| Focused CS1A contract tests | 3/3 PASS |
| PostgreSQL G1 disposable proof | 1/1 PASS |
| Different-actor true concurrency | PASS: 1 success / 1 duplicate |
| Same-actor true concurrency | PASS: 1 success / 1 duplicate |
| Distinct-decision non-overblocking | PASS |
| Four-state rollback | PASS: 0/0/0/0 |
| Unit | 448/448 PASS |
| Integration | 59/59 PASS |
| Migration guard | 10/10 PASS |
| PostgreSQL migration validation | PASS; 22 files / 91 tables |
| DB check | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| `git diff --check` | PASS |

No new skip, only, todo, assertion weakening, timing-only concurrency proof, mock-only canonical proof, count-only rollback proof, or count-only subject proof was added.

## 13. Security / Data Trust

Security Critical/High: `0/0`.

Data Trust Critical/High: `0/0`.

The global policy remains `GLOBAL_DECISION_SINGLE_AUDIT`; actor is excluded from decision identity and bound only through the single generic audit event. PostgreSQL uniqueness remains the final concurrency authority.

## 14. Exact Diff

Repair diff from the pre-fix state: one test file, one fixture-field insertion.

Production runtime files modified by this repair: `0`.

Schema files modified by this repair: `0`.

Migration files modified by this repair: `0`.

Provider/executor files modified by this repair: `0`.

The worktree also contains the earlier uncommitted G1 candidate files and reports; they predate this bounded correction and were preserved.

## 15. Firewalls

Mutation route added: `NO`.

Live audit insert: `0`.

Current real PIA decision insert: `0`.

Receipt created/persisted: `0/0`.

Canonical content write/publication: `0/NO`.

Auth/proxy/session/hash/policy changes: `NO`.

Remote Supabase migration/write: `0`.

Production connection: `NO`.

Staged files: `0`.

Commit, push, PR, merge, deployment: `NO / NO / NO / NO / NO`.

## 16. Recommended Next Gate

`REVIEW_PIA_V1_AUDIT_IDENTITY_FINAL_BLOCKER_REPAIR`

Commit remains unauthorized pending that focused human review.

### Required Result Register

- HEAD: `1855f9818b473a2aa752d004da45a27f056b4838`
- `origin/main`: same SHA; merge base same; ahead/behind `0/0`
- Branch: `feat/pia-audit-identity`
- Root cause: corrected synthetic `publicationAuthority` omission
- Modified test files: `tests/cs1a-audit-identity-postgres-disposable.test.mjs`
- Production runtime files modified: `0`
- Schema/migration/provider changed: `NO / NO / NO`
- Different actor: `1 success / 1 duplicate / 0 errors / 0 double success`
- Same actor: `1 success / 1 duplicate / 1 audit / 0 double success`
- Distinct decision: PASS
- Counts: `decision 1 / subjects 8 / audit 1 / binding 1`
- Rollback: `0 / 0 / 0 / 0`, no partial subject state
- publicationAuthority: persisted and exact read-back equality PASS
- Security Critical/High: `0/0`
- Data Trust Critical/High: `0/0`
- Report path: `reports/securium-pia-audit-identity-postgres-concurrency-bounded-fix-2026-08-29.md`
