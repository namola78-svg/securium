# D1 seed observation envelope

Status: local implementation proposal only. This directory does not connect the
envelope to the D1 seed caller or to `d1-seed-result-classifier`.

## Baseline and reference boundary

- Fixed implementation base: `efc6a873e600b53031b3d728ed5353993ab0ac88`.
- Reviewed `origin/main` after fetch: `dfdf31bb9d1a2b0a955997210b0a1f0d2087e3e1`.
- The only post-base main drift is the unrelated forensic input-limit package;
  it does not change the D1 caller, helper, classifier, contract, or unit runner.
- The observation design document is not present on this base. Its reviewed,
  unmerged reference is commit
  `71d84723a4d2d5e42cdb99582c0a2b7ca8b8300c` on worktree branch
  `docs/d1-seed-observation-contract`.
- The merged baseline contract is
  [`d1-standalone-seed-result-contract.md`](../../docs/architecture/d1-standalone-seed-result-contract.md).
- The reviewed observation document is read-only design evidence. It is not
  copied into this branch or treated as a merged current-main contract.

The current D1 content seed path is `seedD1` in
`scripts/security-content-upgrade-v3.mjs`: preflight queries and immutable
checks, protected snapshot before, generated SQL write subprocess, protected
snapshot after, verification queries, cleanup, and a success marker. The
caller currently preserves only limited process/output information and does
not produce an operation-bound durable commit proof. This implementation
represents supplied observations without repairing that caller boundary.

## API and result boundary

```ts
validateD1SeedObservationEnvelope(input: unknown): D1SeedObservationEnvelopeResult
createD1SeedObservationEnvelope(input: unknown): D1SeedObservationEnvelopeResult
```

Both functions are pure and return either a complete, newly allocated,
deeply frozen envelope or a limited input error:

```ts
{ kind: "VALID", envelope: D1SeedObservationEnvelope }
{ kind: "INPUT_ERROR", code: "INVALID_INPUT_TYPE" | "UNKNOWN_ENUM_VALUE" | "CONTRADICTORY_OBSERVATION" }
```

An input error never contains the original value, rejected key, exception,
stack, payload, or partial envelope. `create...` and `validate...` do not
classify a seed, compute an exit code, access a database, run a process, read a
file, use the environment, generate an ID/timestamp, or call the classifier.

## Input/output field contract

The output uses the same allowlisted camelCase field names as the TypeScript
input. Optional fields are omitted when absent; absence means that the caller
did not supply that observation, not success, failure, `NOT_RUN`, or proof of
non-occurrence.

| Field | Meaning | Producer | Required | Allowed values | Omission means | Structural rejection / not verified |
| --- | --- | --- | --- | --- | --- | --- |
| `schemaVersion` | Envelope schema revision | External observer | Yes | `1` | Invalid input | Version is accepted, not a compatibility proof |
| `operationId` | Opaque correlation identifier | External observer | No | Bounded token string | Operation ID not observed | Not generated or verified as authority/causality |
| `targetScope` | Display scope selected by caller | External observer | No | `d1-local`, `d1-remote`, `d1-managed` | Target scope not observed | Does not prove the actual provider target |
| `targetIdentityEvidence` | Limited evidence labels supplied by observer | External observer | No | `EXPLICIT_CONFIG`, `LOCAL_PERSISTENCE_IDENTITY` | No evidence field supplied | Labels do not prove target identity; duplicates are rejected |
| `sourcePlanHash` | Bounded comparison/replay aid | External observer | No | Bounded hash-like token | Plan hash not observed | Does not prove payload, version, replay, or commit causality |
| `executionStage` | Last caller stage observed | Caller/observer | Yes | `PREFLIGHT`, `WRITE`, `POST_WRITE_RECHECK`, `VERIFICATION`, `REPORT`, `DONE` | Invalid input | Incomplete stage history is not reconstructed |
| `write.attempted` | Whether the write subprocess was attempted | Caller/observer | Yes | Boolean | Invalid input | Does not prove DB mutation |
| `write.processOutcome` | Process result/uncertainty axis | Process boundary | Yes | `NOT_STARTED`, `EXIT_ZERO`, `EXIT_NONZERO`, `TIMEOUT`, `PROCESS_LOSS`, `OUTPUT_LOSS` | Invalid input | No rollback or commit is inferred |
| `write.commitEvidence` | Observer-supplied evidence label | Observer/evidence boundary | Yes | `NONE`, `WRITER_ACKNOWLEDGEMENT`, `TARGET_READ_BACK`, `OPERATION_BOUND_READ_BACK` | Invalid input | The envelope does not create or verify this evidence |
| `snapshot.before` | Protected snapshot query before write | Query observer | Yes | `NOT_RUN`, `PASSED`, `MISMATCH`, `QUERY_FAILED`, `UNAVAILABLE` | Invalid input | Equality is not a commit proof |
| `snapshot.after` | Protected snapshot query after write | Query observer | Yes | `NOT_RUN`, `PASSED`, `MISMATCH`, `QUERY_FAILED`, `UNAVAILABLE` | Invalid input | Result is not bound to this write without separate evidence |
| `verification` | Aggregate/integrity verification observation | Verification observer | Yes | `NOT_RUN`, `PASSED`, `MISMATCH`, `QUERY_FAILED`, `UNAVAILABLE` | Invalid input | `PASSED`/`MISMATCH` remains factual even if classifier would reject the combination |
| `rollback` | Rollback observation | Provider/target observer | Yes | `NOT_APPLICABLE`, `CONFIRMED`, `NOT_CONFIRMED` | Invalid input | The envelope does not prove or infer rollback |
| `secondaryFailures` | Cleanup/report errors separate from primary facts | Cleanup/report observer | No | `REPORT_WRITE_FAILED`, `CLEANUP_FAILED` | No secondary observation supplied | Duplicates rejected; never replaces primary facts |
| `errorClass` | Limited primary observation error category | Caller/observer | No | `INPUT_VALIDATION`, `PREFLIGHT_QUERY`, `WRITE_PROCESS`, `TIMEOUT`, `PROCESS_LOSS`, `OUTPUT_LOSS`, `SNAPSHOT_QUERY`, `SNAPSHOT_MISMATCH`, `VERIFICATION_QUERY`, `VERIFICATION_MISMATCH` | Primary error category not observed | No free-form error text or exception data |
| `reportStatus` | Report persistence observation | Report boundary | No | `NOT_ATTEMPTED`, `WRITTEN`, `WRITE_FAILED`, `UNKNOWN` | Report status not observed | Does not alter the primary observation |

