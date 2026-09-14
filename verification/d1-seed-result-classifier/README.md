# D1 seed result classifier

This directory documents the local, pure classification boundary for the merged
D1 standalone seed result contract. The implementation consumes a structured
observation supplied by a future trusted caller-side observation layer. It does
not execute D1, collect commit receipts, verify evidence, write reports, retry,
replay, roll back, or call `process.exit`.

The implementation was based on main at
`ce45a1937cb59f750c14e06fc0dd6a2e61219ea6` and the merged contract document at
`f8ecdc0fd7bbf8ba9068e45784d905f0db566d72`.

## Observation boundary

The input contains only these structured axes:

| Axis | Values used here |
| --- | --- |
| Execution stage | `PREFLIGHT`, `WRITE`, `POST_WRITE_RECHECK`, `VERIFICATION`, `REPORT`, `DONE` |
| Write process outcome | `NOT_STARTED`, `EXIT_ZERO`, `EXIT_NONZERO`, `TIMEOUT`, `PROCESS_LOSS`, `OUTPUT_LOSS` |
| Commit evidence | `NONE`, `WRITER_ACKNOWLEDGEMENT`, `TARGET_READ_BACK`, `OPERATION_BOUND_READ_BACK` |
| Verification | `NOT_RUN`, `PASSED`, `MISMATCH`, `QUERY_FAILED`, `UNAVAILABLE` |
| Rollback | `NOT_APPLICABLE`, `CONFIRMED`, `NOT_CONFIRMED` |
| Secondary failures | `REPORT_WRITE_FAILED`, `CLEANUP_FAILED` |

`OPERATION_BOUND_READ_BACK` is an observation supplied by a future trusted
internal layer. The classifier does not prove target identity, immutable
payload/version, durability, or causality. `TARGET_READ_BACK` means only that a
target row was observed; it is never promoted to operation-bound commit proof.
An existing row and CLI exit 0 therefore cannot produce a verified result by
themselves.

## State coverage

The five requested states are produced only under these conditions:

| Result state | Sufficient observation | Important insufficiency or limit |
| --- | --- | --- |
| `FAILED_BEFORE_WRITE` | Write was not attempted, process outcome is `NOT_STARTED`, verification was not run, and rollback is not applicable | Any started write is outside this state, even when it later fails |
| `COMMITTED_VERIFIED` | Operation-bound commit evidence and verification `PASSED` | Exit 0, writer acknowledgement, or an existing-row read-back is not enough |
| `COMMITTED_VERIFICATION_FAILED` | Operation-bound commit evidence and verification `MISMATCH` | A mismatch without operation-bound commit evidence is unsupported, not a committed result |
| `COMMITTED_BUT_UNVERIFIED` | Operation-bound commit evidence with verification not run/query failed/unavailable, or an exit-0 acknowledgement without operation-bound proof | It does not assert durable commit when only an acknowledgement or row read-back exists |
| `COMMIT_OUTCOME_UNKNOWN` | A write was attempted but no commit proof exists and the process outcome is non-success or lost/ambiguous | Timeout, nonzero, and output loss are not inferred to be rollback-complete |

`verification=PASSED` or `MISMATCH` without operation-bound commit evidence is
returned as `UNSUPPORTED_COMBINATION`, because forcing it into a committed state
would overstate the evidence. A write failure with confirmed rollback is also
returned as `UNSUPPORTED_COMBINATION`: the source contract describes a proposed
`WRITE_FAILED_ROLLBACK_CONFIRMED` case, but it is not one of the five states
implemented here. No new result state is invented for that gap.

Input types, enum values, required fields, duplicate secondary failures, and
contradictory field relationships are rejected as `INPUT_ERROR`. Error output
contains only a stable code and never reflects the input payload or error text.

## Exit, report, and recovery boundary

The current standalone caller keeps its existing process contract: successful
completion uses exit 0 and failure uses nonzero. This classifier introduces no
numeric exit code and does not alter the caller. The result object is a
structured classification only; it does not authorize replay, recovery, or
rollback.

Report and cleanup failures are secondary values. They are returned in a
restricted `secondaryFailures` list and never replace the primary result state.
No report file is written by this implementation.

The existing recovery proposal remains a caller/operations concern: unknown
commit outcomes must not be automatically replayed; exact replay must be
distinguished from divergent conflict; direct `UPDATE`, unconditional
`DELETE`/recreate, and revision/Evidence/progress bypass remain prohibited.
Target identity cannot be selected from a name or `APP_ENV` alone.

## Verification and integration

Focused tests call the pure function directly:

```text
node --import tsx --test tests/d1-seed-result-classifier.test.ts
```

The local implementation does not connect the current seed caller. Before any
future integration, the caller must supply a trusted structured observation,
including an operation-bound commit evidence mechanism and exact target
identity, preserve the existing exit 0/nonzero behavior, keep verification
separate from commit evidence, and keep report/cleanup failures secondary.
Database, Wrangler, Docker, managed-runtime, recovery, and real commit-proof
collection remain outside this change.
