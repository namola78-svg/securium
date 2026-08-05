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

## Browser QA evidence — 2026-08-05

Environment:

- URL: `https://securium.vercel.app`
- Browser surface: Codex in-app browser
- Session state: authenticated administrator session was already present
- Secret/cookie inspection: not performed

| Scenario | Evidence | Result | Notes |
| --- | --- | --- | --- |
| `/` while authenticated | Redirected to `/dashboard`; dashboard title rendered. | PASS | Public logged-out landing still requires separate clean-session check. |
| `/courses` | Final path `/courses`; title `과정 목록 \| SECURIUM`; no page error state. | PASS | |
| `/courses/information-security-engineer` | Final path matched; heading `정보보안기사`; no page error state. | PASS | |
| `/guide` | Final path `/guide`; heading `시큐리움 학습 가이드`; no page error state. | PASS | |
| `/about` | Final path `/about`; heading `시큐리움 \| SECURIUM`; no page error state. | PASS | |
| Authenticated `/login` | Redirected to `/dashboard`; login form not shown. | PASS | |
| `/dashboard` | Dashboard rendered authenticated content with no page error state. | PASS | |
| `/my-courses` | Heading `내 학습`; no page error state. | PASS | |
| `/learn/information-security-engineer` | Heading `정보보안기사`; no page error state. | PASS_WITH_WARNING | Server log review recommended because browser console retained a production Server Components error from the QA session. |
| `/practice` | Heading `문제풀이`; no page error state. | PASS | |
| `/wrong-notes` | Heading `오답노트`; no page error state. | PASS | |
| `/reviews` | Heading `오늘의 복습`; no page error state. | PASS | |
| `/analytics` | Heading `통합 학습분석`; no page error state. | PASS_WITH_WARNING | Browser console captured `SECURIUM_PAGE_ERROR`; verify Vercel server logs. |
| `/admin/coverage` | Admin Console Shell rendered; no page error state. | PASS | |
| `/admin/ontology` | Admin Console Shell rendered; sparse body but no page error state. | PASS_WITH_WARNING | Confirm expected empty or sparse state with admin owner. |
| `/admin/ai-explainability` | Admin Console Shell rendered; no page error state. | PASS | |
| `/admin/content-revisions` | Admin Console Shell rendered; no page error state. | PASS | |
| `/admin/curriculum` | Global error state: `정보를 불러오지 못했습니다`. | FAIL | P1 candidate: see `PROD-QA-001`. |
| `/admin/audit-logs` | Global error state: `정보를 불러오지 못했습니다`. | FAIL | P1 candidate: see `PROD-QA-002`. |

## Mobile evidence

| Viewport | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 390 × 844 | TBD | TBD | |
| 768 × 1024 | TBD | TBD | |

## Issue log

| ID | Severity | Area | Summary | Decision |
| --- | --- | --- | --- | --- |
| PROD-QA-001 | P1 | Admin Curriculum | `/admin/curriculum` fails in production with global error state. | NO-GO until fixed or explicitly accepted with workaround. |
| PROD-QA-002 | P1 | Admin Audit Logs | `/admin/audit-logs` fails in production with global error state. | NO-GO until fixed or explicitly accepted with workaround. |

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
