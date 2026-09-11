# Q36 Revision-Boundary Review

Status: `BOUNDARY_REPAIRED_DRAFT_PR_CANDIDATE`

## Finding and minimum repair

The prior implementation commit `ed317873b8e7a0871c68131c53f09e6db7e9880f`
was tested directly before Draft PR preparation. Its context-free mapping
returned the repaired Q36 answer (choice 02) under the old
`version-question-developer-secure-coding-8h-python-vibe-Q36-v1` identity. That
would have combined a changed payload with an immutable v1 identity.

The existing mapping extension point now keeps the historical Q36 v1 semantic
anchor (`dc89bfe1e0fd3f8ad8f7879fbe5f9a6d42e9718d98dacd80a6c274e7c819b025`)
and fails closed with `QUESTION_REVISION_CONTEXT_REQUIRED` when the current
Q36 source no longer matches that v1 payload and no explicit revision context
is supplied. It does not copy or rewrite the old snapshot. The preflight calls
the same mapping path, so it rejects the context-free changed source rather
than manufacturing a v1 preflight result.

The approved candidate context remains the only candidate path for the repair:

```json
{
  "sourceRevisionId": "q36-answer-binding-repair-candidate",
  "sourceRevisionVersion": "candidate-1",
  "questionVersionOverrides": {"Q36": 2}
}
```

With that context, Q36 projects to
`version-question-developer-secure-coding-8h-python-vibe-Q36-v2`; the other
39 mappings remain v1 with unchanged payloads, semantic hashes, choice IDs,
and choice order. This is still a candidate projection, not a Runtime-issued
revision or approval.

## Boundary evidence

- Historical v1 Q36 semantic hash: `dc89bfe1e0fd3f8ad8f7879fbe5f9a6d42e9718d98dacd80a6c274e7c819b025`.
- Historical v1 candidate payload hash: `1918e3b1af43e1425fd515f718f87676d58a8c07b6575d9cf78eb58935bf27b7`.
- Repaired Q36 semantic hash: `ffdfbe6aed302a6bf981211a520b7afb20c5e7b083f56cd898371203197c2c6c`.
- Context-free mapping: rejected with `QUESTION_REVISION_CONTEXT_REQUIRED`;
  no changed Q36-v1 output is exposed.
- Context-free preflight: rejected with the same boundary error.
- Candidate mapping: Q36 choice 02/B scores `100`; choice 01/A scores `0`.
- Candidate preflight: `BLOCKED` / `NOT_READY`, source binding and approval
  `UNKNOWN`.
- Caller-supplied approval object, stale mapping, stale payload hash, and
  invalid question-version override remain rejected.

The default mapping and candidate mapping use the same stable snapshot builder;
the only per-entry revision projection is Q36. No same-version payload is
accepted, no historical attempt is changed, and no `humanReviewHash` or
canonical receipt is generated.

## Verification and scope

- Foundation validator: PASS with `9/11/10/10`.
- Focused mapping/preflight/Q36 tests after the repair: `23 PASS`.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS, 0 errors; four unrelated existing warnings remain.
- Fresh `origin/main`: `8e7baf8a3e156f7dc3666313fb7c88d7e6e7d8df`; no new drift
  at review time.
- Python lab sources are unchanged from the prior verified main commit; the
  prior local result remains `49 PASS` and was not unnecessarily repeated.

The implementation branch contains only the Q36 content/validator change,
minimal mapping/preflight boundary support, focused regression updates, and
these reports. M07 instructor/learner documents are not changed to remove the
existing Q36 scoring caveat; that is a separate follow-up documentation task.

The user's approval is recorded as implementation-scope authorization only.
It is not an independent reviewer signature, publication approval, or Runtime
authority binding. Production preflight remains blocked until the existing
trusted source-revision and human-review authorities provide those inputs.
