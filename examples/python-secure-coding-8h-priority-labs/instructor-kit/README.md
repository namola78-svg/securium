# Python Secure Coding 8H Instructor Kit

This kit turns the existing M01–M08 local lab guides into a lecture-use
package. It is a facilitation and evidence-recording aid, not a new course
identity, executable lab, runtime registration, certification rubric, or
delivery claim.

Status: SECURIUM_PYTHON_8H_INSTRUCTOR_KIT_READY_FOR_REHEARSAL

The kit was prepared from PR #143 head
7e15ef3ff74306f2d3725c8a8cba1855c83c34c1. The source labs, common README,
manifest, canonical questions, approval state, and revision state are not
changed by this kit.

## Use this package in order

1. Read the [common lab README](../README.md) and the
   [foundation manifest](../../../content-drafts/secure-coding-8h-foundation/manifest.json)
   for authority, scope, commands, compatibility, and delivery limits.
2. Before class, use [rehearsal-checklist.md](rehearsal-checklist.md) to
   prepare the environment and verify that the planned flow is possible.
3. During class, use [instructor-runbook.md](instructor-runbook.md). It links
   each module to its original learner and instructor guide, practical, goals,
   questions, code locations, and focused command.
4. Give learners [learner-verification-workbook.md](learner-verification-workbook.md).
   They should read the original learner guide, record actual code locations
   and observations, and complete a human decision for each module.
5. Use [assessment-rubric.md](assessment-rubric.md) for observable feedback.
   It is not an official exam, pass/fail rule, or platform state calculation.

## Planning time

The following are manifest planning values. They are not measured learner
durations. The 480 minutes are training time only; whether breaks, lunch,
setup, or preparation are included in a local delivery schedule is not decided
here and must be scheduled separately.

| Module | Original module | Python secure coding | AI/Vibe coding | Planned module time |
|---|---|---:|---:|---:|
| M01 | Secure Python and Vibe-Coding Foundations | 45m | 10m | 55m |
| M02 | Input Validation and Interpreter Boundaries | 50m | 15m | 65m |
| M03 | Data Access, Deserialization, and Code Execution | 50m | 15m | 65m |
| M04 | Files, Uploads, and SSRF | 50m | 15m | 65m |
| M05 | Web Output, CSRF, Exceptions, and Logging | 40m | 15m | 55m |
| M06 | Authentication, Authorization, and BOLA/IDOR | 40m | 20m | 60m |
| M07 | Secrets, Dependencies, and Supply-Chain Review | 35m | 20m | 55m |
| M08 | Vibe-Coding Capstone and Human Re-verification | 40m | 20m | 60m |
| **Total** | 8 modules | **350m** | **130m** | **480m** |

Breaks, lunch, room setup, account setup, accessibility support, and
contingency are outside this 480-minute plan and remain to be scheduled by
the delivery owner. No claim is made that a learner or a class has completed
the plan in these durations.

## Source-of-truth map

The kit deliberately references rather than copies the original material.

| Material | Original location |
|---|---|
| Module authority, objectives, practicals, question ranges, timing | [manifest](../../../content-drafts/secure-coding-8h-foundation/manifest.json) |
| Commands, compatibility, delivery boundary | [common README](../README.md) |
| M01 guide and existing record | [M01 learner](../m01_trust_boundary/learner.md), [M01 instructor](../m01_trust_boundary/instructor.md), [M01 record](../m01_trust_boundary/verification-record.md) |
| M02 guide | [M02 learner](../m02_injection/learner.md), [M02 instructor](../m02_injection/instructor.md) |
| M03 guide | [M03 learner](../m03_deserialization/learner.md), [M03 instructor](../m03_deserialization/instructor.md) |
| M04 guide | [M04 learner](../m04_files_ssrf/learner.md), [M04 instructor](../m04_files_ssrf/instructor.md) |
| M05 guide and existing record | [M05 learner](../m05_web_context/learner.md), [M05 instructor](../m05_web_context/instructor.md), [M05 record](../m05_web_context/verification-record.md) |
| M06 guide | [M06 learner](../m06_authorization/learner.md), [M06 instructor](../m06_authorization/instructor.md) |
| M07 guide | [M07 learner](../m07_secrets_dependencies/learner.md), [M07 instructor](../m07_secrets_dependencies/instructor.md) |
| M08 guide and existing record | [M08 learner](../m08_capstone/learner.md), [M08 instructor](../m08_capstone/instructor.md), [M08 record](../m08_capstone/human-review-template.md) |

The common workbook in this directory normalizes the record fields already
requested by M01, M02, M03, M04, M05, M07, and M08 and supplies the same fields
for M06. The runbook calls out the module-specific evidence so no original
record instruction is silently dropped.

## Environment and evidence boundary

Run commands from the lab bundle directory, not from this instructor-kit
directory. The original guides use the standard library and in-memory or
temporary fixtures. Do not add real credentials, install a package, contact an
external service, or turn a fixture into a production claim.

The latest status recorded in the common README reports 50 passing tests on
the Windows PowerShell and Linux Bash matrix with Python 3.11 and 3.14 patch
versions. The earlier 49-test matrix is historical provenance for the
pre-repair bundle. The README separately identifies the local Windows
PowerShell 5.1/Python 3.14.5 baseline. Python 3.12/3.13, macOS, learner
rehearsal, and real browser behavior are not inferred from that matrix.

M05's tests use a Python HTTP client that directly supplies cookie and request
headers to a loopback fixture. This is not browser verification of cookie,
SameSite, form-submission, or Origin behavior. M04 and M08 use loopback or
mocked opener/resolver fixtures; these demonstrate application policy, not
production network egress isolation.

The repository canonical Q36 record now has `answer: 1` (B/2), and #147 merged
the correction with verified immutable revision-boundary checks. Use B/2 for
content discussion and learner reasoning. The default mapping/preflight path
requires `QUESTION_REVISION_CONTEXT_REQUIRED`; only the fixed candidate
context projects Q36-v2. Source/approval remains `UNKNOWN`, candidate
preflight is `BLOCKED`, persistence is `NOT_READY`, and no `humanReviewHash` or
canonical receipt exists. This kit must not describe Q36-v2 as an
authority-issued Runtime revision or claim automated scoring/publication
readiness. It does not issue approval or change Runtime state.

## Integration hand-off

Only the five Markdown files in this directory are intended for the #143
integration hand-off. The common README and module files should remain
unchanged. Suggested link text for the common README:

> For lecture facilitation and learner evidence records, see the Python 8H
> Instructor Kit at instructor-kit/README.md. This kit is ready for rehearsal;
> it does not claim that instructor/student rehearsal or full delivery is
> complete.
