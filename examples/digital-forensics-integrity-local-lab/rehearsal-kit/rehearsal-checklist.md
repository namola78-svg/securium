# Rehearsal Checklist: Integrity Lab

Use this checklist with the [instructor runbook](instructor-runbook.md) and
[learner workbook](learner-workbook.md). It records a human rehearsal setup;
it does not turn automated CI into a classroom result and does not declare
delivery readiness.

## Rehearsal identity

| Field | Record |
|---|---|
| Facilitator | |
| Learner/cohort | |
| Date and timezone | |
| Repository | `namola78-svg/securium` |
| Fresh revision used | |
| Related merge reference | `7a5b03ad0e9a29a36a3126b151489de622abe83e` |
| Lab path | `examples/digital-forensics-integrity-local-lab/` |
| Mode/room | |
| Number of learners | |

## Environment preflight

Record the actual environment used by the person running the lab. Do not
copy a CI result into these fields.

| Check | Actual value or observation | Confirmed by | Notes/action |
|---|---|---|---|
| Operating system and version | | | |
| Shell and version | | | |
| Python version | | | |
| Python executable path | | | |
| Repository revision | | | |
| `python`/`python3` command resolves as intended | | | |
| Temporary-directory location | | | |
| Symlink creation policy | | | |
| Windows junction/reparse case applicable? | | | |
| macOS or other unverified filesystem policy present? | | | |
| No real evidence or learner personal data in scope | | | |
| No database, network target, secret, or external service required | | | |

Reference evidence already available before a human rehearsal:

- Windows 11 Pro build 26200 / PowerShell 5.1 / Python 3.14.5 local test:
  25/25 passed.
- Lab CI matrix: Windows/Linux × Python 3.11/3.14.
- These are compatibility evidence, not completion of this checklist.

## Time plan and actual time

The 75-minute lab plan is a proposed rehearsal allocation. It is not an
official Foundation practical duration and is not a measured learner-time
claim. The DF-H02 module metadata says 60 minutes, but this independent
executable lab has no official execution allocation. Breaks, lunch, room
setup, account setup, and administration are separate.
The 75-minute plan is for a separate facilitator-led rehearsal, including
checks, negative-case repetition, feedback, and closeout; it is not a learner
class allocation and does not change the 60-minute module value.

| Stage | Proposed minutes | Actual start | Actual end | Actual minutes | Difference/reason |
|---|---:|---|---|---:|---|
| Environment and safety gate | 10 | | | | |
| Boundary framing | 8 | | | | |
| Normal prepare and verify | 12 | | | | |
| Tamper and missing-file cases | 15 | | | | |
| Manifest/custody/path/cleanup cases | 18 | | | | |
| Interpretation and limitations | 7 | | | | |
| Cleanup and handoff review | 5 | | | | |
| **Total lab plan** | **75** | | | | |
| Break/lunch/room/admin (separate) | — | | | | |

## Safety gate

Mark the check only after recording supporting facts where requested.

| Check | Done | Supporting observation or exception |
|---|---|---|
| Learner knows this is one independent synthetic local lab | [ ] | |
| No real disk image, user file, browser data, credential, account, incident, or personal data will be used | [ ] | |
| Workspace will be created by `prepare` and path will be copied from output | [ ] | |
| `original/` will not be edited | [ ] | |
| Only synthetic manifest/custody negative edits are allowed | [ ] | |
| No broad recursive delete, process termination, or OS security change will be used | [ ] | |
| Non-zero negative-case exit codes will be recorded, not hidden | [ ] | |
| Facilitator knows the stop/recovery procedure | [ ] | |

## Stage record

Use the actual command, status, path, output, and help request. Do not write
only “done” or copy an expected result.

