# SECURIUM PIA V1 Canonical PostgreSQL Error Provenance Diagnosis

## 1. Final Diagnostic Status

`SECURIUM_PIA_V1_AUDIT_IDENTITY_CANONICAL_POSTGRES_ERROR_PROVENANCE_PASS_READY_FOR_BOUNDED_FIX`

The first canonical divergence is proven. It is a disposable PostgreSQL test-fixture defect, not a schema, policy, barrier, or PostgreSQL uniqueness defect. No implementation repair was made.

## 2. Prior Conflicting Evidence

The canonical disposable test reproduced `0 SUCCESS / 2 DATABASE_TRANSACTION_ERROR`. A same-shape raw harness reproduced one commit and one `23505` decision-identity conflict. The prior reports correctly disproved a barrier deadlock, but lacked provenance at the canonical subject-insert boundary.

## 3. Canonical Reproduction

The canonical test was run with temporary, test-only bounded stage instrumentation and reproduced the failure. Two independent PostgreSQL clients entered separate transactions and both reached the decision-claim barrier. Neither reached audit or binding persistence.

The first failure for both transactions was subject persistence. The raw driver error was a JavaScript `Error` with bounded code `UNDEFINED_VALUE`; no SQL text, parameters, identifiers, or PII were emitted. The final repository result for both was `DATABASE_TRANSACTION_ERROR`.

The canonical fixture's subject factory omits the required `publicationAuthority` property. The repaired repository binds that property for every subject insert. The raw harness included the property and therefore reached the intended unique race. This is the first semantically different operation.

## 4. Raw Harness Comparison

| Operation | Raw harness | Canonical repository test | Divergence |
|---|---|---|---|
| Decision claim | Reached by both transactions | Reached by both transactions | None |
| Subject persistence | Complete subject values, including publication authority | Subject value is undefined for publication authority | Canonical fixture failure |
| Audit persistence | Winner reached it | Not reached | Consequence |
| Binding persistence | Winner reached it | Not reached | Consequence |
| Unique decision conflict | Loser received `23505` | No `23505` occurred | Consequence |
| Commit | Winner committed | Neither committed | Consequence |

Raw result: one commit and one redacted `23505` decision-identity conflict. Canonical result: both transactions failed at subject persistence before the target uniqueness race.

## 5. T1 Timeline

`BEGIN → decision claim reached → subject persistence attempted → UNDEFINED_VALUE → callback error → ROLLBACK → DATABASE_TRANSACTION_ERROR`.

T1 did not reach audit, binding, read-back, callback return, or commit.

## 6. T2 Timeline

`BEGIN → decision claim reached → barrier release → subject persistence attempted → UNDEFINED_VALUE → callback error → ROLLBACK → DATABASE_TRANSACTION_ERROR`.

T2 did not reach audit, binding, read-back, callback return, or commit.

## 7. Error Transformation Map

| Layer | Input | Output | SQLSTATE preserved | Cause preserved |
|---|---|---|---|---|
| postgres.js/test transaction callback | JS `Error`, code `UNDEFINED_VALUE` | Rejected callback / rollback | No SQLSTATE existed | At this diagnostic boundary, yes |
| PostgreSQL executor transaction boundary | Callback error | Bubbled error | No | Not retained by the safe normalized result |
| CS1A repository `normalizeDatabaseError(error, "transaction")` | Unrecognized database error | `DatabaseProviderError`, `DATABASE_TRANSACTION_ERROR` | No | No |
| Unique classifier | Not invoked | No duplicate result | Not applicable | Not applicable |
| CS1A service/domain boundary | Not reached in this direct repository test | Final repository error result | No | No |

The generic `DATABASE_TRANSACTION_ERROR` is created by `normalizeDatabaseError` in the CS1A repository's transaction-error path. The PostgreSQL provider does not itself recover this fixture error into a domain result.

## 8. SQLSTATE Preservation

Canonical run: T1 raw SQLSTATE `NONE`; T2 raw SQLSTATE `NONE`; raw code `UNDEFINED_VALUE`. Canonical `23505` was not observed. `25P02` was not observed. Post-23505 SQL attempt count was `0`.

The raw comparison harness independently observed `23505` at the decision-identity category and reached the bounded duplicate path. Thus the expected duplicate classifier is reachable for a real decision conflict; it was not reachable in the failing canonical run because the fixture failed earlier.

## 9. Transaction Wrapper

