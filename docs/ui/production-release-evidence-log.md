# Production Release Evidence Log

Use this file to record evidence from the final SECURIUM production smoke test and release decision.

Production URL:

`https://securium.vercel.app`

## Release identity

| Item | Value |
| --- | --- |
| Candidate commit | `c12f26b` |
| Candidate Vercel deployment URL | `https://securium-2ffwathha-namola78-svgs-projects.vercel.app` |
| Evidence documentation commit | `99fd68a` |
| Evidence documentation deployment URL | `https://securium-ppc8gs33r-namola78-svgs-projects.vercel.app` |
| Production alias | `https://securium.vercel.app` |
| Release window | 2026-08-07 |
| Tester | Codex browser + local test suite |
| Decision owner | Owner approval pending |
| Rollback owner | Pending assignment |

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

## Browser QA evidence — 2026-08-07

Environment:

- URL: `https://securium.vercel.app`
- Candidate commit: `c12f26b`
- Vercel deployment: `https://securium-2ffwathha-namola78-svgs-projects.vercel.app`
- Evidence documentation commit: `99fd68a`
- Latest production deployment after evidence update: `https://securium-ppc8gs33r-namola78-svgs-projects.vercel.app`
- Browser surface: Codex in-app browser
- Session state: authenticated administrator session was already present
- Secret/cookie inspection: not performed

| Scenario | Evidence | Result | Notes |
| --- | --- | --- | --- |
| `/` while authenticated | Redirected to `/dashboard`; dashboard heading rendered. | PASS | Logged-out landing still requires clean-session owner QA if needed. |
| `/courses` | Course comparison page rendered without error. | PASS | |
| `/dashboard` | Learner dashboard rendered next action and course summary. | PASS | |
| `/my-courses` | Enrolled courses rendered with separated progress. | PASS | |
| `/learn/information-security-engineer` | Course learning path rendered. | PASS | |
| `/practice/information-security-engineer?random=1&count=10` | Engineer practice page rendered. | PASS | |
| `/practice/information-security-industrial-engineer?random=1&count=10` | Industrial engineer practice page rendered. | PASS | |
| `/wrong-notes` | Empty wrong-note state rendered safely. | PASS | |
| `/reviews` | Empty review state rendered safely. | PASS | |
| `/analytics` | Sparse analytics state rendered without error. | PASS | |
| `/admin` | Admin Console Shell rendered after loading. | PASS | |
| `/admin/curriculum` | Admin Console Shell and curriculum route rendered without global error. | PASS | Resolves `PROD-QA-001`. |
| `/admin/audit-logs` | Audit logs route rendered without `DATABASE_TIMEOUT` or global error. | PASS | Resolves `PROD-QA-002`. |
| `/admin/coverage` | Coverage console rendered. | PASS | |
| `/admin/ontology` | Ontology console rendered. | PASS | |
| `/admin/ai-reviews` | AI review console rendered. | PASS | |
| `/admin/content-revisions` | Content revisions console rendered. | PASS | |

## Automated verification — 2026-08-07

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run typecheck` | PASS | No TypeScript errors. |
| `npm.cmd run lint` | PASS | No ESLint failures. |
| `npm.cmd run test:unit` | PASS | 307 tests passed. |
| `npm.cmd run test:e2e` | PASS | 80 tests passed; includes production build. |
| `npm.cmd run build` | PASS | Verified before deployment; `test:e2e` also rebuilt successfully. |

## Mobile evidence — 2026-08-07

| Viewport | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 360 × 800 | `/`, `/courses`, `/dashboard` rendered with no horizontal overflow. | PASS | Dashboard review CTA touch target improved to 44px. |
| 390 × 844 | `/`, `/courses`, `/dashboard`, `/practice/information-security-engineer` rendered with no horizontal overflow. | PASS | |
| 768 × 1024 | `/`, `/courses`, `/dashboard`, `/practice/information-security-engineer` rendered with no horizontal overflow. | PASS | |

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
| PROD-QA-001 | P1 | Admin Curriculum | `/admin/curriculum` previously failed in production with global error state. | RESOLVED on 2026-08-07; production smoke PASS on `c12f26b`. |
| PROD-QA-002 | P1 | Admin Audit Logs | `/admin/audit-logs` previously failed in production with global error state. | RESOLVED on 2026-08-07; production smoke PASS on `c12f26b`. |

Severity guide:

- P0: Blocks release or exposes sensitive data.
- P1: Major authenticated user or admin flow is broken.
- P2: Important but workaround exists.
- P3: Cosmetic, copy, or minor usability issue.

## Release decision

Decision:

- CONDITIONAL GO

Rationale:

No open P0/P1 remains after 2026-08-07 production smoke. Remaining items are
owner assignments and accepted P2/P3 operational or polish risks.

Follow-up owner:

Owner approval pending
