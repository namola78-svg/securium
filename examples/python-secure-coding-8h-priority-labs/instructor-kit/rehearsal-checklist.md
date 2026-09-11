# Rehearsal Checklist: M01–M08

This checklist is for a future instructor/learner rehearsal. The unchecked
items are not a record that rehearsal has happened. Complete each evidence
field with an actual observation when rehearsal is performed.

Status of this kit: SECURIUM_PYTHON_8H_INSTRUCTOR_KIT_READY_FOR_REHEARSAL.
This document does not claim actual instructor/student rehearsal or full
delivery readiness.

## 1. Scope and source control

- [ ] Read the [common README](../README.md).
  Evidence/date: _________________________________________________
- [ ] Read the [manifest](../../../content-drafts/secure-coding-8h-foundation/manifest.json)
  and confirm the eight module IDs, practical IDs, objectives, and question
  ranges.
  Evidence/date: _________________________________________________
- [ ] Read all original learner and instructor guides linked from the
  [kit README](README.md).
  Missing or unclear source: ______________________________________
- [ ] Confirm this rehearsal uses the dedicated worktree/branch and does not
  modify the PR #143 lab worktree, M05 browser work, or Q36 repair branch.
  Worktree/branch checked: ________________________________________
- [ ] Confirm only files under instructor-kit are changed.
  git status --short observation: _________________________________
- [ ] Confirm no canonical content, approval, revision, common README, lab
  code, or CI workflow is being edited.
  Observation: ___________________________________________________

## 2. Time and room plan

The training plan is 480 minutes: M01 55, M02 65, M03 65, M04 65, M05 55,
M06 60, M07 55, M08 60. Category totals are Python secure coding 350 minutes
and AI/Vibe Coding 130 minutes.

- [ ] Add the eight module blocks to the room schedule without changing the
  480-minute training total.
  Schedule reference: _____________________________________________
- [ ] Schedule breaks, lunch, room setup, preparation, accessibility support,
  and contingency separately from the 480 training minutes.
  Separate-time plan: ____________________________________________
- [ ] Do not label planned minutes as measured learner time.
  Facilitator note: ______________________________________________
- [ ] Confirm the module phase allocations in the runbook sum to each module
  and 480 overall.
  Arithmetic check / reviewer: ____________________________________

## 3. Environment and safety

- [ ] Start from the lab bundle directory, not instructor-kit:

~~~powershell
Set-Location <path-to-repository>\examples\python-secure-coding-8h-priority-labs
python --version
~~~

  Observed path/version: __________________________________________
- [ ] Use only the standard-library local fixtures and the original commands.
  Observation: ___________________________________________________
- [ ] Confirm no real credential, .env file, vulnerable package install,
  external AI call, external service, runtime database, or production data is
  used.
  Observation: ___________________________________________________
- [ ] Confirm temporary files, loopback servers, fake sessions, fake provider,
  fake response, and markers are cleaned by the existing tests.
  Observation: ___________________________________________________
- [ ] Record the exact interpreter, OS, shell, and command results used for
  rehearsal:
  - Python: ____________________
  - OS: ________________________
  - Shell: _____________________
  - Date: ______________________

## 4. Existing compatibility record and limits

The common README records the latest matrix as 49 passing tests on Windows
PowerShell and Linux Bash with Python 3.11 and 3.14 patch versions, and
separately records a local Windows PowerShell 5.1/Python 3.14.5 baseline. This
is repository evidence, not a rehearsal result. Python 3.12/3.13, macOS,
learner rehearsal, and browser behavior are not inferred.

- [ ] Compare the rehearsal environment with the recorded matrix.
  Difference: ____________________________________________________
- [ ] If using M05, tell the group that the test sends Cookie and other
  headers through a direct Python HTTP client. Record what real browser
  behavior remains unverified.
  Observation: ___________________________________________________
- [ ] If using M04 or M08, tell the group that loopback/mocked resolver or
  opener evidence is application-policy evidence, not production egress
  isolation.
  Observation: ___________________________________________________

## 5. Module-by-module dry run

For each row, run the focused command from the bundle directory, verify the
facilitation sequence in the runbook, and write the actual observation. The
expected test counts below are a reference for the existing lab files, not a
pre-completed result.

| Module | Focused command | Existing reference count | Run result / observed evidence |
|---|---|---:|---|
| M01 | python -m unittest m01_trust_boundary.test_m01 -v | 5 | |
| M02 | python -m unittest m02_injection.test_m02 -v | 5 | |
| M03 | python -m unittest m03_deserialization.test_m03 -v | 6 | |
| M04 | python -m unittest m04_files_ssrf.test_m04 -v | 6 | |
| M05 | python -m unittest m05_web_context.test_m05 -v | 6 | |
| M06 | python -m unittest m06_authorization.test_m06 -v | 5 | |
| M07 | python -m unittest m07_secrets_dependencies.test_m07 -v | 10 | |
| M08 | python -m unittest m08_capstone.test_m08 -v | 6 | |

### M01 dry-run checks

- [ ] Instructor can point to the request Source, server-owned ViewerContext,
  validation, and response Sink.
  Code/output evidence: ___________________________________________
- [ ] Instructor can explain why the vulnerable private-field assertion is
  intended weakness evidence and can preserve public/authorized behavior.
  Observation: ___________________________________________________
- [ ] Learner workbook has space for locations, output, repair reason, and
  residual limit.
  Observation: ___________________________________________________

### M02 dry-run checks