The repository uses the provider transaction callback with separate PostgreSQL clients. The provider's transaction callback executes all statements on the transaction executor. The direct disposable test wraps each client in `client.begin`; no shared transaction executor was found.

The actual isolation level is PostgreSQL's default `READ COMMITTED`; no explicit alternate isolation level is configured in this path. The barrier is test-local and separate per scenario. The barrier did not deadlock: both clients reached it and the test released it.

Transaction contract: callback success permits commit; callback failure causes rollback. The canonical callback failed at subject persistence, so both transactions rolled back. No domain error was returned as a successful callback value.

## 10. Duplicate Classifier Reachability

Canonical failing run: expected duplicate classifier reached `NO` for both transactions because no unique violation occurred. Raw harness loser: classifier reached `YES` and produced the bounded exact-decision duplicate result after the expected conflict path. Winner did not reach the classifier.

This diagnosis does not change the previously repaired narrow classification. It does not support catch-all `23505` mapping, retry, savepoints, or provider-wide changes.

## 11. Winner Analysis

There was no canonical winner. Both transactions failed before audit persistence and no commit was observed. Therefore the `0 SUCCESS / 2 DATABASE_TRANSACTION_ERROR` result is explained by the same fixture defect in both transactions, not by a late winner failure.

Post-failure canonical state was not queried by the unmodified test after this failure, so persisted counts are recorded as `UNKNOWN / NOT QUERIED`, not inferred. The stage trace shows no callback return or commit and both transaction callbacks entered rollback handling.

## 12. Loser Analysis

There was no canonical loser in the failing run because neither transaction reached the decision unique conflict. In the raw harness, the losing transaction received `23505` in the decision-identity category, rolled back, and was classified as the bounded exact-decision duplicate.

## 13. Post-Failure Database State

For the canonical reproduced failure: decision count, subject count, generic audit count, and binding count were `NOT QUERIED` by the unchanged test. Complete expected subject set: `UNKNOWN`; partial subject set: `UNKNOWN`. State classification: `OTHER / UNVERIFIED`. Domain-result consistency with database state: `UNKNOWN`.

This limitation is explicitly retained rather than converted into an unsupported zero-count claim. The required four-state rollback proof remains a later validation requirement after the bounded fixture correction.

## 14. Fixture Collision Review

No audit-ID collision, decision-surrogate collision, subject fixture collision, actor fixture collision, foreign-key fixture failure, barrier-state reuse, or other unrelated collision was evidenced. The two clients and synthetic actor fixtures were independent and valid. The failure occurred before those possible target conflicts.

## 15. Root Cause Candidate Matrix

| Candidate | Result | Evidence |
|---|---|---|
| `TRANSACTION_ERROR_TRANSLATION_LOSES_SQLSTATE` | SUPPORTED | Unknown transaction errors are normalized to `DATABASE_TRANSACTION_ERROR`; the raw fixture code is not retained in the domain result. Not the initiating defect. |
| `EXPECTED_UNIQUE_CONFLICT_CAUGHT_INSIDE_ABORTED_TRANSACTION` | DISPROVEN | No canonical `23505`, no `25P02`, and no post-unique SQL. |
| `WINNER_LATE_STAGE_FAILURE` | DISPROVEN | Both failed at subject persistence; no winner existed. |
| `SHARED_TRANSACTION_CONTEXT` | DISPROVEN | Two independent clients and transaction contexts reached the barrier. |
| `FIXTURE_IDENTITY_COLLISION` | DISPROVEN | No collision evidence; failure was an undefined subject parameter. |
| `READ_BACK_FAILURE` | DISPROVEN | Read-back was never reached. |
| `ERROR_CLASSIFIER_UNREACHABLE` | SUPPORTED for this failing run | No unique error reached the classifier; raw harness proves the classifier can be reached for the intended conflict. |
| `TEST_HARNESS_DIVERGENCE` | PROVEN | Canonical subject fixture omits `publicationAuthority`; raw harness supplies it. |
| `OTHER` | PROVEN | `UNDEFINED_VALUE` at subject persistence caused by the missing required fixture field. |

## 16. Proven Root Cause(s)

Primary root cause: canonical disposable PostgreSQL test fixture divergence. The subject factory does not provide `publicationAuthority`, while the repaired repository's subject insert requires it. Both transactions fail before the intended race, and the repository translates the unrecognized database error to `DATABASE_TRANSACTION_ERROR`.

