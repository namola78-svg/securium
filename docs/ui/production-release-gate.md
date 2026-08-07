# Production Release Gate

This gate defines the final SECURIUM production release decision. It is intentionally narrow: it does not run migrations, seed data, deployment commands, or secret changes.

## Decision options

| Decision | Meaning | Allowed next step |
| --- | --- | --- |
| GO | All blocking checks passed. | Production release can proceed with owner approval. |
| CONDITIONAL GO | No blocker remains, but minor risks require monitoring or follow-up. | Production release can proceed if listed conditions are accepted. |
| NO-GO | One or more blockers remain. | Stop release and fix blockers first. |

## Mandatory gates

| Gate | GO requirement | Evidence source |
| --- | --- | --- |
| Candidate commit | Exact commit is recorded and pushed. | Release candidate doc, GitHub, Vercel deployment. |
| Working tree | No unintended local changes are pending. | `git status`. |
| Production deployment | Vercel production deployment is ready and mapped to the intended commit. | Vercel dashboard or CLI. |
| Authentication | Login, `return_to`, authenticated `/login`, logout, and protected route redirects pass. | Smoke runbook evidence. |
| Learner core flow | Dashboard, course detail, learning path, practice, review, and analytics render without blockers. | Smoke runbook evidence. |
| Admin core flow | Console Shell, Curriculum, Coverage, Ontology, AI Explainability, Content Revisions, and Audit render without blockers. | Smoke runbook evidence. |
| Data safety | No unapproved production migration, seed, destructive write, or secret change occurred. | Release evidence log. |
| Rollback | Rollback owner and trigger conditions are recorded. | Release readiness doc. |

## Conditional GO examples

A CONDITIONAL GO is acceptable only when all of these are true:

- The issue is not a security, authentication, data integrity, or privacy blocker.
- A user-facing workaround exists or the affected feature is non-critical.
- The owner, deadline, and monitoring plan are recorded.
- The issue is visible in the release evidence log.

Examples:

- Minor copy inconsistency.
- Non-blocking layout issue on an uncommon viewport.
- Admin-only visual polish issue with no data risk.
- Slow but functional non-critical page.

## NO-GO triggers

Use NO-GO if any of the following is observed:

- Login or logout is broken.
- A logged-out user can view protected content.
- Unsafe `return_to` values can redirect outside the platform.
- User-specific learning data leaks across accounts.
- Course-specific progress, questions, wrong notes, reviews, or analytics mix across courses.
- Admin pages are accessible to non-admin users.
- AI prompt, secret, answer raw data, token, or sensitive metadata is exposed.
- Production database writes fail broadly.
- A required migration or seed is missing and has not been explicitly approved.
- The production deployment does not match the intended commit.

## Final decision template

```text
Decision: GO | CONDITIONAL GO | NO-GO

Candidate commit:
Production deployment:
Decision owner:
Rollback owner:
Monitoring owner:

Passed gates:
- 

Conditions or blockers:
- 

Follow-up:
- 
```

## Approved decision - 2026-08-07

```text
Decision: CONDITIONAL GO

Candidate commit: c12f26b
Production deployment: https://securium.vercel.app
Decision owner: namola78-svg
Rollback owner: namola78-svg
Monitoring owner: namola78-svg

Passed gates:
- No open P0/P1 blockers remain after production smoke.
- GitHub main is clean and pushed.
- Latest production deployment is ready.
- Protected routes redirect correctly when logged out.
- Learner and admin core routes render without global error cards.

Conditions or blockers:
- BETA-001 sparse-data loading polish is accepted for beta monitoring.
- BETA-002 mobile Escape close needs real-browser owner QA follow-up.
- BETA-003 local Vercel CLI TLS issue is accepted with documented workaround.

Follow-up:
- Monitor first 5 minutes, first 30 minutes, and first 24 hours after release.
```
