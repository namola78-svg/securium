# Production Rollback Drill

This drill is for SECURIUM production release readiness. It documents the rollback decision path without executing production deployment, database migration, seed, or secret changes.

## Purpose

Rollback must be boring, fast, and explicit. If a production release causes authentication, privacy, data integrity, or core learning flow failure, the team should know which action to take before the incident happens.

## Do not execute from this document

- Do not run production migrations.
- Do not run production seed scripts.
- Do not rotate secrets.
- Do not change Supabase policies.
- Do not trigger a Vercel production deployment without explicit owner approval.

## Roles

| Role | Responsibility | Assigned |
| --- | --- | --- |
| Release owner | Makes GO / CONDITIONAL GO / NO-GO decision. | TBD |
| Rollback owner | Executes approved rollback action. | TBD |
| Verification owner | Runs smoke checks after rollback. | TBD |
| Communication owner | Records user-facing and internal status. | TBD |

## Rollback trigger matrix

| Trigger | Severity | Default decision |
| --- | --- | --- |
| Login or logout broken | P0 | Rollback |
| Logged-out user can view protected content | P0 | Rollback |
| User data leaks across accounts | P0 | Rollback |
| Course progress mixes across courses | P0 | Rollback |
| Admin route accessible to non-admin user | P0 | Rollback |
| Practice submission corrupts scoring or attempts | P1 | Rollback unless hotfix is already verified |
| AI exposes sensitive prompt, secret, or raw answer data | P0 | Rollback |
| Production DB writes fail broadly | P0 | Rollback |
| Public marketing copy issue | P3 | No rollback; patch later |
| Minor responsive layout issue with workaround | P2/P3 | Conditional GO or follow-up patch |

## Vercel rollback checklist

Use this checklist only after rollback is approved by the release owner.

| Step | Expected evidence | Result |
| --- | --- | --- |
| Identify last known good deployment | Deployment URL and commit recorded. | TBD |
| Confirm target project | SECURIUM production project selected. | TBD |
| Promote or alias previous deployment | Production alias points to last known good deployment. | TBD |
| Confirm production URL | `https://securium.vercel.app` loads expected version. | TBD |
| Run auth smoke | Login, logout, protected redirect pass. | TBD |
| Run learner smoke | Dashboard, course, learn, practice render. | TBD |
| Run admin smoke | Admin dashboard and critical consoles render. | TBD |
| Record evidence | Evidence log updated. | TBD |

## Database rollback policy

Database rollback is not automatic.

If a production migration was involved, stop and record:

- Migration name.
- Whether the migration was destructive.
- Whether a pre-migration backup exists.
- Whether forward-fix is safer than rollback.
- Whether restore testing has been completed.

Do not attempt production database restore from this UI release drill.

## Post-rollback smoke test

Run the minimum checks below:

1. `/`
2. `/courses`
3. `/login`
4. `/dashboard`
5. `/my-courses`
6. `/learn/information-security-engineer`
7. `/practice`
8. `/admin`
9. `/admin/curriculum`
10. Logout and protected route redirect

## Incident record template

```text
Incident:
Detected at:
Detected by:
Release commit:
Bad deployment:
Rollback target:
Decision:

Impact:
- 

Action taken:
- 

Verification:
- 

Follow-up:
- 
```
