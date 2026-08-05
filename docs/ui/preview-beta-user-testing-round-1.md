# Preview Beta User Testing Round 1

Date: TBD  
Environment: `https://securium.vercel.app`  
Baseline: `b4c3961 Prepare UI preview beta readiness` or newer approved freeze commit  
Facilitator: TBD

This document is the working log for the first guided Preview Beta user testing round.

## Goals

Round 1 focuses on whether SECURIUM is understandable, trustworthy, and action-oriented for both learners and administrators.

Primary questions:

1. Can learners understand what SECURIUM is within the first screen?
2. Can learners choose a course and identify the next study action?
3. Can learners distinguish official curriculum, practice content, and AI-generated support?
4. Can administrators understand the Console Shell and Inspector pattern?
5. Can administrators move between Coverage, Ontology, AI Trace, and Content Revisions without a separate map?

## Test accounts

Do not write passwords, tokens, OAuth secrets, or recovery codes in this file.

| Account type | Status | Notes |
| --- | --- | --- |
| Learner | Not recorded | Use a prepared non-admin account. |
| Admin | Not recorded | Use a prepared admin account with read-only test behavior where possible. |

## Participants

| ID | Role | Background | Device | Session date | Status |
| --- | --- | --- | --- | --- | --- |
| P01 | Learner | TBD | Desktop | TBD | Planned |
| P02 | Learner | TBD | Mobile | TBD | Planned |
| P03 | Admin | TBD | Desktop | TBD | Planned |

## Learner observations

| Task | Pass/Fail | Notes | Issue ID |
| --- | --- | --- | --- |
| Explain the home page value proposition | TBD |  |  |
| Compare courses and choose one | TBD |  |  |
| Open course detail and explain the CTA | TBD |  |  |
| Identify the next dashboard action | TBD |  |  |
| Open curriculum and understand official source metadata | TBD |  |  |
| Find practice questions | TBD |  |  |
| Identify AI explanation as reference-only | TBD |  |  |
| Understand wrong note or review empty state | TBD |  |  |
| Interpret analytics sparse-data state | TBD |  |  |

## Admin observations

| Task | Pass/Fail | Notes | Issue ID |
| --- | --- | --- | --- |
| Understand Console Shell navigation | TBD |  |  |
| Inspect Curriculum source, stable key, and coverage | TBD |  |  |
| Inspect Coverage gap queue | TBD |  |  |
| Inspect Ontology concept and relations | TBD |  |  |
| Inspect AI Explainability trace | TBD |  |  |
| Inspect Content Revision impact | TBD |  |  |
| Inspect Question Reports queue | TBD |  |  |

## Issue log

| ID | Severity | Role | Route | Summary | Status | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| UXR1-001 | TBD | TBD | TBD | TBD | Open | TBD |

Severity guide:

- P0: Blocks login, data isolation, protected routes, or core learning access.
- P1: Blocks course start, curriculum navigation, practice, or critical admin review.
- P2: Causes confusion but has a workaround.
- P3: Polish, copy, spacing, or lower-risk comprehension issue.

## Decision log

| Decision | Owner | Date | Notes |
| --- | --- | --- | --- |
| Start Round 1 user testing | TBD | TBD | Requires freeze baseline and test accounts. |

## Exit criteria

Round 1 is complete when:

- At least two learner sessions and one admin session are recorded, or the owner explicitly accepts a smaller sample.
- All P0/P1 issues are fixed or accepted with a documented reason.
- P2/P3 issues are logged for post-beta triage.
- Production Release Readiness is updated with the user testing result.