The `snapshot` object is intentionally separate from `verification`. A passed
or mismatched snapshot is preserved as a query observation and is not renamed
to a commit result. A verification pass or mismatch without operation-bound
evidence is also preserved; this envelope does not turn it into a classifier
result or reject it merely because the classifier has an unsupported boundary.

## Runtime validation rules

- The root and every nested object must be a plain object with exactly the
  allowlisted own keys, including non-enumerable string keys; symbol keys and
  custom prototypes are rejected. Sensitive fields are not silently stripped
  and then accepted.
- Enum values and booleans are checked without coercion. Opaque identifiers and
  hashes are bounded and token-shaped; they are never generated or echoed in
  errors.
- `write.attempted: false` requires `PREFLIGHT`, `NOT_STARTED`, `NONE`,
  `verification: NOT_RUN`, and `rollback: NOT_APPLICABLE`.
- An attempted write cannot have `NOT_STARTED`; `PREFLIGHT` cannot describe an
  attempted write; a `WRITE` stage cannot carry an after-snapshot or
  verification result; and writer acknowledgement requires `EXIT_ZERO`.
- These are only clear structural contradictions. The validator does not
  reconstruct missing stage history, infer transaction boundaries, decide
  whether a row was newly created, or translate nonzero/timeout/output loss
  into rollback.
- Arrays are copied, duplicate codes are rejected, and set-like arrays are
  returned in canonical order. The returned envelope is deeply frozen.

## Trust and sensitive-data boundary

The allowlist excludes raw stdout/stderr, SQL, row payloads, credentials or
connection strings, arbitrary exception/stack values, learner/Evidence data,
free-form operational notes, full environment objects, absolute paths, and
fixture/container details. Rejecting an unknown sensitive field does not make
the remaining input evidence of a successful seed. The envelope represents
only the shape and labels supplied by an observer.

`OPERATION_BOUND_READ_BACK` is accepted only as an externally supplied label;
this implementation does not collect the target identity, immutable payload or
version, replay/competing-writer facts, or write-to-read-back causality needed
to trust that label. `COMMITTED_VERIFIED` and other final seed result states
are not produced here.

## Caller/classifier separation

The caller and classifier remain unchanged in this branch. No import or call
to `lib/services/d1-seed-result-classifier.ts` is made, and no caller exit,
report, retry, recovery, or DB behavior changes. Future integration still needs
decisions about operation-bound commit evidence, target identity, report
ownership/persistence, timeout/output-loss capture, and unsupported classifier
handling.

## Focused local verification

The focused test uses only synthetic inputs; it does not run subprocesses,
Wrangler, D1, migrations, seed callers, or log collection.

```text
node --import tsx --test tests/d1-seed-observation-envelope.test.ts
npm run typecheck
npx eslint lib/services/d1-seed-observation-envelope.ts tests/d1-seed-observation-envelope.test.ts
git diff --check
```

The existing `test:unit` loader and path order are preserved, with
`tests/d1-seed-observation-envelope.test.ts` registered exactly once directly
after the classifier test. This goal does not run the full local unit, build,
E2E, migration, D1, Wrangler, or seed suites.