Classification: `OTHER_PROVEN_ROOT_CAUSE` with `HIGH` confidence. First divergence point: canonical subject persistence, specifically binding the omitted publication-authority value. Multi-cause root problem: `NO`.

The error translation is a secondary observable effect, not a proven generic-provider defect. The canonical run does not establish a committed decision hidden behind a domain failure; commit state was not queried and must not be assumed. Blind retry remains prohibited.

## 17. Minimum Future Fix

The minimum bounded future fix is test-only: add the existing verified publication-authority value (`NOT_GRANTED`) to every synthetic subject fixture in `tests/cs1a-audit-identity-postgres-disposable.test.mjs`. No schema, migration, policy, hash, repository, generic provider, or service change is indicated by this diagnosis.

After that correction, rerun the genuine-overlap different-actor, same-actor, and distinct-decision tests; the four-state late-failure rollback test; publication-authority read-back; narrow duplicate/integrity classification; and the required regression suites. The future proof must still show one success/one bounded duplicate for same decisions, one canonical audit, complete subjects, and rollback `0/0/0/0`.

Expected future file scope:

- Required: `tests/cs1a-audit-identity-postgres-disposable.test.mjs`.
- Possibly required: none based on current evidence; a report update belongs to the later focused review, not this diagnosis.
- Not required: schema, migrations, generic DB provider, CS1A repository, service, hash implementation, or policy files.

## 18. Schema / Migration Impact

Schema change required: `NO`.

PostgreSQL migration change required: `NO`.

D1 migration change required: `NO`.

Hash V1 change required: `NO`.

Governance policy change required: `NO`.

The repaired `publicationAuthority` persistence model is preserved; only its synthetic test input is incomplete.

## 19. Security / Data Trust Impact

Current diagnostic-level counts: Security Critical `0`; Security High `0`; Data Trust Critical `0`; Data Trust High `0` newly discovered. The implementation gate remains blocked until canonical runtime proof is rerun successfully.

The defect can produce a caller-visible failure before the target race, but no committed canonical state was demonstrated. Because post-failure counts were not part of the unchanged failing test, `Domain Failure With DB Commit Possible = UNKNOWN`; a future caller must not blindly retry and must re-read exact authority before recovery.

No actor, subject, hash, audit-ID, RLS, raw-database-leakage, production, or remote-Supabase issue was found in this diagnosis.

## 20. Diagnostic Restore Proof

Temporary instrumentation was confined to the disposable PostgreSQL test and restored. The test file SHA-256 returned exactly to its pre-diagnostic value:

`1FD2D3393FDE41B3058EFBFF6DD88B182BD2491F1485522285AAD3D5EA741A5B`

Diagnostic code remaining: `0`.

Diagnostic test hooks remaining: `0`.

Schema changed during diagnosis: `NO`.

Migration changed during diagnosis: `NO`.

Persistent runtime changed during diagnosis: `NO`.

Unexpected persistent changes: `0`.

The only artifact created by this diagnostic phase is this report. No file was staged; no commit, push, PR, merge, deployment, remote migration, production connection, live audit, receipt, canonical content write, route, or publication occurred.

## 21. Required Result Register

| Result | Value |
|---|---|
| Docker healthy | YES |
| PostgreSQL version | 17.6 disposable fixture |
| Failure reproduced | YES, canonical `0/2` |
| T1 raw SQLSTATE | NONE; code `UNDEFINED_VALUE` |
| T2 raw SQLSTATE | NONE; code `UNDEFINED_VALUE` |
| T1 first failing stage | SUBJECT_PERSIST |
| T2 first failing stage | SUBJECT_PERSIST |
| Barrier placement | Transaction start, before statement execution / decision claim |
| Barrier deadlock present | NO |
| First database contention point | NONE in canonical failing run; raw harness decision identity unique conflict |
| Transaction aborted before error translation | YES, after subject-persistence error; no unique abort |
| Post-23505 SQL attempt count | 0 |
| 25P02 observed | NO |
| DATABASE_TRANSACTION_ERROR origin | CS1A repository `normalizeDatabaseError(..., "transaction")` path |
| Duplicate classifier reached | NO canonical; YES in raw harness loser |
| Winner commit observed | NO canonical / no winner |
| Loser rollback observed | YES for both failed canonical callbacks; raw harness loser also rolled back |
| Independent transaction contexts | YES, 2 |
| Shared provider | NO |
| Shared transaction executor | NO |
| Isolation level | READ COMMITTED |
| Raw harness result | 1 commit, 1 redacted `23505` decision conflict |
| Post-failure canonical counts | NOT QUERIED; UNKNOWN |
| Primary classification | OTHER_PROVEN_ROOT_CAUSE |
| Confidence | HIGH |
| Schema change required | NO |
| Migration change required | NO |
| Repository change required | NO indicated |
| Provider change required | NO indicated |
| Test change required | YES, bounded fixture correction |
| Current real PIA write | 0 |
| Live audit insert | 0 |
| Mutation route count | 0 |
| Receipt created/persisted | 0 / 0 |
| Canonical content write/publication | 0 / NO |
| Remote Supabase write | 0 |
| Production connection | NO |
| Diagnostic code remaining | 0 |
| Staged files | 0 |
| Commit / push / PR / merge / deployment | NO / NO / NO / NO / NO |