- [ ] Instructor can distinguish SQL data binding, structural sort allowlist,
  shell argument handling, and expression parsing.
  Code/output evidence: ___________________________________________
- [ ] Instructor can explain injection observations without teaching escaping,
  shell=False alone, or restricted eval globals as complete controls.
  Observation: ___________________________________________________
- [ ] Learner records normal, attack, and boundary evidence.
  Observation: ___________________________________________________

### M03 dry-run checks

- [ ] Instructor keeps request JSON and application-owned migration artifact
  paths separate.
  Code/output evidence: ___________________________________________
- [ ] Instructor can explain the marker observation, bounded schema checks,
  digest/path ownership, and why SQL binding is not provenance.
  Observation: ___________________________________________________
- [ ] Learner records the artifact assumptions and cleanup observation.
  Observation: ___________________________________________________

### M04 dry-run checks

- [ ] Instructor can show the containment postcondition, generated upload name,
  and exact URL policy.
  Code/output evidence: ___________________________________________
- [ ] Instructor labels loopback and mocked opener results as bounded policy
  evidence rather than browser or production network proof.
  Observation: ___________________________________________________
- [ ] Learner records normal file/upload/fetch and rejected boundary cases.
  Observation: ___________________________________________________

### M05 dry-run checks

- [ ] Instructor can identify HTML text encoding, session-bound CSRF
  validation, trusted Origin, state-change Sink, and safe failure paths.
  Code/output evidence: ___________________________________________
- [ ] Instructor records status/body and state before/after for denied
  requests, plus redacted correlation evidence.
  Observation: ___________________________________________________
- [ ] Instructor states explicitly that direct HTTP client verification is not
  real browser verification.
  Observation: ___________________________________________________

### M06 dry-run checks

- [ ] Instructor can draw subject/object/action/tenant policy before object
  lookup and explain default deny.
  Code/output evidence: ___________________________________________
- [ ] Instructor can distinguish BOLA from the explicit same-tenant admin
  exception and from session rotation.
  Observation: ___________________________________________________
- [ ] Learner records old/new session IDs and revocation without treating the
  ID as authorization.
  Observation: ___________________________________________________

### M07 dry-run checks

- [ ] Instructor can trace secret channels and show the narrow fake credential
  sink, stable error, redacted logs, and allowlisted support export.
  Code/output evidence: ___________________________________________
- [ ] Instructor can require owner/path/reachability/upgrade evidence for a
  dependency and source/integrity/owner/build/CI evidence for provenance.
  Observation: ___________________________________________________
- [ ] The instructor records that user approval of the Q36 answer-binding
  correction is complete, while canonical application, immutable revision
  binding, and verification are not confirmed. Q36 remains excluded from
  confirmed-answer use and scoring; no guessed answer is used.
  Observation: ___________________________________________________
- [ ] Instructor records the learning-evaluation impact: O28 can be observed
  through P07 reasoning and evidence, while the Q36 item remains incomplete
  and unscored.
  Observation: ___________________________________________________

### M08 dry-run checks

- [ ] Instructor can trace all four flows: SQL, file, invoice authorization,
  and preview URL.
  Code/output evidence: ___________________________________________
- [ ] Instructor separates attack evidence, normal behavior, regression
  evidence, and the human decision.
  Observation: ___________________________________________________
- [ ] Mocked approved preview is described as policy evidence, not production
  egress proof.
  Observation: ___________________________________________________

## 6. Learner evidence and instructor review

- [ ] Give each learner a blank workbook copy and explain that a checkbox alone
  is insufficient.
  Distribution observation: _______________________________________
- [ ] Confirm each record contains requirements/protected target, trust
  boundary, Source/Validation/Sink locations, prompt, expected vulnerability,
  actual command/observation, repair rationale, normal/attack/regression
  results, limitations, and a human judgment with basis.
  Missing fields: __________________________________________________
- [ ] Review one completed record for exact path/function or line references.
  Record reviewed: _______________________________________________
- [ ] Review one record for actual observed output/state/body/log evidence.
  Record reviewed: _______________________________________________
- [ ] Use the rubric only for observable feedback; do not translate it into
  platform Mastery, Confidence, Skill State, or an official pass mark.
  Observation: ___________________________________________________
- [ ] Confirm no learner answer, success record, or evaluation result was
  prefilled by the kit.
  Observation: ___________________________________________________

## 7. Q36 and delivery decision

- [ ] Confirm the instructor announcement: user approval of the Q36 correction
  is complete, but canonical application, revision binding, and verification
  are pending; Q36 is excluded from confirmed-answer use and item-level scoring.
  Announcement evidence: _________________________________________
- [ ] Confirm the exclusion is recorded as an evaluation limitation and does
  not alter canonical Q36 content.
  Observation: ___________________________________________________
- [ ] Confirm no one describes the package as actual rehearsal complete or
  full delivery ready.
  Observation: ___________________________________________________

## 8. Post-rehearsal record

- Rehearsal date(s):
- Instructor(s):
- Learner count or pilot size:
- Environment(s):
- Modules actually exercised:
- Commands actually run:
- Unexpected failures or timing changes:
- Accessibility or room issues:
- Workbook issues:
- Rubric issues:
- Q36 handling issue:
- Follow-up owner and date:

Final rehearsal disposition:

- [ ] More rehearsal required.
- [ ] Ready for a further controlled pilot.
- [ ] Blocked pending a named correction.

Basis and evidence:

______________________________________________________________________________
