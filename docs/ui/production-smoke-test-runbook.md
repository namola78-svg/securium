# Production Smoke Test Runbook

This runbook is for the final SECURIUM production smoke test. Use it immediately before and after a production release.

Target production URL:

`https://securium.vercel.app`

## Safety rules

- Do not run production migrations from this checklist.
- Do not run production seed scripts from this checklist.
- Do not reveal or paste secrets into tickets, logs, screenshots, or docs.
- Use prepared test accounts only.
- Keep destructive admin actions out of smoke testing.
- If a P0 issue appears, stop the release and record the rollback decision.

## Pre-release checks

| Check | Expected | Result |
| --- | --- | --- |
| Candidate commit recorded | Exact commit is written in release candidate doc. | TBD |
| GitHub main is clean | Intended commit is pushed. | TBD |
| Vercel deployment ready | Latest production deployment matches candidate commit. | TBD |
| Supabase Auth Site URL | Production URL is configured. | TBD |
| Supabase Redirect URLs | Production login callback is configured. | TBD |
| Production env values | Names confirmed in provider UI without exposing values. | TBD |
| DB migration decision | Approved, deferred, or not required. | TBD |
| Seed decision | Approved, deferred, or not required. | TBD |
| Rollback owner | Assigned. | TBD |
| Monitoring owner | Assigned. | TBD |

## Public smoke tests

| Route | Expected result | Result |
| --- | --- | --- |
| `/` | SECURIUM landing page, hero CTA, and course preview render. | TBD |
| `/courses` | Course cards render without internal development copy. | TBD |
| `/courses/information-security-engineer` | Course detail, curriculum summary, and CTA render. | TBD |
| `/guide` | Learning guide renders. | TBD |
| `/about` | SECURIUM introduction renders. | TBD |

## Authentication smoke tests

| Flow | Expected result | Result |
| --- | --- | --- |
| Logged-out `/dashboard` | Redirects to `/login?return_to=/dashboard`. | TBD |
| Login without `return_to` | Lands on `/dashboard`. | TBD |
| Login with safe `return_to` | Lands on the requested internal path. | TBD |
| Login with unsafe `return_to` | Falls back to safe default route. | TBD |
| Authenticated `/login` | Redirects away from login form to dashboard. | TBD |
| Logout | Session clears and UI switches to logged-out state. | TBD |
| Back after logout | Protected content is not shown. | TBD |

## Learner smoke tests

| Route or task | Expected result | Result |
| --- | --- | --- |
| `/dashboard` | Next action and active courses render. | TBD |
| `/my-courses` | Enrolled courses and separated progress render. | TBD |
| `/learn/information-security-engineer` | Official curriculum path and CourseLesson progress render. | TBD |
| Open a CourseLesson | Lesson body and progress action render. | TBD |
| `/practice` | Course-scoped practice entry renders. | TBD |
| Submit a practice answer | Answer is graded once and explanation timing is correct. | TBD |
| AI explanation | AI content is marked reference-only. | TBD |
| `/wrong-notes` | Empty or populated state is understandable. | TBD |
| `/reviews` | Review queue or empty state is understandable. | TBD |
| `/analytics` | Sparse data and zero denominators do not break the page. | TBD |

## Admin smoke tests

| Route | Expected result | Result |
| --- | --- | --- |
| `/admin` | Admin Console Shell renders. | TBD |
| `/admin/curriculum` | Official tree, stable key, source metadata, and inspector render. | TBD |
| `/admin/coverage` | Coverage queue and inspector render. | TBD |
| `/admin/ontology` | Ontology explorer and inspector render. | TBD |
| `/admin/ai-explainability` | Trace metrics, retrieval context, and inspector render. | TBD |
| `/admin/content-revisions` | Revision list, impact, and inspector render. | TBD |
| `/admin/question-reports` | Report queue and inspector render. | TBD |
| `/admin/audit-logs` | Audit filters and detail render; no edit/delete route appears. | TBD |

## Mobile smoke tests

Viewports:

- 390px × 844px
- 768px × 1024px

| Check | Expected result | Result |
| --- | --- | --- |
| Header | Logo, menu button, and command palette access fit without horizontal scroll. | TBD |
| Mobile menu open | Background scroll locks and `aria-expanded` updates. | TBD |
| Mobile menu close | Close button and Escape close the menu. | TBD |
| Course cards | Cards stack cleanly. | TBD |
| Learner dashboard | Cards and CTA remain readable. | TBD |
| Admin inspector | Inspector stacks or collapses without hiding primary content. | TBD |

## Rollback decision

Rollback if any of the following are observed:

- Login or logout fails for normal users.
- Protected content remains visible after logout.
- Admin route becomes accessible to non-admin users.
- Course enrollment creates duplicate records.
- Practice submission corrupts scores, wrong notes, or analytics.
- AI or admin pages expose prompts, secrets, tokens, or raw sensitive answers.
- Production database writes broadly fail.

## Result summary

```text
Release:
Commit:
Tester:
Started:
Completed:

Public smoke:
Auth smoke:
Learner smoke:
Admin smoke:
Mobile smoke:

Open P0:
Open P1:
Open P2:
Open P3:

Decision:
Notes:
```