## 22. Fresh Repository State

HEAD, `origin/main`, and merge base were `1855f9818b473a2aa752d004da45a27f056b4838`; ahead/behind was `0/0`; branch was `feat/pia-audit-identity`. The existing uncommitted G1 candidate files and earlier reports predated this diagnostic phase and were preserved.

## 23. Recommended Next Gate

`AUTHORIZE_PIA_V1_AUDIT_IDENTITY_POSTGRES_CONCURRENCY_BOUNDED_FIX`

Do not apply that fix in this diagnostic phase. After the focused test-fixture correction, run the PostgreSQL runtime proof again and then conduct the required focused human review.

--------------------------------------------------
FINAL DIAGNOSTIC STATUS
--------------------------------------------------

Root cause proven; ready for a bounded test-fixture fix only.

--------------------------------------------------
CANONICAL REPRODUCTION
--------------------------------------------------

Fresh instrumented canonical result: `0/2`; both transactions failed at subject persistence with `UNDEFINED_VALUE`.

--------------------------------------------------
RAW POSTGRES COMPARISON
--------------------------------------------------

Raw disposable harness: one commit and one `23505` decision-identity conflict.

--------------------------------------------------
T1
--------------------------------------------------

`BEGIN → decision claim → subject persistence → UNDEFINED_VALUE → rollback → DATABASE_TRANSACTION_ERROR`.

--------------------------------------------------
T2
--------------------------------------------------

`BEGIN → decision claim/barrier release → subject persistence → UNDEFINED_VALUE → rollback → DATABASE_TRANSACTION_ERROR`.

--------------------------------------------------
ERROR PROVENANCE
--------------------------------------------------

The first canonical error is `UNDEFINED_VALUE`; repository transaction normalization converts it to `DATABASE_TRANSACTION_ERROR`. No canonical `23505` or `25P02` occurred.

--------------------------------------------------
WINNER
--------------------------------------------------

No canonical winner existed; both failed before audit persistence.

--------------------------------------------------
LOSER
--------------------------------------------------

No canonical loser existed. The raw harness loser received the expected decision-identity `23505` and bounded duplicate classification.

--------------------------------------------------
DATABASE STATE
--------------------------------------------------

The unchanged failing test did not query post-failure counts; state is `UNKNOWN`, not inferred.

--------------------------------------------------
ROOT CAUSE
--------------------------------------------------

Proven high-confidence test-fixture divergence: subject `publicationAuthority` is omitted from the canonical fixture although the repaired insert requires it.

--------------------------------------------------
MINIMUM FIX DESIGN
--------------------------------------------------

Add the existing `NOT_GRANTED` publication-authority value to the disposable subject fixture. No implementation, schema, migration, policy, or hash change is indicated.

--------------------------------------------------
SCHEMA / MIGRATION
--------------------------------------------------

No schema or migration change required.

--------------------------------------------------
SECURITY / DATA TRUST
--------------------------------------------------

No new Critical/High issue found. Commit readiness remains pending the bounded repair and focused human review; blind retry is prohibited while failed-run commit state is unverified.

--------------------------------------------------
DIAGNOSTIC RESTORE
--------------------------------------------------

Temporary diagnostics restored exactly; diagnostic code and hooks remaining are both `0`.

--------------------------------------------------
FIREWALLS
--------------------------------------------------

No live audit, receipt, canonical write, publication, route, production connection, remote migration, staging, commit, push, PR, merge, or deployment occurred.

--------------------------------------------------
NEXT GATE
--------------------------------------------------

`AUTHORIZE_PIA_V1_AUDIT_IDENTITY_POSTGRES_CONCURRENCY_BOUNDED_FIX`
