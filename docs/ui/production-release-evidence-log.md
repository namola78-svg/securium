# Production Release Evidence Log

Use this file to record evidence from the final SECURIUM production smoke test and release decision.

Production URL:

`https://securium.vercel.app`

## Release identity

| Item | Value |
| --- | --- |
| Candidate commit | TBD |
| Vercel deployment URL | TBD |
| Production alias | `https://securium.vercel.app` |
| Release window | TBD |
| Tester | TBD |
| Decision owner | TBD |
| Rollback owner | TBD |

## Environment confirmation

Record only names, presence, and configuration status. Do not paste secret values.

| Area | Expected | Evidence | Result |
| --- | --- | --- | --- |
| Supabase project | Production project selected. | TBD | TBD |
| Supabase Site URL | Production URL configured. | TBD | TBD |
| Supabase Redirect URLs | Production callback and allowed paths configured. | TBD | TBD |
| Vercel environment | Production variables present. | TBD | TBD |
| Database provider | Intended provider selected. | TBD | TBD |
| Migration status | Approved and applied, deferred, or not required. | TBD | TBD |
| Seed status | Approved and applied, deferred, or not required. | TBD | TBD |

## Smoke test evidence

| Scenario | Evidence | Result | Notes |
| --- | --- | --- | --- |
| Public landing page | TBD | TBD | |
| Course list | TBD | TBD | |
| Course detail | TBD | TBD | |
| Login with no `return_to` | TBD | TBD | |
| Login with safe `return_to` | TBD | TBD | |
| Unsafe `return_to` fallback | TBD | TBD | |
| Authenticated `/login` redirect | TBD | TBD | |
| Logout | TBD | TBD | |
| Learner dashboard | TBD | TBD | |
| My courses | TBD | TBD | |
| Course learning path | TBD | TBD | |
| Practice flow | TBD | TBD | |
| Wrong notes | TBD | TBD | |
| Review queue | TBD | TBD | |
| Analytics | TBD | TBD | |
| Admin dashboard | TBD | TBD | |
| Admin curriculum tree | TBD | TBD | |
| Coverage inspector | TBD | TBD | |
| Ontology inspector | TBD | TBD | |
| AI explainability inspector | TBD | TBD | |
| Content revisions inspector | TBD | TBD | |

## Mobile evidence

| Viewport | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 390 × 844 | TBD | TBD | |
| 768 × 1024 | TBD | TBD | |

## Issue log

| ID | Severity | Area | Summary | Decision |
| --- | --- | --- | --- | --- |
| TBD | TBD | TBD | TBD | TBD |

Severity guide:

- P0: Blocks release or exposes sensitive data.
- P1: Major authenticated user or admin flow is broken.
- P2: Important but workaround exists.
- P3: Cosmetic, copy, or minor usability issue.

## Release decision

Decision:

- GO
- CONDITIONAL GO
- NO-GO

Rationale:

TBD

Follow-up owner:

TBD
