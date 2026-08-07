# Production Monitoring Checklist

This checklist defines what to watch after a SECURIUM production release. It does not require production database changes, seed changes, secret changes, or deployment commands.

## Monitoring windows

| Window | Goal | Owner | Result |
| --- | --- | --- | --- |
| First 5 minutes | Confirm the release is reachable and authentication still works. | `namola78-svg` | PASS on 2026-08-07 |
| First 30 minutes | Confirm learner and admin core flows remain stable. | `namola78-svg` | Pending monitoring window |
| First 24 hours | Watch for delayed auth, DB, AI, and analytics issues. | `namola78-svg` | Pending monitoring window |

## First 5 minutes

| Check | Expected | Result |
| --- | --- | --- |
| Production URL | `https://securium.vercel.app` loads. | PASS |
| Public landing page | Hero, CTA, and navigation render. | PASS |
| Login | User can sign in. | Not rerun during this 5-minute check; authenticated session remained valid |
| Logout | User can sign out and protected pages redirect. | Not rerun during this 5-minute check; protected logged-out redirects passed by HTTP smoke |
| Vercel deployment status | Latest production deployment remains ready. | PASS - `https://securium-cyyuvvntq-namola78-svgs-projects.vercel.app` |
| Error spike | No obvious 5xx spike in hosting logs. | PASS - browser console errors were not observed; hosting log review not performed |

## First 30 minutes

| Check | Expected | Result |
| --- | --- | --- |
| Course list | Courses render without internal development copy. | TBD |
| Course detail | CTA state is correct for logged-out, logged-in, and enrolled users. | TBD |
| Learner dashboard | User-specific content renders. | TBD |
| Learn overview | CourseLesson progress and curriculum render. | TBD |
| Practice | Answer submission works once. | TBD |
| Review / wrong notes | Empty and populated states render safely. | TBD |
| Analytics | Sparse data does not break charts or summaries. | TBD |
| Admin dashboard | Admin Console Shell renders only for authorized users. | TBD |
| Admin curriculum | Tree and inspector render. | TBD |

## First 24 hours

| Check | Expected | Result |
| --- | --- | --- |
| Auth logs | No repeated callback, redirect, or session errors. | TBD |
| API errors | No repeated learner or admin endpoint failure. | TBD |
| Database errors | No broad read/write failure. | TBD |
| Slow pages | No critical page consistently exceeds acceptable latency. | TBD |
| AI requests | AI failures are safe and marked as unavailable or reference-only. | TBD |
| Audit logs | Important admin actions are recorded without sensitive values. | TBD |
| User feedback | Reported issues are triaged. | TBD |

## Signals to capture

Record links or summaries only. Do not paste tokens, cookies, secrets, full request bodies, or raw user answers.

- Vercel deployment URL.
- Vercel function error summary.
- Supabase Auth error summary.
- Database error summary.
- Browser console error summary.
- User-reported issue summary.
- Screenshot path or ticket link if safe.

## Escalation

Use the Production Rollback Drill if any P0 or unresolved P1 issue appears.

P0 examples:

- Login or logout broken.
- Protected content visible after logout.
- Cross-user data exposure.
- Admin access bypass.
- Sensitive AI, prompt, token, or secret exposure.

P1 examples:

- Course enrollment fails broadly.
- Practice submission creates duplicate or corrupted results.
- Curriculum or dashboard fails for most users.
- Admin core console cannot load.

## Monitoring result template

```text
Release:
Commit:
Deployment:
Monitoring owner:

`namola78-svg`

5-minute result:
- PASS on 2026-08-07. Production URL, public routes, logged-out protected redirects, authenticated dashboard, admin curriculum, and admin audit logs were checked. No global error card or browser console error was observed.

30-minute result:
- 

24-hour result:
- 

Issues:
- 

Decision:
GO | CONDITIONAL GO | ROLLBACK REQUIRED
```
