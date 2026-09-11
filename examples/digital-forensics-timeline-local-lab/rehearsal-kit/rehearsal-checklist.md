# Rehearsal Checklist: Synthetic Forensics Timeline Lab

Use this blank form with the [instructor runbook](instructor-runbook.md) and
[learner workbook](learner-workbook.md). It records a future human rehearsal setup; it does
not turn automated CI into a classroom result or declare delivery readiness.

## Rehearsal identity

| Field | Record |
| --- | --- |
| Facilitator | |
| Learner/cohort | |
| Date and timezone | |
| Repository | `namola78-svg/securium` |
| Fresh revision used | |
| Related merge | `e67293d285ff913070af5fc1634ecfd5fc4e6405` |
| Lab path | `examples/digital-forensics-timeline-local-lab/` |
| Mode/room | |
| Number of learners | |
| Human rehearsal actually completed? | |

## Environment preflight

Record the environment actually used by the person running the lab. Do not copy CI results
into blank fields.

| Check | Actual value or observation | Confirmed by | Notes/action |
| --- | --- | --- | --- |
| Operating system/version | | | |
| Shell/version | | | |
| Python version | | | |
| Python executable path | | | |
| Repository revision | | | |
| `python` command resolves as intended | | | |
| Temporary-directory location | | | |
| Python standard-library-only dependency confirmed | | | |
| No real evidence, personal data, or user file in scope | | | |
| No database, network target, credential, or external service required | | | |

Compatibility evidence available before a human rehearsal may be noted separately:
Windows/Linux × Python 3.11/3.14, with 10/10 tests in each matrix job. That evidence is
not completion of this checklist.

## Time plan and actual time

The 75-minute plan is a proposed facilitator rehearsal block, not official course time and
not a measured learner-time claim. Current Securium Foundation metadata assigns `DF-H06` 60
minutes and the course total 480 minutes; breaks, lunch, room setup, and administration are
separate.

| Stage | Proposed minutes | Actual start | Actual end | Actual minutes | Difference/reason |
| --- | ---: | --- | --- | ---: | --- |
| Environment and safety gate | 10 | | | | |
| Normal JSON and CSV run | 15 | | | | |
| Timestamp, tie, and conflict interpretation | 15 | | | | |
| Invalid input and overwrite boundaries | 15 | | | | |
| Learner recording and facilitator review | 15 | | | | |
| Cleanup and handoff | 5 | | | | |
| **Total proposed rehearsal block** | **75** | | | | |
| Break/lunch/room/admin (separate) | — | | | | |

## Stage record

Record actual commands, paths, output, exit codes, and help requests. Do not write only
“done” and do not copy expected instructor observations into the learner record.

| Stage | Command or learner action | Actual observation | Exit code/status | Evidence location | Help needed |
| --- | --- | --- | ---: | --- | --- |
| Safety and synthetic-only briefing | | | | | |
| Prepare fresh temporary path | | | | | |
| Generate JSON fixture | | | | | |
| Analyze JSON | | | | | |
| Generate/analyze CSV | | | | | |
| Record original/UTC/tie observations | | | | | |
| Discuss source conflict/gaps | | | | | |
| Run invalid input copy | | | | | |
| Check existing output/input collision | | | | | |
| Record hash roles | | | | | |
| Cleanup exact owned path | | | | | |

## Observation coverage

| Required observation | Actual evidence location | Observed? | Notes or limitation |
| --- | --- | --- | --- |
| Fixture creation, observed event, and analysis run times kept distinct | | [ ] | |
| Original timestamp and source/event meaning preserved | | [ ] | |
| Offset normalization produces UTC values | | [ ] | |
| Same UTC instant is not treated as known event order | | [ ] | |
| Deterministic tie-break is explained as display-only | | [ ] | |
| Potential source conflict is not called confirmed tampering | | [ ] | |
| Clock skew/accuracy limitation is stated | | [ ] | |
| Invalid/missing timezone is rejected or recorded as not run | | [ ] | |
| Input order/format comparison is explained within documented scope | | [ ] | |
| Original input and existing output are preserved | | [ ] | |
| `input_sha256` role recorded | | [ ] | |
| `deterministic_result_sha256` role recorded | | [ ] | |
| `report_bytes_sha256` role recorded | | [ ] | |
| Hash limits on authenticity/legal proof stated | | [ ] | |
| Additional evidence request names a source and question | | [ ] | |
| No real disk/OS timestamp/credential/network/DB was used | | [ ] | |

## Help and blockage log

| Time | Learner | Stage | Attempt | Help/request | Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |

## Stop, recovery, and cleanup record

| Event | Actual command/path | What was preserved | Recovery action | Final result |
| --- | --- | --- | --- | --- |
| Real/outside path detected | | | | |
| Original modification risk | | | | |
| Existing output overwrite attempt | | | | |
| Platform-specific link/reparse case unavailable | | | | |
| Cleanup rejection | | | | |

| Cleanup field | Record |
| --- | --- |
| Exact temporary path created by this run | |
| Exact cleanup command | |
| Cleanup exit code/output | |
| Path remains? | |
| Repository and pre-existing reports preserved? | |

Clean only the exact temporary directory created for this rehearsal. If a cleanup command is
rejected, leave the path in place and report the error instead of using a broad delete.

## Learner feedback

| Prompt | Learner record |
| --- | --- |
| Which step was clearest? | |
| Which step was most difficult? | |
| Where was help requested? | |
| What expected result differed from the actual output? | |
| Which boundary needs clearer wording? | |
| What command or link should be corrected? | |
| Would a future rehearsal need more or less time? Give observed evidence. | |

## Facilitator change log

Do not silently change the canonical lab, Foundation, or runtime. Record proposed wording or
implementation issues separately.

| File/section | Observed issue | Reproduction/evidence | Proposed documentation change | Code/canonical impact |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |
| | | | | |

## Handoff

| Question | Record |
| --- | --- |
| Which cases were actually run? | |
| Which cases need another OS/permission environment? | |
| Which rubric evidence is still missing? | |
| What follow-up documentation is proposed? | |
| Next owner/action | |

Do not write `delivery READY` based on this form. It is a future rehearsal record, not an
approval, publication, canonical registration, or Foundation status artifact.