| Stage | Command or learner action | Actual observation | Exit code/status | Learner evidence location | Help needed |
|---|---|---|---:|---|---|
| Prepare fresh workspace | | | | | |
| Inspect original/copy/records | | | | | |
| Normal verify and report | | | | | |
| Tamper working copy | | | | | |
| Verify tampered workspace | | | | | |
| Prepare fresh missing-file workspace | | | | | |
| Remove working-copy file | | | | | |
| Verify missing-file workspace | | | | | |
| Path and manifest boundary | | | | | |
| Custody/field boundary | | | | | |
| Symlink/reparse boundary | | | | | |
| Report overwrite boundary | | | | | |
| Cleanup owner/path boundary | | | | | |
| Final cleanup | | | | | |

## Observation coverage

| Observation required | Actual evidence location | Observed? | Notes |
|---|---|---|---|
| Caller `recorded_at` and verifier `verified_at` kept distinct | | [ ] | |
| Three original/working-copy paths recorded | | [ ] | |
| Size and streaming SHA-256 observations recorded | | [ ] | |
| Tamper mismatch reproduced | | [ ] | |
| Missing file distinguished from mismatch | | [ ] | |
| Original preservation checked after mutation | | [ ] | |
| Absolute/traversal path rejection observed | | [ ] | |
| Duplicate/missing/additional manifest handling observed | | [ ] | |
| Malformed/invalid/oversized record handling observed | | [ ] | |
| Custody required-field handling observed | | [ ] | |
| Existing report was not overwritten | | [ ] | |
| Symlink result recorded with platform/permission details | | [ ] | |
| Windows junction/reparse case actually run or explicitly platform-scoped | | [ ] | |
| Forged/copy marker and replaced-root cleanup boundary observed | | [ ] | |
| Outside sentinel and original survived boundary tests | | [ ] | |
| TOCTOU limitation discussed | | [ ] | |
| Hash/provenance limitation discussed | | [ ] | |
| Custody/acquisition/write-blocker limitation discussed | | [ ] | |

## Help and blockage log

Record help without pre-filling the learner's answer. Include the stage and
whether the issue was resolved or remains an environment limitation.

| Time | Learner | Stage | What was attempted | Help/request | Result | Follow-up |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |

## Stop, recovery, and cleanup record

| Event | Actual command/path | What was preserved | Recovery action | Final result |
|---|---|---|---|---|
| Real or outside path detected | | | | |
| Original modification risk | | | | |
| Invalid/replaced workspace root | | | | |
| Partial prepare failure | | | | |
| Report overwrite refusal | | | | |
| Symlink/junction permission issue | | | | |
| Cleanup rejection | | | | |

### Workspace cleanup

Record each printed workspace separately. Use only the exact cleanup command
from the runbook; never replace it with a broad recursive delete.

| Workspace label | Printed path | Cleanup command | Exit code/output | Path remains? | Outside sentinel/original status |
|---|---|---|---:|---|---|
| Normal/tamper | | | | | |
| Missing-file | | | | | |
| Other boundary case | | | | | |

## Learner feedback

| Prompt | Learner record |
|---|---|
| Which step was clearest? | |
| Which step was most difficult? | |
| Where was help requested? | |
| What did the learner expect that differed from the observation? | |
| Which limitation should be made clearer? | |
| What command or wording should be corrected? | |
| Would another rehearsal need more or less time? Give evidence. | |

## Facilitator change log

Do not silently change the canonical lab, Foundation, or runtime. Record
proposed wording or implementation issues separately.

| File/section | Observed issue | Reproduction/evidence | Proposed local change | Canonical/runtime impact |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## Handoff status

| Question | Record |
|---|---|
| Was a human rehearsal actually completed? | |
| Which learners completed a workbook? | |
| Which cases were not run? | |
| Which cases need another environment? | |
| Which rubric evidence is still missing? | |
| Is a separate content or code issue proposed? | |
| Next owner and action | |

Do not write `delivery READY` based on this checklist. The checklist is a
recording tool for a future rehearsal, not an approval, publication, or
Foundation-registration artifact.
