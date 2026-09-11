# Q36 Answer-Binding Repair Implementation

Status: `IMPLEMENTATION_COMPLETE_CANDIDATE_AUTHORITY_BLOCKED`

This report records the user's approval to implement the exact Q36 content
repair and the minimal mapping/preflight revision extension. It does not
represent an independent reviewer signature, a canonical approval receipt, or
publication approval. The prior candidate and review reports remain preserved
in the Q36 repair worktree.

## Scope and source state

- Approved candidate: `129f7f25eef379c80918b7f215854ab595623229`
- Approved source candidate: `content-drafts/secure-coding-8h-foundation/q36-minimal-revision-candidate.json`
- Implementation worktree: `securium-python-8h-q36-minimal-revision-implementation`
- Implementation branch: `fix/python-8h-q36-minimal-revision-implementation`
- Fresh `origin/main` used as the base: `8e7baf8a3e156f7dc3666313fb7c88d7e6e7d8df`
- Fresh-main drift from the earlier implementation base `0c92a8d`: the
  reviewed M01-M08 local-lab bundle and its Python CI were added in
  `8e7baf8`.
- Original candidate worktree
  `securium-python-8h-q36-answer-binding-repair` was not modified.

The canonical Foundation candidate in this implementation worktree now has
the approved content candidate. Its approval status, review receipt, source
authority, Runtime registration, and persistence state were not promoted.

## Minimal content change

Only `questions.json` Q36's answer index changed from `0` to `1`. The stem,
four options, option order, explanation, question ID `Q36`, module `M07`,
objective `O28`, and all choice identities remain unchanged. The Foundation
manifest and validator's existing explicit implementation expectation changed
from `10/10/10/10` to `9/11/10/10`.

No `max-min <= 2` policy was introduced. The existing answer type/range,
single-answer, choice-binding, explanation/review, identity, and semantic-hash
checks remain active. No other question was edited.

## Minimal revision projection

The existing mapping extension points now accept a candidate-only revision
context:

```json
{
  "sourceRevisionId": "q36-answer-binding-repair-candidate",
  "sourceRevisionVersion": "candidate-1",
  "questionVersionOverrides": {"Q36": 2}
}
```

This is a local projection context, not an authority-assigned revision. With
no context, the existing v1 projection remains the default. With this context,
Q36 projects to
`version-question-developer-secure-coding-8h-python-vibe-Q36-v2`; the other
39 questions remain on their v1 identities and their payloads, semantic hashes,
choice IDs, and choice order are unchanged. Q36's stable question and choice
identities are also unchanged.

Preflight accepts the context only to rebuild and compare a candidate
projection. It binds the context into the revision-binding and payload hashes,
supports matching expected revision/source comparisons, and rejects stale
mapping, version, source, and payload values. Caller-supplied approval evidence
continues to fail closed. No allocator, approval registry, persistence adapter,
database write, or full materializer was added.

## Revision and authority boundary

| Layer | Result in this commit |
|---|---|
| Authoring source/manifest | Q36 candidate answer and exact distribution expectation updated; no authority-assigned next source revision exists |
| Runtime question version | Candidate-only Q36 v2 projection supported; existing IDs and v1 default preserved |
| Persistent `question_versions` | Not written; existing generic governed write path remains the future authority-bound integration point |
| Human review/approval | Not generated or bound; `humanReviewHash` remains `null` |
| Production preflight | Remains `BLOCKED`; source binding and approval remain `UNKNOWN`; persistence remains `NOT_READY` |
| Historical attempts | Not accessed or changed |

The existing v1 changed-payload projection is rejected as
`MAPPING_PROJECTION_MISMATCH`; it is not overwritten with the repaired answer.
The revised Q36 semantic hash is
`ffdfbe6aed302a6bf981211a520b7afb20c5e7b083f56cd898371203197c2c6c`.
The candidate projection uses a new Q36 version ID only in the supplied
candidate context; it does not claim that version `2` was assigned by trusted
authority.

## Verification

- Foundation validator: PASS; 40 questions, 160 choices, and answer position
  distribution `9/11/10/10`.
- Focused Node tests: 28 PASS across mapping, preflight, Q36 regression, and
  registration tests.
- Q36 regression: B/2 scores `100`; A/1 scores `0`.
- Projection regression: Q36-only v2 change; all other 39 mappings and all
  choice IDs/order preserved.
- Immutable/stale checks: PASS for changed same-v1 payload, stale mapping,
  stale payload hash, invalid revision override, and caller approval bypass.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS with 0 errors and 4 pre-existing warnings in unrelated
  files (`digital-forensics-8h-foundation/validator.mjs`,
  `create-security-content-v3-generator-input.mjs`,
  `validate-information-systems-auditor-foundation-wave-a.mjs`, and
  `crypto-module-tester-question-provenance.test.mjs`).
- Integrated Python local labs after rebasing on fresh main: 49 PASS.

Candidate hash observations from the DB-free preflight are:

| Value | Hash |
|---|---|
| v1 candidate manifest hash | `0f05cdf8510841444f63faa91275056ee36fc5d91f39d9e93458b4c597ab22a6` |
| v1 candidate revision-binding hash | `f19a2fa6e8d20dc58bcc59dc2996b616e38ced730614906793356ad1f69efe96` |
| Q36-context revision-binding hash | `ce1db8061aa60c08f36ac7c9df819416cc5cf432e214ca64b8e3fc0f1da70d42` |
| v1 candidate payload hash | `2ee7574da35fe18fe64f2d168dfa7a4dd7016f7d1e38d73f155355050fda00c0` |
| Q36-context candidate payload hash | `d0cf2a4349b0cf59f10e475a42dee507f138d73aa627c2cd923f1fe222b62252` |

## Environment and boundaries

- OS: Windows 11 Pro
- Node: `v24.19.0`; `npm ci` used only to provision local lockfile-matched tooling and
  did not change the lockfile or product dependencies.
- Python: 3.14.5
- Python 3.11: `NOT_RUN`
- Other OS: `NOT_RUN`
- No Runtime/shared/production DB I/O, historical-attempt mutation, remote
  mutation, push, PR, merge, publication, or deployment was performed.
- No real secret, user file, production data, or external service was used by
  the lab verification; the integrated Python suite used only its documented
  local temporary fixtures and loopback server.

The final local implementation commit is the commit containing this report;
its exact SHA is recorded in the handoff accompanying this file. It must not
be treated as an approval receipt or published revision until the existing
trusted source-revision and human-review authorities assign and bind those
values.
