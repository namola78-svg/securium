# Preview Beta QA Results

Date: 2026-08-05  
Target: `https://securium.vercel.app`  
Commit verified locally: `b4c3961 Prepare UI preview beta readiness`

This report records the first Preview Beta readiness QA pass after UI-6. It is intentionally limited to UI, navigation, rendered page state, and existing automated checks. No production data changes were performed.

## Scope

### Included

- Public landing page and public navigation.
- Learner routes while authenticated in the browser session.
- Admin console routes while authenticated as an administrator in the browser session.
- Mobile navigation at 390px.
- Local automated validation.

### Excluded

- Production DB migration.
- Production seed.
- Preview DB mutation.
- Secret or environment variable changes.
- Vercel deployment creation.
- Google OAuth credential submission.
- Destructive admin actions.

## Automated checks

| Check | Result | Notes |
| --- | --- | --- |
| Unit tests | Pass | 289 / 289 passed during `npm.cmd run test` before the command timeout. |
| E2E tests | Pass | 80 / 80 passed via `npm.cmd run test:e2e`. |
| Typecheck | Pass | `npm.cmd run typecheck`. |
| Lint | Pass | `npm.cmd run lint`. |
| Production build | Pass | `npm.cmd run build`. |
| Full `npm.cmd run test` wrapper | Inconclusive | Timed out at 180 seconds, but unit tests had passed and E2E passed when rerun with a longer timeout. |

Known local warning:

- `NODE_EXTRA_CA_CERTS` points to `C:\path\to\company-root-ca.pem`, which produces a local certificate warning. It did not fail tests or builds, but should be cleaned before release verification.

## Operating environment checks

| Area | Result | Notes |
| --- | --- | --- |
| Git status | Pass | Local `main` was clean and aligned with `origin/main`. |
| Vercel CLI status check | Blocked | Local network/TLS layer returned `connect EACCES ...:443`. Browser-based production page checks were used instead. |
| Production URL access | Pass | `https://securium.vercel.app` rendered current SECURIUM UI in the browser. |

## Public route QA

| Route | Result | Observations |
| --- | --- | --- |
| `/` | Pass | SECURIUM brand, hero CTA, value proposition, and 7-course catalog rendered. No `Shield Academy`, `Phase 1`, or public development sample copy observed. |
| `/courses` | Pass | Course comparison cards rendered with course name, audience, learning composition, period, status, and CTA. |
| `/guide` | Pass | Learning guide page rendered with SECURIUM header and learner onboarding content. |
| `/about` | Pass | SECURIUM introduction page rendered with mission and principles. |
| `/login` while authenticated | Pass | Redirected to `/dashboard`; login form was not shown. |

## Learner route QA

| Route | Result | Observations |
| --- | --- | --- |
| `/dashboard` | Pass | Learner overview rendered with active course summary and today's plan. |
| `/my-courses` | Pass | Enrolled courses rendered with course-separated progress actions. |
| `/learn/information-security-engineer` | Pass | Official curriculum, CourseLesson routing, progress summary, and curriculum inspector rendered. |
| `/practice` | Pass | Course-scoped practice entry rendered. |
| `/wrong-notes` | Pass | Empty wrong-note state rendered without error. |
| `/reviews` | Pass | Empty review schedule state rendered without error. |
| `/ai-tutor` | Pass | AI tutor guidance rendered with reference-only AI disclaimer. |
| `/analytics` | Pass | Sparse-data analytics state rendered after initial loading state. |

## Admin route QA

| Route | Result | Observations |
| --- | --- | --- |
| `/admin/curriculum` | Pass | Console navigation, curriculum metrics, ACTIVE official trees, linked content area, and inspector rendered after initial loading. |
| `/admin/coverage` | Pass | Console shell and coverage navigation rendered. |
| `/admin/ontology` | Pass | Console shell and ontology navigation rendered. |
| `/admin/ai-explainability` | Pass | Console shell, AI trace summary, metrics, and inspector-oriented layout rendered after initial loading. |
| `/admin/content-revisions` | Pass | Console shell and content revision navigation rendered. |

## Mobile QA

Viewport: 390px × 844px

| Check | Result | Notes |
| --- | --- | --- |
| Horizontal overflow | Pass | `documentElement.scrollWidth` matched viewport width. |
| Menu button label | Pass | Mobile menu button exposed `aria-label="메뉴 열기"`. |
| Menu expanded state | Pass | Menu button exposed `aria-expanded`. |
| Background scroll lock | Pass | Body overflow changed to `hidden` while mobile menu was open. |
| Authenticated menu content | Pass | Learner links, account links, admin link, and logout action rendered. |
| Escape close | Needs manual confirmation | The in-app browser input target rejected the synthetic `Escape` keypress. Use a real browser keyboard check before Production Release. |

## Issues and risks

| Severity | Item | Status |
| --- | --- | --- |
| P2 | Some pages show loading text for around 1-5 seconds before content is ready. | Accepted for Preview Beta; monitor perceived performance. |
| P2 | Vercel CLI cannot be used from this local session due to network/TLS `EACCES`. | Use Vercel dashboard for deployment status or fix local corporate/root CA configuration. |
| P3 | Mobile Escape-close behavior could not be confirmed through the in-app browser automation. | Manual keyboard QA required. |
| P3 | Full `npm.cmd run test` wrapper exceeded 180 seconds in the Codex tool timeout. | Increase timeout in local/CI contexts; underlying unit and E2E suites passed separately. |

## Preview Beta Freeze decision

Decision: GO for Preview Beta Freeze.

Conditions before user testing:

1. Confirm the latest Vercel deployment is based on `b4c3961` or a newer approved commit.
2. Manually verify Google login and logout in a real browser.
3. Manually verify mobile menu Escape behavior.
4. Keep production DB, seed, migration, and secret changes frozen unless separately approved.

